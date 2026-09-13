# Deploy - Vercel (Hobby) + Supabase (free tier)

The app is a single Next.js monolith. Nothing else runs: no worker, no Redis, no mail service.
Background jobs are HTTP endpoints called by Supabase `pg_cron`.

## 1. Supabase project

1. Create a project (region closest to Colombo, e.g. `ap-south-1` / `ap-southeast-1`).
2. **Database → Settings → Connection strings**. You need two:
   - `DATABASE_ADMIN_URL` - *Direct connection* (session mode, port 5432) as `postgres`. Used only for migrations, seed, pgTAP.
   - `DATABASE_URL` - *Transaction pooler* (port 6543) but **as the `app_rw` role** created below. Append `?sslmode=require`.
3. Run the migrations from your machine (they create the least-privilege `app_rw` role, every table, RLS policies, triggers, grants):
   ```bash
   DATABASE_ADMIN_URL='postgres://postgres.[ref]:[password]@...:5432/postgres?sslmode=require' pnpm db:migrate
   ```
4. Give the app role a password (SQL editor):
   ```sql
   alter role app_rw with login password '<strong-password>';
   ```
   `DATABASE_URL` is then `postgres://app_rw.[ref]:<strong-password>@...pooler...:6543/postgres?sslmode=require`.
   (`app_rw` has no DDL rights and cannot bypass RLS - security.md A01.)
5. Reference data (no demo data in production):
   ```bash
   SEED_DEMO=0 DATABASE_ADMIN_URL=... pnpm db:seed
   ```
6. **Storage**: create a bucket named `attachments`, **private**. No storage policies are needed - the server uploads and signs URLs with the service key; browsers only ever receive ≤ 60 s signed URLs.
7. **Auth** (only if `AUTH_PROVIDER=supabase`): Authentication → Providers → Email: enable, *disable* "Allow new users to sign up" (invite-only), enable email confirmations. Authentication → MFA: enable TOTP. Authentication → Security: enable leaked-password protection. Set the site URL to your Vercel URL and add `https://<app>/auth/callback` to redirect URLs.
   With `AUTH_PROVIDER=local` (self-owned auth in Postgres) none of this is required.
8. **Cron**: Database → Extensions → enable `pg_cron` and `pg_net`. Then run `db/migrations/supabase/0001_pg_cron_schedule.sql` in the SQL editor after replacing `<APP_URL>` and `<CRON_SECRET>`. This calls:
   - `/api/cron/sla-tick` every minute (at-risk / breach / escalation + notifications)
   - `/api/cron/notify-flush` every minute (sends queued emails)
   - `/api/cron/daily-stats` at 00:05 (dashboard aggregates)
   Until pg_cron is set up, staff page loads run the tick opportunistically (`OPPORTUNISTIC_JOBS=true`); set it to `false` afterwards.

## 2. Vercel project

Import the Git repository. Framework preset: Next.js. Build command `pnpm build`, install `pnpm install --frozen-lockfile`.

**Region matters**: `vercel.json` pins functions to `sin1` (Singapore) to sit next to the Supabase `ap-southeast-1` database. If your Supabase project is elsewhere, change `regions` to the matching Vercel region; cross-region round trips make every page several times slower.

Environment variables (Production):

| Variable | Value |
|---|---|
| `APP_ENV` | `production` (turns on strict checks: no local storage, no placeholder secrets) |
| `APP_URL` | `https://<your-app>.vercel.app` |
| `DATABASE_URL` | pooler URL as `app_rw` (step 1.4) |
| `DATABASE_ADMIN_URL` | not needed on Vercel (migrations run from your machine / CI) |
| `AUTH_PROVIDER` | `local` or `supabase` |
| `STORAGE_PROVIDER` | `supabase` |
| `STORAGE_BUCKET` | `attachments` |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (browser-safe; every table is RLS-protected and never queried with supabase-js) |
| `SUPABASE_SERVICE_ROLE_KEY` | service key - server only (storage uploads/signing, auth admin ops) |
| `EMAIL_PROVIDER` | `log` until a mail client is chosen (see providers.md) |
| `EMAIL_FROM` | `EXPENDABLES Support <support@…>` - **TODO: confirm the mailbox; the website shows two spellings** |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `WEBSITE_FORM_HMAC_SECRET` | `openssl rand -hex 32` |
| `APP_ENCRYPTION_KEY` | `openssl rand -hex 32` (64 hex chars) |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `OPPORTUNISTIC_JOBS` | `false` once pg_cron is scheduled (`true` only as a stop-gap) |
| `NEXT_PUBLIC_NOTIFICATIONS_POLL_MS` | `60000` (or `0` to disable the bell refresh) |
| `RATE_LIMIT_SCALE` | `1` |

`vercel.json` schedules `/api/cron/daily-stats` daily as a belt-and-braces fallback (Hobby allows daily cron only).

## 3. First admin

```bash
APP_URL=https://<your-app>.vercel.app DATABASE_ADMIN_URL=... AUTH_PROVIDER=<same as Vercel> \
  pnpm tsx db/seed/first-admin.ts admin@expendables.lk "Admin Name"
```
It prints a single-use invitation link (7 days). Accepting it sets the password and then enrols TOTP. Invite everyone else from **Admin → Staff & roles** and **Clients → organisation → Invite contact**.

## 4. Free-tier budget

| Item | Load | Free limit |
|---|---|---|
| pg_cron → `/api/cron/*` | 2 calls/min ≈ 88 k function invocations/month | Vercel Hobby: well within limits |
| Notification bell refresh | 1 call/min per open staff tab (toggle: `NEXT_PUBLIC_NOTIFICATIONS_POLL_MS`) | modest |
| Live updates | none by design (owner decision) | - |
| Database | Supabase free: 500 MB, pooler connections; app uses `max: 1` per function + transaction pooling | fine for the prototype |
| Storage | 1 GB free; 25 MB/file cap enforced server-side | |

## 5. Verify after deploy

- `https://<app>/login` renders; headers contain the nonce CSP, HSTS, `X-Frame-Options: DENY` (securityheaders.com → A).
- `curl -H "authorization: Bearer $CRON_SECRET" https://<app>/api/cron/all` returns `{"ok":true,...}`.
- Accept the admin invitation, enrol TOTP, create a client org, invite a client contact, raise a ticket from the portal.
- `pnpm test:rls` against `DATABASE_ADMIN_URL` (pgTAP is available on Supabase).

## 6. Rollback / reset

Migrations are forward-only SQL files. To reset a **non-production** Supabase project: `DATABASE_ADMIN_URL=... pnpm db:reset && pnpm db:migrate && SEED_DEMO=0 pnpm db:seed`.
Sessions can be invalidated for everyone by bumping `users.session_version` (`update users set session_version = session_version + 1`).
