# Build progress (hand-off note)

> Updated by Claude Code after every step so a fresh session can continue without re-reading everything.
> Read `CLAUDE.md` first, then this file, then `docs/STATUS.md` (written at the end).

## Owner decisions taken during the build (override the spec where they conflict)
- **No auto-close** anywhere. Closing is a human action only (client confirms, staff closes/cancels). `auto_close*` transitions, settings and job removed.
- **No Redis / Upstash, no Resend.** Rate limiter is Postgres-backed (`lib/ratelimit/provider.ts`); email is `EMAIL_PROVIDER=log` (server log + `.local/outbox.jsonl` dev outbox) behind `EmailProvider` — real mail client is a one-file adapter later.
- **No pg-boss / long-lived worker.** Target is Vercel Hobby + Supabase free: jobs are plain functions behind `/api/cron/[job]` (Bearer `CRON_SECRET`), scheduled by Supabase `pg_cron` (`db/migrations/supabase/0001_pg_cron_schedule.sql`) + opportunistic `maybeTick()` on staff page loads. `vercel.json` only schedules the daily stats job.
- **Auth is Supabase Auth in production** (`AUTH_PROVIDER=supabase`, `lib/auth/supabase.ts`, httpOnly cookies only). A portable Postgres-backed `local` adapter (`lib/auth/local.ts`: scrypt, opaque sessions, TOTP) is used for local dev / CI / e2e and is the "own auth" path.
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
| # | Step | State | Notes |
|---|---|---|---|
| 1 | Scaffold, env.ts, globals.css tokens, fonts, brand assets, security headers + nonce CSP | ✅ | `proxy.ts` sets CSP nonce; static headers in `next.config.ts`. ESLint boundaries: **TODO** (eslint.config.mjs not yet written) |
| 2 | DB schema, migrations, RLS, grants, seed, pgTAP | ✅ | 33 tables all RLS; 36 pgTAP assertions pass (`pnpm test:rls`) |
| 3 | Auth + authz | ✅ | login/magic link/reset/invite/TOTP pages; authz matrix test (347 cases) |
| 4 | Domain (pure) | ✅ | 76 unit tests; coverage run **TODO** |
| 5 | App shell + portal shell | ✅ | sidebar/topbar/⌘K/notifications/timer indicator |
| 6 | Tickets: create, queues/table, detail, composer, properties, attachments, realtime | ✅ code written | needs browser verification |
| 7 | Delivery loop: assign→work log/timer→work_state→submit→review | ✅ code written | needs browser verification |
| 8 | SLA jobs, notifications (in-app + email outbox), matrix | ✅ | `lib/jobs/*` |
| 9 | Admin console | ✅ code written | users, orgs, categories+canned, SLA, templates, settings, audit(+CSV) |
| 10 | Four dashboards + daily_ticket_stats job | ✅ code written | charts: inline SVG per dataviz skill |
| 11 | Demo seed | ✅ | 154 tickets |
| 12 | Polish + hardening (apple-design checklist, security-review, Lighthouse, axe) | ⬜ | |
| 13 | README, docs/runbooks/deploy.md, docs/STATUS.md | ⬜ | also docs/runbooks/providers.md |
| — | Playwright e2e: 6 golden paths + IDOR + client snapshot test | ⬜ | `playwright.config.ts` not yet written; chromium installed |
| — | ESLint config (boundaries, no dangerouslySetInnerHTML except SafeHtml) + `pnpm lint` green | ⬜ | |
| — | First real browser smoke test of login → dashboards | ⬜ | next action |

## Known gaps / follow-ups
- `lib/auth/supabase.ts` and `lib/storage/supabase.ts` are written but untested against a live project (no credentials yet).
- Supabase prod needs: `DATABASE_URL` (pooler, role app_rw), `DATABASE_ADMIN_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, secrets, `APP_ENV=production`.
- Company email spelling unresolved → `EMAIL_FROM` placeholder with TODO.
