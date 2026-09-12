import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, conflict, notFound } from "@/lib/errors";
import { computePriority, priorityRank } from "@/lib/domain/priority";
import { statusChangeCountsAsFirstResponse } from "@/lib/domain/first-response";
import { transition, type TicketAction, type TransitionInput } from "@/lib/domain/ticket-machine";
import { CLIENT_STATUS_LABEL, OPEN_STATUSES, STAFF_STATUS_LABEL, type Level3, type LinkKindT, type Priority, type TicketStatus, type TicketType, type WorkState } from "@/lib/domain/types";
import { firstName } from "@/lib/utils";
import { logAccessDenied } from "./audit";
import { emitEvent, listEvents } from "./events";
import { notifyInTx, staffUserIdsByRole } from "./notifications";
import { orgSettingsFor } from "./orgs";
import { applySlaEffects, policyForOrg, retargetTimers, startTimers, timersForTicket, extendTimer } from "./sla";

const requester = alias(schema.users, "requester");
const assignee = alias(schema.users, "assignee");
const frTimer = alias(schema.slaTimers, "fr");
const resTimer = alias(schema.slaTimers, "res");

export type SlaState = "running" | "paused" | "at_risk" | "breached" | "met" | "met_late" | "none";

const slaStateSql = (t: typeof frTimer | typeof resTimer) => sql<SlaState>`case
  when ${t.id} is null then 'none'
  when ${t.metAt} is not null then (case when ${t.breachedAt} is not null then 'met_late' else 'met' end)
  when ${t.breachedAt} is not null then 'breached'
  when ${t.pausedAt} is not null then 'paused'
  when ${t.dueAt} < now() then 'breached'
  when ${t.atRiskNotified} then 'at_risk'
  else 'running' end`;

const listColumns = {
  id: schema.tickets.id,
  key: schema.tickets.key,
  subject: schema.tickets.subject,
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  type: schema.tickets.type,
  urgency: schema.tickets.urgency,
  impact: schema.tickets.impact,
  workState: schema.tickets.workState,
  orgId: schema.tickets.orgId,
  orgName: schema.organisations.name,
  requesterId: schema.tickets.requesterId,
  requesterName: requester.fullName,
  assigneeId: schema.tickets.assigneeId,
  assigneeName: assignee.fullName,
  categoryId: schema.tickets.categoryId,
  categoryName: schema.categories.name,
  escalationLevel: schema.tickets.escalationLevel,
  timeSpentMinutes: schema.tickets.timeSpentMinutes,
  reviewOutcome: schema.tickets.reviewOutcome,
  submittedAt: schema.tickets.submittedAt,
  firstRespondedAt: schema.tickets.firstRespondedAt,
  resolvedAt: schema.tickets.resolvedAt,
  closedAt: schema.tickets.closedAt,
  lastClientReplyAt: schema.tickets.lastClientReplyAt,
  lastStaffReplyAt: schema.tickets.lastStaffReplyAt,
  createdAt: schema.tickets.createdAt,
  updatedAt: schema.tickets.updatedAt,
  frDueAt: frTimer.dueAt,
  frState: slaStateSql(frTimer),
  resDueAt: resTimer.dueAt,
  resState: slaStateSql(resTimer),
  version: schema.tickets.version,
};

export type TicketListRow = {
  [K in keyof typeof listColumns]: (typeof listColumns)[K] extends { _: { data: infer D } } ? D | (K extends "assigneeName" | "assigneeId" | "categoryName" | "categoryId" | "frDueAt" | "resDueAt" ? null : never) : never;
} & { frState: SlaState; resState: SlaState };

export type QueueId = "unassigned" | "mine" | "all_open" | "at_risk" | "pending_client" | "on_hold" | "resolved" | "review" | "my_work" | "all";

export type TicketFilter = {
  queue?: QueueId;
  status?: TicketStatus[];
  priority?: Priority[];
  type?: TicketType[];
  orgId?: string;
  assignee?: string | "me" | "unassigned";
  requesterId?: string;
  categoryId?: string;
  tag?: string;
  sla?: "at_risk" | "breached" | "ok";
  workState?: WorkState[];
  q?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sort?: "updated" | "created" | "priority" | "due" | "key";
  dir?: "asc" | "desc";
  cursor?: string | null;
  limit?: number;
};

function baseQuery(tx: Tx) {
  return tx
    .select(listColumns)
    .from(schema.tickets)
    .innerJoin(schema.organisations, eq(schema.organisations.id, schema.tickets.orgId))
    .innerJoin(requester, eq(requester.id, schema.tickets.requesterId))
    .leftJoin(assignee, eq(assignee.id, schema.tickets.assigneeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.tickets.categoryId))
    .leftJoin(frTimer, and(eq(frTimer.ticketId, schema.tickets.id), eq(frTimer.metric, "first_response")))
    .leftJoin(resTimer, and(eq(resTimer.ticketId, schema.tickets.id), eq(resTimer.metric, "resolution")));
}

