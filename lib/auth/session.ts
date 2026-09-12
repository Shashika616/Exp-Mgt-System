import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { schema, withContext } from "@/lib/dal/db";
import { SYSTEM_CONTEXT, type AuthContext } from "@/lib/authz/policy";
import { MFA_REQUIRED_ROLES, ROLE_PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/domain/types";
import { sign, unsign } from "./crypto";
import { getAuthProvider } from "./provider";

const SV_COOKIE = "exp_sv";

export type SessionState =
  | { kind: "anonymous" }
  | { kind: "mfa_enroll_required"; ctx: AuthContext }
  | { kind: "mfa_required"; ctx: AuthContext }
  | { kind: "authenticated"; ctx: AuthContext };

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null; requestId: string }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return {
    ip: (fwd ? fwd.split(",")[0]?.trim() : h.get("x-real-ip")) ?? null,
    userAgent: h.get("user-agent"),
    requestId: h.get("x-request-id") ?? crypto.randomUUID(),
  };
}

/**
 * Resolves the current session once per request (React cache). Fails closed: any uncertainty → anonymous.
 * architecture.md §7: provider identity → our users row (status active, session_version pinned) → MFA gate.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const provider = await getAuthProvider();
  const session = await provider.getSessionUser().catch(() => null);
  if (!session) return { kind: "anonymous" };

  const user = await withContext(SYSTEM_CONTEXT, async (tx) => {
    const [row] = await tx
      .select({
        id: schema.users.id,
        orgId: schema.users.orgId,
        roleId: schema.users.roleId,
        email: schema.users.email,
        fullName: schema.users.fullName,
        status: schema.users.status,
        mfaEnrolled: schema.users.mfaEnrolled,
        sessionVersion: schema.users.sessionVersion,
        orgType: schema.organisations.type,
        orgStatus: schema.organisations.status,
      })
      .from(schema.users)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
      .where(and(eq(schema.users.authProviderId, session.providerId), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!row) return null;
    const perms = await tx
      .select({ id: schema.rolePermissions.permissionId })
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, row.roleId));
    return { ...row, perms: perms.map((p) => p.id as Permission) };
  });
  if (!user || user.status !== "active" || user.orgStatus !== "active") return { kind: "anonymous" };

  // Session-version pin (sign-out-everywhere, deactivation, role change). Supabase sessions carry it in a signed cookie.
  if (provider.name === "supabase") {
    const jar = await cookies();
    const pinned = unsign(jar.get(SV_COOKIE)?.value);
    if (pinned !== String(user.sessionVersion)) return { kind: "anonymous" };
  }

  const meta = await requestMeta();
  const role = user.roleId as Role;
  const ctx: AuthContext = {
    userId: user.id,
    orgId: user.orgId,
    orgType: user.orgType,
    role,
    email: user.email,
    fullName: user.fullName,
    permissions: new Set(user.perms.length ? user.perms : ROLE_PERMISSIONS[role]),
    mfaVerified: session.amr.includes("totp"),
    ip: meta.ip,
    userAgent: meta.userAgent,
    requestId: meta.requestId,
  };

  if (MFA_REQUIRED_ROLES.includes(role) && !user.mfaEnrolled) return { kind: "mfa_enroll_required", ctx };
  if (user.mfaEnrolled && !ctx.mfaVerified) return { kind: "mfa_required", ctx }; // optional MFA, once enrolled, is enforced too
  return { kind: "authenticated", ctx };
});

/** For Server Actions / Route Handlers: throws AppError; never redirects. */
export async function requireUser(): Promise<AuthContext> {
  const s = await getSession();
  if (s.kind === "anonymous") throw new AppError("unauthenticated");
  if (s.kind !== "authenticated") throw new AppError("mfa_required");
  return s.ctx;
}

/** After a successful login with the Supabase provider: pin the session version. */
export async function pinSessionVersion(userId: string): Promise<void> {
  const [row] = await withContext(SYSTEM_CONTEXT, (tx) =>
    tx.select({ v: schema.users.sessionVersion }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
  );
  const jar = await cookies();
  jar.set(SV_COOKIE, sign(String(row?.v ?? 1)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600 });
}

export async function clearSessionPin(): Promise<void> {
  const jar = await cookies();
  jar.set(SV_COOKIE, "", { path: "/", maxAge: 0 });
}

export const homeFor = (ctx: AuthContext): string => (ctx.orgType === "client" ? "/portal" : "/app");

/** Validate `next` as a relative, allowlisted path (security.md A05: no open redirects). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!/^\/(app|portal)(\/|$)/.test(next) || next.includes("//") || next.includes("\\")) return fallback;
  return next;
}
