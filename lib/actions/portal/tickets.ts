"use server";
import { revalidatePath } from "next/cache";
import { action } from "../_helpers";
import { AppError } from "@/lib/errors";
import { createTicket, transitionInTx } from "@/lib/dal/tickets";
import { createCommentInTx } from "@/lib/dal/comments";
import { withContext, schema } from "@/lib/dal/db";
import { attachToComment } from "@/lib/dal/attachments";
import { findFollowUpSource } from "@/lib/dal/portal/tickets";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { PortalCommentSchema } from "@/lib/schemas/comments";
import { PortalCreateTicketSchema, PortalParticipantSchema, PortalTransitionSchema } from "@/lib/schemas/tickets";
import { eq, and } from "drizzle-orm";

const revalidate = () => revalidatePath("/portal", "layout");

/** FR-CP-01/02: the portal form. Clients never set impact/priority/assignee; org and requester come from the session. */
export const createPortalTicket = action(PortalCreateTicketSchema, "ticket.create", async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  await enforceLimit("ticket_create", ctx.userId);
  if (input.followUpOf) await findFollowUpSource(ctx, input.followUpOf);
  const t = await createTicket(ctx, {
    orgId: ctx.orgId,
    requesterId: ctx.userId,
    type: input.type,
    subject: input.subject,
    description: input.description,
    urgency: input.urgency,
    categoryId: input.categoryId ?? null,
    source: "portal",
    participantIds: input.participantIds,
    followUpOf: input.followUpOf ?? null,
  });
  revalidate();
  return { id: t.id, key: t.key, priority: t.priority, firstResponseDueAt: t.firstResponseDueAt?.toISOString() ?? null };
});

/** FR-CP-05 reply. Always public; pending_client → in_progress happens in the DAL. */
export const replyToTicket = action(PortalCommentSchema, "comment.public", async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  await enforceLimit("comment", ctx.userId);
  const c = await withContext(ctx, (tx) => createCommentInTx(tx, ctx, { ticketId: input.ticketId, body: input.body, visibility: "public" }));
  if (input.attachmentIds?.length) await attachToComment(ctx, input.ticketId, c.id, input.attachmentIds);
  revalidate();
  return { id: c.id };
});

/** FR-CP-05: Reopen (resolved) / Confirm-close (resolved) / Cancel (new, open). */
export const portalTransition = action(PortalTransitionSchema, null, async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  const res = await withContext(ctx, async (tx) => {
    if (input.message) await createCommentInTx(tx, ctx, { ticketId: input.ticketId, body: input.message, visibility: "public" });
    return transitionInTx(tx, ctx, input.ticketId, input.action, { reason: input.reason ?? null }, { expectedVersion: input.expectedVersion });
  });
  revalidate();
  return { status: res.status, version: res.version };
});

/** FR-CP-06: add a colleague from the same org as a participant. */
export const addPortalParticipant = action(PortalParticipantSchema, "ticket.participants", async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  await withContext(ctx, async (tx) => {
    const [u] = await tx.select({ id: schema.users.id, fullName: schema.users.fullName }).from(schema.users).where(and(eq(schema.users.id, input.userId), eq(schema.users.orgId, ctx.orgId))).limit(1);
    if (!u) throw new AppError("validation", "Choose a colleague from your organisation.");
    const [t] = await tx.select({ id: schema.tickets.id, orgId: schema.tickets.orgId }).from(schema.tickets).where(eq(schema.tickets.id, input.ticketId)).limit(1);
    if (!t) throw new AppError("not_found");
    await tx.insert(schema.ticketParticipants).values({ ticketId: t.id, userId: u.id, kind: "participant" }).onConflictDoNothing();
    const { emitEvent } = await import("@/lib/dal/events");
    await emitEvent(tx, ctx, { ticketId: t.id, orgId: t.orgId, kind: "participant_added", visibility: "public", data: { userId: u.id, name: u.fullName } });
  });
  revalidate();
  return { ok: true };
});
