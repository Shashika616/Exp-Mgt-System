"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action, publicAction } from "./_helpers";
import { AppError } from "@/lib/errors";
import { getAuthProvider } from "@/lib/auth/provider";
import { clearSessionPin, getSession, homeFor, pinSessionVersion, requestMeta, safeNext } from "@/lib/auth/session";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { MFA_REQUIRED_ROLES } from "@/lib/authz/permissions";
import type { Role } from "@/lib/domain/types";
import { audit } from "@/lib/dal/audit";
import { schema, withContext } from "@/lib/dal/db";
import { acceptInvitation, bumpSessionVersion, findInvitation, markMfaEnrolled } from "@/lib/dal/users";
import { enforceLimit } from "@/lib/ratelimit/provider";
import { isPwnedPassword } from "@/lib/auth/pwned";

const PWNED_MESSAGE = "That password has appeared in a known data breach. Please choose a different one.";
import { AcceptInviteSchema, LoginSchema, MagicLinkSchema, RecoveryCodeSchema, ResetPasswordSchema, ResetRequestSchema, TotpSchema } from "@/lib/schemas/auth";
import { eq } from "drizzle-orm";

async function userByProviderId(providerId: string) {
  return withContext(SYSTEM_CONTEXT, async (tx) => {
    const [u] = await tx
      .select({ id: schema.users.id, orgType: schema.organisations.type, roleId: schema.users.roleId, email: schema.users.email, orgId: schema.users.orgId, mfaEnrolled: schema.users.mfaEnrolled })
      .from(schema.users)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
      .where(eq(schema.users.authProviderId, providerId))
      .limit(1);
    return u ?? null;
  });
}

/** FR-AUTH-01: password login. Uniform errors, rate-limited per IP and per account (security.md A07). */
export const signInWithPassword = publicAction(LoginSchema, async (input) => {
  const meta = await requestMeta();
  await enforceLimit("login_ip", meta.ip ?? "unknown");
  await enforceLimit("login_account", input.email);
  const provider = await getAuthProvider();
  const res = await provider.signInWithPassword(input.email, input.password, { ...meta, rememberMe: input.rememberMe });
  const sys = { ...SYSTEM_CONTEXT, ip: meta.ip, userAgent: meta.userAgent, email: input.email };
  if (!res.ok) {
    await audit(sys, { action: "auth.login_failed", entityType: "user", entityId: input.email, after: { reason: res.reason } }).catch(() => undefined);
    throw new AppError("validation", res.reason === "locked" ? "Too many failed attempts. Try again in 15 minutes." : "Email or password is incorrect.");
  }
  const user = await userByProviderId(res.providerId);
  if (!user) {
    await provider.signOut("local");
    throw new AppError("validation", "Email or password is incorrect.");
  }
  await pinSessionVersion(user.id);
  await audit({ ...sys, userId: user.id, orgId: user.orgId }, { action: "auth.login", entityType: "user", entityId: user.id, after: { method: "password" } });
  const fallback = user.orgType === "client" ? "/portal" : "/app";
  return { next: mfaGate(user, safeNext(input.next, fallback)) };
});

/** FR-AUTH-01 magic link. Always "sent" (no enumeration). */
export const requestMagicLink = publicAction(MagicLinkSchema, async (input) => {
  await enforceLimit("magic_link", input.email);
  const provider = await getAuthProvider();
  await provider.sendMagicLink(input.email, safeNext(input.next, "/portal"));
  return { sent: true };
});

/** The magic-link page requires a click (no prefetch consumption, security.md A07). */
export const consumeMagicLink = publicAction(z.object({ token: z.string().min(10).max(500), next: z.string().max(500).optional() }).strict(), async (input) => {
  const meta = await requestMeta();
  const provider = await getAuthProvider();
  const res = await provider.consumeMagicLink(input.token, meta);
  if (!res.ok) throw new AppError("validation", res.reason === "used" ? "This link has already been used. Request a new one." : "This link is invalid or has expired. Request a new one.");
  const user = await userByProviderId(res.providerId);
  if (!user) throw new AppError("validation", "This link is invalid or has expired.");
  await pinSessionVersion(user.id);
  await audit({ ...SYSTEM_CONTEXT, userId: user.id, orgId: user.orgId, ip: meta.ip, userAgent: meta.userAgent, email: user.email }, { action: "auth.login", entityType: "user", entityId: user.id, after: { method: "magic_link" } });
  return { next: mfaGate(user, safeNext(input.next, user.orgType === "client" ? "/portal" : "/app")) };
});

/** FR-AUTH-05 */
export const requestPasswordReset = publicAction(ResetRequestSchema, async (input) => {
  await enforceLimit("password_reset", input.email);
  const provider = await getAuthProvider();
  await provider.requestPasswordReset(input.email, "/login");
  return { sent: true };
});

export const resetPassword = publicAction(ResetPasswordSchema, async (input) => {
  const provider = await getAuthProvider();
  const res = await provider.consumePasswordReset(input.token);
  if (!res) throw new AppError("validation", "This link is invalid or has expired. Request a new one.");
  if (await isPwnedPassword(input.password)) throw new AppError("validation", PWNED_MESSAGE, { fields: { password: "Choose a different password" } });
  await provider.setPassword(res.providerId, input.password);
  const user = await userByProviderId(res.providerId);
  if (user) {
    await bumpSessionVersion(user.id);
    await audit({ ...SYSTEM_CONTEXT, userId: user.id, orgId: user.orgId, email: user.email }, { action: "auth.password_reset", entityType: "user", entityId: user.id });
  }
  return { ok: true };
});

