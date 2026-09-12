import { z } from "zod";
import { markdown, uuid } from "./common";

export const StaffCommentSchema = z
  .object({
    ticketId: uuid,
    body: markdown(20000),
    visibility: z.enum(["public", "internal"]),
    mentions: z.array(uuid).max(20).optional(),
    attachmentIds: z.array(uuid).max(10).optional(),
  })
  .strict();

/** Clients never choose visibility — always public. */
export const PortalCommentSchema = z.object({ ticketId: uuid, body: markdown(20000), attachmentIds: z.array(uuid).max(10).optional() }).strict();

export const EditCommentSchema = z.object({ commentId: uuid, body: markdown(20000) }).strict();
