import { z } from "zod";

// Validated at import (docs/architecture.md §9, security.md A02): missing/invalid env fails fast.
// Client-side bundles only ever receive NEXT_PUBLIC_* values.
const providerEnum = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Deployment stage. Strict production checks apply only when this (or Vercel) says production. */
    APP_ENV: z.enum(["development", "test", "production"]).optional(),
    VERCEL_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DATABASE_ADMIN_URL: z.string().optional(),

    AUTH_PROVIDER: providerEnum(["supabase", "local"]).default("supabase"),
    STORAGE_PROVIDER: providerEnum(["supabase", "local"]).default("supabase"),
    EMAIL_PROVIDER: providerEnum(["log"]).default("log"),
    RATELIMIT_PROVIDER: providerEnum(["postgres"]).default("postgres"),

    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().default("attachments"),

    EMAIL_FROM: z.string().default("EXPENDABLES Support <support@example.invalid>"),

    CRON_SECRET: z.string().min(16),
    WEBSITE_FORM_HMAC_SECRET: z.string().min(16),
    APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "APP_ENCRYPTION_KEY must be 64 hex chars (256-bit)"),
    SESSION_SECRET: z.string().min(32),

    SENTRY_DSN: z.string().optional(),
    APP_URL: z.string().url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** Multiplies every rate limit (tests use 20; production must stay 1). */
    RATE_LIMIT_SCALE: z.coerce.number().int().min(1).max(100).default(1),
    /** Staff page loads may run the SLA tick + email flush at most once a minute (off when pg_cron owns it). */
    OPPORTUNISTIC_JOBS: z.enum(["true", "false"]).default("true"),
    /** Notification bell refresh while a tab is open, in ms; 0 disables. */
    NEXT_PUBLIC_NOTIFICATIONS_POLL_MS: z.coerce.number().int().min(0).max(3_600_000).default(60_000),
  })
  .superRefine((e, ctx) => {
    const needsSupabase =
      e.AUTH_PROVIDER === "supabase" || e.STORAGE_PROVIDER === "supabase";
    if (needsSupabase && (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      ctx.addIssue({
        code: "custom",
        message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required when a provider is 'supabase'",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
    if (e.AUTH_PROVIDER === "supabase" && !e.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "SUPABASE_SERVICE_ROLE_KEY is required for invite flows when AUTH_PROVIDER=supabase",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
      });
    }
    const deployedProd = e.APP_ENV === "production" || e.VERCEL_ENV === "production";
    if (deployedProd) {
      if (e.STORAGE_PROVIDER === "local") ctx.addIssue({ code: "custom", message: "STORAGE_PROVIDER=local is not allowed in production", path: ["STORAGE_PROVIDER"] });
      if (e.RATE_LIMIT_SCALE !== 1) ctx.addIssue({ code: "custom", message: "RATE_LIMIT_SCALE must be 1 in production", path: ["RATE_LIMIT_SCALE"] });
      if (/change-me|^0+$/.test(e.CRON_SECRET + e.SESSION_SECRET + e.APP_ENCRYPTION_KEY)) {
        ctx.addIssue({ code: "custom", message: "placeholder secrets are not allowed in production", path: ["CRON_SECRET"] });
      }
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env: Env = load();
export const isProd = env.NODE_ENV === "production";
/** True only for a real production deployment (APP_ENV / VERCEL_ENV), not for local `next build`. */
export const isDeployedProd = env.APP_ENV === "production" || env.VERCEL_ENV === "production";
export const isDev = env.NODE_ENV === "development";
