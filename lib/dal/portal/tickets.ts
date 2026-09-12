import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema, withContext } from "../db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import { CLIENT_STATUS_LABEL, OPEN_STATUSES, toClientStatus, type ClientStatus, type Priority, type TicketStatus, type TicketType } from "@/lib/domain/types";
import { firstName } from "@/lib/utils";
import { logAccessDenied } from "../audit";
import { listCommentsInTx } from "../comments";
import { orgSettingsFor } from "../orgs";
import { timersForTicket } from "../sla";

/**
 * Client-portal projection. This module is the ONLY ticket reader the portal route group may import
 * (ESLint boundary). It never selects work_state, work logs, submissions or internal comments, and
 * collapses `in_review` into "Being worked on" (security.md A01, §6 snapshot test).
 */
const assignee = alias(schema.users, "assignee");
const requester = alias(schema.users, "requester");
const resTimer = alias(schema.slaTimers, "res");
const frTimer = alias(schema.slaTimers, "fr");

export type PortalTicketRow = {
  id: string;
  key: string;
  subject: string;
  type: TicketType;
  status: ClientStatus;
  statusLabel: string;
  priority: Priority;
  requesterId: string;
  requesterName: string;
  assigneeFirstName: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  lastStaffReplyAt: Date | null;
  targetResponseAt: Date | null;
  targetResolutionAt: Date | null;
  awaitingYou: boolean;
};

type RawRow = {
  id: string; key: string; subject: string; type: TicketType; status: TicketStatus; priority: Priority; requesterId: string; requesterName: string; assigneeName: string | null;
  createdAt: Date; updatedAt: Date; resolvedAt: Date | null; closedAt: Date | null; lastStaffReplyAt: Date | null; frDueAt: Date | null; frMet: Date | null; resDueAt: Date | null; resMet: Date | null;
};

function project(r: RawRow): PortalTicketRow {
  const status = toClientStatus(r.status);
  return {
    id: r.id,
    key: r.key,
    subject: r.subject,
    type: r.type,
    status,
    statusLabel: CLIENT_STATUS_LABEL[status],
    priority: r.priority,
    requesterId: r.requesterId,
    requesterName: r.requesterName,
    assigneeFirstName: r.assigneeName ? firstName(r.assigneeName) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    resolvedAt: r.resolvedAt,
    closedAt: r.closedAt,
    lastStaffReplyAt: r.lastStaffReplyAt,
    targetResponseAt: r.frMet ? null : r.frDueAt,
    targetResolutionAt: r.resMet ? null : r.resDueAt,
    awaitingYou: status === "pending_client" || status === "resolved",
  };
}

const columns = {
  id: schema.tickets.id,
  key: schema.tickets.key,
  subject: schema.tickets.subject,
  type: schema.tickets.type,
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  requesterId: schema.tickets.requesterId,
  requesterName: requester.fullName,
  assigneeName: assignee.fullName,
  createdAt: schema.tickets.createdAt,
  updatedAt: schema.tickets.updatedAt,
  resolvedAt: schema.tickets.resolvedAt,
  closedAt: schema.tickets.closedAt,
  lastStaffReplyAt: schema.tickets.lastStaffReplyAt,
  frDueAt: frTimer.dueAt,
  frMet: frTimer.metAt,
  resDueAt: resTimer.dueAt,
  resMet: resTimer.metAt,
};

export type PortalFilter = { scope?: "open" | "resolved" | "all"; q?: string; requesterId?: string; limit?: number };

