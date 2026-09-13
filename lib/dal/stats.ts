import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";

const OPEN = ["new", "open", "in_progress", "in_review", "pending_client", "on_hold"] as const;

/** FR-RP-01 tiles + developer load board + SLA attainment per client + escalations. */
export async function adminDashboard(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const [tiles] = await tx
      .select({
        open: sql<number>`count(*) filter (where ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
        unassigned: sql<number>`count(*) filter (where ${schema.tickets.assigneeId} is null and ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
        awaitingReview: sql<number>`count(*) filter (where ${schema.tickets.status} = 'in_review')::int`,
        resolvedToday: sql<number>`count(*) filter (where ${schema.tickets.resolvedAt} >= date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo')::int`,
        avgFirstResponse7: sql<number | null>`(avg(extract(epoch from (${schema.tickets.firstRespondedAt} - ${schema.tickets.createdAt}))/60) filter (where ${schema.tickets.firstRespondedAt} >= now() - interval '7 days'))::int`,
        avgFirstResponse30: sql<number | null>`(avg(extract(epoch from (${schema.tickets.firstRespondedAt} - ${schema.tickets.createdAt}))/60) filter (where ${schema.tickets.firstRespondedAt} >= now() - interval '30 days'))::int`,
        avgResolution7: sql<number | null>`(avg(extract(epoch from (${schema.tickets.resolvedAt} - ${schema.tickets.createdAt}))/60) filter (where ${schema.tickets.resolvedAt} >= now() - interval '7 days'))::int`,
        avgResolution30: sql<number | null>`(avg(extract(epoch from (${schema.tickets.resolvedAt} - ${schema.tickets.createdAt}))/60) filter (where ${schema.tickets.resolvedAt} >= now() - interval '30 days'))::int`,
      })
      .from(schema.tickets)
      .where(isNull(schema.tickets.deletedAt));
    const [slaTiles] = await tx
      .select({
        atRisk: sql<number>`count(distinct ${schema.slaTimers.ticketId}) filter (where ${schema.slaTimers.metAt} is null and ${schema.slaTimers.pausedAt} is null and ${schema.slaTimers.breachedAt} is null and ${schema.slaTimers.atRiskNotified})::int`,
        breachedToday: sql<number>`count(distinct ${schema.slaTimers.ticketId}) filter (where ${schema.slaTimers.breachedAt} >= date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo')::int`,
        breachedOpen: sql<number>`count(distinct ${schema.slaTimers.ticketId}) filter (where ${schema.slaTimers.breachedAt} is not null and ${schema.slaTimers.metAt} is null)::int`,
      })
      .from(schema.slaTimers)
      .innerJoin(schema.tickets, eq(schema.tickets.id, schema.slaTimers.ticketId))
      .where(and(isNull(schema.tickets.deletedAt), inArray(schema.tickets.status, [...OPEN, "resolved"])));

    const trend = await createdVsResolved(tx, 30, null);

    const loadBoard = await tx
      .select({
        id: schema.users.id,
        name: schema.users.fullName,
        assigned: sql<number>`count(${schema.tickets.id}) filter (where ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
        investigating: sql<number>`count(*) filter (where ${schema.tickets.workState} = 'investigating' and ${schema.tickets.status} in ('in_progress','on_hold','pending_client'))::int`,
        fixInProgress: sql<number>`count(*) filter (where ${schema.tickets.workState} = 'fix_in_progress' and ${schema.tickets.status} in ('in_progress','on_hold','pending_client'))::int`,
        fixReady: sql<number>`count(*) filter (where ${schema.tickets.workState} = 'fix_ready' and ${schema.tickets.status} in ('in_progress','in_review'))::int`,
        blocked: sql<number>`count(*) filter (where ${schema.tickets.workState} = 'blocked' and ${schema.tickets.status} in ('in_progress','on_hold','pending_client'))::int`,
        needsInfo: sql<number>`count(*) filter (where ${schema.tickets.workState} = 'needs_info' and ${schema.tickets.status} in ('in_progress','on_hold','pending_client'))::int`,
        inReview: sql<number>`count(*) filter (where ${schema.tickets.status} = 'in_review')::int`,
        hoursWeek: sql<number>`coalesce((select sum(minutes) from work_logs w where w.user_id = ${schema.users.id} and w.deleted_at is null and w.logged_on >= date_trunc('week', (now() at time zone 'Asia/Colombo'))::date), 0)::int`,
      })
      .from(schema.users)
      .leftJoin(schema.tickets, and(eq(schema.tickets.assigneeId, schema.users.id), isNull(schema.tickets.deletedAt)))
      .where(and(eq(schema.users.roleId, "developer"), eq(schema.users.status, "active"), isNull(schema.users.deletedAt)))
      .groupBy(schema.users.id, schema.users.fullName)
      .orderBy(asc(schema.users.fullName));

    const slaByClient = await tx
      .select({
        orgId: schema.organisations.id,
        orgName: schema.organisations.name,
        met: sql<number>`count(*) filter (where ${schema.slaTimers.metAt} is not null and ${schema.slaTimers.breachedAt} is null and ${schema.slaTimers.metAt} >= now() - interval '30 days')::int`,
        total: sql<number>`count(*) filter (where ${schema.slaTimers.metAt} is not null and ${schema.slaTimers.metAt} >= now() - interval '30 days')::int`,
        open: sql<number>`count(distinct ${schema.tickets.id}) filter (where ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
      })
      .from(schema.organisations)
      .leftJoin(schema.tickets, and(eq(schema.tickets.orgId, schema.organisations.id), isNull(schema.tickets.deletedAt)))
      .leftJoin(schema.slaTimers, eq(schema.slaTimers.ticketId, schema.tickets.id))
      .where(and(eq(schema.organisations.type, "client"), isNull(schema.organisations.deletedAt)))
      .groupBy(schema.organisations.id, schema.organisations.name)
      .orderBy(asc(schema.organisations.name));

    const escalations = await tx
      .select({ id: schema.tickets.id, key: schema.tickets.key, subject: schema.tickets.subject, priority: schema.tickets.priority, escalationLevel: schema.tickets.escalationLevel, escalatedAt: schema.tickets.escalatedAt, status: schema.tickets.status, orgName: schema.organisations.name })
      .from(schema.tickets)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.tickets.orgId))
      .where(and(isNull(schema.tickets.deletedAt), sql`${schema.tickets.escalatedAt} is not null`, inArray(schema.tickets.status, [...OPEN])))
      .orderBy(desc(schema.tickets.escalatedAt))
      .limit(8);

    return { tiles: { ...tiles!, ...slaTiles! }, trend, loadBoard, slaByClient, escalations };
  });
}

