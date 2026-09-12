import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getAttachmentForDownload } from "@/lib/dal/attachments";
import { logAccessDenied } from "@/lib/dal/audit";
import { getStorageProvider, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

/** Authorise, log, then redirect to a ≤ 60 s signed URL (never proxied through Next.js in production). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = await getAttachmentForDownload(ctx, id);
  if (!row) {
    await logAccessDenied(ctx, "attachment", id);
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const storage = await getStorageProvider();
  const url = await storage.signedDownloadUrl(row.storageKey, row.fileName, SIGNED_URL_TTL_SECONDS);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
