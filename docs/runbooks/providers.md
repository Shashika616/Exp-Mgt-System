# Providers — how to swap auth, storage, email, rate limiting, database

Every external dependency sits behind a small interface with adapters next to it. Swapping = one new file + one env value. No component or Server Action imports an implementation directly (ESLint enforces the boundary).

| Area | Interface | Adapters shipped | Env |
|---|---|---|---|
| Auth | `lib/auth/types.ts` (`AuthProvider`) | `lib/auth/local.ts` (self-owned: scrypt, opaque httpOnly sessions, TOTP + recovery codes, lockout), `lib/auth/supabase.ts` (Supabase Auth via `@supabase/ssr`) | `AUTH_PROVIDER=local|supabase` |
| Storage | `lib/storage/provider.ts` (`StorageProvider`) | `local.ts` (dev/test filesystem, HMAC-signed URLs), `supabase.ts` (private bucket, signed URLs ≤ 60 s) | `STORAGE_PROVIDER` |
| Email | `lib/email/provider.ts` (`EmailProvider`) | `log` (server log + dev outbox) | `EMAIL_PROVIDER` |
| Rate limiting | `lib/ratelimit/provider.ts` (`RateLimiter`) | Postgres fixed window (`rate_limits` table) | — |
| Database | Drizzle over `DATABASE_URL`; SQL migrations in `db/migrations`; RLS via session variables | any PostgreSQL 16 | `DATABASE_URL` |

## Adding a real email client (e.g. SMTP, SES, Postmark)

1. Create `lib/email/<name>.ts` implementing `EmailProvider.send({ to, subject, html, text, tag })`. Pass subject/name as structured fields (never string-concatenate headers — `cleanHeader()` is there for you).
2. Register it in `getEmailProvider()` and add the value to `EMAIL_PROVIDER` in `lib/env.ts` (+ any keys it needs, with a `superRefine` check).
3. Document the variables in `.env.example`.
The templates (`emails/*.tsx`, React Email) and the queue (`notifications.email_status`, flushed by `notify-flush`) stay unchanged.

## Writing your own auth (or moving off Supabase Auth)

The `local` adapter *is* a complete, portable implementation — copy it as a starting point. The contract:

- `getSessionUser()` → `{ providerId, email, amr }` from the request cookies, or `null`. `amr` must include `"totp"` after a successful TOTP check; `requireUser()` enforces MFA for admin/lead from it.
- Identity mapping lives in **our** `users.auth_provider_id`; roles, permissions, MFA flags and `session_version` are ours. Swapping providers never changes the schema.
- Keep tokens in httpOnly cookies. Never persist sessions in localStorage.

## Moving the database off Supabase

`pg_dump` → restore into any managed Postgres → run `pnpm db:migrate` to verify → point `DATABASE_URL`/`DATABASE_ADMIN_URL` at it → schedule `pnpm cron all` (every minute) from a system cron or a small container. Supabase-only SQL is isolated in `db/migrations/supabase/`.
