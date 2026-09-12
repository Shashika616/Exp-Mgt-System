import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/dal/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dailyStats } from "./daily-stats";
import { notifyFlush } from "./notify-flush";
import { slaTick } from "./sla-tick";

/**
 * Job registry. No long-lived worker is needed (Vercel Hobby + Supabase free): jobs run as plain functions
 * behind /api/cron/[job] (scheduled by Supabase pg_cron, see db/migrations/supabase/) and opportunistically
 * from staff page loads (`maybeTick`). A Postgres advisory lock prevents overlapping runs.
 */
export const JOBS = {
  "sla-tick": slaTick,
  "notify-flush": notifyFlush,
  "daily-stats": dailyStats,
  all: async () => ({ sla: await slaTick(), notify: await notifyFlush(), stats: await dailyStats() }),
} as const;
export type JobName = keyof typeof JOBS;

const LOCK_KEYS: Record<JobName, number> = { "sla-tick": 7101, "notify-flush": 7102, "daily-stats": 7103, all: 7100 };

export async function runJob(name: JobName): Promise<unknown> {
  const key = LOCK_KEYS[name];
  const [lock] = await db.execute<{ ok: boolean }>(sql`select pg_try_advisory_lock(${key}) as ok`);
  if (!lock?.ok) return { skipped: "already running" };
  try {
    return await JOBS[name]();
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${key})`);
  }
}

let lastTick = 0;
/** Cheap opportunistic tick from staff page loads: at most once a minute per server instance. */
export async function maybeTick(): Promise<void> {
  if (env.OPPORTUNISTIC_JOBS !== "true") return;
  const now = Date.now();
  if (now - lastTick < 60_000) return;
  lastTick = now;
  runJob("sla-tick").then(() => runJob("notify-flush")).catch((err) => logger.warn({ err }, "opportunistic tick failed"));
}
