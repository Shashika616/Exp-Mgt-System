import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { DEFAULT_CALENDAR, addBusinessMinutes, addMinutesOnCalendar, businessMinutesBetween, businessMsBetween, isWithinBusinessHours, msBetweenOnCalendar, nextWorkingInstant } from "@/lib/domain/sla-calendar";

// Asia/Colombo is UTC+5:30, no DST. Mon 2026-09-14.
const colombo = (iso: string) => DateTime.fromISO(iso, { zone: "Asia/Colombo" }).toJSDate();

describe("business-hours calendar (requirements §6)", () => {
  it("adds minutes within a working day", () => {
    expect(addBusinessMinutes(colombo("2026-09-14T09:00"), 60, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-14T10:00"));
  });
  it("rolls over the end of day to the next morning", () => {
    expect(addBusinessMinutes(colombo("2026-09-14T16:30"), 60, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-15T09:30"));
  });
  it("skips the weekend", () => {
    // Friday 16:00 + 8 business hours → Monday 16:00 (1h Fri + 7h Mon)
    expect(addBusinessMinutes(colombo("2026-09-18T16:00"), 480, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-21T16:00"));
  });
  it("skips holidays", () => {
    const cal = { ...DEFAULT_CALENDAR, holidays: ["2026-09-15"] };
    expect(addBusinessMinutes(colombo("2026-09-14T16:30"), 60, cal)).toEqual(colombo("2026-09-16T09:30"));
  });
  it("starts outside hours → counts from the next opening", () => {
    expect(addBusinessMinutes(colombo("2026-09-13T20:00"), 30, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-14T09:30")); // Sunday evening
    expect(addBusinessMinutes(colombo("2026-09-14T07:00"), 30, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-14T09:30"));
  });
  it("3 business days = 24 business hours", () => {
    expect(addBusinessMinutes(colombo("2026-09-14T09:00"), 1440, DEFAULT_CALENDAR)).toEqual(colombo("2026-09-16T17:00"));
  });
  it("measures elapsed working time across days and weekends", () => {
    expect(businessMinutesBetween(colombo("2026-09-14T16:00"), colombo("2026-09-15T10:00"), DEFAULT_CALENDAR)).toBe(120);
    expect(businessMinutesBetween(colombo("2026-09-18T16:00"), colombo("2026-09-21T10:00"), DEFAULT_CALENDAR)).toBe(120);
    expect(businessMsBetween(colombo("2026-09-14T10:00"), colombo("2026-09-14T09:00"), DEFAULT_CALENDAR)).toBe(0);
  });
  it("round-trips: elapsed(start, add(start, n)) === n", () => {
    for (const n of [1, 45, 480, 1000, 2400]) {
      const start = colombo("2026-09-14T11:17");
      expect(businessMinutesBetween(start, addBusinessMinutes(start, n, DEFAULT_CALENDAR), DEFAULT_CALENDAR)).toBe(n);
    }
  });
  it("nextWorkingInstant / isWithinBusinessHours", () => {
    expect(nextWorkingInstant(colombo("2026-09-12T12:00"), DEFAULT_CALENDAR)).toEqual(colombo("2026-09-14T09:00")); // Saturday
    expect(isWithinBusinessHours(colombo("2026-09-14T12:00"), DEFAULT_CALENDAR)).toBe(true);
    expect(isWithinBusinessHours(colombo("2026-09-14T18:00"), DEFAULT_CALENDAR)).toBe(false);
  });
  it("24x7 calendar is wall-clock", () => {
    const start = colombo("2026-09-12T12:00");
    expect(addMinutesOnCalendar(start, 30, "24x7", DEFAULT_CALENDAR)).toEqual(new Date(start.getTime() + 30 * 60_000));
    expect(msBetweenOnCalendar(start, new Date(start.getTime() + 90_000), "24x7", DEFAULT_CALENDAR)).toBe(90_000);
  });
  it("handles DST calendars (Europe/London spring forward)", () => {
    const cal = { ...DEFAULT_CALENDAR, tz: "Europe/London" };
    const start = DateTime.fromISO("2026-03-27T16:00", { zone: "Europe/London" }).toJSDate(); // Friday before DST switch (29 Mar)
    const end = addBusinessMinutes(start, 120, cal);
    expect(DateTime.fromJSDate(end, { zone: "Europe/London" }).toISO()).toMatch(/^2026-03-30T10:00/);
  });
  it("throws when the calendar has no working hours", () => {
    const empty = { ...DEFAULT_CALENDAR, hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
    expect(() => addBusinessMinutes(new Date(), 10, empty)).toThrow();
  });
});
