import { NextResponse } from "next/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { pinSessionVersion, safeNext } from "@/lib/auth/session";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { schema, withContext } from "@/lib/dal/db";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";

/** Supabase PKCE callback (magic link / password reset). Local provider uses /magic-link/[token] instead. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/");
  const reset = url.searchParams.get("reset") === "1";
  if (!code) return NextResponse.redirect(new URL("/login", env.APP_URL));
  const provider = await getAuthProvider();
  const res = await provider.consumeMagicLink(code, {});
  if (!res.ok) return NextResponse.redirect(new URL("/login?error=link", env.APP_URL));
  const [u] = await withContext(SYSTEM_CONTEXT, (tx) => tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.authProviderId, res.providerId)).limit(1));
  if (!u) return NextResponse.redirect(new URL("/login?error=account", env.APP_URL));
  await pinSessionVersion(u.id);
  return NextResponse.redirect(new URL(reset ? `/reset/${encodeURIComponent(code)}` : next, env.APP_URL));
}
