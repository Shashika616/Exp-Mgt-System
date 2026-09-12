import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import * as OTPAuth from "otpauth";
import { schema, withContext } from "@/lib/dal/db";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { env, isProd } from "@/lib/env";
import { getEmailProvider } from "@/lib/email/provider";
import { renderAuthEmail } from "@/lib/email/render";
import { decrypt, encrypt, hashPassword, randomToken, sha256, verifyPassword } from "./crypto";
import type { AuthProvider, AuthResult, RequestMeta, SessionUser, TotpEnrollment } from "./types";

/**
 * Portable, Postgres-backed AuthProvider (architecture.md §10 step 5 - the "own cloud" path).
 * Passwords: scrypt. Sessions: opaque random token in an httpOnly cookie, hashed at rest, idle timeout
 * 12 h for staff / 30 d for clients (FR-AUTH-06). TOTP: RFC 6238 via `otpauth`, secret AES-256-GCM at rest.
 * The provider id of a user *is* our users.id.
 */
const SESSION_COOKIE = "exp_session";
const STAFF_IDLE_MS = 12 * 60 * 60 * 1000;
const CLIENT_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const LOCK_AFTER = 10;
const LOCK_MS = 15 * 60 * 1000;

const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});

export class LocalAuthProvider implements AuthProvider {
  readonly name = "local" as const;

