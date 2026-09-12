import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import { canReviewSubmission, canSubmitForReview, validateReviewDecision, validateSubmission, type ReviewDecision, type SubmissionInput } from "@/lib/domain/review";
import { createCommentInTx } from "./comments";
import { emitEvent } from "./events";
import { loadTicketRow, transitionInTx } from "./tickets";

export const submissionColumns = {
  id: schema.submissions.id,
  ticketId: schema.submissions.ticketId,
  developerId: schema.submissions.developerId,
  developerName: schema.users.fullName,
  findings: schema.submissions.findings,
  rootCause: schema.submissions.rootCause,
  changesMade: schema.submissions.changesMade,
  verification: schema.submissions.verification,
  suggestedResolutionCode: schema.submissions.suggestedResolutionCode,
  proposedReply: schema.submissions.proposedReply,
  timeMinutes: schema.submissions.timeMinutes,
  timeAdjustReason: schema.submissions.timeAdjustReason,
  submittedAt: schema.submissions.submittedAt,
  outcome: schema.submissions.outcome,
  reviewerId: schema.submissions.reviewerId,
  reviewedAt: schema.submissions.reviewedAt,
  reviewNotes: schema.submissions.reviewNotes,
  sentReply: schema.submissions.sentReply,
};

export async function listSubmissionsInTx(tx: Tx, ticketId: string) {
  return tx
    .select(submissionColumns)
    .from(schema.submissions)
    .innerJoin(schema.users, eq(schema.users.id, schema.submissions.developerId))
    .where(eq(schema.submissions.ticketId, ticketId))
    .orderBy(desc(schema.submissions.submittedAt));
}

export async function listSubmissions(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, (tx) => listSubmissionsInTx(tx, ticketId));
}

export type SubmissionRow = Awaited<ReturnType<typeof listSubmissionsInTx>>[number];

/** FR-DEV-04: structured hand-off → `in_review`, notifies reviewers. */
export async function submitForReview(ctx: AuthContext, ticketId: string, input: SubmissionInput, expectedVersion?: number) {
  return withContext(ctx, async (tx) => {
    const ticket = await loadTicketRow(tx, eq(schema.tickets.id, ticketId));
    if (!ticket) throw notFound();
    if (!canSubmitForReview(ctx.role, ticket.assigneeId, ctx.userId)) throw new AppError("forbidden", "Only the assigned developer can submit this ticket for review.");
    const v = validateSubmission(input, ticket.timeSpentMinutes);
    if (!v.ok) throw new AppError("validation", "Please complete the submission.", { fields: v.fields });
    const [s] = await tx
      .insert(schema.submissions)
      .values({
        ticketId,
        orgId: ticket.orgId,
        developerId: ctx.userId,
        findings: input.findings,
        rootCause: input.rootCause ?? null,
        changesMade: input.changesMade,
        verification: input.verification,
        suggestedResolutionCode: input.suggestedResolutionCode ?? null,
        proposedReply: input.proposedReply,
        timeMinutes: input.timeMinutes,
        timeAdjustReason: input.timeAdjustReason ?? null,
      })
      .returning({ id: schema.submissions.id });
    await emitEvent(tx, ctx, { ticketId, orgId: ticket.orgId, kind: "submitted", data: { submissionId: s!.id, timeMinutes: input.timeMinutes, suggestedResolutionCode: input.suggestedResolutionCode ?? null } });
    const res = await transitionInTx(tx, ctx, ticketId, "submit", { submissionId: s!.id }, { expectedVersion });
    await tx.update(schema.tickets).set({ workState: "fix_ready" }).where(and(eq(schema.tickets.id, ticketId), isNull(schema.tickets.workState)));
    return { submissionId: s!.id, version: res.version };
  });
}

