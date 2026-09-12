import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runJob, JOBS, type JobName } from "@/lib/jobs/run";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

function authorised(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.headers.get("x-cron-secret") ?? "");
  const a = Buffer.from(token);
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron / Supabase pg_cron → run a job. Secret in Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { job } = await params;
  if (!(job in JOBS)) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const started = Date.now();
  try {
    const result = await runJob(job as JobName);
    return NextResponse.json({ ok: true, job, ms: Date.now() - started, result });
  } catch (err) {
    logger.error({ err, job }, "cron job failed");
    return NextResponse.json({ ok: false, job }, { status: 500 });
  }
}

export const POST = GET;
