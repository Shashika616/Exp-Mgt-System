import { describe, expect, it } from "vitest";
import { canReviewSubmission, canSubmitForReview, validateReviewDecision, validateSubmission } from "@/lib/domain/review";

const good = { findings: "NaN in formatter", rootCause: "Intl bug", changesMade: "Patched", verification: "Unit test", proposedReply: "Fixed, please verify", timeMinutes: 120 };

describe("submission rules (requirements §5.4 rule 5)", () => {
  it("accepts a complete submission whose time matches the log", () => {
    expect(validateSubmission(good, 120)).toEqual({ ok: true });
  });
  it("requires findings, changes, verification and proposed reply", () => {
    const r = validateSubmission({ ...good, findings: " ", changesMade: "", verification: "", proposedReply: "" }, 120);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["changesMade", "findings", "proposedReply", "verification"]);
  });
  it("editing the auto-summed time needs a reason", () => {
    const r = validateSubmission({ ...good, timeMinutes: 90 }, 120);
    expect(r.ok).toBe(false);
    expect(validateSubmission({ ...good, timeMinutes: 90, timeAdjustReason: "timer left running" }, 120).ok).toBe(true);
  });
  it("only the assigned developer (or assigned staff) may submit", () => {
    expect(canSubmitForReview("developer", "d1", "d1")).toBe(true);
    expect(canSubmitForReview("developer", "d2", "d1")).toBe(false);
    expect(canSubmitForReview("client_user", "d1", "d1")).toBe(false);
  });
});

describe("review rules (requirements §5.4 rule 6, security.md review integrity)", () => {
  it("only lead/admin review; never own submission", () => {
    expect(canReviewSubmission("admin", "d1", "a1")).toBe(true);
    expect(canReviewSubmission("lead", "d1", "l1")).toBe(true);
    expect(canReviewSubmission("agent", "d1", "a1")).toBe(false);
    expect(canReviewSubmission("admin", "a1", "a1")).toBe(false);
  });
  it("approve needs reply + code; return needs notes; ask needs question", () => {
    expect(validateReviewDecision({ outcome: "approved", reply: "", resolutionCode: "fixed" }).ok).toBe(false);
    expect(validateReviewDecision({ outcome: "approved", reply: "ok", resolutionCode: "fixed" }).ok).toBe(true);
    expect(validateReviewDecision({ outcome: "returned", notes: "" }).ok).toBe(false);
    expect(validateReviewDecision({ outcome: "returned", notes: "more tests" }).ok).toBe(true);
    expect(validateReviewDecision({ outcome: "ask_client", question: "" }).ok).toBe(false);
    expect(validateReviewDecision({ outcome: "ask_client", question: "Which browser?" }).ok).toBe(true);
  });
});
