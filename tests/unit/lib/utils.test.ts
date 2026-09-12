import { describe, expect, it } from "vitest";
import { formatMinutes, initials, relativeTime, slugify } from "@/lib/utils";

describe("utils", () => {
  it("formatMinutes", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(275)).toBe("4h 35m");
  });
  it("initials", () => expect(initials("Nimal Perera")).toBe("NP"));
  it("slugify", () => expect(slugify("Ceylon Agro Holdings (Pvt) Ltd")).toBe("ceylon-agro-holdings-pvt-ltd"));
  it("relativeTime", () => {
    const now = new Date("2026-09-12T10:00:00Z");
    expect(relativeTime(new Date("2026-09-12T09:59:50Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-09-12T09:55:00Z"), now)).toBe("5m ago");
    expect(relativeTime(new Date("2026-09-12T12:00:00Z"), now)).toBe("in 2h");
    expect(relativeTime(new Date("2026-09-05T10:00:00Z"), now)).toBe("1w ago");
  });
});
