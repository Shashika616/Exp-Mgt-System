import { z } from "zod";
import { RESOLUTION_CODES, WORK_STATES } from "@/lib/domain/types";
import { boundedInt, markdown, optionalText, uuid } from "./common";

export const WorkLogSchema = z
  .object({
    ticketId: uuid,
    minutes: boundedInt(1, 1440),
    note: markdown(5000),
    loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    workState: z.enum(WORK_STATES).nullable().optional(),
    startedAt: z.string().datetime().nullable().optional(),
    endedAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const EditWorkLogSchema = z
  .object({ workLogId: uuid, minutes: boundedInt(1, 1440).optional(), note: markdown(5000).optional(), loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), workState: z.enum(WORK_STATES).nullable().optional() })
  .strict();

export const TimerSchema = z.object({ ticketId: uuid }).strict();

export const SubmitReviewSchema = z
  .object({
    ticketId: uuid,
    findings: markdown(10000),
    rootCause: optionalText(5000),
    changesMade: markdown(10000),
    verification: markdown(10000),
    suggestedResolutionCode: z.enum(RESOLUTION_CODES).nullable().optional(),
    proposedReply: markdown(20000),
    timeMinutes: boundedInt(0, 100000),
    timeAdjustReason: optionalText(500),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const ReviewSchema = z
  .object({
    ticketId: uuid,
    decision: z.discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("approved"), reply: markdown(20000), resolutionCode: z.enum(RESOLUTION_CODES) }).strict(),
      z.object({ outcome: z.literal("returned"), notes: markdown(5000) }).strict(),
      z.object({ outcome: z.literal("ask_client"), question: markdown(20000) }).strict(),
    ]),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
