/** What a provider knows about the signed-in identity. `amr` = authentication methods used (e.g. password, otp, totp). */
export type SessionUser = {
  providerId: string;
  email: string;
  amr: string[];
};

export type AuthResult =
  | { ok: true; providerId: string; email: string; amr: string[] }
  | { ok: false; reason: "invalid_credentials" | "locked" | "expired" | "used" | "unknown" };

export type TotpEnrollment = { secret: string; uri: string; recoveryCodes: string[] };

/**
 * architecture.md §7 AuthProvider. Two implementations:
 *  - lib/auth/supabase.ts  — Supabase Auth via @supabase/ssr (production today)
 *  - lib/auth/local.ts     — portable Postgres-backed auth (own-cloud path; also what CI/e2e run on)
 */
export interface AuthProvider {
  readonly name: "supabase" | "local";
  getSessionUser(): Promise<SessionUser | null>;
  signInWithPassword(email: string, password: string, meta: RequestMeta): Promise<AuthResult>;
  /** Sends the magic link email through lib/email (local) or Supabase (supabase). Always resolves (no enumeration). */
  sendMagicLink(email: string, redirectPath: string): Promise<void>;
  /** Local: consume a magic-link token. Supabase: exchange the PKCE code from the callback URL. */
  consumeMagicLink(tokenOrCode: string, meta: RequestMeta): Promise<AuthResult>;
  /** Create the provider identity for an invited user; returns its provider id. */
  createIdentity(email: string): Promise<{ providerId: string }>;
  /** Set (or reset) the password for the identity. Used by invite acceptance + reset. */
  setPassword(providerId: string, password: string): Promise<void>;
  /** After invite acceptance / reset: establish a session for the identity. */
  establishSession(providerId: string, amr: string[], meta: RequestMeta): Promise<void>;
  requestPasswordReset(email: string, redirectPath: string): Promise<void>;
  consumePasswordReset(token: string): Promise<{ providerId: string } | null>;
  enrollTotp(providerId: string): Promise<TotpEnrollment>;
  confirmTotp(providerId: string, code: string): Promise<boolean>;
  verifyTotp(providerId: string, code: string): Promise<boolean>;
  verifyRecoveryCode(providerId: string, code: string): Promise<boolean>;
  resetTotp(providerId: string): Promise<void>;
  signOut(scope: "local" | "global"): Promise<void>;
  /** Invalidate all sessions of a provider identity (deactivation, role change). */
  revokeAllSessions(providerId: string): Promise<void>;
}

export type RequestMeta = { ip?: string | null; userAgent?: string | null; rememberMe?: boolean; isStaff?: boolean };