/** FR-AUTH-04: accepting an invite sets the password and signs the user in (MFA enrolment follows for admin/lead). */
export const acceptInvite = publicAction(AcceptInviteSchema, async (input) => {
  const meta = await requestMeta();
  const inv = await findInvitation(input.token);
  if (!inv || inv.state !== "valid") throw new AppError("validation", inv?.state === "used" ? "This invitation has already been used." : "This invitation is invalid or has expired.");
  if (await isPwnedPassword(input.password)) throw new AppError("validation", PWNED_MESSAGE, { fields: { password: "Choose a different password" } });
  const provider = await getAuthProvider();
  const providerId = inv.authProviderId ?? inv.userId;
  await provider.setPassword(providerId, input.password);
  const accepted = await acceptInvitation(input.token);
  if (!accepted) throw new AppError("validation", "This invitation is invalid or has expired.");
  await provider.establishSession(providerId, ["password"], { ...meta, isStaff: accepted.orgType === "staff" });
  await pinSessionVersion(accepted.userId);
  return { next: accepted.orgType === "client" ? "/portal" : "/app" };
});

/** FR-AUTH-03: TOTP enrolment (mandatory for admin/lead, optional otherwise). */
export const beginTotpEnrollment = publicAction(z.object({}).strict(), async () => {
  const s = await getSession();
  if (s.kind === "anonymous") throw new AppError("unauthenticated");
  const provider = await getAuthProvider();
  const providerId = await providerIdFor(s.ctx.userId);
  const enr = await provider.enrollTotp(providerId);
  return enr;
});

export const confirmTotpEnrollment = publicAction(TotpSchema, async (input) => {
  const s = await getSession();
  if (s.kind === "anonymous") throw new AppError("unauthenticated");
  const provider = await getAuthProvider();
  const ok = await provider.confirmTotp(await providerIdFor(s.ctx.userId), input.code);
  if (!ok) throw new AppError("validation", "That code didn't match. Check your authenticator app and try again.", { fields: { code: "Incorrect code" } });
  await markMfaEnrolled(s.ctx.userId);
  await audit(s.ctx, { action: "auth.mfa_enrolled", entityType: "user", entityId: s.ctx.userId });
  return { next: safeNext(input.next, homeFor(s.ctx)) };
});

export const verifyTotp = publicAction(TotpSchema, async (input) => {
  const s = await getSession();
  if (s.kind === "anonymous") throw new AppError("unauthenticated");
  await enforceLimit("login_account", `totp:${s.ctx.userId}`);
  const provider = await getAuthProvider();
  const ok = await provider.verifyTotp(await providerIdFor(s.ctx.userId), input.code);
  if (!ok) {
    await audit(s.ctx, { action: "auth.mfa_failed", entityType: "user", entityId: s.ctx.userId });
    throw new AppError("validation", "That code didn't match. Try again.", { fields: { code: "Incorrect code" } });
  }
  await audit(s.ctx, { action: "auth.mfa_verified", entityType: "user", entityId: s.ctx.userId });
  return { next: safeNext(input.next, homeFor(s.ctx)) };
});

export const signInWithRecoveryCode = publicAction(RecoveryCodeSchema, async (input) => {
  const s = await getSession();
  if (s.kind === "anonymous") throw new AppError("unauthenticated");
  await enforceLimit("login_account", `recovery:${s.ctx.userId}`);
  const provider = await getAuthProvider();
  const ok = await provider.verifyRecoveryCode(await providerIdFor(s.ctx.userId), input.code);
  if (!ok) throw new AppError("validation", "That recovery code is not valid.", { fields: { code: "Invalid" } });
  await audit(s.ctx, { action: "auth.recovery_code_used", entityType: "user", entityId: s.ctx.userId });
  return { next: homeFor(s.ctx) };
});

/** FR-AUTH-06: sign out here, or everywhere. */
export const signOut = action(z.object({ everywhere: z.boolean().optional() }).strict(), null, async (ctx, input) => {
  const provider = await getAuthProvider();
  if (input.everywhere) await bumpSessionVersion(ctx.userId);
  await provider.signOut(input.everywhere ? "global" : "local");
  await clearSessionPin();
  await audit(ctx, { action: input.everywhere ? "auth.logout_all" : "auth.logout", entityType: "user", entityId: ctx.userId });
  return { next: "/login" };
});

export async function signOutAndRedirect() {
  const s = await getSession();
  if (s.kind !== "anonymous") {
    const provider = await getAuthProvider();
    await provider.signOut("local");
    await clearSessionPin();
  }
  redirect("/login");
}

/** Where to send a freshly signed-in user: straight in, or through the TOTP gate first (FR-AUTH-03). */
function mfaGate(user: { roleId: string; mfaEnrolled: boolean }, next: string): string {
  if (user.mfaEnrolled) return `/mfa?next=${encodeURIComponent(next)}`;
  return MFA_REQUIRED_ROLES.includes(user.roleId as Role) ? `/mfa/enroll?next=${encodeURIComponent(next)}` : next;
}

async function providerIdFor(userId: string): Promise<string> {
  const [u] = await withContext(SYSTEM_CONTEXT, (tx) => tx.select({ p: schema.users.authProviderId }).from(schema.users).where(eq(schema.users.id, userId)).limit(1));
  return u?.p ?? userId;
}