export type AdminDashboard = Awaited<ReturnType<typeof adminDashboard>>;

/** created vs resolved per day - last `days` days, from daily_ticket_stats with today computed live. */
export async function createdVsResolved(tx: Tx, days: number, orgId: string | null) {
  const rows = await tx
    .select({
      day: sql<string>`d::date::text`,
      created: sql<number>`count(t.id) filter (where t.created_at >= d and t.created_at < d + interval '1 day')::int`,
      resolved: sql<number>`count(t.id) filter (where t.resolved_at >= d and t.resolved_at < d + interval '1 day')::int`,
    })
    .from(sql`generate_series(date_trunc('day', now() at time zone 'Asia/Colombo') - (${days - 1} || ' days')::interval, date_trunc('day', now() at time zone 'Asia/Colombo'), interval '1 day') as d`)
    .leftJoin(sql`tickets t`, sql`t.deleted_at is null ${orgId ? sql`and t.org_id = ${orgId}` : sql``} and ((t.created_at >= d and t.created_at < d + interval '1 day') or (t.resolved_at >= d and t.resolved_at < d + interval '1 day'))`)
    .groupBy(sql`d`)
    .orderBy(sql`d`);
  return rows;
}

/** FR-RP-02 */
export async function developerDashboard(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const mine = await tx
      .select({
        id: schema.tickets.id,
        key: schema.tickets.key,
        subject: schema.tickets.subject,
        status: schema.tickets.status,
        priority: schema.tickets.priority,
        workState: schema.tickets.workState,
        orgName: schema.organisations.name,
        reviewOutcome: schema.tickets.reviewOutcome,
        reviewedAt: schema.tickets.reviewedAt,
        lastClientReplyAt: schema.tickets.lastClientReplyAt,
        lastStaffReplyAt: schema.tickets.lastStaffReplyAt,
        timeSpentMinutes: schema.tickets.timeSpentMinutes,
        updatedAt: schema.tickets.updatedAt,
        resDueAt: schema.slaTimers.dueAt,
        resBreached: schema.slaTimers.breachedAt,
        resAtRisk: schema.slaTimers.atRiskNotified,
        resPaused: schema.slaTimers.pausedAt,
      })
      .from(schema.tickets)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.tickets.orgId))
      .leftJoin(schema.slaTimers, and(eq(schema.slaTimers.ticketId, schema.tickets.id), eq(schema.slaTimers.metric, "resolution")))
      .where(and(eq(schema.tickets.assigneeId, ctx.userId), inArray(schema.tickets.status, [...OPEN]), isNull(schema.tickets.deletedAt)))
      .orderBy(asc(schema.tickets.priority), asc(schema.slaTimers.dueAt));
    return { mine };
  });
}

