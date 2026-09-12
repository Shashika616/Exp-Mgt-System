"use server";
import { revalidatePath } from "next/cache";
import { action } from "./_helpers";
import { AppError } from "@/lib/errors";
import { createComment, editComment } from "@/lib/dal/comments";
import { attachToComment } from "@/lib/dal/attachments";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { EditCommentSchema, StaffCommentSchema } from "@/lib/schemas/comments";

/** FR-AG-04 / FR-DEV-05: staff reply (public) or internal note. Developer public replies are gated in the DAL. */
export const createStaffComment = action(StaffCommentSchema, ["comment.public", "comment.internal"], async (ctx, input) => {
  if (input.visibility === "internal" && !ctx.permissions.has("comment.internal")) throw new AppError("forbidden");
  if (input.visibility === "public" && !ctx.permissions.has("comment.public")) throw new AppError("forbidden");
  await enforceLimit("comment", ctx.userId);
  const c = await createComment(ctx, { ticketId: input.ticketId, body: input.body, visibility: input.visibility, mentions: input.mentions });
  if (input.attachmentIds?.length) await attachToComment(ctx, input.ticketId, c.id, input.attachmentIds);
  revalidatePath("/app", "layout");
  return c;
});

export const editStaffComment = action(EditCommentSchema, ["comment.public", "comment.internal"], async (ctx, input) => {
  await editComment(ctx, input.commentId, input.body);
  revalidatePath("/app", "layout");
  return { ok: true };
});
