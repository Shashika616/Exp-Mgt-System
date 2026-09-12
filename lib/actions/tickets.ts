"use server";
import { revalidatePath } from "next/cache";
import { action } from "./_helpers";
import { AppError } from "@/lib/errors";
import * as dal from "@/lib/dal/tickets";
import { createCommentInTx } from "@/lib/dal/comments";
import { withContext } from "@/lib/dal/db";
import { inviteUser } from "@/lib/dal/users";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { AgentCreateTicketSchema, AssignSchema, BulkSchema, CategorySchema, EditTicketSchema, EscalateSchema, ExtendSlaSchema, ImpactUrgencySchema, LinkSchema, ListFilterSchema, OverridePrioritySchema, ParticipantSchema, TagsSchema, TransitionSchema, WorkStateSchema } from "@/lib/schemas/tickets";
import type { Permission } from "@/lib/authz/permissions";
import type { TicketAction } from "@/lib/domain/ticket-machine";

const revalidate = (key?: string) => {
  revalidatePath("/app", "layout");
  if (key) revalidatePath(`/app/tickets/${key}`);
};

const TRANSITION_PERMISSION: Record<string, Permission> = {
  acknowledge: "ticket.transition.acknowledge",
  start: "ticket.transition.start",
  ask_client: "ticket.transition.pending_client",
  hold: "ticket.transition.on_hold",
  unhold: "ticket.transition.on_hold",
  resolve: "ticket.transition.resolve",
  reopen: "ticket.transition.reopen",
  close: "ticket.transition.close",
  cancel: "ticket.transition.cancel",
};

/** FR-AG-07: create on behalf of a client (optionally creating the contact inline). */
export const createTicketOnBehalf = action(AgentCreateTicketSchema, "ticket.create.on_behalf", async (ctx, input) => {
  await enforceLimit("ticket_create", ctx.userId);
  let requesterId = input.requesterId ?? null;
  if (!requesterId && input.newContact) {
    const { userId } = await inviteUser(ctx, { email: input.newContact.email, fullName: input.newContact.fullName, roleId: "client_user", orgId: input.orgId });
    requesterId = userId;
  }
  if (!requesterId) throw new AppError("validation", "Choose a contact.");
  const t = await dal.createTicket(ctx, { orgId: input.orgId, requesterId, type: input.type, subject: input.subject, description: input.description, urgency: input.urgency, impact: input.impact, categoryId: input.categoryId ?? null, subcategoryId: input.subcategoryId ?? null, source: "agent" });
  if (input.assigneeId) await dal.assignTicket(ctx, t.id, input.assigneeId);
  revalidate();
  return t;
});

/** Status transitions (staff). Optional public message is posted first so "ask client" carries the question. */
export const transitionTicket = action(TransitionSchema, null, async (ctx, input) => {
  const perm = TRANSITION_PERMISSION[input.action]!;
  if (!ctx.permissions.has(perm)) throw new AppError("forbidden");
  const res = await withContext(ctx, async (tx) => {
    if (input.message) await createCommentInTx(tx, ctx, { ticketId: input.ticketId, body: input.message, visibility: "public" });
    return dal.transitionInTx(tx, ctx, input.ticketId, input.action as TicketAction, { resolutionCode: input.resolutionCode ?? null, resolutionNote: input.resolutionNote ?? null, holdReason: input.holdReason ?? null, holdNote: input.holdNote ?? null, reason: input.reason ?? null }, { expectedVersion: input.expectedVersion });
  });
  revalidate(res.key);
  return { status: res.status, version: res.version };
});

export const assignTicket = action(AssignSchema, ["ticket.assign", "ticket.take"], async (ctx, input) => {
  if (!ctx.permissions.has("ticket.assign") && input.assigneeId !== ctx.userId) throw new AppError("forbidden");
  const r = await dal.assignTicket(ctx, input.ticketId, input.assigneeId, input.note);
  revalidate(r.key);
  return { assigneeId: r.assigneeId, status: r.status };
});

export const setImpactUrgency = action(ImpactUrgencySchema, "ticket.impact", async (ctx, input) => {
  const r = await dal.setImpactUrgency(ctx, input.ticketId, input);
  revalidate(r.key);
  return { priority: r.priority };
});

export const overridePriority = action(OverridePrioritySchema, "ticket.priority.override", async (ctx, input) => {
  const r = await dal.overridePriority(ctx, input.ticketId, input.priority, input.reason);
  revalidate(r.key);
  return { ok: true };
});

export const setCategory = action(CategorySchema, "ticket.category", async (ctx, input) => {
  const r = await dal.setCategory(ctx, input.ticketId, input.categoryId, input.subcategoryId);
  revalidate(r.key);
  return { ok: true };
});

export const editTicket = action(EditTicketSchema, "ticket.edit", async (ctx, { ticketId, ...patch }) => {
  const r = await dal.editTicket(ctx, ticketId, patch);
  revalidate(r.key);
  return { ok: true };
});

/** FR-DEV-03 */
export const setWorkState = action(WorkStateSchema, "ticket.work_state", async (ctx, input) => {
  const r = await dal.setWorkState(ctx, input.ticketId, input.workState, input.note);
  revalidate(r.key);
  return { workState: input.workState };
});

export const setTags = action(TagsSchema, "ticket.tags", async (ctx, input) => {
  const tags = await dal.setTags(ctx, input.ticketId, input.tags);
  revalidate();
  return { tags };
});

export const addParticipant = action(ParticipantSchema, ["ticket.participants", "ticket.watchers"], async (ctx, input) => {
  if (input.kind === "watcher" && !ctx.permissions.has("ticket.watchers")) throw new AppError("forbidden");
  await dal.addParticipant(ctx, input.ticketId, input.userId, input.kind);
  revalidate();
  return { ok: true };
});

export const removeParticipant = action(ParticipantSchema, ["ticket.participants", "ticket.watchers"], async (ctx, input) => {
  await dal.removeParticipant(ctx, input.ticketId, input.userId);
  revalidate();
  return { ok: true };
});

export const linkTickets = action(LinkSchema, "ticket.link", async (ctx, input) => {
  const other = await dal.linkTickets(ctx, input.ticketId, input.linkedKey, input.kind);
  revalidate();
  return other;
});

export const escalateTicket = action(EscalateSchema, "ticket.escalate", async (ctx, input) => {
  const r = await dal.escalateTicket(ctx, input.ticketId, input.reason);
  revalidate(r.key);
  return { ok: true };
});

export const extendSla = action(ExtendSlaSchema, "ticket.sla.extend", async (ctx, input) => {
  await dal.extendSla(ctx, input.ticketId, input.metric, input.extraMinutes, input.reason);
  revalidate();
  return { ok: true };
});

/** FR-AG-03: bulk assign / status / impact. Each ticket is processed independently; failures are reported. */
export const bulkUpdate = action(BulkSchema, "ticket.bulk", async (ctx, input) => {
  const failed: string[] = [];
  for (const id of input.ticketIds) {
    try {
      if (input.op.kind === "assign") await dal.assignTicket(ctx, id, input.op.assigneeId);
      else if (input.op.kind === "status") await dal.transitionTicket(ctx, id, input.op.action);
      else await dal.setImpactUrgency(ctx, id, { impact: input.op.impact });
    } catch {
      failed.push(id);
    }
  }
  revalidate();
  return { done: input.ticketIds.length - failed.length, failed };
});

export const listTicketsAction = action(ListFilterSchema, ["ticket.read.org", "ticket.read.assigned"], async (ctx, input) => dal.listTickets(ctx, input));
