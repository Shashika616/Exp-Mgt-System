import type { ResolutionCode, Role } from "./types";
import { REVIEWER_ROLES } from "./types";

// requirements.md §5.4 rules 5–6 and security.md "Review integrity".

export type SubmissionInput = {
  findings: string;
  rootCause?: string | null;
  changesMade: string;
  verification: string;
  suggestedResolutionCode?: ResolutionCode | null;
  proposedReply: string;
  timeMinutes: number;
  timeAdjustReason?: string | null;
};

export type SubmissionValidation = { ok: true } | { ok: false; fields: Record<string, string> };

export function validateSubmission(input: SubmissionInput, loggedMinutes: number): SubmissionValidation {
  const fields: Record<string, string> = {};
  if (!input.findings.trim()) fields.findings = "Describe what you found";
  if (!input.changesMade.trim()) fields.changesMade = "Describe what was changed";
  if (!input.verification.trim()) fields.verification = "Describe how you verified the fix";
  if (!input.proposedReply.trim()) fields.proposedReply = "Write the reply the client will receive";
  if (input.timeMinutes < 0) fields.timeMinutes = "Time cannot be negative";
  if (input.timeMinutes !== loggedMinutes && !input.timeAdjustReason?.trim()) {
    fields.timeAdjustReason = "Explain why the total differs from the logged time";
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true };
}

export function canSubmitForReview(role: Role, assigneeId: string | null, userId: string): boolean {
  return (role === "developer" || role === "agent" || role === "lead" || role === "admin") && assigneeId === userId;
}

/** Only lead/admin review; a developer can never review their own submission even if later promoted. */
export function canReviewSubmission(role: Role, submissionDeveloperId: string, reviewerId: string): boolean {
  return REVIEWER_ROLES.includes(role) && submissionDeveloperId !== reviewerId;
}

export type ReviewDecision =
  | { outcome: "approved"; reply: string; resolutionCode: ResolutionCode }
  | { outcome: "returned"; notes: string }
  | { outcome: "ask_client"; question: string };

export function validateReviewDecision(d: ReviewDecision): SubmissionValidation {
  const fields: Record<string, string> = {};
  if (d.outcome === "approved") {
    if (!d.reply.trim()) fields.reply = "The reply to the client is required";
    if (!d.resolutionCode) fields.resolutionCode = "Choose a resolution code";
  } else if (d.outcome === "returned") {
    if (!d.notes.trim()) fields.notes = "Tell the developer what needs to change";
  } else if (!d.question.trim()) {
    fields.question = "Write the question for the client";
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true };
}
