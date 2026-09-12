import { describe, expect, it } from "vitest";
import { isWorkLogEditable, sumMinutes, timerToMinutes, validateMinutes } from "@/lib/domain/work-logs";

describe("work log rules (requirements §5.4 rule 2, FR-DEV-02)", () => {
  it("minutes must be a whole number between 1 and 1440", () => {
    expect(validateMinutes(0)).toMatch(/at least/);
    expect(validateMinutes(1441)).toMatch(/24 hours/);
    expect(validateMinutes(1.5)).toMatch(/whole/);
    expect(validateMinutes(30)).toBeNull();
  });
  it("entries are editable for 24 h", () => {
    const created = new Date("2026-09-12T10:00:00Z");
    expect(isWorkLogEditable(created, new Date("2026-09-13T09:59:00Z"))).toBe(true);
    expect(isWorkLogEditable(created, new Date("2026-09-13T10:00:01Z"))).toBe(false);
  });
  it("timer rounds up to the minute and clamps", () => {
    expect(timerToMinutes(new Date(0), new Date(61_000))).toBe(2);
    expect(timerToMinutes(new Date(0), new Date(10))).toBe(1);
    expect(timerToMinutes(new Date(0), new Date(100 * 3600_000))).toBe(1440);
  });
  it("sums exclude soft-deleted entries", () => {
    expect(sumMinutes([{ minutes: 30 }, { minutes: 45, deletedAt: new Date() }, { minutes: 15, deletedAt: null }])).toBe(45);
  });
});