const OPEN = [...OPEN_STATUSES];

function queueWhere(queue: QueueId | undefined, ctx: AuthContext): SQL | undefined {
  switch (queue) {
    case "unassigned":
      return and(isNull(schema.tickets.assigneeId), inArray(schema.tickets.status, OPEN));
    case "mine":
      return and(eq(schema.tickets.assigneeId, ctx.userId), inArray(schema.tickets.status, OPEN));
    case "my_work":
      return and(eq(schema.tickets.assigneeId, ctx.userId), inArray(schema.tickets.status, ["in_progress", "in_review", "on_hold", "pending_client", "open", "new"]));
    case "all_open":
      return inArray(schema.tickets.status, OPEN);
    case "at_risk":
      return and(inArray(schema.tickets.status, OPEN), or(sql`${slaStateSql(frTimer)} in ('at_risk','breached')`, sql`${slaStateSql(resTimer)} in ('at_risk','breached')`));
    case "pending_client":
      return eq(schema.tickets.status, "pending_client");
    case "on_hold":
      return eq(schema.tickets.status, "on_hold");
    case "resolved":
      return eq(schema.tickets.status, "resolved");
    case "review":
      return eq(schema.tickets.status, "in_review");
    default:
      return undefined;
  }
}

function filterWhere(f: TicketFilter, ctx: AuthContext): SQL | undefined {
  const clauses: (SQL | undefined)[] = [isNull(schema.tickets.deletedAt), queueWhere(f.queue, ctx)];
  if (f.status?.length) clauses.push(inArray(schema.tickets.status, f.status));
  if (f.priority?.length) clauses.push(inArray(schema.tickets.priority, f.priority));
  if (f.type?.length) clauses.push(inArray(schema.tickets.type, f.type));
  if (f.orgId) clauses.push(eq(schema.tickets.orgId, f.orgId));
  if (f.requesterId) clauses.push(eq(schema.tickets.requesterId, f.requesterId));
  if (f.categoryId) clauses.push(or(eq(schema.tickets.categoryId, f.categoryId), eq(schema.tickets.subcategoryId, f.categoryId)));
  if (f.workState?.length) clauses.push(inArray(schema.tickets.workState, f.workState));
  if (f.assignee === "me") clauses.push(eq(schema.tickets.assigneeId, ctx.userId));
  else if (f.assignee === "unassigned") clauses.push(isNull(schema.tickets.assigneeId));
  else if (f.assignee) clauses.push(eq(schema.tickets.assigneeId, f.assignee));
  if (f.tag) clauses.push(sql`exists (select 1 from ticket_tags tt join tags tg on tg.id = tt.tag_id where tt.ticket_id = ${schema.tickets.id} and tg.name = ${f.tag})`);
  if (f.sla === "breached") clauses.push(or(sql`${slaStateSql(frTimer)} = 'breached'`, sql`${slaStateSql(resTimer)} = 'breached'`));
  if (f.sla === "at_risk") clauses.push(or(sql`${slaStateSql(frTimer)} = 'at_risk'`, sql`${slaStateSql(resTimer)} = 'at_risk'`));
  if (f.sla === "ok") clauses.push(and(sql`${slaStateSql(frTimer)} not in ('at_risk','breached')`, sql`${slaStateSql(resTimer)} not in ('at_risk','breached')`));
  if (f.createdFrom) clauses.push(gt(schema.tickets.createdAt, f.createdFrom));
  if (f.createdTo) clauses.push(lt(schema.tickets.createdAt, f.createdTo));
  if (f.q?.trim()) {
    const q = f.q.trim();
    clauses.push(or(ilike(schema.tickets.key, `%${q}%`), sql`${schema.tickets.searchVector} @@ plainto_tsquery('english', ${q})`, ilike(schema.tickets.subject, `%${q}%`)));
  }
  return and(...clauses);
}

type Cursor = { v: string | number; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
const decodeCursor = (s?: string | null): Cursor | null => {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as Cursor;
    return typeof c.id === "string" ? c : null;
  } catch {
    return null;
  }
};

