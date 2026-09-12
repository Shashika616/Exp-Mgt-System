import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { DEFAULT_CALENDAR, type BusinessCalendar } from "@/lib/domain/sla-calendar";
import {
  DEFAULT_SLA_TARGETS,
  newTimer,
  pause,
  restartFromRemaining,
  resume,
  stop,
  type SlaTargets,
  type TimerRow,
} from "@/lib/domain/sla-timers";
import type { Effect } from "@/lib/domain/ticket-machine";
import type { Priority, SlaMetric, TicketType } from "@/lib/domain/types";

export type SlaPolicy = { id: string; name: string; calendar: BusinessCalendar; targets: SlaTargets; isDefault: boolean };

/** Effective policy for an org: the org's policy, else the default policy, else code defaults. */
export async function policyForOrg(tx: Tx, orgId: string): Promise<SlaPolicy> {
  const [row] = await tx
    .select({
      id: schema.slaPolicies.id,
      name: schema.slaPolicies.name,
      calendar: schema.slaPolicies.calendar,
      targets: schema.slaPolicies.targets,
      isDefault: schema.slaPolicies.isDefault,
    })
    .from(schema.organisations)
    .innerJoin(schema.slaPolicies, eq(schema.slaPolicies.id, schema.organisations.slaPolicyId))
    .where(eq(schema.organisations.id, orgId))
    .limit(1);
  if (row) return row as SlaPolicy;
  const [def] = await tx.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.isDefault, true)).limit(1);
  if (def) return { id: def.id, name: def.name, calendar: def.calendar as BusinessCalendar, targets: def.targets as SlaTargets, isDefault: true };
  return { id: "", name: "Default", calendar: DEFAULT_CALENDAR, targets: DEFAULT_SLA_TARGETS, isDefault: true };
}

export async function listPolicies(ctx: AuthContext) {
  return withContext(ctx, (tx) => tx.select().from(schema.slaPolicies).orderBy(asc(schema.slaPolicies.name)));
}

export async function getPolicy(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.id, id)).limit(1);
    return row ?? null;
  });
}

export async function upsertPolicy(ctx: AuthContext, input: { id?: string; name: string; calendar: BusinessCalendar; targets: SlaTargets; isDefault?: boolean }) {
  return withContext(ctx, async (tx) => {
    if (input.isDefault) await tx.update(schema.slaPolicies).set({ isDefault: false }).where(eq(schema.slaPolicies.isDefault, true));
    if (input.id) {
      const [row] = await tx
        .update(schema.slaPolicies)
        .set({ name: input.name, calendar: input.calendar, targets: input.targets, isDefault: input.isDefault ?? false })
        .where(eq(schema.slaPolicies.id, input.id))
        .returning();
      return row!;
    }
    const [row] = await tx.insert(schema.slaPolicies).values({ name: input.name, calendar: input.calendar, targets: input.targets, isDefault: input.isDefault ?? false }).returning();
    return row!;
  });
}

function toRow(t: typeof schema.slaTimers.$inferSelect): TimerRow & { id: string } {
  return {
    id: t.id,
    metric: t.metric,
    calendar: t.calendar as "24x7" | "business",
    targetMinutes: t.targetMinutes,
    startedAt: t.startedAt,
    pausedAt: t.pausedAt,
    elapsedMs: Number(t.elapsedMs),
    dueAt: t.dueAt,
    atRiskNotified: t.atRiskNotified,
    breachedAt: t.breachedAt,
    metAt: t.metAt,
  };
}

export async function timersForTicket(tx: Tx, ticketId: string): Promise<(TimerRow & { id: string })[]> {
  const rows = await tx.select().from(schema.slaTimers).where(eq(schema.slaTimers.ticketId, ticketId));
  return rows.map(toRow);
}

export async function startTimers(tx: Tx, t: { id: string; orgId: string; priority: Priority; type: TicketType }, policy: SlaPolicy, now: Date): Promise<void> {
  for (const metric of ["first_response", "resolution"] as SlaMetric[]) {
    const timer = newTimer(metric, t.priority, t.type, policy.targets, policy.calendar, now);
    if (!timer) continue;
    await tx
      .insert(schema.slaTimers)
      .values({ ticketId: t.id, orgId: t.orgId, metric, calendar: timer.calendar, targetMinutes: timer.targetMinutes, startedAt: timer.startedAt, dueAt: timer.dueAt })
      .onConflictDoNothing();
  }
}

