import { describe, expect, it } from "vitest";
import { TRANSITIONS, actionsFor, availableActions, canTransition, transition, type TicketSnapshot } from "@/lib/domain/ticket-machine";
import { ROLES, TICKET_STATUSES, type Role } from "@/lib/domain/types";

const base: TicketSnapshot = { id: "t1", status: "new", requesterId: "client-1", assigneeId: null, orgId: "org-1", workState: null, reopenedCount: 0 };
const actor = (role: Role, userId = "u1", orgId = "org-1") => ({ role, userId, orgId });
const now = new Date("2026-09-12T10:00:00Z");

describe("ticket state machine (requirements §5.2)", () => {
  it("covers every status", () => {
    for (const s of TICKET_STATUSES) expect(TRANSITIONS[s]).toBeDefined();
    expect(Object.keys(TRANSITIONS.closed)).toHaveLength(0);
    expect(Object.keys(TRANSITIONS.cancelled)).toHaveLength(0);
  });

  it("new → open via acknowledge (staff)", () => {
    const r = transition(base, "acknowledge", actor("agent"), {}, now);
    expect(r.to).toBe("open");
    expect(r.event.visibility).toBe("public");
  });

  it("agent takes a new ticket → in_progress stops first-response clock", () => {
    const r = transition(base, "start", actor("agent"), {}, now);
    expect(r.to).toBe("in_progress");
    expect(r.effects).toContain("sla.stop_first_response");
  });

  it("resolve requires code and note", () => {
    const t = { ...base, status: "in_progress" as const };
    expect(() => transition(t, "resolve", actor("agent"), {}, now)).toThrow(/resolution code/i);
    expect(() => transition(t, "resolve", actor("agent"), { resolutionCode: "fixed" }, now)).toThrow(/resolution note/i);
    const r = transition(t, "resolve", actor("agent"), { resolutionCode: "fixed", resolutionNote: "Done" }, now);
    expect(r.to).toBe("resolved");
    expect(r.patch.resolvedAt).toEqual(now);
    expect(r.patch.workState).toBeNull();
    expect(r.effects).toContain("notify.requester");
  });

  it("on_hold requires a reason; 'other' requires a note", () => {
    const t = { ...base, status: "in_progress" as const, assigneeId: "dev-1" };
    expect(() => transition(t, "hold", actor("developer", "dev-1"), {}, now)).toThrow(/hold reason/i);
    expect(() => transition(t, "hold", actor("developer", "dev-1"), { holdReason: "other" }, now)).toThrow(/explain/i);
    const r = transition(t, "hold", actor("developer", "dev-1"), { holdReason: "awaiting_vendor" }, now);
    expect(r.to).toBe("on_hold");
    expect(r.patch.holdReason).toBe("awaiting_vendor");
    expect(r.effects).toContain("sla.pause_resolution");
  });

  it("cancel requires a reason", () => {
    expect(() => transition(base, "cancel", actor("agent"), {}, now)).toThrow(/reason/i);
    const r = transition(base, "cancel", actor("agent"), { reason: "dup" }, now);
    expect(r.to).toBe("cancelled");
    expect(r.patch.cancelReason).toBe("dup");
  });

  describe("client rules", () => {
    it("client may cancel only before work starts", () => {
      expect(transition(base, "cancel", actor("client_user", "client-1"), { reason: "no longer needed" }, now).to).toBe("cancelled");
      expect(transition({ ...base, status: "open" }, "cancel", actor("client_user", "client-1"), { reason: "x" }, now).patch.resolutionCode).toBe("cancelled_by_client");
      expect(() => transition({ ...base, status: "in_progress" }, "cancel", actor("client_user", "client-1"), { reason: "x" }, now)).toThrow();
    });
    it("client may reopen and close a resolved ticket", () => {
      const t = { ...base, status: "resolved" as const, reopenedCount: 1 };
      const r = transition(t, "reopen", actor("client_admin", "c2"), {}, now);
      expect(r.to).toBe("open");
      expect(r.patch.reopenedCount).toBe(2);
      expect(r.patch.resolutionCode).toBeNull();
      expect(r.effects).toContain("sla.restart_resolution_remaining");
      expect(transition(t, "close", actor("client_user", "client-1"), {}, now).to).toBe("closed");
    });
    it("client from another org is rejected", () => {
      expect(() => transition({ ...base, status: "resolved" }, "reopen", actor("client_user", "x", "org-2"), {}, now)).toThrow(/organisation/i);
    });
    it("client cannot resolve or start", () => {
      expect(canTransition("open", "resolve", "client_user")).toBe(false);
      expect(canTransition("open", "start", "client_admin")).toBe(false);
    });
    it("client reply moves pending_client → in_progress and resumes the clock", () => {
      const r = transition({ ...base, status: "pending_client" }, "client_reply", actor("client_user", "client-1"), {}, now);
      expect(r.to).toBe("in_progress");
      expect(r.effects).toContain("sla.resume_resolution");
    });
  });

  describe("developer rules (requirements §5.4, FR-DEV-06)", () => {
    const t = { ...base, status: "in_progress" as const, assigneeId: "dev-1" };
    it("cannot resolve, close, cancel", () => {
      expect(canTransition("in_progress", "resolve", "developer")).toBe(false);
      expect(canTransition("in_progress", "cancel", "developer")).toBe(false);
      expect(canTransition("resolved", "close", "developer")).toBe(false);
      expect(canTransition("resolved", "reopen", "developer")).toBe(false);
    });
    it("can submit, hold, ask client — only when assigned", () => {
      expect(transition(t, "submit", actor("developer", "dev-1"), { submissionId: "s1" }, now).to).toBe("in_review");
      expect(() => transition(t, "submit", actor("developer", "dev-2"), { submissionId: "s1" }, now)).toThrow(/assigned developer/i);
      expect(transition(t, "ask_client", actor("developer", "dev-1"), {}, now).to).toBe("pending_client");
    });
    it("submit requires a submission and sets submitted_at/by", () => {
      expect(() => transition(t, "submit", actor("developer", "dev-1"), {}, now)).toThrow(/submission/i);
      const r = transition(t, "submit", actor("developer", "dev-1"), { submissionId: "s1" }, now);
      expect(r.patch.submittedAt).toEqual(now);
      expect(r.patch.submittedBy).toBe("dev-1");
      expect(r.event.visibility).toBe("internal"); // client label unchanged: "Being worked on"
      expect(r.effects).toContain("notify.reviewers");
    });
  });

  describe("review (requirements §5.4 rule 6)", () => {
    const t = { ...base, status: "in_review" as const, assigneeId: "dev-1" };
    it("only lead/admin may approve or return", () => {
      expect(canTransition("in_review", "approve", "agent")).toBe(false);
      expect(canTransition("in_review", "return", "developer")).toBe(false);
      expect(canTransition("in_review", "approve", "lead")).toBe(true);
      expect(canTransition("in_review", "return", "admin")).toBe(true);
    });
    it("return requires notes and goes back to in_progress, developer notified", () => {
      expect(() => transition(t, "return", actor("admin"), {}, now)).toThrow(/notes/i);
      const r = transition(t, "return", actor("admin"), { reviewNotes: "Add tests" }, now);
      expect(r.to).toBe("in_progress");
      expect(r.patch.reviewOutcome).toBe("returned");
      expect(r.effects).toContain("notify.developer");
      expect(r.event.visibility).toBe("internal");
    });
    it("approve resolves with the reviewer's reply as resolution note", () => {
      const r = transition(t, "approve", actor("admin"), { resolutionCode: "fixed", resolutionNote: "Fixed the export" }, now);
      expect(r.to).toBe("resolved");
      expect(r.patch.resolutionNote).toBe("Fixed the export");
      expect(r.patch.reviewOutcome).toBe("approved");
      expect(r.effects).toEqual(expect.arrayContaining(["sla.stop_resolution", "notify.requester", "notify.developer"]));
      expect(r.event.visibility).toBe("public");
    });
    it("admin can ask the client during review", () => {
      expect(transition(t, "ask_client", actor("lead"), {}, now).to).toBe("pending_client");
    });
  });

  it("closed and cancelled are terminal", () => {
    for (const role of ROLES) {
      expect(availableActions("closed", role)).toEqual([]);
      expect(availableActions("cancelled", role)).toEqual([]);
    }
    expect(() => transition({ ...base, status: "closed" }, "reopen", actor("admin"), {}, now)).toThrow(/cannot reopen/i);
  });

  it("there is no automatic close — every close is a human action", () => {
    for (const s of TICKET_STATUSES) {
      for (const a of Object.keys(TRANSITIONS[s])) expect(a).not.toMatch(/auto/);
    }
  });

  it("actionsFor hides actions a developer cannot take on unassigned tickets", () => {
    expect(actionsFor({ status: "in_progress", assigneeId: "dev-2" }, actor("developer", "dev-1"))).toEqual([]);
    expect(actionsFor({ status: "in_progress", assigneeId: "dev-1" }, actor("developer", "dev-1"))).toEqual(expect.arrayContaining(["submit", "hold", "ask_client"]));
    expect(actionsFor({ status: "resolved", assigneeId: null }, actor("client_user", "client-1"))).toEqual(["reopen", "close"]);
    expect(actionsFor({ status: "in_progress", assigneeId: null }, actor("client_user", "client-1"))).toEqual([]);
  });
});