/** Keyset-paginated ticket list (architecture.md §13: no OFFSET). RLS additionally scopes rows per role. */
export async function listTickets(ctx: AuthContext, f: TicketFilter = {}) {
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 100);
  const sort = f.sort ?? "updated";
  const dir = f.dir ?? (sort === "priority" || sort === "due" || sort === "key" ? "asc" : "desc");
  const sortCol =
    sort === "created" ? schema.tickets.createdAt
    : sort === "priority" ? sql`${schema.tickets.priority}::text`
    : sort === "due" ? sql`coalesce(${resTimer.dueAt}, ${frTimer.dueAt}, 'infinity'::timestamptz)`
    : sort === "key" ? sql`substring(${schema.tickets.key} from 5)::int`
    : schema.tickets.updatedAt;
  const cursor = decodeCursor(f.cursor);
  return withContext(ctx, async (tx) => {
    const cmp = dir === "asc" ? gt : lt;
    const cursorWhere = cursor
      ? or(cmp(sortCol as SQL, sort === "priority" ? String(cursor.v) : sort === "key" ? Number(cursor.v) : new Date(cursor.v)), and(eq(sortCol as SQL, sort === "priority" ? String(cursor.v) : sort === "key" ? Number(cursor.v) : new Date(cursor.v)), cmp(schema.tickets.id, cursor.id)))
      : undefined;
    const rows = await baseQuery(tx)
      .where(and(filterWhere(f, ctx), cursorWhere))
      .orderBy(dir === "asc" ? asc(sortCol as SQL) : desc(sortCol as SQL), dir === "asc" ? asc(schema.tickets.id) : desc(schema.tickets.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit) as unknown as TicketListRow[];
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({
            v: sort === "priority" ? last.priority : sort === "key" ? Number(last.key.slice(4)) : sort === "due" ? (last.resDueAt ?? last.frDueAt ?? new Date(8.64e15)).toISOString() : (sort === "created" ? last.createdAt : last.updatedAt).toISOString(),
            id: last.id,
          })
        : null;
    return { rows: page, nextCursor };
  });
}

export async function countTickets(ctx: AuthContext, f: TicketFilter = {}): Promise<number> {
  return withContext(ctx, async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.tickets)
      .leftJoin(frTimer, and(eq(frTimer.ticketId, schema.tickets.id), eq(frTimer.metric, "first_response")))
      .leftJoin(resTimer, and(eq(resTimer.ticketId, schema.tickets.id), eq(resTimer.metric, "resolution")))
      .where(filterWhere(f, ctx));
    return row?.n ?? 0;
  });
}

/** Live counts for every queue in one query (FR-AG-01). */
export async function queueCounts(ctx: AuthContext): Promise<Record<QueueId, number>> {
  return withContext(ctx, async (tx) => {
    const open = sql`${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold')`;
    const [row] = await tx
      .select({
        unassigned: sql<number>`count(*) filter (where ${schema.tickets.assigneeId} is null and ${open})::int`,
        mine: sql<number>`count(*) filter (where ${schema.tickets.assigneeId} = ${ctx.userId}::uuid and ${open})::int`,
        my_work: sql<number>`count(*) filter (where ${schema.tickets.assigneeId} = ${ctx.userId}::uuid and ${open})::int`,
        all_open: sql<number>`count(*) filter (where ${open})::int`,
        at_risk: sql<number>`count(*) filter (where ${open} and (${slaStateSql(frTimer)} in ('at_risk','breached') or ${slaStateSql(resTimer)} in ('at_risk','breached')))::int`,
        pending_client: sql<number>`count(*) filter (where ${schema.tickets.status} = 'pending_client')::int`,
        on_hold: sql<number>`count(*) filter (where ${schema.tickets.status} = 'on_hold')::int`,
        resolved: sql<number>`count(*) filter (where ${schema.tickets.status} = 'resolved')::int`,
        review: sql<number>`count(*) filter (where ${schema.tickets.status} = 'in_review')::int`,
        all: sql<number>`count(*)::int`,
      })
      .from(schema.tickets)
      .leftJoin(frTimer, and(eq(frTimer.ticketId, schema.tickets.id), eq(frTimer.metric, "first_response")))
      .leftJoin(resTimer, and(eq(resTimer.ticketId, schema.tickets.id), eq(resTimer.metric, "resolution")))
      .where(isNull(schema.tickets.deletedAt));
    return row as Record<QueueId, number>;
  });
}

// --- Detail ------------------------------------------------------------------

export async function loadTicketRow(tx: Tx, where: SQL) {
  const [row] = await tx.select().from(schema.tickets).where(and(where, isNull(schema.tickets.deletedAt))).limit(1);
  return row ?? null;
}

/**
 * Full staff-side ticket detail. Not found (or hidden by RLS) → 404 + `access_denied` audit row
 * (security.md A01: never 403, to avoid enumeration).
 */
