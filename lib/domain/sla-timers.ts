import { addMinutesOnCalendar, msBetweenOnCalendar, type BusinessCalendar, type CalendarKind } from "./sla-calendar";
import type { Priority, SlaMetric, TicketType } from "./types";
import { TYPES_WITHOUT_RESOLUTION_SLA } from "./types";

/**
 * Pure SLA timer maths (requirements.md §6). A timer row accumulates `elapsedMs` while paused;
 * `startedAt` is the instant of the last (re)start. Breach is recorded but the clock keeps counting
 * overtime for reporting. Thresholds: at-risk 75 %, breached 100 %.
 */
export const AT_RISK_RATIO = 0.75;

export type SlaTargets = Record<Priority, { first_response_min: number; resolution_min: number | null; calendar: CalendarKind }>;

export const DEFAULT_SLA_TARGETS: SlaTargets = {
  p1: { first_response_min: 30, resolution_min: 240, calendar: "24x7" },
  p2: { first_response_min: 120, resolution_min: 1440, calendar: "24x7" }, // "1 business day" on a 24×7 clock = 24 h (Jira semantics)
  p3: { first_response_min: 480, resolution_min: 1440, calendar: "business" }, // 8 bh / 3 business days (8h days)
  p4: { first_response_min: 480, resolution_min: 2400, calendar: "business" }, // 1 bd / 5 business days
};

export type TimerRow = {
  metric: SlaMetric;
  calendar: CalendarKind;
  targetMinutes: number;
  startedAt: Date;
  pausedAt: Date | null;
  elapsedMs: number;
  dueAt: Date;
  atRiskNotified: boolean;
  breachedAt: Date | null;
  metAt: Date | null;
};

export type TimerState = "running" | "paused" | "met" | "breached" | "met_late";

export function newTimer(metric: SlaMetric, priority: Priority, ticketType: TicketType, targets: SlaTargets, cal: BusinessCalendar, now: Date): TimerRow | null {
  const t = targets[priority];
  const minutes = metric === "first_response" ? t.first_response_min : t.resolution_min;
  if (minutes == null) return null;
  if (metric === "resolution" && TYPES_WITHOUT_RESOLUTION_SLA.includes(ticketType)) return null;
  return {
    metric,
    calendar: t.calendar,
    targetMinutes: minutes,
    startedAt: now,
    pausedAt: null,
    elapsedMs: 0,
    dueAt: addMinutesOnCalendar(now, minutes, t.calendar, cal),
    atRiskNotified: false,
    breachedAt: null,
    metAt: null,
  };
}

/** Total working ms elapsed on the metric as of `now`. */
export function elapsedMs(timer: TimerRow, now: Date, cal: BusinessCalendar): number {
  if (timer.metAt) return timer.elapsedMs;
  if (timer.pausedAt) return timer.elapsedMs;
  return timer.elapsedMs + msBetweenOnCalendar(timer.startedAt, now, timer.calendar, cal);
}

export function targetMs(timer: TimerRow): number {
  return timer.targetMinutes * 60_000;
}

export function remainingMs(timer: TimerRow, now: Date, cal: BusinessCalendar): number {
  return targetMs(timer) - elapsedMs(timer, now, cal);
}

export function ratioElapsed(timer: TimerRow, now: Date, cal: BusinessCalendar): number {
  return elapsedMs(timer, now, cal) / targetMs(timer);
}

export function timerState(timer: TimerRow, now: Date, cal: BusinessCalendar): TimerState {
  if (timer.metAt) return timer.breachedAt ? "met_late" : "met";
  if (timer.pausedAt) return "paused";
  return ratioElapsed(timer, now, cal) >= 1 ? "breached" : "running";
}

export function isAtRisk(timer: TimerRow, now: Date, cal: BusinessCalendar): boolean {
  if (timer.metAt || timer.pausedAt) return false;
  const r = ratioElapsed(timer, now, cal);
  return r >= AT_RISK_RATIO && r < 1;
}

export function isBreached(timer: TimerRow, now: Date, cal: BusinessCalendar): boolean {
  if (timer.metAt) return !!timer.breachedAt;
  if (timer.pausedAt) return !!timer.breachedAt;
  return ratioElapsed(timer, now, cal) >= 1;
}

export function pause(timer: TimerRow, now: Date, cal: BusinessCalendar): TimerRow {
  if (timer.metAt || timer.pausedAt) return timer;
  return { ...timer, elapsedMs: elapsedMs(timer, now, cal), pausedAt: now };
}

export function resume(timer: TimerRow, now: Date, cal: BusinessCalendar): TimerRow {
  if (timer.metAt || !timer.pausedAt) return timer;
  const remainingMin = Math.max(0, (targetMs(timer) - timer.elapsedMs) / 60_000);
  return { ...timer, pausedAt: null, startedAt: now, dueAt: addMinutesOnCalendar(now, remainingMin, timer.calendar, cal) };
}

export function stop(timer: TimerRow, now: Date, cal: BusinessCalendar): TimerRow {
  if (timer.metAt) return timer;
  const el = elapsedMs(timer, now, cal);
  return {
    ...timer,
    elapsedMs: el,
    pausedAt: null,
    metAt: now,
    breachedAt: timer.breachedAt ?? (el >= targetMs(timer) ? now : null),
  };
}

/** Reopen: restart the resolution clock from remaining time (Jira behaviour). */
export function restartFromRemaining(timer: TimerRow, now: Date, cal: BusinessCalendar): TimerRow {
  const remainingMin = Math.max(0, (targetMs(timer) - timer.elapsedMs) / 60_000);
  return { ...timer, metAt: null, pausedAt: null, startedAt: now, dueAt: addMinutesOnCalendar(now, remainingMin, timer.calendar, cal) };
}

/** Lead extends a due date once (requirements.md §6). Extends the target by the given minutes. */
export function extend(timer: TimerRow, extraMinutes: number, now: Date, cal: BusinessCalendar): TimerRow {
  const next = { ...timer, targetMinutes: timer.targetMinutes + extraMinutes };
  if (next.metAt || next.pausedAt) return next;
  const remainingMin = Math.max(0, (targetMs(next) - elapsedMs(next, now, cal)) / 60_000);
  return { ...next, dueAt: addMinutesOnCalendar(now, remainingMin, next.calendar, cal) };
}

export type TickResult = {
  timer: TimerRow;
  nowAtRisk: boolean;
  nowBreached: boolean;
};

/** Called by the sla.tick job. Returns the updated row plus which notifications fire this tick. */
export function tick(timer: TimerRow, now: Date, cal: BusinessCalendar): TickResult {
  if (timer.metAt || timer.pausedAt) return { timer, nowAtRisk: false, nowBreached: false };
  const r = ratioElapsed(timer, now, cal);
  let next = timer;
  let nowAtRisk = false;
  let nowBreached = false;
  if (r >= 1 && !timer.breachedAt) {
    next = { ...next, breachedAt: now, atRiskNotified: true };
    nowBreached = true;
  } else if (r >= AT_RISK_RATIO && !timer.atRiskNotified) {
    next = { ...next, atRiskNotified: true };
    nowAtRisk = true;
  }
  return { timer: next, nowAtRisk, nowBreached };
}

/** Compact display state for badges. */
export type SlaBadge = { state: TimerState; ratio: number; dueAt: Date; remainingMs: number };
export function badge(timer: TimerRow, now: Date, cal: BusinessCalendar): SlaBadge {
  return { state: timerState(timer, now, cal), ratio: ratioElapsed(timer, now, cal), dueAt: timer.dueAt, remainingMs: remainingMs(timer, now, cal) };
}
