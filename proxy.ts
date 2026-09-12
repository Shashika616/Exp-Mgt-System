import { NextResponse, type NextRequest } from "next/server";

/**
 * Routing only (architecture.md ADR-07, security.md A01): per-request CSP nonce, Supabase cookie refresh,
 * and a UX redirect for obviously-anonymous requests to /app or /portal. NO authorisation decisions live here —
 * every layout, Server Action and Route Handler calls requireUser()/requirePermission() itself.
 */
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const AUTH_PROVIDER = process.env.AUTH_PROVIDER ?? "supabase";
const PROTECTED = /^\/(app|portal)(\/|$)/;
const isDev = process.env.NODE_ENV !== "production";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // style attributes (motion/charts) need 'unsafe-inline'; a nonce here would make browsers ignore it. Scripts stay nonce-only.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${SUPABASE ? ` ${SUPABASE}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${SUPABASE ? ` ${SUPABASE}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", crypto.randomUUID());

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Supabase session refresh (cookie rotation only; httpOnly cookies, never localStorage).
  let hasSession = false;
  if (AUTH_PROVIDER === "supabase" && SUPABASE && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: !isDev });
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    hasSession = !!data.user;
  } else {
    hasSession = !!request.cookies.get("exp_session")?.value;
  }

  if (PROTECTED.test(request.nextUrl.pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    response = NextResponse.redirect(url);
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // everything except static assets
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