export async function getTicketDetail(ctx: AuthContext, key: string) {
  const result = await withContext(ctx, async (tx) => {
    const [row] = await baseQuery(tx).where(and(eq(schema.tickets.key, key), isNull(schema.tickets.deletedAt))).limit(1);
    if (!row) return null;
    const [full] = await tx.select().from(schema.tickets).where(eq(schema.tickets.id, row.id)).limit(1);
    const [org, requesterRow, assigneeRow, participants, tags, links, timers, events, subcategory] = await Promise.all([
      tx.select({ id: schema.organisations.id, name: schema.organisations.name, tier: schema.organisations.tier, timezone: schema.organisations.timezone }).from(schema.organisations).where(eq(schema.organisations.id, row.orgId)).limit(1),
      tx.select({ id: schema.users.id, fullName: schema.users.fullName, email: schema.users.email, phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, row.requesterId)).limit(1),
      row.assigneeId ? tx.select({ id: schema.users.id, fullName: schema.users.fullName, roleId: schema.users.roleId }).from(schema.users).where(eq(schema.users.id, row.assigneeId)).limit(1) : Promise.resolve([]),
      tx.select({ userId: schema.ticketParticipants.userId, kind: schema.ticketParticipants.kind, fullName: schema.users.fullName, roleId: schema.users.roleId }).from(schema.ticketParticipants).innerJoin(schema.users, eq(schema.users.id, schema.ticketParticipants.userId)).where(eq(schema.ticketParticipants.ticketId, row.id)),
      tx.select({ name: schema.tags.name }).from(schema.ticketTags).innerJoin(schema.tags, eq(schema.tags.id, schema.ticketTags.tagId)).where(eq(schema.ticketTags.ticketId, row.id)),
      tx.select({ id: schema.ticketLinks.id, kind: schema.ticketLinks.kind, linkedTicketId: schema.ticketLinks.linkedTicketId, linkedKey: schema.tickets.key, linkedSubject: schema.tickets.subject, linkedStatus: schema.tickets.status }).from(schema.ticketLinks).innerJoin(schema.tickets, eq(schema.tickets.id, schema.ticketLinks.linkedTicketId)).where(eq(schema.ticketLinks.ticketId, row.id)),
      timersForTicket(tx, row.id),
      listEvents(tx, row.id),
      full!.subcategoryId ? tx.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).where(eq(schema.categories.id, full!.subcategoryId)).limit(1) : Promise.resolve([]),
    ]);
    const policy = await policyForOrg(tx, row.orgId);
    const settings = await orgSettingsFor(tx, row.orgId);
    return {
      ...(row as unknown as TicketListRow),
      description: full!.description,
      holdReason: full!.holdReason,
      holdNote: full!.holdNote,
      resolutionCode: full!.resolutionCode,
      resolutionNote: full!.resolutionNote,
      cancelReason: full!.cancelReason,
      priorityOverridden: full!.priorityOverridden,
      subcategoryId: full!.subcategoryId,
      subcategoryName: subcategory[0]?.name ?? null,
      reopenedCount: full!.reopenedCount,
      escalatedAt: full!.escalatedAt,
      submittedBy: full!.submittedBy,
      reviewedAt: full!.reviewedAt,
      reviewedBy: full!.reviewedBy,
      source: full!.source,
      org: org[0]!,
      requester: requesterRow[0]!,
      assignee: assigneeRow[0] ?? null,
      participants,
      tags: tags.map((t) => t.name),
      links,
      timers,
      events,
      policy,
      settings,
    };
  });
  if (!result) throw notFound(); // the route layout has already logged access_denied
  return result;
}

export type TicketDetail = Awaited<ReturnType<typeof getTicketDetail>>;

// --- Create ------------------------------------------------------------------

export type CreateTicketInput = {
  orgId: string;
  requesterId: string;
  type: TicketType;
  subject: string;
  description: string;
  urgency: Level3;
  impact?: Level3;
  categoryId?: string | null;
  subcategoryId?: string | null;
  source: "portal" | "agent";
  participantIds?: string[];
  followUpOf?: string | null;
};

