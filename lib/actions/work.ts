"use server";
import { revalidatePath } from "next/cache";
import { action } from "./_helpers";
import { addWorkLogWithState, getRunningTimer, startTimer, stopTimer, updateWorkLog } from "@/lib/dal/work-logs";
import { reviewSubmission, submitForReview } from "@/lib/dal/submissions";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { EditWorkLogSchema, ReviewSchema, SubmitReviewSchema, TimerSchema, WorkLogSchema } from "@/lib/schemas/work";
import { z } from "zod";

const revalidate = () => revalidatePath("/app", "layout");

/** FR-DEV-02 */
export const logWork = action(WorkLogSchema, "worklog.write", async (ctx, input) => {
  await enforceLimit("work_log", ctx.userId);
  const r = await addWorkLogWithState(ctx, { ...input, startedAt: input.startedAt ? new Date(input.startedAt) : null, endedAt: input.endedAt ? new Date(input.endedAt) : null });
  revalidate();
  return r;
});

export const editWorkLog = action(EditWorkLogSchema, "worklog.write", async (ctx, { workLogId, ...patch }) => {
  const r = await updateWorkLog(ctx, workLogId, patch);
  revalidate();
  return r;
});

export const startWorkTimer = action(TimerSchema, "worklog.write", async (ctx, input) => {
  const r = await startTimer(ctx, input.ticketId);
  revalidate();
  return { startedAt: r.startedAt.toISOString() };
});

export const stopWorkTimer = action(TimerSchema, "worklog.write", async (ctx, input) => {
  const r = await stopTimer(ctx, input.ticketId);
  revalidate();
  return { startedAt: r.startedAt.toISOString(), endedAt: r.endedAt.toISOString(), minutes: r.minutes };
});

export const currentTimer = action(z.object({}).strict(), "worklog.write", async (ctx) => {
  const t = await getRunningTimer(ctx);
  return t ? { ticketId: t.ticketId, key: t.key, subject: t.subject, startedAt: t.startedAt.toISOString() } : null;
});

/** FR-DEV-04 */
export const submitTicketForReview = action(SubmitReviewSchema, "ticket.submit_review", async (ctx, { ticketId, expectedVersion, ...input }) => {
  await enforceLimit("submission", ctx.userId);
  const r = await submitForReview(ctx, ticketId, input, expectedVersion);
  revalidate();
  return r;
});

/** FR-DEV-07 */
export const reviewTicket = action(ReviewSchema, "ticket.review", async (ctx, input) => {
  const r = await reviewSubmission(ctx, input.ticketId, input.decision, input.expectedVersion);
  revalidate();
  return r;
});