/** FR-DEV-07: approve & reply / return / ask client. Submissions are immutable once decided (trigger + RLS). */
export async function reviewSubmission(ctx: AuthContext, ticketId: string, decision: ReviewDecision, expectedVersion?: number) {
  return withContext(ctx, async (tx) => {
    const ticket = await loadTicketRow(tx, eq(schema.tickets.id, ticketId));
    if (!ticket) throw notFound();
    if (ticket.status !== "in_review") throw new AppError("invalid_transition", "This ticket is not awaiting review.");
    const [sub] = await tx.select().from(schema.submissions).where(and(eq(schema.submissions.ticketId, ticketId), isNull(schema.submissions.outcome))).orderBy(desc(schema.submissions.submittedAt)).limit(1);
    if (!sub) throw new AppError("invalid_transition", "No open submission on this ticket.");
    if (!canReviewSubmission(ctx.role, sub.developerId, ctx.userId)) throw new AppError("forbidden", "You cannot review this submission.");
    const v = validateReviewDecision(decision);
    if (!v.ok) throw new AppError("validation", "Please complete the review.", { fields: v.fields });
    const now = new Date();

    if (decision.outcome === "approved") {
      await tx.update(schema.submissions).set({ outcome: "approved", reviewerId: ctx.userId, reviewedAt: now, sentReply: decision.reply }).where(eq(schema.submissions.id, sub.id));
      await emitEvent(tx, ctx, { ticketId, orgId: ticket.orgId, kind: "review_approved", data: { submissionId: sub.id, developerId: sub.developerId, resolutionCode: decision.resolutionCode, replyEdited: decision.reply.trim() !== sub.proposedReply.trim() } });
      // The reviewer's edited reply is sent as the public resolution comment AND stored as resolution_note
      await createCommentInTx(tx, ctx, { ticketId, body: decision.reply, visibility: "public", kind: "resolution" });
      const res = await transitionInTx(tx, ctx, ticketId, "approve", { resolutionCode: decision.resolutionCode, resolutionNote: decision.reply }, { now });
      return { outcome: "approved" as const, version: res.version };
    }
    if (decision.outcome === "returned") {
      await tx.update(schema.submissions).set({ outcome: "returned", reviewerId: ctx.userId, reviewedAt: now, reviewNotes: decision.notes }).where(eq(schema.submissions.id, sub.id));
      await emitEvent(tx, ctx, { ticketId, orgId: ticket.orgId, kind: "review_returned", data: { submissionId: sub.id, developerId: sub.developerId, notes: decision.notes } });
      // Return notes appear in the thread as an internal note addressed to the developer (design.md §7.11a)
      await createCommentInTx(tx, ctx, { ticketId, body: `**Returned from review**\n\n${decision.notes}`, visibility: "internal", kind: "review_note" });
      const res = await transitionInTx(tx, ctx, ticketId, "return", { reviewNotes: decision.notes }, { now });
      await tx.update(schema.tickets).set({ workState: "fix_in_progress" }).where(eq(schema.tickets.id, ticketId));
      return { outcome: "returned" as const, version: res.version };
    }
    // ask_client: the submission stays open; the ticket waits for the client, still assigned to the developer
    await createCommentInTx(tx, ctx, { ticketId, body: decision.question, visibility: "public" });
    const res = await transitionInTx(tx, ctx, ticketId, "ask_client", {}, { now });
    await emitEvent(tx, ctx, { ticketId, orgId: ticket.orgId, kind: "review_asked_client", data: { submissionId: sub.id } });
    return { outcome: "ask_client" as const, version: res.version };
  });
}

/** Admin review queue (FR-DEV-07): oldest first with time in review. */
export async function reviewQueue(ctx: AuthContext, limit = 50) {
  return withContext(ctx, (tx) =>
    tx
      .select({
        id: schema.tickets.id,
        key: schema.tickets.key,
        subject: schema.tickets.subject,
        priority: schema.tickets.priority,
        orgName: schema.organisations.name,
        developerId: schema.tickets.assigneeId,
        developerName: schema.users.fullName,
        submittedAt: schema.tickets.submittedAt,
        timeSpentMinutes: schema.tickets.timeSpentMinutes,
        minutesInReview: sql<number>`extract(epoch from (now() - ${schema.tickets.submittedAt}))::int / 60`,
      })
      .from(schema.tickets)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.tickets.orgId))
      .leftJoin(schema.users, eq(schema.users.id, schema.tickets.assigneeId))
      .where(and(eq(schema.tickets.status, "in_review"), isNull(schema.tickets.deletedAt)))
      .orderBy(schema.tickets.submittedAt)
      .limit(limit),
  );
}
