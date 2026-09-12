import { DateTime } from "luxon";

/**
 * Business-hours calendar math (requirements.md §6). All inputs/outputs are UTC `Date`s; the calendar
 * carries its own IANA zone so DST is handled by luxon. `24x7` is the identity calendar.
 */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BusinessCalendar = {
  tz: string;
  hours: Record<DayKey, [string, string][]>;
  holidays: string[]; // ISO dates in the calendar's zone, e.g. "2026-02-04"
};
export type CalendarKind = "24x7" | "business";

export const DEFAULT_CALENDAR: BusinessCalendar = {
  tz: "Asia/Colombo",
  hours: {
    mon: [["09:00", "17:00"]],
    tue: [["09:00", "17:00"]],
    wed: [["09:00", "17:00"]],
    thu: [["09:00", "17:00"]],
    fri: [["09:00", "17:00"]],
    sat: [],
    sun: [],
  },
  holidays: [],
};

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX_DAYS = 400;

function dayKey(dt: DT): DayKey {
  return DAY_KEYS[dt.weekday - 1]!;
}

type DT = DateTime<boolean>;

function intervalsFor(dt: DT, cal: BusinessCalendar): [DT, DT][] {
  const iso = dt.toISODate();
  if (iso && cal.holidays.includes(iso)) return [];
  const spans = cal.hours[dayKey(dt)] ?? [];
  const out: [DT, DT][] = [];
  for (const [s, e] of spans) {
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    const start = dt.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
    const end = dt.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
    if (end > start) out.push([start, end]);
  }
  return out.sort((a, b) => a[0].toMillis() - b[0].toMillis());
}

/** Add `minutes` of working time to `start`. */
export function addBusinessMinutes(start: Date, minutes: number, cal: BusinessCalendar): Date {
  let remaining = Math.max(0, minutes) * 60_000;
  let cursor: DT = DateTime.fromJSDate(start, { zone: cal.tz });
  if (remaining === 0) {
    // Snap to the next working instant so a zero-length target is still "within hours".
    return nextWorkingInstant(start, cal);
  }
  for (let i = 0; i < MAX_DAYS; i++) {
    for (const [s, e] of intervalsFor(cursor, cal)) {
      if (cursor < s) cursor = s;
      if (cursor >= e) continue;
      const available = e.toMillis() - cursor.toMillis();
      if (available >= remaining) return cursor.plus({ milliseconds: remaining }).toJSDate();
      remaining -= available;
      cursor = e;
    }
    cursor = cursor.plus({ days: 1 }).startOf("day");
  }
  throw new Error("addBusinessMinutes: calendar has no working hours");
}

/** Working milliseconds elapsed between two instants. */
export function businessMsBetween(from: Date, to: Date, cal: BusinessCalendar): number {
  if (to <= from) return 0;
  const end: DT = DateTime.fromJSDate(to, { zone: cal.tz });
  let cursor: DT = DateTime.fromJSDate(from, { zone: cal.tz });
  let total = 0;
  for (let i = 0; i < MAX_DAYS && cursor < end; i++) {
    for (const [s, e] of intervalsFor(cursor, cal)) {
      const a = cursor > s ? cursor : s;
      const b = end < e ? end : e;
      if (b > a) total += b.toMillis() - a.toMillis();
    }
    cursor = cursor.plus({ days: 1 }).startOf("day");
  }
  return total;
}

export function businessMinutesBetween(from: Date, to: Date, cal: BusinessCalendar): number {
  return Math.floor(businessMsBetween(from, to, cal) / 60_000);
}

export function nextWorkingInstant(at: Date, cal: BusinessCalendar): Date {
  let cursor: DT = DateTime.fromJSDate(at, { zone: cal.tz });
  for (let i = 0; i < MAX_DAYS; i++) {
    for (const [s, e] of intervalsFor(cursor, cal)) {
      if (cursor < s) return s.toJSDate();
      if (cursor < e) return cursor.toJSDate();
    }
    cursor = cursor.plus({ days: 1 }).startOf("day");
  }
  throw new Error("nextWorkingInstant: calendar has no working hours");
}

export function isWithinBusinessHours(at: Date, cal: BusinessCalendar): boolean {
  const dt = DateTime.fromJSDate(at, { zone: cal.tz });
  return intervalsFor(dt, cal).some(([s, e]) => dt >= s && dt < e);
}

// --- Kind-aware helpers -----------------------------------------------------

export function addMinutesOnCalendar(start: Date, minutes: number, kind: CalendarKind, cal: BusinessCalendar): Date {
  return kind === "24x7" ? new Date(start.getTime() + minutes * 60_000) : addBusinessMinutes(start, minutes, cal);
}

export function msBetweenOnCalendar(from: Date, to: Date, kind: CalendarKind, cal: BusinessCalendar): number {
  return kind === "24x7" ? Math.max(0, to.getTime() - from.getTime()) : businessMsBetween(from, to, cal);
}
