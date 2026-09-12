# Build progress (hand-off note)

> Updated by Claude Code after every step so a fresh session can continue without re-reading everything.
> Read `CLAUDE.md` first, then this file, then `docs/STATUS.md` (written at the end).

## Owner decisions taken during the build (override the spec where they conflict)
- **No auto-close** anywhere. Closing is a human action only (client confirms, staff closes/cancels). `auto_close*` transitions, settings and job removed.
- **No Redis / Upstash, no Resend.** Rate limiter is Postgres-backed (`lib/ratelimit/provider.ts`); email is `EMAIL_PROVIDER=log` (server log + `.local/outbox.jsonl` dev outbox) behind `EmailProvider` - real mail client is a one-file adapter later.
- **No pg-boss / long-lived worker.** Target is Vercel Hobby + Supabase free: jobs are plain functions behind `/api/cron/[job]` (Bearer `CRON_SECRET`), scheduled by Supabase `pg_cron` (`db/migrations/supabase/0001_pg_cron_schedule.sql`) + opportunistic `maybeTick()` on staff page loads. `vercel.json` only schedules the daily stats job.
- **Auth is Supabase Auth in production** (`AUTH_PROVIDER=supabase`, `lib/auth/supabase.ts`, httpOnly cookies only). A portable Postgres-backed `local` adapter (`lib/auth/local.ts`: scrypt, opaque sessions, TOTP) is used for local dev / CI / e2e and is the "own auth" path.
- No em dashes in UI copy (owner preference).
- Everything external sits behind `lib/<area>/provider.ts` (auth, storage, email, ratelimit, realtime). DB = Drizzle over `DATABASE_URL`.
- Git identity: the owner will set `git config user.email` themselves.

## Local dev
```
docker compose up -d db          # Postgres 16 + pgTAP on :54329
cp .env.example .env.local       # defaults work locally (local auth/storage, log email)
pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev
```
Demo password for every seeded user: `Expendables#2026!`. Admin/lead TOTP secret: `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (db/seed/demo.ts).
Users: admin@expendables.lk, lead@expendables.lk, nimal@/tharushi@ (agents), kasun@/ishara@/ravindu@expendables.lk (developers),
sanduni@ceylonagro.example (client_admin), priyantha@ceylonagro.example (client_user), roshan@serendibfreight.example …

## Steps (from PROMPT.md)
All 13 steps are complete. `docs/STATUS.md` has the per-FR table and the deviation list.

| Check | Command | State |
|---|---|---|
| lint / typecheck | `pnpm lint && pnpm typecheck` | green |
| unit + authz matrix | `pnpm test` (435) | green, coverage 95 % |
| RLS | `pnpm test:rls` (38) | green |
| e2e (6 golden paths, IDOR, snapshot, axe, mobile) | `APP_ENV=test pnpm test:e2e` (19) | green |
| audit | `pnpm security` | clean |

## Later owner decisions (after the first note)
- No live/realtime updates anywhere (hook + endpoints removed). Bell refresh and opportunistic jobs are toggles (`NEXT_PUBLIC_NOTIFICATIONS_POLL_MS`, `OPPORTUNISTIC_JOBS`).
- No em dashes in any UI text (replaced with ":" / "," / "-").
- Errors shown to users are always plain sentences from `lib/errors.ts`; raw errors stay in server logs.

## If you pick this up fresh
1. `docker compose up -d db && cp .env.example .env.local && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`
2. Read `docs/STATUS.md` for what is done and the open questions for the company.
3. Deployment: `docs/runbooks/deploy.md`. Provider swaps: `docs/runbooks/providers.md`.
