import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import { commentCountsAsFirstResponse } from "@/lib/domain/first-response";
import type { Visibility } from "@/lib/domain/types";
import { renderMarkdown } from "@/lib/markdown";
import { firstName } from "@/lib/utils";
import { emitEvent } from "./events";
import { notifyInTx, staffUserIdsByRole } from "./notifications";
import { orgSettingsFor } from "./orgs";
import { policyForOrg, stopFirstResponse } from "./sla";
import { loadTicketRow, transitionInTx } from "./tickets";

export const commentColumns = {
  id: schema.comments.id,
  ticketId: schema.comments.ticketId,
  visibility: schema.comments.visibility,
  body: schema.comments.body,
  bodyHtml: schema.comments.bodyHtml,
  kind: schema.comments.kind,
  editedAt: schema.comments.editedAt,
  createdAt: schema.comments.createdAt,
  authorId: schema.comments.authorId,
  authorName: schema.users.fullName,
  authorRole: schema.users.roleId,
};

/** Thread for staff. RLS already hides internal comments from client roles; the portal DAL filters again. */
export async function listComments(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, (tx) => listCommentsInTx(tx, ticketId));
}

export async function listCommentsInTx(tx: Tx, ticketId: string, visibility?: Visibility) {
  return tx
    .select(commentColumns)
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(and(eq(schema.comments.ticketId, ticketId), isNull(schema.comments.deletedAt), visibility ? eq(schema.comments.visibility, visibility) : undefined))
    .orderBy(asc(schema.comments.createdAt));
}

export type CommentRow = Awaited<ReturnType<typeof listCommentsInTx>>[number];

export type CreateCommentInput = { ticketId: string; body: string; visibility: Visibility; kind?: "comment" | "review_note" | "resolution"; mentions?: string[] };

/**
 * Create a comment. Enforces (server-side): developer public replies per org_settings.developer_public_reply,
 * client roles public-only, first-response rule (§5.3), pending_client → in_progress on client reply,
 * and the notification matrix (§8).
 */
export async function createComment(ctx: AuthContext, input: CreateCommentInput) {
  return withContext(ctx, (tx) => createCommentInTx(tx, ctx, input));
}