export async function createTicket(ctx: AuthContext, input: CreateTicketInput) {
  return withContext(ctx, async (tx) => {
    const impact = input.impact ?? "medium";
    const priority = computePriority(impact, input.urgency);
    const now = new Date();
    const [t] = await tx
      .insert(schema.tickets)
      .values({
        orgId: input.orgId,
        requesterId: input.requesterId,
        type: input.type,
        subject: input.subject,
        description: input.description,
        urgency: input.urgency,
        impact,
        priority,
        categoryId: input.categoryId ?? null,
        subcategoryId: input.subcategoryId ?? null,
        source: input.source,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: schema.tickets.id, key: schema.tickets.key });
    const ticket = t!;
    const policy = await policyForOrg(tx, input.orgId);
    await startTimers(tx, { id: ticket.id, orgId: input.orgId, priority, type: input.type }, policy, now);
    const participants = [...new Set((input.participantIds ?? []).filter((id) => id !== input.requesterId))];
    if (participants.length) await tx.insert(schema.ticketParticipants).values(participants.map((userId) => ({ ticketId: ticket.id, userId, kind: "participant" as const }))).onConflictDoNothing();
    if (input.followUpOf) {
      const [prev] = await tx.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.key, input.followUpOf)).limit(1);
      if (prev) {
        await tx.insert(schema.ticketLinks).values({ ticketId: ticket.id, linkedTicketId: prev.id, kind: "follow_up_of", createdBy: ctx.userId });
        const prevParticipants = await tx.select({ userId: schema.ticketParticipants.userId }).from(schema.ticketParticipants).where(eq(schema.ticketParticipants.ticketId, prev.id));
        if (prevParticipants.length) await tx.insert(schema.ticketParticipants).values(prevParticipants.filter((p) => p.userId !== input.requesterId).map((p) => ({ ticketId: ticket.id, userId: p.userId, kind: "participant" as const }))).onConflictDoNothing();
      }
    }
    await emitEvent(tx, ctx, { ticketId: ticket.id, orgId: input.orgId, kind: "created", visibility: "public", data: { source: input.source, type: input.type, priority, key: ticket.key } });
    const frTimerRow = (await timersForTicket(tx, ticket.id)).find((x) => x.metric === "first_response");
    // Notification matrix: requester confirmation + participants
    await notifyInTx(tx, {
      userIds: [input.requesterId, ...participants],
      orgId: input.orgId,
      ticketId: ticket.id,
      kind: "ticket_created",
      title: `${ticket.key} received: ${input.subject}`,
      body: frTimerRow ? `We aim to respond by ${frTimerRow.dueAt.toISOString()}` : null,
      href: `/portal/tickets/${ticket.key}`,
      email: true,
    });
    return { id: ticket.id, key: ticket.key, priority, firstResponseDueAt: frTimerRow?.dueAt ?? null };
  });
}

// --- Transitions -------------------------------------------------------------

async function getSnapshot(tx: Tx, ticketId: string) {
  const row = await loadTicketRow(tx, eq(schema.tickets.id, ticketId));
  if (!row) throw notFound();
  return row;
}

/**
 * Apply a state-machine transition inside an open transaction: domain validation → ticket patch (with
 * optimistic `version` check) → SLA effects → event → notifications.
 */
export async function transitionInTx(tx: Tx, ctx: AuthContext, ticketId: string, action: TicketAction, input: TransitionInput = {}, opts: { expectedVersion?: number; now?: Date; skipNotify?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const row = await getSnapshot(tx, ticketId);
  if (opts.expectedVersion !== undefined && row.version !== opts.expectedVersion) throw conflict();
  const result = transition(
    { id: row.id, status: row.status, requesterId: row.requesterId, assigneeId: row.assigneeId, orgId: row.orgId, workState: row.workState, reopenedCount: row.reopenedCount },
    action,
    { userId: ctx.userId, role: ctx.role, orgId: ctx.orgId },
    input,
    now,
  );
  const firstResponse = !row.firstRespondedAt && statusChangeCountsAsFirstResponse(ctx.role, result.to) ? now : undefined;
  const [updated] = await tx
    .update(schema.tickets)
    .set({ ...result.patch, ...(firstResponse ? { firstRespondedAt: firstResponse } : {}), updatedBy: ctx.userId, version: sql`${schema.tickets.version} + 1` })
    .where(and(eq(schema.tickets.id, ticketId), eq(schema.tickets.version, row.version)))
    .returning({ id: schema.tickets.id, key: schema.tickets.key, status: schema.tickets.status, subject: schema.tickets.subject, version: schema.tickets.version });
  if (!updated) throw conflict();
  const policy = await policyForOrg(tx, row.orgId);
  const effects = [...result.effects, ...(firstResponse ? (["sla.stop_first_response"] as const) : [])];
  await applySlaEffects(tx, ticketId, effects, policy.calendar, now);
  await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, ...result.event });

  if (!opts.skipNotify) {
    const participants = (await tx.select({ userId: schema.ticketParticipants.userId }).from(schema.ticketParticipants).where(and(eq(schema.ticketParticipants.ticketId, ticketId), eq(schema.ticketParticipants.kind, "participant")))).map((p) => p.userId);
    const label = CLIENT_STATUS_LABEL[result.to];
    if (effects.includes("notify.requester") && result.event.visibility === "public") {
      await notifyInTx(tx, {
        userIds: [row.requesterId, ...participants],
        orgId: row.orgId,
        ticketId,
        kind: `status_${result.to}`,
        title: `${row.key} — ${label}`,
        body: result.to === "resolved" ? "Please confirm the resolution or reopen the request." : result.to === "pending_client" ? "We need something from you to continue." : null,
        href: `/portal/tickets/${row.key}`,
        email: true,
        excludeUserId: ctx.userId,
      });
    }
    if (effects.includes("notify.assignee") && row.assigneeId) {
      await notifyInTx(tx, { userIds: [row.assigneeId], orgId: row.orgId, ticketId, kind: `status_${result.to}`, title: `${row.key} ${STAFF_STATUS_LABEL[result.to].toLowerCase()}: ${row.subject}`, href: `/app/tickets/${row.key}`, email: true, excludeUserId: ctx.userId });
    }
    if (effects.includes("notify.developer") && row.assigneeId) {
      await notifyInTx(tx, { userIds: [row.assigneeId], orgId: row.orgId, ticketId, kind: action === "approve" ? "review_approved" : "review_returned", title: action === "approve" ? `${row.key} approved — resolved` : `${row.key} returned from review`, body: input.reviewNotes ?? null, href: `/app/tickets/${row.key}`, email: true, excludeUserId: ctx.userId });
    }
    if (effects.includes("notify.reviewers")) {
      const reviewers = await staffUserIdsByRole(tx, ["lead", "admin"]);
      await notifyInTx(tx, { userIds: reviewers, orgId: row.orgId, ticketId, kind: "submitted_for_review", title: `${row.key} submitted for review by ${firstName(ctx.fullName)}`, body: row.subject, href: `/app/tickets/${row.key}`, email: true, excludeUserId: ctx.userId });
    }
  }
  return { ...updated, effects, to: result.to };
}