export async function listMyRequests(ctx: AuthContext, f: PortalFilter = {}): Promise<PortalTicketRow[]> {
  return withContext(ctx, async (tx) => {
    const rows = await tx
      .select(columns)
      .from(schema.tickets)
      .innerJoin(requester, eq(requester.id, schema.tickets.requesterId))
      .leftJoin(assignee, eq(assignee.id, schema.tickets.assigneeId))
      .leftJoin(frTimer, and(eq(frTimer.ticketId, schema.tickets.id), eq(frTimer.metric, "first_response")))
      .leftJoin(resTimer, and(eq(resTimer.ticketId, schema.tickets.id), eq(resTimer.metric, "resolution")))
      .where(
        and(
          isNull(schema.tickets.deletedAt),
          eq(schema.tickets.orgId, ctx.orgId),
          f.scope === "open" ? inArray(schema.tickets.status, [...OPEN_STATUSES]) : f.scope === "resolved" ? inArray(schema.tickets.status, ["resolved", "closed", "cancelled"]) : undefined,
          f.requesterId ? eq(schema.tickets.requesterId, f.requesterId) : undefined,
          f.q?.trim() ? or(ilike(schema.tickets.key, `%${f.q.trim()}%`), ilike(schema.tickets.subject, `%${f.q.trim()}%`)) : undefined,
        ),
      )
      .orderBy(desc(schema.tickets.updatedAt))
      .limit(Math.min(f.limit ?? 100, 200));
    return rows.map(project);
  });
}

/** Detail for the portal thread. 404 + access_denied audit on anything RLS hides (other org, not participant). */
export async function getPortalTicket(ctx: AuthContext, key: string) {
  const result = await withContext(ctx, async (tx) => {
    const [row] = await tx
      .select({ ...columns, description: schema.tickets.description, resolutionNote: schema.tickets.resolutionNote, reopenedCount: schema.tickets.reopenedCount, version: schema.tickets.version, timeSpentMinutes: schema.tickets.timeSpentMinutes, orgId: schema.tickets.orgId })
      .from(schema.tickets)
      .innerJoin(requester, eq(requester.id, schema.tickets.requesterId))
      .leftJoin(assignee, eq(assignee.id, schema.tickets.assigneeId))
      .leftJoin(frTimer, and(eq(frTimer.ticketId, schema.tickets.id), eq(frTimer.metric, "first_response")))
      .leftJoin(resTimer, and(eq(resTimer.ticketId, schema.tickets.id), eq(resTimer.metric, "resolution")))
      .where(and(eq(schema.tickets.key, key), isNull(schema.tickets.deletedAt), eq(schema.tickets.orgId, ctx.orgId)))
      .limit(1);
    if (!row) return null;
    // Public comments only - belt (this filter) and braces (RLS policy comments_client_public_only)
    const comments = (await listCommentsInTx(tx, row.id, "public")).map((c) => ({
      id: c.id,
      body: c.body,
      bodyHtml: c.bodyHtml,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      authorId: c.authorId,
      authorName: c.authorName,
      // Client-facing display: staff show as "Name · Expendables" - never an internal role label (§5.4 rule 4)
      authorSide: ["client_user", "client_admin"].includes(c.authorRole) ? ("client" as const) : ("staff" as const),
      authorTitle: c.authorRole === "developer" ? "Engineer, Expendables" : ["client_user", "client_admin"].includes(c.authorRole) ? null : "Support, Expendables",
      kind: c.kind,
    }));
    const events = await tx
      .select({ id: schema.ticketEvents.id, kind: schema.ticketEvents.kind, data: schema.ticketEvents.data, createdAt: schema.ticketEvents.createdAt })
      .from(schema.ticketEvents)
      .where(and(eq(schema.ticketEvents.ticketId, row.id), eq(schema.ticketEvents.visibility, "public")))
      .orderBy(asc(schema.ticketEvents.createdAt));
    const participants = await tx
      .select({ userId: schema.ticketParticipants.userId, fullName: schema.users.fullName })
      .from(schema.ticketParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.ticketParticipants.userId))
      .where(and(eq(schema.ticketParticipants.ticketId, row.id), eq(schema.ticketParticipants.kind, "participant")));
    const attachments = await tx
      .select({ id: schema.attachments.id, fileName: schema.attachments.fileName, sizeBytes: schema.attachments.sizeBytes, mimeType: schema.attachments.mimeType, commentId: schema.attachments.commentId, createdAt: schema.attachments.createdAt, scanStatus: schema.attachments.scanStatus })
      .from(schema.attachments)
      .where(and(eq(schema.attachments.ticketId, row.id), eq(schema.attachments.visibility, "public"), isNull(schema.attachments.deletedAt)));
    const settings = await orgSettingsFor(tx, row.orgId);
    const links = await tx
      .select({ kind: schema.ticketLinks.kind, key: schema.tickets.key, subject: schema.tickets.subject })
      .from(schema.ticketLinks)
      .innerJoin(schema.tickets, eq(schema.tickets.id, schema.ticketLinks.linkedTicketId))
      .where(and(eq(schema.ticketLinks.ticketId, row.id), eq(schema.ticketLinks.kind, "follow_up_of")));
    const timers = await timersForTicket(tx, row.id);
    return {
      ...project(row),
      description: row.description,
      resolutionNote: row.resolutionNote,
      reopenedCount: row.reopenedCount,
      version: row.version,
      // exposed only when the org opted in (requirements.md §5.4 rule 7)
      timeSpentMinutes: settings.showTimeToClient ? row.timeSpentMinutes : null,
      comments,
      events: events.map((e) => ({ ...e, data: sanitiseEventData(e.kind, e.data) })),
      participants,
      attachments,
      followUpOf: links[0] ?? null,
      targetResponseAt: timers.find((t) => t.metric === "first_response" && !t.metAt)?.dueAt ?? null,
      targetResolutionAt: timers.find((t) => t.metric === "resolution" && !t.metAt)?.dueAt ?? null,
    };
  });
  if (!result) {
    await logAccessDenied(ctx, "ticket", key);
    throw notFound();
  }
  return result;
}

