import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { schema, withContext } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import type { Visibility } from "@/lib/domain/types";
import { emitEvent } from "./events";
import { loadTicketRow } from "./tickets";
import { auditInTx } from "./audit";

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "csv", "log", "xlsx", "docx", "zip"] as const;
export const ALLOWED_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain"],
  log: ["text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  zip: ["application/zip", "application/x-zip-compressed"],
};
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_TICKET_UPLOAD = 10;

export const attachmentColumns = {
  id: schema.attachments.id,
  ticketId: schema.attachments.ticketId,
  commentId: schema.attachments.commentId,
  submissionId: schema.attachments.submissionId,
  fileName: schema.attachments.fileName,
  mimeType: schema.attachments.mimeType,
  sizeBytes: schema.attachments.sizeBytes,
  scanStatus: schema.attachments.scanStatus,
  visibility: schema.attachments.visibility,
  uploaderId: schema.attachments.uploaderId,
  uploaderName: schema.users.fullName,
  createdAt: schema.attachments.createdAt,
};

export async function listAttachments(ctx: AuthContext, ticketId: string) {
  return withContext(ctx, (tx) =>
    tx
      .select(attachmentColumns)
      .from(schema.attachments)
      .innerJoin(schema.users, eq(schema.users.id, schema.attachments.uploaderId))
      .where(and(eq(schema.attachments.ticketId, ticketId), isNull(schema.attachments.deletedAt)))
      .orderBy(schema.attachments.createdAt),
  );
}

export type AttachmentRow = Awaited<ReturnType<typeof listAttachments>>[number];

export type RecordAttachmentInput = { ticketId: string; commentId?: string | null; submissionId?: string | null; storageKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string; visibility: Visibility };

export async function recordAttachment(ctx: AuthContext, input: RecordAttachmentInput) {
  return withContext(ctx, async (tx) => {
    const ticket = await loadTicketRow(tx, eq(schema.tickets.id, input.ticketId));
    if (!ticket) throw notFound();
    if (ctx.orgType === "client" && input.visibility !== "public") throw new AppError("forbidden");
    const [row] = await tx
      .insert(schema.attachments)
      .values({ ...input, orgId: ticket.orgId, uploaderId: ctx.userId, commentId: input.commentId ?? null, submissionId: input.submissionId ?? null })
      .returning({ id: schema.attachments.id });
    await emitEvent(tx, ctx, { ticketId: ticket.id, orgId: ticket.orgId, kind: "attachment_added", visibility: input.visibility, data: { attachmentId: row!.id, fileName: input.fileName, sizeBytes: input.sizeBytes } });
    return { id: row!.id, orgId: ticket.orgId };
  });
}

/** Authorised lookup for download; logs the download (security.md A09). RLS hides other tenants' rows → 404. */
export async function getAttachmentForDownload(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select().from(schema.attachments).where(and(eq(schema.attachments.id, id), isNull(schema.attachments.deletedAt))).limit(1);
    if (!row) return null;
    await auditInTx(tx, ctx, { action: "attachment.downloaded", entityType: "attachment", entityId: id, orgId: row.orgId, after: { fileName: row.fileName } });
    return row;
  });
}

/** Link freshly uploaded attachments (uploaded before the comment existed) to the comment. */
export async function attachToComment(ctx: AuthContext, ticketId: string, commentId: string, attachmentIds: string[]) {
  await withContext(ctx, async (tx) => {
    const { inArray } = await import("drizzle-orm");
    await tx
      .update(schema.attachments)
      .set({ commentId })
      .where(and(eq(schema.attachments.ticketId, ticketId), inArray(schema.attachments.id, attachmentIds), isNull(schema.attachments.commentId), eq(schema.attachments.uploaderId, ctx.userId)));
  });
}