/** FR-RP-03 */
export async function agentDashboard(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const [pendingAging] = await tx
      .select({
        d1: sql<number>`count(*) filter (where ${schema.tickets.updatedAt} > now() - interval '1 day')::int`,
        d3: sql<number>`count(*) filter (where ${schema.tickets.updatedAt} <= now() - interval '1 day' and ${schema.tickets.updatedAt} > now() - interval '3 days')::int`,
        d7: sql<number>`count(*) filter (where ${schema.tickets.updatedAt} <= now() - interval '3 days' and ${schema.tickets.updatedAt} > now() - interval '7 days')::int`,
        older: sql<number>`count(*) filter (where ${schema.tickets.updatedAt} <= now() - interval '7 days')::int`,
      })
      .from(schema.tickets)
      .where(and(eq(schema.tickets.status, "pending_client"), isNull(schema.tickets.deletedAt)));
    const [fr] = await tx
      .select({
        met: sql<number>`count(*) filter (where ${schema.slaTimers.breachedAt} is null)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.slaTimers)
      .where(and(eq(schema.slaTimers.metric, "first_response"), sql`${schema.slaTimers.metAt} >= date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo'`));
    return { pendingAging: pendingAging!, firstResponseToday: fr! };
  });
}

/** Org page (FR-ORG-03) */
export async function orgStats(ctx: AuthContext, orgId: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx
      .select({
        open: sql<number>`count(*) filter (where ${schema.tickets.status} in ('new','open','in_progress','in_review','pending_client','on_hold'))::int`,
        resolved30: sql<number>`count(*) filter (where ${schema.tickets.resolvedAt} >= now() - interval '30 days')::int`,
        created30: sql<number>`count(*) filter (where ${schema.tickets.createdAt} >= now() - interval '30 days')::int`,
        minutes30: sql<number>`coalesce(sum(${schema.tickets.timeSpentMinutes}) filter (where ${schema.tickets.createdAt} >= now() - interval '30 days'),0)::int`,
      })
      .from(schema.tickets)
      .where(and(eq(schema.tickets.orgId, orgId), isNull(schema.tickets.deletedAt)));
    const [sla] = await tx
      .select({ met: sql<number>`count(*) filter (where ${schema.slaTimers.breachedAt} is null)::int`, total: sql<number>`count(*)::int` })
      .from(schema.slaTimers)
      .where(and(eq(schema.slaTimers.orgId, orgId), sql`${schema.slaTimers.metAt} >= now() - interval '30 days'`));
    const recent = await tx
      .select({ id: schema.ticketEvents.id, kind: schema.ticketEvents.kind, createdAt: schema.ticketEvents.createdAt, ticketKey: schema.tickets.key, subject: schema.tickets.subject, actorName: schema.users.fullName })
      .from(schema.ticketEvents)
      .innerJoin(schema.tickets, eq(schema.tickets.id, schema.ticketEvents.ticketId))
      .leftJoin(schema.users, eq(schema.users.id, schema.ticketEvents.actorId))
      .where(eq(schema.ticketEvents.orgId, orgId))
      .orderBy(desc(schema.ticketEvents.createdAt))
      .limit(15);
    return { ...row!, slaMetPct: sla && sla.total ? Math.round((sla.met / sla.total) * 100) : null, recent };
  });
}