export type PortalTicket = Awaited<ReturnType<typeof getPortalTicket>>;

/** Only client-safe keys survive; `in_review` never appears in from/to. */
function sanitiseEventData(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === "status_changed") {
    const collapse = (s: unknown) => (s === "in_review" ? "in_progress" : s);
    return { from: collapse(data.from), to: collapse(data.to) };
  }
  if (kind === "priority_changed" || kind === "priority_overridden") return { from: data.from, to: data.to };
  if (kind === "participant_added") return { name: data.name };
  if (kind === "created") return { type: data.type };
  return {};
}

export async function findFollowUpSource(ctx: AuthContext, key: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select({ id: schema.tickets.id, key: schema.tickets.key, subject: schema.tickets.subject, status: schema.tickets.status, type: schema.tickets.type, requesterId: schema.tickets.requesterId }).from(schema.tickets).where(and(eq(schema.tickets.key, key), eq(schema.tickets.orgId, ctx.orgId), isNull(schema.tickets.deletedAt))).limit(1);
    if (!row) throw notFound();
    if (row.status !== "closed") throw new AppError("validation", "Follow-ups can only be created for closed requests.");
    return row;
  });
}

/** Monthly summary for client_admin dashboard (FR-RP-04). */
export async function orgMonthlySummary(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx
      .select({
        created: sql<number>`count(*) filter (where ${schema.tickets.createdAt} >= date_trunc('month', now()))::int`,
        resolved: sql<number>`count(*) filter (where ${schema.tickets.resolvedAt} >= date_trunc('month', now()))::int`,
        avgResolutionMin: sql<number | null>`(avg(extract(epoch from (${schema.tickets.resolvedAt} - ${schema.tickets.createdAt}))/60) filter (where ${schema.tickets.resolvedAt} >= date_trunc('month', now())))::int`,
        open: sql<number>`count(*) filter (where ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
        minutesLogged: sql<number>`coalesce(sum(${schema.tickets.timeSpentMinutes}) filter (where ${schema.tickets.resolvedAt} >= date_trunc('month', now())), 0)::int`,
      })
      .from(schema.tickets)
      .where(and(eq(schema.tickets.orgId, ctx.orgId), isNull(schema.tickets.deletedAt)));
    const [sla] = await tx
      .select({
        met: sql<number>`count(*) filter (where ${schema.slaTimers.metAt} is not null and ${schema.slaTimers.breachedAt} is null)::int`,
        total: sql<number>`count(*) filter (where ${schema.slaTimers.metAt} is not null)::int`,
      })
      .from(schema.slaTimers)
      .where(and(eq(schema.slaTimers.orgId, ctx.orgId), sql`${schema.slaTimers.metAt} >= date_trunc('month', now())`));
    const settings = await orgSettingsFor(tx, ctx.orgId);
    return { ...row!, slaMetPct: sla && sla.total > 0 ? Math.round((sla.met / sla.total) * 100) : null, minutesLogged: settings.showTimeToClient ? row!.minutesLogged : null };
  });
}