export async function transitionTicket(ctx: AuthContext, ticketId: string, action: TicketAction, input: TransitionInput = {}, expectedVersion?: number) {
  return withContext(ctx, (tx) => transitionInTx(tx, ctx, ticketId, action, input, { expectedVersion }));
}

// --- Field mutations ---------------------------------------------------------

async function bump(tx: Tx, ctx: AuthContext, ticketId: string, patch: Partial<typeof schema.tickets.$inferInsert>) {
  const [row] = await tx
    .update(schema.tickets)
    .set({ ...patch, updatedBy: ctx.userId, version: sql`${schema.tickets.version} + 1` })
    .where(eq(schema.tickets.id, ticketId))
    .returning({ id: schema.tickets.id, key: schema.tickets.key, orgId: schema.tickets.orgId, subject: schema.tickets.subject, status: schema.tickets.status, assigneeId: schema.tickets.assigneeId });
  if (!row) throw notFound();
  return row;
}

export async function assignTicket(ctx: AuthContext, ticketId: string, assigneeId: string | null, note?: string | null) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    if (before.status === "closed" || before.status === "cancelled") throw new AppError("invalid_transition", "Closed tickets cannot be reassigned.");
    let assigneeRole: string | null = null;
    if (assigneeId) {
      const [u] = await tx.select({ roleId: schema.users.roleId, orgType: schema.organisations.type, status: schema.users.status }).from(schema.users).innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId)).where(eq(schema.users.id, assigneeId)).limit(1);
      if (!u || u.orgType !== "staff" || u.status !== "active") throw new AppError("validation", "Assignee must be an active staff member.");
      assigneeRole = u.roleId;
    }
    // Assigning to a developer starts work: new/open → in_progress with work_state = investigating (requirements.md §5.4)
    const patch: Partial<typeof schema.tickets.$inferInsert> = { assigneeId, workState: assigneeRole === "developer" ? (before.workState ?? "investigating") : assigneeId ? before.workState : null };
    const row = await bump(tx, ctx, ticketId, patch);
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "assigned", data: { from: before.assigneeId, to: assigneeId, note: note ?? null, assigneeRole } });
    if (assigneeId && (before.status === "new" || before.status === "open") && ctx.role !== "developer") {
      await transitionInTx(tx, ctx, ticketId, "start", {}, { skipNotify: true });
    }
    if (assigneeId && assigneeId !== ctx.userId) {
      await notifyInTx(tx, { userIds: [assigneeId], orgId: row.orgId, ticketId, kind: "assigned", title: `${row.key} assigned to you: ${row.subject}`, body: note ?? null, href: `/app/tickets/${row.key}`, email: true });
    }
    return row;
  });
}

