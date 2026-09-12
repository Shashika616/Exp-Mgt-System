import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

/** Supabase realtime: hand the browser a short-lived access token (memory only). Refresh token stays httpOnly. */
export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (env.REALTIME_PROVIDER !== "supabase" || !env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const jar = await cookies();
  const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => jar.getAll(), setAll: () => {} } });
  const { data } = await sb.auth.getSession();
  if (!data.session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json({ url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, token: data.session.access_token }, { headers: { "Cache-Control": "no-store" } });
}
