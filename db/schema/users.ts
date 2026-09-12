import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { userStatusEnum } from "./enums";
import { organisations, roles } from "./orgs";

export const citext = customType<{ data: string }>({ dataType: () => "citext" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    authProviderId: text("auth_provider_id").unique(), // Supabase auth.users.id today
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    email: citext("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    timezone: text("timezone"),
    mfaEnrolled: boolean("mfa_enrolled").notNull().default(false),
    sessionVersion: integer("session_version").notNull().default(1),
    status: userStatusEnum("status").notNull().default("invited"),
    notificationPrefs: jsonb("notification_prefs").notNull().default({}).$type<Record<string, unknown>>(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("users_org_idx").on(t.orgId, t.roleId)],
);

// Single-use, hashed, expiring invitation tokens (FR-AUTH-02/04, security.md A04).
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    invitedBy: uuid("invited_by").references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitations_user_idx").on(t.userId)],
);

// Magic-link / password-reset tokens (hashed, single-use, short-lived).
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(), // magic_link | password_reset
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.kind)],
);

// Credentials for the portable "local" AuthProvider (own-cloud path). Unused when AUTH_PROVIDER=supabase.
export const localCredentials = pgTable("local_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  passwordHash: text("password_hash"), // scrypt, encoded
  totpSecretEnc: text("totp_secret_enc"), // AES-256-GCM with APP_ENCRYPTION_KEY
  recoveryCodeHashes: jsonb("recovery_code_hashes").notNull().default([]).$type<string[]>(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Server-side sessions for the local AuthProvider (Supabase manages its own).
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    sessionVersion: integer("session_version").notNull(),
    amr: jsonb("amr").notNull().default([]).$type<string[]>(), // ["password"|"otp"|"totp"]
    ip: text("ip"),
    userAgent: text("user_agent"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);