export async function setImpactUrgency(ctx: AuthContext, ticketId: string, input: { impact?: Level3; urgency?: Level3 }) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    const impact = input.impact ?? before.impact;
    const urgency = input.urgency ?? before.urgency;
    const priority = before.priorityOverridden ? before.priority : computePriority(impact, urgency);
    const row = await bump(tx, ctx, ticketId, { impact, urgency, priority });
    if (priority !== before.priority) {
      const policy = await policyForOrg(tx, before.orgId);
      await retargetTimers(tx, { id: ticketId, priority, type: before.type }, policy, new Date());
      await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "priority_changed", visibility: "public", data: { from: before.priority, to: priority, impact, urgency } });
    } else {
      await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "field_changed", data: { impact, urgency } });
    }
    return { ...row, priority };
  });
}

export async function overridePriority(ctx: AuthContext, ticketId: string, priority: Priority, reason: string) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    const computed = computePriority(before.impact, before.urgency);
    const row = await bump(tx, ctx, ticketId, { priority, priorityOverridden: priority !== computed });
    const policy = await policyForOrg(tx, before.orgId);
    await retargetTimers(tx, { id: ticketId, priority, type: before.type }, policy, new Date());
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "priority_overridden", visibility: "public", data: { from: before.priority, to: priority, reason } });
    return row;
  });
}

export async function setCategory(ctx: AuthContext, ticketId: string, categoryId: string | null, subcategoryId: string | null) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    const row = await bump(tx, ctx, ticketId, { categoryId, subcategoryId });
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "field_changed", data: { categoryId: { from: before.categoryId, to: categoryId }, subcategoryId: { from: before.subcategoryId, to: subcategoryId } } });
    return row;
  });
}

export async function editTicket(ctx: AuthContext, ticketId: string, patch: { subject?: string; description?: string; type?: TicketType }) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    const row = await bump(tx, ctx, ticketId, patch);
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "edited", data: { fields: Object.keys(patch), before: { subject: before.subject, type: before.type } } });
    return row;
  });
}

/** FR-DEV-03: blocked/needs_info require a note; admin + leads are notified on blocked/needs_info. */
export async function setWorkState(ctx: AuthContext, ticketId: string, workState: WorkState, note?: string | null) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    if (ctx.role === "developer" && before.assigneeId !== ctx.userId) throw notFound();
    if ((workState === "blocked" || workState === "needs_info") && !note?.trim()) throw new AppError("validation", "Add a note explaining what is blocking you.", { fields: { note: "Required" } });
    const row = await bump(tx, ctx, ticketId, { workState });
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "work_state_changed", data: { from: before.workState, to: workState, note: note ?? null } });
    if (workState === "blocked" || workState === "needs_info") {
      const reviewers = await staffUserIdsByRole(tx, ["lead", "admin"]);
      await notifyInTx(tx, { userIds: reviewers, orgId: row.orgId, ticketId, kind: `work_${workState}`, title: `${row.key} is ${workState === "blocked" ? "blocked" : "waiting for information"} — ${firstName(ctx.fullName)}`, body: note ?? null, href: `/app/tickets/${row.key}`, email: true, excludeUserId: ctx.userId });
    }
    return row;
  });
}

export async function setTags(ctx: AuthContext, ticketId: string, names: string[]) {
  return withContext(ctx, async (tx) => {
    const row = await getSnapshot(tx, ticketId);
    const clean = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    await tx.delete(schema.ticketTags).where(eq(schema.ticketTags.ticketId, ticketId));
    for (const name of clean) {
      const [tag] = await tx.insert(schema.tags).values({ name }).onConflictDoUpdate({ target: schema.tags.name, set: { name } }).returning({ id: schema.tags.id });
      await tx.insert(schema.ticketTags).values({ ticketId, tagId: tag!.id }).onConflictDoNothing();
    }
    await bump(tx, ctx, ticketId, {});
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "tags_changed", data: { tags: clean } });
    return clean;
  });
}

export async function addParticipant(ctx: AuthContext, ticketId: string, userId: string, kind: "participant" | "watcher") {
  return withContext(ctx, async (tx) => {
    const row = await getSnapshot(tx, ticketId);
    const [u] = await tx.select({ orgId: schema.users.orgId, orgType: schema.organisations.type, fullName: schema.users.fullName }).from(schema.users).innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId)).where(eq(schema.users.id, userId)).limit(1);
    if (!u) throw notFound();
    if (kind === "participant" && u.orgId !== row.orgId) throw new AppError("validation", "Participants must belong to the ticket's organisation.");
    if (kind === "watcher" && u.orgType !== "staff") throw new AppError("validation", "Only staff can watch a ticket.");
    await tx.insert(schema.ticketParticipants).values({ ticketId, userId, kind }).onConflictDoUpdate({ target: [schema.ticketParticipants.ticketId, schema.ticketParticipants.userId], set: { kind } });
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: kind === "participant" ? "participant_added" : "watcher_added", visibility: kind === "participant" ? "public" : "internal", data: { userId, name: u.fullName } });
  });
}

