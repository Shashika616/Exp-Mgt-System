import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Local storage adapter only (dev/test): serves a file for a valid, unexpired HMAC-signed URL. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (env.STORAGE_PROVIDER !== "local") return new Response("not found", { status: 404 });
  const { key } = await params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const name = url.searchParams.get("name") ?? "file";
  const sig = url.searchParams.get("sig") ?? "";
  const storageKey = key.join("/");
  const { signLocal, LocalStorageProvider } = await import("@/lib/storage/local");
  const expected = signLocal(storageKey, name, exp);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000 || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response("expired", { status: 403 });
  const bytes = await new LocalStorageProvider().get(storageKey);
  if (!bytes) return new Response("not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