  async getSessionUser(): Promise<SessionUser | null> {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const hash = sha256(token);
    const now = new Date();
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [row] = await tx
        .select({
          id: schema.authSessions.id,
          userId: schema.authSessions.userId,
          amr: schema.authSessions.amr,
          lastActiveAt: schema.authSessions.lastActiveAt,
          sessionVersion: schema.authSessions.sessionVersion,
          email: schema.users.email,
          userSessionVersion: schema.users.sessionVersion,
          orgType: schema.organisations.type,
        })
        .from(schema.authSessions)
        .innerJoin(schema.users, eq(schema.users.id, schema.authSessions.userId))
        .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
        .where(and(eq(schema.authSessions.tokenHash, hash), isNull(schema.authSessions.revokedAt), gt(schema.authSessions.expiresAt, now)))
        .limit(1);
      if (!row) return null;
      if (row.sessionVersion !== row.userSessionVersion) return null; // "sign out everywhere" / deactivation
      const idle = row.orgType === "staff" ? STAFF_IDLE_MS : CLIENT_IDLE_MS;
      if (now.getTime() - row.lastActiveAt.getTime() > idle) return null;
      // Touch at most once a minute to avoid write amplification
      if (now.getTime() - row.lastActiveAt.getTime() > 60_000) {
        await tx.update(schema.authSessions).set({ lastActiveAt: now }).where(eq(schema.authSessions.id, row.id));
      }
      return { providerId: row.userId, email: row.email, amr: row.amr };
    });
  }

  async signInWithPassword(email: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [user] = await tx
        .select({
          id: schema.users.id,
          email: schema.users.email,
          status: schema.users.status,
          passwordHash: schema.localCredentials.passwordHash,
          failed: schema.localCredentials.failedAttempts,
          lockedUntil: schema.localCredentials.lockedUntil,
        })
        .from(schema.users)
        .leftJoin(schema.localCredentials, eq(schema.localCredentials.userId, schema.users.id))
        .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
        .limit(1);
      const now = new Date();
      if (user?.lockedUntil && user.lockedUntil > now) {
        await verifyPassword(password, null);
        return { ok: false, reason: "locked" };
      }
      const valid = await verifyPassword(password, user?.passwordHash);
      if (!user || !valid || user.status !== "active") {
        if (user) {
          const failed = (user.failed ?? 0) + 1;
          await tx
            .update(schema.localCredentials)
            .set({ failedAttempts: failed, lockedUntil: failed >= LOCK_AFTER ? new Date(now.getTime() + LOCK_MS) : null })
            .where(eq(schema.localCredentials.userId, user.id));
        }
        return { ok: false, reason: "invalid_credentials" };
      }
      await tx.update(schema.localCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(schema.localCredentials.userId, user.id));
      await this.createSession(tx, user.id, ["password"], meta);
      return { ok: true, providerId: user.id, email: user.email, amr: ["password"] };
    });
  }

  async sendMagicLink(email: string, redirectPath: string): Promise<void> {
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      const [user] = await tx
        .select({ id: schema.users.id, fullName: schema.users.fullName })
        .from(schema.users)
        .where(and(eq(schema.users.email, email), eq(schema.users.status, "active"), isNull(schema.users.deletedAt)))
        .limit(1);
      if (!user) return; // uniform response
      const token = randomToken();
      await tx.insert(schema.authTokens).values({
        userId: user.id,
        kind: "magic_link",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      });
      const url = `${env.APP_URL}/magic-link/${token}?next=${encodeURIComponent(redirectPath)}`;
      const { subject, html, text } = await renderAuthEmail("magic_link", { name: user.fullName, url });
      await getEmailProvider().send({ to: email, subject, html, text, tag: "auth_magic_link" });
    });
  }

  async consumeMagicLink(token: string, meta: RequestMeta): Promise<AuthResult> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [row] = await tx
        .select({ id: schema.authTokens.id, userId: schema.authTokens.userId, expiresAt: schema.authTokens.expiresAt, usedAt: schema.authTokens.usedAt, email: schema.users.email, status: schema.users.status })
        .from(schema.authTokens)
        .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
        .where(and(eq(schema.authTokens.tokenHash, sha256(token)), eq(schema.authTokens.kind, "magic_link")))
        .limit(1);
      if (!row) return { ok: false, reason: "unknown" };
      if (row.usedAt) return { ok: false, reason: "used" };
      if (row.expiresAt < new Date() || row.status !== "active") return { ok: false, reason: "expired" };
      await tx.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.id));
      await this.createSession(tx, row.userId, ["otp"], meta);
      return { ok: true, providerId: row.userId, email: row.email, amr: ["otp"] };
    });
  }

  async createIdentity(_email: string): Promise<{ providerId: string }> {
    // The local provider keys identities by users.id; the caller sets auth_provider_id = users.id.
    return { providerId: "" };
  }

  async setPassword(providerId: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      await tx
        .insert(schema.localCredentials)
        .values({ userId: providerId, passwordHash })
        .onConflictDoUpdate({ target: schema.localCredentials.userId, set: { passwordHash, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() } });
      // Password change invalidates other sessions (security.md A07)
      await tx.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, providerId));
    });
  }

  async establishSession(providerId: string, amr: string[], meta: RequestMeta): Promise<void> {
    await withContext(SYSTEM_CONTEXT, (tx) => this.createSession(tx, providerId, amr, meta));
  }

  async requestPasswordReset(email: string, redirectPath: string): Promise<void> {
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      const [user] = await tx
        .select({ id: schema.users.id, fullName: schema.users.fullName })
        .from(schema.users)
        .where(and(eq(schema.users.email, email), eq(schema.users.status, "active"), isNull(schema.users.deletedAt)))
        .limit(1);
      if (!user) return;
      const token = randomToken();
      await tx.insert(schema.authTokens).values({ userId: user.id, kind: "password_reset", tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
      const url = `${env.APP_URL}/reset/${token}?next=${encodeURIComponent(redirectPath)}`;
      const { subject, html, text } = await renderAuthEmail("password_reset", { name: user.fullName, url });
      await getEmailProvider().send({ to: email, subject, html, text, tag: "auth_password_reset" });
    });
  }

  async consumePasswordReset(token: string): Promise<{ providerId: string } | null> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [row] = await tx
        .select({ id: schema.authTokens.id, userId: schema.authTokens.userId, expiresAt: schema.authTokens.expiresAt, usedAt: schema.authTokens.usedAt })
        .from(schema.authTokens)
        .where(and(eq(schema.authTokens.tokenHash, sha256(token)), eq(schema.authTokens.kind, "password_reset")))
        .limit(1);
      if (!row || row.usedAt || row.expiresAt < new Date()) return null;
      await tx.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.id));
      return { providerId: row.userId };
    });
  }

  async enrollTotp(providerId: string): Promise<TotpEnrollment> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const [user] = await withContext(SYSTEM_CONTEXT, (tx) => tx.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, providerId)).limit(1));
    const totp = new OTPAuth.TOTP({ issuer: "Expendables Support", label: user?.email ?? providerId, algorithm: "SHA1", digits: 6, period: 30, secret });
    const recoveryCodes = Array.from({ length: 8 }, () => randomToken(6).replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase());
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      await tx
        .insert(schema.localCredentials)
        .values({ userId: providerId, totpSecretEnc: encrypt(`pending:${secret.base32}`), recoveryCodeHashes: recoveryCodes.map(sha256) })
        .onConflictDoUpdate({ target: schema.localCredentials.userId, set: { totpSecretEnc: encrypt(`pending:${secret.base32}`), recoveryCodeHashes: recoveryCodes.map(sha256), updatedAt: new Date() } });
    });
    return { secret: secret.base32, uri: totp.toString(), recoveryCodes };
  }

  async confirmTotp(providerId: string, code: string): Promise<boolean> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [cred] = await tx.select({ enc: schema.localCredentials.totpSecretEnc }).from(schema.localCredentials).where(eq(schema.localCredentials.userId, providerId)).limit(1);
      if (!cred?.enc) return false;
      const raw = decrypt(cred.enc);
      const base32 = raw.startsWith("pending:") ? raw.slice(8) : raw;
      if (!validateTotp(base32, code)) return false;
      await tx.update(schema.localCredentials).set({ totpSecretEnc: encrypt(base32), updatedAt: new Date() }).where(eq(schema.localCredentials.userId, providerId));
      await tx.update(schema.users).set({ mfaEnrolled: true }).where(eq(schema.users.id, providerId));
      await this.addAmr(tx, "totp");
      return true;
    });
  }

  async verifyTotp(providerId: string, code: string): Promise<boolean> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [cred] = await tx.select({ enc: schema.localCredentials.totpSecretEnc }).from(schema.localCredentials).where(eq(schema.localCredentials.userId, providerId)).limit(1);
      if (!cred?.enc) return false;
      const raw = decrypt(cred.enc);
      if (raw.startsWith("pending:")) return false;
      if (!validateTotp(raw, code)) return false;
      await this.addAmr(tx, "totp");
      return true;
    });
  }

  async verifyRecoveryCode(providerId: string, code: string): Promise<boolean> {
    return withContext(SYSTEM_CONTEXT, async (tx) => {
      const [cred] = await tx.select({ hashes: schema.localCredentials.recoveryCodeHashes }).from(schema.localCredentials).where(eq(schema.localCredentials.userId, providerId)).limit(1);
      const h = sha256(code.trim().toLowerCase());
      if (!cred || !cred.hashes.includes(h)) return false;
      await tx.update(schema.localCredentials).set({ recoveryCodeHashes: cred.hashes.filter((x) => x !== h) }).where(eq(schema.localCredentials.userId, providerId));
      await this.addAmr(tx, "totp");
      return true;
    });
  }

  async resetTotp(providerId: string): Promise<void> {
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      await tx.update(schema.localCredentials).set({ totpSecretEnc: null, recoveryCodeHashes: [] }).where(eq(schema.localCredentials.userId, providerId));
      await tx.update(schema.users).set({ mfaEnrolled: false, sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, providerId));
    });
  }

  async signOut(scope: "local" | "global"): Promise<void> {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await withContext(SYSTEM_CONTEXT, async (tx) => {
        const hash = sha256(token);
        if (scope === "global") {
          const [row] = await tx.select({ userId: schema.authSessions.userId }).from(schema.authSessions).where(eq(schema.authSessions.tokenHash, hash)).limit(1);
          if (row) await tx.update(schema.authSessions).set({ revokedAt: new Date() }).where(eq(schema.authSessions.userId, row.userId));
        } else {
          await tx.update(schema.authSessions).set({ revokedAt: new Date() }).where(eq(schema.authSessions.tokenHash, hash));
        }
      });
    }
    jar.set(SESSION_COOKIE, "", { ...cookieOpts(0), maxAge: 0 });
  }

  async revokeAllSessions(providerId: string): Promise<void> {
    await withContext(SYSTEM_CONTEXT, async (tx) => {
      await tx.update(schema.authSessions).set({ revokedAt: new Date() }).where(eq(schema.authSessions.userId, providerId));
      await tx.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, providerId));
    });
  }

  // --- internals -------------------------------------------------------------

  private async createSession(tx: Parameters<Parameters<typeof withContext>[1]>[0], userId: string, amr: string[], meta: RequestMeta) {
    const token = randomToken(32);
    const [user] = await tx
      .select({ sessionVersion: schema.users.sessionVersion, orgType: schema.organisations.type })
      .from(schema.users)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!user) throw new Error("user not found");
    const idle = user.orgType === "staff" ? STAFF_IDLE_MS : CLIENT_IDLE_MS;
    const expiresAt = new Date(Date.now() + (user.orgType === "staff" ? 7 : 30) * 24 * 60 * 60 * 1000);
    await tx.insert(schema.authSessions).values({
      userId,
      tokenHash: sha256(token),
      sessionVersion: user.sessionVersion,
      amr,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      expiresAt,
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, cookieOpts(Math.floor(Math.min(idle, expiresAt.getTime() - Date.now()) / 1000)));
  }

  private async addAmr(tx: Parameters<Parameters<typeof withContext>[1]>[0], method: string) {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return;
    await tx
      .update(schema.authSessions)
      .set({ amr: sql`(select jsonb_agg(distinct x) from jsonb_array_elements(${schema.authSessions.amr} || ${JSON.stringify([method])}::jsonb) x)` })
      .where(eq(schema.authSessions.tokenHash, sha256(token)));
  }
}

function validateTotp(base32: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(base32) });
  const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: 1 });
  return delta !== null;
}