export async function removeParticipant(ctx: AuthContext, ticketId: string, userId: string) {
  return withContext(ctx, async (tx) => {
    const row = await getSnapshot(tx, ticketId);
    await tx.delete(schema.ticketParticipants).where(and(eq(schema.ticketParticipants.ticketId, ticketId), eq(schema.ticketParticipants.userId, userId)));
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "participant_removed", data: { userId } });
  });
}

export async function linkTickets(ctx: AuthContext, ticketId: string, linkedKey: string, kind: LinkKindT) {
  return withContext(ctx, async (tx) => {
    const row = await getSnapshot(tx, ticketId);
    const [other] = await tx.select({ id: schema.tickets.id, key: schema.tickets.key }).from(schema.tickets).where(and(eq(schema.tickets.key, linkedKey), ne(schema.tickets.id, ticketId))).limit(1);
    if (!other) throw new AppError("validation", `Ticket ${linkedKey} was not found.`);
    await tx.insert(schema.ticketLinks).values({ ticketId, linkedTicketId: other.id, kind, createdBy: ctx.userId });
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "linked", data: { kind, key: other.key } });
    return other;
  });
}

export async function escalateTicket(ctx: AuthContext, ticketId: string, reason: string) {
  return withContext(ctx, async (tx) => {
    const before = await getSnapshot(tx, ticketId);
    const level = Math.min(3, before.escalationLevel + 1);
    const row = await bump(tx, ctx, ticketId, { escalationLevel: level, escalatedAt: new Date() });
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "escalated", data: { level, reason } });
    const leads = await staffUserIdsByRole(tx, ["lead", "admin"]);
    await notifyInTx(tx, { userIds: [...leads, ...(row.assigneeId ? [row.assigneeId] : [])], orgId: row.orgId, ticketId, kind: "escalated", title: `${row.key} escalated to level ${level}`, body: reason, href: `/app/tickets/${row.key}`, email: true, excludeUserId: ctx.userId });
    return row;
  });
}

export async function extendSla(ctx: AuthContext, ticketId: string, metric: "first_response" | "resolution", extraMinutes: number, reason: string) {
  return withContext(ctx, async (tx) => {
    const row = await getSnapshot(tx, ticketId);
    const timers = await timersForTicket(tx, ticketId);
    const [t] = await tx.select({ adjustedBy: schema.slaTimers.adjustedBy }).from(schema.slaTimers).where(and(eq(schema.slaTimers.ticketId, ticketId), eq(schema.slaTimers.metric, metric))).limit(1);
    if (t?.adjustedBy) throw new AppError("validation", "This due date has already been extended once.");
    if (!timers.some((x) => x.metric === metric)) throw new AppError("validation", "No SLA timer for that metric.");
    const policy = await policyForOrg(tx, row.orgId);
    await extendTimer(tx, ticketId, metric, extraMinutes, policy.calendar, new Date(), ctx, reason);
    await bump(tx, ctx, ticketId, {});
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "sla_extended", data: { metric, extraMinutes, reason } });
  });
}

/** ⌘K search over tickets by key/subject/body (FR-AG-09). */
export async function searchTickets(ctx: AuthContext, q: string, limit = 8) {
  const term = q.trim();
  if (!term) return [];
  return withContext(ctx, (tx) =>
    tx
      .select({ id: schema.tickets.id, key: schema.tickets.key, subject: schema.tickets.subject, status: schema.tickets.status, priority: schema.tickets.priority, orgName: schema.organisations.name })
      .from(schema.tickets)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.tickets.orgId))
      .where(and(isNull(schema.tickets.deletedAt), or(ilike(schema.tickets.key, `%${term}%`), ilike(schema.tickets.subject, `%${term}%`), sql`${schema.tickets.searchVector} @@ plainto_tsquery('english', ${term})`)))
      .orderBy(desc(schema.tickets.updatedAt))
      .limit(limit),
  );
}

export { priorityRank };

/** Cheap visibility probe used by the route layout so a hidden/missing ticket yields a real 404 status before streaming. */
export async function ticketExistsForViewer(ctx: AuthContext, key: string): Promise<boolean> {
  const [row] = await withContext(ctx, (tx) => tx.select({ id: schema.tickets.id }).from(schema.tickets).where(and(eq(schema.tickets.key, key), isNull(schema.tickets.deletedAt))).limit(1));
  if (!row) await logAccessDenied(ctx, "ticket", key);
  return !!row;
}
