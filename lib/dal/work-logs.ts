import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import { isWorkLogEditable, timerToMinutes, validateMinutes } from "@/lib/domain/work-logs";
import type { WorkState } from "@/lib/domain/types";
import { emitEvent } from "./events";
import { loadTicketRow, setWorkState } from "./tickets";

export const workLogColumns = {
  id: schema.workLogs.id,
  ticketId: schema.workLogs.ticketId,
  userId: schema.workLogs.userId,
  userName: schema.users.fullName,
  loggedOn: schema.workLogs.loggedOn,
  minutes: schema.workLogs.minutes,
  note: schema.workLogs.note,
  workState: schema.workLogs.workState,
  startedAt: schema.workLogs.startedAt,
  endedAt: schema.workLogs.endedAt,
  createdAt: schema.workLogs.createdAt,
  updatedAt: schema.workLogs.updatedAt,
};

export async function listWorkLogs(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, (tx) => listWorkLogsInTx(tx, ticketId));
}

export async function listWorkLogsInTx(tx: Tx, ticketId: string) {
  const rows = await tx
    .select(workLogColumns)
    .from(schema.workLogs)
    .innerJoin(schema.users, eq(schema.users.id, schema.workLogs.userId))
    .where(and(eq(schema.workLogs.ticketId, ticketId), isNull(schema.workLogs.deletedAt)))
    .orderBy(desc(schema.workLogs.loggedOn), desc(schema.workLogs.createdAt));
  return rows.map((r) => ({ ...r, editable: isWorkLogEditable(r.createdAt) }));
}

export type WorkLogRow = Awaited<ReturnType<typeof listWorkLogsInTx>>[number];

export type WorkLogInput = { ticketId: string; minutes: number; note: string; loggedOn?: string; workState?: WorkState | null; startedAt?: Date | null; endedAt?: Date | null };

export async function addWorkLog(ctx: AuthContext, input: WorkLogInput) {
  const err = validateMinutes(input.minutes);
  if (err) throw new AppError("validation", err, { fields: { minutes: err } });
  return withContext(ctx, async (tx) => {
    const ticket = await loadTicketRow(tx, eq(schema.tickets.id, input.ticketId));
    if (!ticket) throw notFound();
    if (ctx.role === "developer" && ticket.assigneeId !== ctx.userId) throw notFound();
    if (ticket.status === "closed" || ticket.status === "cancelled") throw new AppError("invalid_transition", "Work cannot be logged on a closed ticket.");
    const [row] = await tx
      .insert(schema.workLogs)
      .values({ ticketId: ticket.id, orgId: ticket.orgId, userId: ctx.userId, minutes: input.minutes, note: input.note, loggedOn: input.loggedOn ?? sql`current_date`, workState: input.workState ?? null, startedAt: input.startedAt ?? null, endedAt: input.endedAt ?? null })
      .returning({ id: schema.workLogs.id });
    // Trigger recomputes tickets.time_spent_minutes; bump version for optimistic concurrency
    const [t] = await tx.update(schema.tickets).set({ updatedBy: ctx.userId, version: sql`${schema.tickets.version} + 1` }).where(eq(schema.tickets.id, ticket.id)).returning({ timeSpentMinutes: schema.tickets.timeSpentMinutes });
    await emitEvent(tx, ctx, { ticketId: ticket.id, orgId: ticket.orgId, kind: "work_logged", data: { workLogId: row!.id, minutes: input.minutes, workState: input.workState ?? null, total: t!.timeSpentMinutes } });
    return { id: row!.id, total: t!.timeSpentMinutes };
  });
}

/** After inserting the entry, optionally move the ticket's work_state (separate tx so the rule set stays in one place). */
export async function addWorkLogWithState(ctx: AuthContext, input: WorkLogInput) {
  const res = await addWorkLog(ctx, input);
  if (input.workState) {
    const current = await withContext(ctx, (tx) => loadTicketRow(tx, eq(schema.tickets.id, input.ticketId)));
    if (current && current.workState !== input.workState) await setWorkState(ctx, input.ticketId, input.workState, input.note);
  }
  return res;
}