/** Re-target running timers when priority changes: keep elapsed, recompute due from the new target. */
export async function retargetTimers(tx: Tx, t: { id: string; priority: Priority; type: TicketType }, policy: SlaPolicy, now: Date): Promise<void> {
  const rows = await timersForTicket(tx, t.id);
  for (const timer of rows) {
    if (timer.metAt) continue;
    const fresh = newTimer(timer.metric, t.priority, t.type, policy.targets, policy.calendar, now);
    if (!fresh) continue;
    const el = timer.pausedAt ? timer.elapsedMs : timer.elapsedMs + Math.max(0, now.getTime() - timer.startedAt.getTime());
    const remainingMin = Math.max(0, (fresh.targetMinutes * 60_000 - el) / 60_000);
    const { addMinutesOnCalendar } = await import("@/lib/domain/sla-calendar");
    await tx
      .update(schema.slaTimers)
      .set({
        targetMinutes: fresh.targetMinutes,
        calendar: fresh.calendar,
        dueAt: timer.pausedAt ? timer.dueAt : addMinutesOnCalendar(now, remainingMin, fresh.calendar, policy.calendar),
        atRiskNotified: false,
      })
      .where(eq(schema.slaTimers.id, timer.id));
  }
}

async function saveTimer(tx: Tx, id: string, t: TimerRow): Promise<void> {
  await tx
    .update(schema.slaTimers)
    .set({
      startedAt: t.startedAt,
      pausedAt: t.pausedAt,
      elapsedMs: t.elapsedMs,
      dueAt: t.dueAt,
      metAt: t.metAt,
      breachedAt: t.breachedAt,
      atRiskNotified: t.atRiskNotified,
      targetMinutes: t.targetMinutes,
    })
    .where(eq(schema.slaTimers.id, id));
}

/** Apply state-machine SLA effects to a ticket's timers in the current transaction. */
export async function applySlaEffects(tx: Tx, ticketId: string, effects: readonly Effect[], cal: BusinessCalendar, now: Date): Promise<void> {
  const timers = await timersForTicket(tx, ticketId);
  for (const timer of timers) {
    let next: TimerRow = timer;
    for (const e of effects) {
      if (e === "sla.stop_first_response" && timer.metric === "first_response") next = stop(next, now, cal);
      if (timer.metric === "resolution") {
        if (e === "sla.stop_resolution") next = stop(next, now, cal);
        if (e === "sla.pause_resolution") next = pause(next, now, cal);
        if (e === "sla.resume_resolution") next = resume(next, now, cal);
        if (e === "sla.restart_resolution_remaining") next = restartFromRemaining(next, now, cal);
      }
    }
    if (next !== timer) await saveTimer(tx, timer.id, next);
  }
}

export async function stopFirstResponse(tx: Tx, ticketId: string, cal: BusinessCalendar, now: Date): Promise<void> {
  await applySlaEffects(tx, ticketId, ["sla.stop_first_response"], cal, now);
}

export async function extendTimer(tx: Tx, ticketId: string, metric: SlaMetric, extraMinutes: number, cal: BusinessCalendar, now: Date, ctx: AuthContext, reason: string): Promise<void> {
  const { extend } = await import("@/lib/domain/sla-timers");
  const [t] = (await timersForTicket(tx, ticketId)).filter((x) => x.metric === metric);
  if (!t) return;
  const next = extend(t, extraMinutes, now, cal);
  await saveTimer(tx, t.id, next);
  await tx.update(schema.slaTimers).set({ adjustedBy: ctx.userId, adjustReason: reason }).where(eq(schema.slaTimers.id, t.id));
}

/** All running (not met, not paused) timers with their org calendar - for the SLA tick job. */
export async function runningTimers(tx: Tx) {
  return tx
    .select({
      timer: schema.slaTimers,
      ticketId: schema.tickets.id,
      ticketKey: schema.tickets.key,
      ticketOrgId: schema.tickets.orgId,
      subject: schema.tickets.subject,
      assigneeId: schema.tickets.assigneeId,
      escalationLevel: schema.tickets.escalationLevel,
      status: schema.tickets.status,
    })
    .from(schema.slaTimers)
    .innerJoin(schema.tickets, eq(schema.tickets.id, schema.slaTimers.ticketId))
    .where(and(isNull(schema.slaTimers.metAt), isNull(schema.slaTimers.pausedAt), isNull(schema.tickets.deletedAt)))
    .orderBy(asc(schema.slaTimers.dueAt))
    .limit(2000);
}

export async function markTimer(tx: Tx, id: string, patch: Partial<{ atRiskNotified: boolean; breachedAt: Date | null }>): Promise<void> {
  await tx.update(schema.slaTimers).set(patch).where(eq(schema.slaTimers.id, id));
}

export const nowSql = sql`now()`;
