import { describe, expect, it } from "vitest";
import { CLIENT_STATUS_LABEL, TICKET_STATUSES, TYPE_URGENCY_OPTIONS, isClientRole, isStaffRole, toClientStatus } from "@/lib/domain/types";

describe("domain vocabulary", () => {
  it("in_review collapses to in_progress for clients ('Being worked on')", () => {
    expect(toClientStatus("in_review")).toBe("in_progress");
    expect(CLIENT_STATUS_LABEL.in_review).toBe(CLIENT_STATUS_LABEL.in_progress);
    for (const s of TICKET_STATUSES) expect(toClientStatus(s)).not.toBe("in_review");
  });
  it("role families", () => {
    expect(isStaffRole("developer")).toBe(true);
    expect(isClientRole("developer")).toBe(false);
    expect(isClientRole("client_admin")).toBe(true);
  });
  it("questions and project enquiries only offer low urgency", () => {
    expect(TYPE_URGENCY_OPTIONS.question).toEqual(["low"]);
    expect(TYPE_URGENCY_OPTIONS.project_enquiry).toEqual(["low"]);
    expect(TYPE_URGENCY_OPTIONS.incident).toContain("high");
  });
});