export async function updateWorkLog(ctx: AuthContext, id: string, patch: { minutes?: number; note?: string; loggedOn?: string; workState?: WorkState | null }) {
  if (patch.minutes !== undefined) {
    const err = validateMinutes(patch.minutes);
    if (err) throw new AppError("validation", err, { fields: { minutes: err } });
  }
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select().from(schema.workLogs).where(and(eq(schema.workLogs.id, id), isNull(schema.workLogs.deletedAt))).limit(1);
    if (!row) throw notFound();
    if (row.userId !== ctx.userId && ctx.role !== "admin") throw notFound();
    if (!isWorkLogEditable(row.createdAt) && ctx.role !== "admin") throw new AppError("validation", "Work log entries lock 24 hours after they are created.");
    await tx.update(schema.workLogs).set(patch).where(eq(schema.workLogs.id, id));
    const [t] = await tx.update(schema.tickets).set({ updatedBy: ctx.userId, version: sql`${schema.tickets.version} + 1` }).where(eq(schema.tickets.id, row.ticketId)).returning({ timeSpentMinutes: schema.tickets.timeSpentMinutes });
    await emitEvent(tx, ctx, { ticketId: row.ticketId, orgId: row.orgId, kind: "work_log_edited", data: { workLogId: id, before: { minutes: row.minutes }, after: patch, total: t!.timeSpentMinutes } });
    return { total: t!.timeSpentMinutes };
  });
}

// --- Inline timer -------------------------------------------------------------

export async function getRunningTimer(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx
      .select({ ticketId: schema.workTimers.ticketId, startedAt: schema.workTimers.startedAt, key: schema.tickets.key, subject: schema.tickets.subject })
      .from(schema.workTimers)
      .innerJoin(schema.tickets, eq(schema.tickets.id, schema.workTimers.ticketId))
      .where(eq(schema.workTimers.userId, ctx.userId))
      .limit(1);
    return row ?? null;
  });
}

export async function startTimer(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, async (tx) => {
    const ticket = await loadTicketRow(tx, eq(schema.tickets.id, ticketId));
    if (!ticket) throw notFound();
    const existing = await tx.select({ ticketId: schema.workTimers.ticketId }).from(schema.workTimers).where(eq(schema.workTimers.userId, ctx.userId));
    if (existing.length && existing[0]!.ticketId !== ticketId) throw new AppError("conflict", "A timer is already running on another ticket. Stop it first.");
    const [row] = await tx.insert(schema.workTimers).values({ userId: ctx.userId, ticketId, orgId: ticket.orgId }).onConflictDoNothing().returning({ startedAt: schema.workTimers.startedAt });
    await emitEvent(tx, ctx, { ticketId, orgId: ticket.orgId, kind: "timer_started", data: {} });
    return { startedAt: row?.startedAt ?? new Date() };
  });
}

/** Stops the timer and returns prefill values for the work-log row (does not create the entry). */
export async function stopTimer(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.delete(schema.workTimers).where(and(eq(schema.workTimers.userId, ctx.userId), eq(schema.workTimers.ticketId, ticketId))).returning({ startedAt: schema.workTimers.startedAt, orgId: schema.workTimers.orgId });
    if (!row) throw new AppError("validation", "No timer is running on this ticket.");
    const endedAt = new Date();
    await emitEvent(tx, ctx, { ticketId, orgId: row.orgId, kind: "timer_stopped", data: { minutes: timerToMinutes(row.startedAt, endedAt) } });
    return { startedAt: row.startedAt, endedAt, minutes: timerToMinutes(row.startedAt, endedAt) };
  });
}

/** Minutes logged by a user today / this week / per day for the last 7 days (developer dashboard). */
export async function myTimeSummary(ctx: AuthContext, tz = "Asia/Colombo") {
  return withContext(ctx, async (tx) => {
    const rows = await tx
      .select({ day: schema.workLogs.loggedOn, minutes: sql<number>`sum(${schema.workLogs.minutes})::int` })
      .from(schema.workLogs)
      .where(and(eq(schema.workLogs.userId, ctx.userId), isNull(schema.workLogs.deletedAt), gte(schema.workLogs.loggedOn, sql`(now() at time zone ${tz})::date - 6`)))
      .groupBy(schema.workLogs.loggedOn);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const byDay = new Map(rows.map((r) => [String(r.day), r.minutes]));
    const days: { day: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: tz });
      days.push({ day: d, minutes: byDay.get(d) ?? 0 });
    }
    const week = days.reduce((a, d) => a + d.minutes, 0);
    return { today: byDay.get(today) ?? 0, week, days };
  });
}
