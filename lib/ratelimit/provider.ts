import "server-only";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * security.md A06 rate limits, keyed by scope + subject. Postgres-backed (portable, no Redis needed).
 * A Redis/Upstash adapter can be added later by implementing RateLimiter.
 */
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

export interface RateLimiter {
  readonly name: "postgres";
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export const LIMITS = {
  login_ip: { limit: 5, window: 60 },
  login_account: { limit: 10, window: 3600 },
  magic_link: { limit: 3, window: 3600 },
  ticket_create: { limit: 30, window: 3600 },
  comment: { limit: 60, window: 3600 },
  work_log: { limit: 120, window: 86400 },
  submission: { limit: 20, window: 86400 },
  attachment: { limit: 100, window: 86400 },
  password_reset: { limit: 3, window: 3600 },
} as const;
export type LimitScope = keyof typeof LIMITS;

class PostgresRateLimiter implements RateLimiter {
  readonly name = "postgres" as const;
  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const { withContext } = await import("@/lib/dal/db");
    const { SYSTEM_CONTEXT } = await import("@/lib/authz/policy");
    const now = new Date();
    // raw sql params must be strings for postgres.js
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - windowSeconds * 1000).toISOString();
    // Fixed window stored per key; only the system role may touch rate_limits (RLS).
    const rows = await withContext(SYSTEM_CONTEXT, (tx) =>
      tx.execute<{ count: number; window_start: Date }>(sql`
        insert into rate_limits (key, window_start, count) values (${key}, ${nowIso}::timestamptz, 1)
        on conflict (key) do update set
          count = case when rate_limits.window_start < ${cutoffIso}::timestamptz then 1 else rate_limits.count + 1 end,
          window_start = case when rate_limits.window_start < ${cutoffIso}::timestamptz then ${nowIso}::timestamptz else rate_limits.window_start end
        returning count, window_start`),
    );
    const row = rows[0]!;
    const resetAt = new Date(new Date(row.window_start).getTime() + windowSeconds * 1000);
    return { allowed: Number(row.count) <= limit, remaining: Math.max(0, limit - Number(row.count)), resetAt };
  }
}

let limiter: RateLimiter | undefined;
export function getRateLimiter(): RateLimiter {
  if (limiter) return limiter;
  limiter = new PostgresRateLimiter();
  return limiter;
}

/** Throws AppError('rate_limited') when over the limit. */
export async function enforceLimit(scope: LimitScope, subject: string): Promise<void> {
  const { limit, window } = LIMITS[scope];
  const res = await getRateLimiter().hit(`${scope}:${subject}`, limit * env.RATE_LIMIT_SCALE, window);
  if (!res.allowed) throw new AppError("rate_limited");
}
