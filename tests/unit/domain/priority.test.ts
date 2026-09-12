import { describe, expect, it } from "vitest";
import { canOverridePriority, computePriority, priorityRank } from "@/lib/domain/priority";

describe("priority matrix (requirements §4.3)", () => {
  it.each([
    ["high", "high", "p1"],
    ["high", "medium", "p2"],
    ["high", "low", "p3"],
    ["medium", "high", "p2"],
    ["medium", "medium", "p3"],
    ["medium", "low", "p4"],
    ["low", "high", "p3"],
    ["low", "medium", "p4"],
    ["low", "low", "p4"],
  ] as const)("impact %s × urgency %s → %s", (impact, urgency, expected) => {
    expect(computePriority(impact, urgency)).toBe(expected);
  });

  it("new incident with urgency high and default impact medium lands as P2", () => {
    expect(computePriority("medium", "high")).toBe("p2");
  });

  it("only lead/admin may override", () => {
    expect(canOverridePriority("lead")).toBe(true);
    expect(canOverridePriority("admin")).toBe(true);
    expect(canOverridePriority("agent")).toBe(false);
    expect(canOverridePriority("developer")).toBe(false);
    expect(canOverridePriority("client_admin")).toBe(false);
  });

  it("ranks P1 first", () => {
    expect([...["p4", "p2", "p1", "p3"] as const].sort((a, b) => priorityRank(a) - priorityRank(b))).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