/** Nightly aggregation job target (architecture.md §13). */
export async function refreshDailyStats(tx: Tx, day: string): Promise<void> {
  await tx.execute(sql`
    insert into daily_ticket_stats (day, org_id, created, resolved, closed, first_response_met, first_response_breached, resolution_met, resolution_breached, avg_first_response_min, avg_resolution_min, minutes_logged, updated_at)
    select ${day}::date, o.id,
      (select count(*) from tickets t where t.org_id = o.id and t.created_at::date = ${day}::date),
      (select count(*) from tickets t where t.org_id = o.id and t.resolved_at::date = ${day}::date),
      (select count(*) from tickets t where t.org_id = o.id and t.closed_at::date = ${day}::date),
      (select count(*) from sla_timers s where s.org_id = o.id and s.metric = 'first_response' and s.met_at::date = ${day}::date and s.breached_at is null),
      (select count(*) from sla_timers s where s.org_id = o.id and s.metric = 'first_response' and s.met_at::date = ${day}::date and s.breached_at is not null),
      (select count(*) from sla_timers s where s.org_id = o.id and s.metric = 'resolution' and s.met_at::date = ${day}::date and s.breached_at is null),
      (select count(*) from sla_timers s where s.org_id = o.id and s.metric = 'resolution' and s.met_at::date = ${day}::date and s.breached_at is not null),
      (select (avg(extract(epoch from (t.first_responded_at - t.created_at))/60))::int from tickets t where t.org_id = o.id and t.first_responded_at::date = ${day}::date),
      (select (avg(extract(epoch from (t.resolved_at - t.created_at))/60))::int from tickets t where t.org_id = o.id and t.resolved_at::date = ${day}::date),
      (select coalesce(sum(w.minutes),0) from work_logs w where w.org_id = o.id and w.logged_on = ${day}::date and w.deleted_at is null),
      now()
    from organisations o where o.type = 'client' and o.deleted_at is null
    on conflict (day, org_id) do update set
      created = excluded.created, resolved = excluded.resolved, closed = excluded.closed,
      first_response_met = excluded.first_response_met, first_response_breached = excluded.first_response_breached,
      resolution_met = excluded.resolution_met, resolution_breached = excluded.resolution_breached,
      avg_first_response_min = excluded.avg_first_response_min, avg_resolution_min = excluded.avg_resolution_min,
      minutes_logged = excluded.minutes_logged, updated_at = now()`);
}

export async function dailyStats(ctx: AuthContext, days = 30) {
  return withContext(ctx, (tx) =>
    tx
      .select()
      .from(schema.dailyTicketStats)
      .where(gte(schema.dailyTicketStats.day, sql`(current_date - ${days}::int)::date`))
      .orderBy(asc(schema.dailyTicketStats.day)),
  );
}