export async function createCommentInTx(tx: Tx, ctx: AuthContext, input: CreateCommentInput) {
  const ticket = await loadTicketRow(tx, eq(schema.tickets.id, input.ticketId));
  if (!ticket) throw notFound();
  if (ticket.status === "closed" || ticket.status === "cancelled") throw new AppError("invalid_transition", "This ticket is closed. Create a follow-up request instead.");
  const isClient = ctx.orgType === "client";
  if (isClient && input.visibility !== "public") throw new AppError("forbidden");
  if (ctx.role === "developer") {
    if (ticket.assigneeId !== ctx.userId) throw notFound();
    if (input.visibility === "public") {
      const settings = await orgSettingsFor(tx, ticket.orgId);
      if (settings.developerPublicReply === "never") throw new AppError("forbidden", "Public replies from developers are disabled. Add an internal note for the admin to send.");
      if (settings.developerPublicReply === "after_first_admin_reply" && !ticket.lastStaffReplyAt) throw new AppError("forbidden", "A public reply is allowed after the admin's first reply to the client.");
    }
  }
  const now = new Date();
  const bodyHtml = await renderMarkdown(input.body);
  const [c] = await tx
    .insert(schema.comments)
    .values({ ticketId: ticket.id, orgId: ticket.orgId, authorId: ctx.userId, visibility: input.visibility, body: input.body, bodyHtml, kind: input.kind ?? "comment" })
    .returning({ id: schema.comments.id, createdAt: schema.comments.createdAt });
  await emitEvent(tx, ctx, { ticketId: ticket.id, orgId: ticket.orgId, kind: "commented", visibility: input.visibility, data: { commentId: c!.id, visibility: input.visibility, kind: input.kind ?? "comment" } });

  const staffPublic = commentCountsAsFirstResponse(ctx.role, input.visibility);
  const patch: Partial<typeof schema.tickets.$inferInsert> = {};
  if (staffPublic) {
    patch.lastStaffReplyAt = now;
    if (!ticket.firstRespondedAt) {
      patch.firstRespondedAt = now;
      const policy = await policyForOrg(tx, ticket.orgId);
      await stopFirstResponse(tx, ticket.id, policy.calendar, now);
      await emitEvent(tx, ctx, { ticketId: ticket.id, orgId: ticket.orgId, kind: "first_response", data: { commentId: c!.id } });
    }
  }
  if (isClient) patch.lastClientReplyAt = now;
  if (Object.keys(patch).length) await tx.update(schema.tickets).set({ ...patch, updatedBy: ctx.userId }).where(eq(schema.tickets.id, ticket.id));

  // Client reply while waiting on them → back to in_progress (implicit transition, requirements.md §5.2)
  if (isClient && ticket.status === "pending_client") {
    await transitionInTx(tx, ctx, ticket.id, "client_reply", {}, { skipNotify: true });
  }

  // Notification matrix (requirements.md §8)
  const participants = (await tx.select({ userId: schema.ticketParticipants.userId, kind: schema.ticketParticipants.kind }).from(schema.ticketParticipants).where(eq(schema.ticketParticipants.ticketId, ticket.id)));
  const clientSide = [ticket.requesterId, ...participants.filter((p) => p.kind === "participant").map((p) => p.userId)];
  const snippet = input.body.slice(0, 200);
  if (input.visibility === "public" && !isClient) {
    await notifyInTx(tx, { userIds: clientSide, orgId: ticket.orgId, ticketId: ticket.id, kind: "staff_reply", title: `${ticket.key}: new reply from ${firstName(ctx.fullName)}`, body: snippet, href: `/portal/tickets/${ticket.key}`, email: true, excludeUserId: ctx.userId });
  } else if (isClient) {
    const staffTargets = [...(ticket.assigneeId ? [ticket.assigneeId] : await staffUserIdsByRole(tx, ["agent", "lead", "admin"])), ...participants.filter((p) => p.kind === "watcher").map((p) => p.userId)];
    await notifyInTx(tx, { userIds: staffTargets, orgId: ticket.orgId, ticketId: ticket.id, kind: "client_reply", title: `${ticket.key}: ${firstName(ctx.fullName)} replied`, body: snippet, href: `/app/tickets/${ticket.key}`, email: true, excludeUserId: ctx.userId });
    await notifyInTx(tx, { userIds: clientSide, orgId: ticket.orgId, ticketId: ticket.id, kind: "client_reply", title: `${ticket.key}: ${firstName(ctx.fullName)} replied`, body: snippet, href: `/portal/tickets/${ticket.key}`, email: false, excludeUserId: ctx.userId });
  }
  if (input.mentions?.length) {
    await notifyInTx(tx, { userIds: input.mentions, orgId: ticket.orgId, ticketId: ticket.id, kind: "mentioned", title: `${firstName(ctx.fullName)} mentioned you on ${ticket.key}`, body: snippet, href: `/app/tickets/${ticket.key}`, email: true, excludeUserId: ctx.userId });
  }
  return { id: c!.id, createdAt: c!.createdAt, bodyHtml };
}

export async function editComment(ctx: AuthContext, commentId: string, body: string) {
  return withContext(ctx, async (tx) => {
    const [c] = await tx.select().from(schema.comments).where(eq(schema.comments.id, commentId)).limit(1);
    if (!c || c.authorId !== ctx.userId) throw notFound();
    const bodyHtml = await renderMarkdown(body);
    await tx.update(schema.comments).set({ body, bodyHtml, editedAt: new Date() }).where(eq(schema.comments.id, commentId));
    await emitEvent(tx, ctx, { ticketId: c.ticketId, orgId: c.orgId, kind: "comment_edited", visibility: c.visibility, data: { commentId } });
  });
}
