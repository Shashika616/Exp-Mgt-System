import { z } from "zod";
import { HOLD_REASONS, LEVELS, LINK_KINDS, PRIORITIES, RESOLUTION_CODES, TICKET_STATUSES, TICKET_TYPES, TYPE_URGENCY_OPTIONS, WORK_STATES } from "@/lib/domain/types";
import { boundedInt, markdown, optionalMarkdown, optionalText, optionalUuid, text, ticketKey, uuid } from "./common";

// Every schema is .strict(): unknown keys are rejected, so mass assignment is impossible (security.md A01).

/** Portal form — clients can NEVER submit priority, impact, assignee, visibility; category is optional. */
export const PortalCreateTicketSchema = z
  .object({
    type: z.enum(TICKET_TYPES),
    subject: text(160),
    description: markdown(20000),
    urgency: z.enum(LEVELS),
    categoryId: optionalUuid,
    participantIds: z.array(uuid).max(10).optional(),
    followUpOf: z.preprocess((v) => (v === "" ? null : v), ticketKey.nullable().optional()),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!TYPE_URGENCY_OPTIONS[v.type].includes(v.urgency)) ctx.addIssue({ code: "custom", path: ["urgency"], message: "That urgency is not available for this request type" });
  });
export type PortalCreateTicketInput = z.infer<typeof PortalCreateTicketSchema>;

/** Agent on-behalf form — may set org, requester, impact and category. */
export const AgentCreateTicketSchema = z
  .object({
    orgId: uuid,
    requesterId: optionalUuid,
    newContact: z.object({ fullName: text(120), email: z.string().email().max(254) }).strict().nullable().optional(),
    type: z.enum(TICKET_TYPES),
    subject: text(160),
    description: markdown(20000),
    urgency: z.enum(LEVELS),
    impact: z.enum(LEVELS).default("medium"),
    categoryId: optionalUuid,
    subcategoryId: optionalUuid,
    assigneeId: optionalUuid,
  })
  .strict()
  .refine((v) => v.requesterId || v.newContact, { message: "Choose a contact or create one", path: ["requesterId"] });
export type AgentCreateTicketInput = z.infer<typeof AgentCreateTicketSchema>;

export const TransitionSchema = z
  .object({
    ticketId: uuid,
    action: z.enum(["acknowledge", "start", "ask_client", "hold", "unhold", "resolve", "reopen", "close", "cancel"]),
    resolutionCode: z.enum(RESOLUTION_CODES).nullable().optional(),
    resolutionNote: optionalMarkdown(20000),
    holdReason: z.enum(HOLD_REASONS).nullable().optional(),
    holdNote: optionalText(1000),
    reason: optionalText(1000),
    /** public message sent to the client together with the transition (e.g. the question when asking the client) */
    message: optionalMarkdown(20000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type TransitionInputDto = z.infer<typeof TransitionSchema>;

/** Portal transitions: reopen / close / cancel only. */
export const PortalTransitionSchema = z
  .object({
    ticketId: uuid,
    action: z.enum(["reopen", "close", "cancel"]),
    reason: optionalText(1000),
    message: optionalMarkdown(20000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const AssignSchema = z.object({ ticketId: uuid, assigneeId: uuid.nullable(), note: optionalText(1000) }).strict();
export const ImpactUrgencySchema = z.object({ ticketId: uuid, impact: z.enum(LEVELS).optional(), urgency: z.enum(LEVELS).optional() }).strict();
export const OverridePrioritySchema = z.object({ ticketId: uuid, priority: z.enum(PRIORITIES), reason: text(500) }).strict();
export const CategorySchema = z.object({ ticketId: uuid, categoryId: uuid.nullable(), subcategoryId: uuid.nullable() }).strict();
export const EditTicketSchema = z.object({ ticketId: uuid, subject: text(160).optional(), description: markdown(20000).optional(), type: z.enum(TICKET_TYPES).optional() }).strict();
export const WorkStateSchema = z.object({ ticketId: uuid, workState: z.enum(WORK_STATES), note: optionalText(2000) }).strict();
export const TagsSchema = z.object({ ticketId: uuid, tags: z.array(text(40)).max(20) }).strict();
export const ParticipantSchema = z.object({ ticketId: uuid, userId: uuid, kind: z.enum(["participant", "watcher"]) }).strict();
export const PortalParticipantSchema = z.object({ ticketId: uuid, userId: uuid }).strict();
export const LinkSchema = z.object({ ticketId: uuid, linkedKey: ticketKey, kind: z.enum(LINK_KINDS) }).strict();
export const EscalateSchema = z.object({ ticketId: uuid, reason: text(500) }).strict();
export const ExtendSlaSchema = z.object({ ticketId: uuid, metric: z.enum(["first_response", "resolution"]), extraMinutes: boundedInt(15, 60 * 24 * 30), reason: text(500) }).strict();
export const BulkSchema = z
  .object({
    ticketIds: z.array(uuid).min(1).max(100),
    op: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("assign"), assigneeId: uuid.nullable() }).strict(),
      z.object({ kind: z.literal("status"), action: z.enum(["acknowledge", "start", "close"]) }).strict(),
      z.object({ kind: z.literal("impact"), impact: z.enum(LEVELS) }).strict(),
    ]),
  })
  .strict();

export const ListFilterSchema = z
  .object({
    queue: z.enum(["unassigned", "mine", "all_open", "at_risk", "pending_client", "on_hold", "resolved", "review", "my_work", "all"]).optional(),
    status: z.array(z.enum(TICKET_STATUSES)).optional(),
    priority: z.array(z.enum(PRIORITIES)).optional(),
    type: z.array(z.enum(TICKET_TYPES)).optional(),
    orgId: uuid.optional(),
    assignee: z.union([uuid, z.literal("me"), z.literal("unassigned")]).optional(),
    categoryId: uuid.optional(),
    tag: text(40).optional(),
    sla: z.enum(["at_risk", "breached", "ok"]).optional(),
    workState: z.array(z.enum(WORK_STATES)).optional(),
    q: z.string().max(200).optional(),
    sort: z.enum(["updated", "created", "priority", "due", "key"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    cursor: z.string().max(500).nullable().optional(),
    limit: boundedInt(1, 100).optional(),
  })
  .strict();
export type ListFilterInput = z.infer<typeof ListFilterSchema>;
