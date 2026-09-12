import { createHash, randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/authz/policy";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME, MAX_FILE_BYTES, recordAttachment } from "@/lib/dal/attachments";
import { schema, withContext } from "@/lib/dal/db";
import { loadTicketRow } from "@/lib/dal/tickets";
import { AppError, toPublicError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { env } from "@/lib/env";
import { getStorageProvider } from "@/lib/storage/provider";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TEXT_EXT = new Set(["txt", "csv", "log"]);

/**
 * Upload (security.md A08): extension allowlist, MIME sniffed server-side, 25 MB cap, object path
 * {org}/{ticket}/{uuid} with no user-controlled names, SHA-256 stored. Private bucket; download via signed URL.
 */
export async function POST(req: Request) {
  try {
    // Route handlers don't get the Server Action origin check: enforce same-origin ourselves (CSRF).
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== new URL(env.APP_URL).host) throw new AppError("forbidden");
    const ctx = await requireUser();
    requirePermission(ctx, "attachment.upload");
    await enforceLimit("attachment", ctx.userId);
    const form = await req.formData();
    const ticketId = String(form.get("ticketId") ?? "");
    const visibility = ctx.orgType === "client" ? "public" : String(form.get("visibility") ?? "public") === "internal" ? "internal" : "public";
    const file = form.get("file");
    if (!/^[0-9a-f-]{36}$/.test(ticketId) || !(file instanceof File)) throw new AppError("validation", "Missing file or ticket.");
    if (file.size > MAX_FILE_BYTES) throw new AppError("validation", "Files must be 25 MB or smaller.");
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) throw new AppError("validation", `File type .${ext || "?"} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = await fileTypeFromBuffer(bytes);
    let mime: string;
    if (sniffed) {
      if (!ALLOWED_MIME[ext]?.includes(sniffed.mime)) throw new AppError("validation", "The file's content does not match its extension.");
      mime = sniffed.mime;
    } else if (TEXT_EXT.has(ext) && !bytes.subarray(0, 4096).some((b) => b === 0)) {
      mime = ext === "csv" ? "text/csv" : "text/plain";
    } else {
      throw new AppError("validation", "Could not verify the file type.");
    }
    // Ticket must be visible to the caller (RLS) — otherwise 404, never a hint about existence.
    const ticket = await withContext(ctx, (tx) => loadTicketRow(tx, eq(schema.tickets.id, ticketId)));
    if (!ticket) throw new AppError("not_found");
    if (ctx.role === "developer" && ticket.assigneeId !== ctx.userId) throw new AppError("not_found");
    const storageKey = `${ticket.orgId}/${ticket.id}/${randomUUID()}`;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storage = await getStorageProvider();
    await storage.put(storageKey, bytes, mime);
    const rec = await recordAttachment(ctx, { ticketId: ticket.id, storageKey, fileName: file.name.replace(/[\r\n"]/g, "_").slice(0, 200), mimeType: mime, sizeBytes: file.size, sha256, visibility });
    return NextResponse.json({ ok: true, data: { id: rec.id, fileName: file.name, sizeBytes: file.size, mimeType: mime } });
  } catch (err) {
    const pub = toPublicError(err, ({ id, err }) => logger.error({ errorId: id, err }, "upload failed"));
    return NextResponse.json(pub, { status: pub.code === "not_found" ? 404 : pub.code === "validation" ? 400 : pub.code === "rate_limited" ? 429 : pub.code === "unauthenticated" ? 401 : 403 });
  }
}
