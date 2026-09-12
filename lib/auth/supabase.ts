import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AuthProvider, AuthResult, RequestMeta, SessionUser, TotpEnrollment } from "./types";

/**
 * Supabase Auth adapter (architecture.md §7). Used ONLY for identity: the anon key has zero table access
 * because every table is RLS-protected and the app never queries tables with supabase-js.
 * Supabase Auth settings required (docs/runbooks/deploy.md): signups disabled, email confirmations on,
 * leaked-password protection on, TOTP MFA enabled.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase" as const;

  private async client(): Promise<SupabaseClient> {
    const jar = await cookies();
    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production" });
          } catch {
            // Called from a Server Component: cookies are refreshed by proxy.ts instead.
          }
        },
      },
    });
  }

  /** Server-only admin client (service role) — for invite/identity management, never for data. */
  private admin(): SupabaseClient {
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async getSessionUser(): Promise<SessionUser | null> {
    const sb = await this.client();
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const amr: string[] = (aal?.currentAuthenticationMethods ?? []).map((m) => (typeof m === "string" ? m : m.method));
    if (aal?.currentLevel === "aal2" && !amr.includes("totp")) amr.push("totp");
    return { providerId: data.user.id, email: data.user.email ?? "", amr };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const sb = await this.client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, reason: "invalid_credentials" };
    return { ok: true, providerId: data.user.id, email: data.user.email ?? email, amr: ["password"] };
  }

  async sendMagicLink(email: string, redirectPath: string): Promise<void> {
    const sb = await this.client();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(redirectPath)}` },
    });
    if (error) logger.warn({ err: error.message }, "magic link not sent"); // uniform response to the caller
  }

  async consumeMagicLink(code: string): Promise<AuthResult> {
    const sb = await this.client();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error || !data.user) return { ok: false, reason: "expired" };
    return { ok: true, providerId: data.user.id, email: data.user.email ?? "", amr: ["otp"] };
  }

  async createIdentity(email: string): Promise<{ providerId: string }> {
    const admin = this.admin();
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) {
      // Already exists → look it up
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) throw new Error(`supabase createUser: ${error?.message}`);
      return { providerId: found.id };
    }
    return { providerId: data.user.id };
  }

  async setPassword(providerId: string, password: string): Promise<void> {
    const { error } = await this.admin().auth.admin.updateUserById(providerId, { password });
    if (error) throw new Error(`supabase setPassword: ${error.message}`);
  }

  async establishSession(providerId: string, _amr: string[], _meta: RequestMeta): Promise<void> {
    // Generate a one-time magic link and exchange it server-side so the invitee lands signed in.
    const admin = this.admin();
    const { data: user } = await admin.auth.admin.getUserById(providerId);
    if (!user.user?.email) throw new Error("supabase: user has no email");
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
    if (error || !data.properties?.hashed_token) throw new Error(`supabase generateLink: ${error?.message}`);
    const sb = await this.client();
    const { error: verifyErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (verifyErr) throw new Error(`supabase verifyOtp: ${verifyErr.message}`);
  }

  async requestPasswordReset(email: string, redirectPath: string): Promise<void> {
    const sb = await this.client();
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(redirectPath)}&reset=1` });
  }

  async consumePasswordReset(code: string): Promise<{ providerId: string } | null> {
    const sb = await this.client();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error || !data.user) return null;
    return { providerId: data.user.id };
  }

  async enrollTotp(): Promise<TotpEnrollment> {
    const sb = await this.client();
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: "Expendables Support" });
    if (error || !data) throw new Error(`supabase mfa.enroll: ${error?.message}`);
    // Supabase does not issue recovery codes; the app stores hashed codes in local_credentials for all providers.
    return { secret: data.totp.secret, uri: data.totp.uri, recoveryCodes: [] };
  }

  async confirmTotp(_providerId: string, code: string): Promise<boolean> {
    const sb = await this.client();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const factor = factors?.all.find((f) => f.factor_type === "totp" && f.status === "unverified") ?? factors?.totp[0];
    if (!factor) return false;
    const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId: factor.id });
    if (chErr || !ch) return false;
    const { error } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
    return !error;
  }

  async verifyTotp(providerId: string, code: string): Promise<boolean> {
    return this.confirmTotp(providerId, code);
  }

  async verifyRecoveryCode(): Promise<boolean> {
    return false; // recovery codes for Supabase are handled by the local_credentials fallback in lib/auth/mfa.ts
  }

  async resetTotp(providerId: string): Promise<void> {
    const admin = this.admin();
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: providerId });
    for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: providerId });
  }

  async signOut(scope: "local" | "global"): Promise<void> {
    const sb = await this.client();
    await sb.auth.signOut({ scope: scope === "global" ? "global" : "local" });
  }

  async revokeAllSessions(providerId: string): Promise<void> {
    await this.admin().auth.admin.signOut(providerId, "global").catch(() => undefined);
  }
}
