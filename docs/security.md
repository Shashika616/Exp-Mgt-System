# Security — Threat Model & Controls

> Scope: the whole system (client portal, agent workspace, admin console, jobs, email).
> Framework: **OWASP Top 10:2025** (final release Jan 2026) + OWASP ASVS 5.0 Level 2 as the
> verification bar. Every control here is **P0 unless marked**. Claude Code: treat this file
> as a checklist — a PR that touches auth, data access, uploads, email or headers must cite
> which items it satisfies.

---

## 1. Assets & trust boundaries

| Asset | Sensitivity | Threat if compromised |
|---|---|---|
| Ticket bodies, comments, attachments | **High** — contain client system details, credentials clients paste in, screenshots | Client confidentiality breach; reputational damage |
| Internal notes | **High** — candid staff commentary | Client relationship damage |
| User PII (name, email, phone) | Medium | Phishing, GDPR/PDPA‑style exposure |
| Auth secrets, sessions, MFA seeds | **Critical** | Full takeover |
| Audit log | High (integrity) | Covers tracks |
| Supabase service key, DB URL, email API key | **Critical** | Full data access |

Trust boundaries: browser ↔ Next.js server (untrusted input) · Next.js ↔ Postgres (trusted, role‑restricted) · Next.js ↔ Supabase Auth/Storage (trusted, keyed) · Inbound email ↔ system (untrusted, P1) · Website contact form ↔ API (semi‑trusted, signed, P1).

**Tenancy model:** every business row carries `org_id`. Staff org may read all; client orgs may read only their own. This is the #1 thing to get right.

---

## 2. Attacker personas

1. **Malicious client user** — tries to read other clients' tickets (IDOR), escalate to admin, inject scripts into a comment that an agent will open, upload malware for an agent to download.
2. **Ex‑employee / disgruntled agent** — retains a session, exfiltrates data, alters audit trail.
3. **Internet attacker** — credential stuffing, password spraying, phishing links in tickets, scanning for misconfig, exploiting dependencies.
4. **Compromised third party** — npm package, email provider, CDN.

---

## 3. OWASP Top 10:2025 → controls

### A01:2025 Broken Access Control (incl. SSRF, now folded in)
| Control | Implementation |
|---|---|
| **Deny by default; authorise every data access in one place** | All DB access goes through `lib/dal/*` functions that take an `AuthContext` (`{userId, orgId, role, permissions}`) and add `org_id` scoping themselves. UI components never call the DB or `supabase-js` tables directly. |
| **Never rely on `proxy.ts`/middleware for auth** | Next.js 16 replaced `middleware.ts` with `proxy.ts` for routing only; CVE‑2025‑29927 (x‑middleware‑subrequest bypass) showed why. Auth is checked in **layouts, Server Actions and Route Handlers** via `requireUser()` / `requirePermission()`. `proxy.ts` may only redirect unauthenticated users for UX. |
| **Postgres RLS as second layer** | `SET LOCAL app.user_id / app.org_id / app.role` per transaction; RLS policies on every business table. Works on any Postgres (no `auth.uid()` dependency). The app DB role is **not** `service_role`/superuser and has RLS *not* bypassed. |
| **IDOR tests** | Every entity route has an e2e test: user of org A requests org B's ticket by id → 404 (not 403, to avoid enumeration) + audit event `access_denied`. |
| **Object references** | Ticket keys `EXP‑n` are public‑ish but authz still applies. Internal UUIDs (v7) used for attachments/comments. |
| **Field‑level authz** | zod schemas per role: clients cannot submit `priority`, `assignee_id`, `impact`, `internal` etc. Unknown keys are stripped (`.strict()` on input, mass‑assignment impossible). |
| **Internal notes never leak** | DAL filters `visibility='public'` for client roles; the client portal Server Components can't even select the column; realtime channels are per‑ticket‑per‑visibility. |
| **Work logs, submissions, `work_state`, `in_review` are staff‑only** | Client DAL/RLS never select `work_logs`/`submissions`; the portal status mapper collapses `in_review` → "Being worked on"; `time_spent_minutes` is exposed only when `org_settings.show_time_to_client` is on. e2e test: client fetches ticket JSON → none of these fields present. |
| **Developer scope** | `developer` reads only tickets where `assignee_id = self` or watcher (RLS `tickets_developer`); cannot call `resolveTicket`, `assignTicket`, `setPriority`, `closeTicket` — server‑enforced via `requirePermission`, hidden in UI second. Developer public replies gated by `org_settings.developer_public_reply` checked **server‑side** in `createComment`. |
| **Review integrity** | Only `lead`/`admin` may approve/return; a developer cannot review their own submission even if later promoted (check `developer_id <> ctx.userId`); submissions immutable after outcome (trigger + RLS `with check (outcome is null)`); every review writes `ticket_events` with reviewer id. |
| **Privilege changes** | Only `admin` can change roles; cannot change own role; last admin cannot be demoted; step‑up MFA (P1). |
| **SSRF** | The server never fetches user‑supplied URLs. Webhooks (P2) use an allowlist of schemes/hosts, block private IP ranges, and resolve DNS once. Email `href`s are rendered as text with `rel="noopener noreferrer nofollow"`, never fetched for previews. |
| **CORS** | No wildcard. Route handlers only accept same‑origin (Server Actions enforce Origin/Host match by default). Public API (P2) uses explicit allowlist per API key. |
| **Directory / storage** | Attachments in **private** buckets; download only via short‑lived (60 s) signed URLs minted after authz; object path = `{org_id}/{ticket_id}/{uuid}` with no user‑controlled names. |

### A02:2025 Security Misconfiguration
| Control | Implementation |
|---|---|
| Security headers | `next.config.ts` `headers()`: `Content-Security-Policy` (nonce‑based, `default-src 'self'`, `img-src 'self' data: <storage-host>`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`. |
| No debug in prod | `NODE_ENV=production`; Next.js error overlay off; Sentry receives stack traces, users get an error id. |
| Environment separation | `dev` / `staging` / `prod` Supabase projects; prod secrets only in Vercel encrypted env; `.env*` gitignored; `env.ts` validates all env vars with zod at boot (fail fast). |
| Supabase config | Email confirmations on; signups **disabled** (invite‑only); RLS enabled on every table (CI check queries `pg_tables` for any table without RLS → fail); anon key only used for auth endpoints; storage buckets private; realtime restricted to authenticated + RLS. |
| Cloud hardening | Vercel deployment protection for preview URLs; Supabase network restrictions (allowlist Vercel egress / own VPC later); DB password rotated; `pg_net`, `pg_graphql` extensions disabled if unused. |
| Default accounts | None. First admin is created by a one‑time seed script that requires a fresh invite. |
| Dependency configs | `pnpm` with `ignore-scripts=true` in `.npmrc`; `engine-strict`. |

### A03:2025 Software Supply Chain Failures *(new category)*
| Control | Implementation |
|---|---|
| Lockfile committed; `pnpm install --frozen-lockfile` in CI | Prevents drift. |
| Automated updates | Renovate/Dependabot weekly, grouped; security patches auto‑merged after CI. |
| Vulnerability scanning | `pnpm audit --audit-level=high` + Snyk/OSV‑Scanner in CI; fail on high/critical. |
| Minimal dependency policy | Prefer platform APIs; each new dep needs ≥ 1k weekly downloads, active maintenance, and a note in the PR. No `postinstall` scripts. |
| Provenance | Pin GitHub Actions to commit SHAs; use `npm` provenance where available; SBOM (`cyclonedx`) generated per release. |
| Build integrity | Vercel builds from Git only; no manual deploys; branch protection + required reviews. |
| Third‑party scripts | **None** in the app (no analytics/CDN scripts). Fonts self‑hosted via `next/font`. |

### A04:2025 Cryptographic Failures
| Control | Implementation |
|---|---|
| TLS everywhere | HSTS preload; Supabase connections `sslmode=require`. |
| Password hashing | Delegated to Supabase Auth (bcrypt); on migration to own cloud, use Argon2id via Auth.js/Keycloak. Never store plaintext or reversible. |
| Secrets | Only in env; never logged; rotated on staff departure. Encryption keys for any app‑level encryption (e.g. API keys at rest) come from env, 256‑bit, `AES‑256‑GCM` via WebCrypto. |
| Tokens | Invite/reset/reply tokens: 32 random bytes (`crypto.getRandomValues`), stored **hashed (SHA‑256)**, single‑use, expiring. |
| Data at rest | Supabase/Postgres disk encryption; attachments encrypted at rest by storage provider. |
| No custom crypto | Ever. |

### A05:2025 Injection
| Control | Implementation |
|---|---|
| SQL | Drizzle ORM with parameterised queries only; `sql` template tag for raw fragments, never string concat; DB role has no DDL rights. |
| XSS | React escapes by default. Markdown in tickets/comments rendered with `remark` + `rehype-sanitize` (strict schema: no `html`, no `javascript:`/`data:` links, images only from our storage host). `dangerouslySetInnerHTML` is **banned** by ESLint rule except in the one sanitiser component. CSP nonce blocks inline scripts. |
| Email injection | Subjects/names passed to the email API as structured fields; newlines stripped; templates escape by default (React Email). |
| Header/URL injection | Redirects only to relative paths validated against an allowlist (`/app/**`, `/portal/**`). No open redirects. |
| Command injection | No shelling out. Attachment scanning (P1) uses an API, not CLI with user filenames. |
| Log injection | Structured JSON logs (pino); user strings are values, never format strings. |
| CSV export | Cells starting with `= + - @ \t \r` prefixed with `'` (formula injection). |

### A06:2025 Insecure Design
| Control | Implementation |
|---|---|
| Threat model reviewed per epic | This doc updated when adding channels (email‑in, API). |
| Invite‑only, no self‑signup | Removes account‑creation abuse surface. |
| Rate limits by design | Login 5/min/IP + 10/hour/account; magic link 3/hour/email; ticket create 30/hour/user; comment 60/hour/user; work‑log entries 120/day/user; submissions 20/day/user; attachment 100/day/user; API (P2) per key. Implemented with Upstash Ratelimit (sliding window) or Postgres‑backed limiter — behind an interface for portability. |
| Abuse cases as tests | "Client tries to set priority", "agent tries to read audit log", "user replays invite link" — all in the e2e suite. |
| Separation of duties | Admin actions logged and visible to other admins; audit log is append‑only (no UPDATE/DELETE grants). |
| Fail closed | Any authz helper that cannot determine permission throws → 404/403, never proceeds. |
| Client‑side isolation | Client portal is a separate route group with its own layout that **cannot import** staff DAL functions (ESLint `no-restricted-imports` boundary). |

### A07:2025 Authentication Failures
| Control | Implementation |
|---|---|
| Passwords | ≥ 12 chars, checked against HaveIBeenPwned k‑anonymity API, no composition rules; Supabase "leaked password protection" on. |
| MFA | TOTP mandatory for `admin`/`lead`; enforced in `requireUser()` (`amr` claim check), not just at login. Recovery codes hashed. |
| Brute force | Rate limits above + progressive delay; account lock after 10 failures with email notice; uniform error messages. |
| Sessions | `@supabase/ssr` httpOnly, `Secure`, `SameSite=Lax` cookies; refresh rotation; idle timeout 12 h (staff) / 30 d (clients); "sign out all devices"; session invalidated on password change, role change, deactivation (checked server‑side per request via `users.session_version`). |
| Magic links | 15‑min expiry, single use, bound to email; link opens a page that requires a click (no auto‑consume via prefetch). |
| Enumeration | Login, reset and invite endpoints respond identically for unknown users, with equal timing budget. |
| Deactivation | Deactivated user's next request → 401 within one request (no cached sessions). |

### A08:2025 Software and Data Integrity Failures
| Control | Implementation |
|---|---|
| Audit log integrity | `ticket_events`/`audit_log` tables: INSERT‑only role grants; each row includes `prev_hash` chain (SHA‑256 of previous row) so tampering is detectable (P1). |
| Server Actions | Only accept validated zod input; action IDs are opaque; never trust hidden form fields for authz. |
| Attachments | Store SHA‑256 checksum; verify on download; MIME sniffed server‑side (`file-type`), not trusted from client; extension allowlist (`pdf png jpg jpeg gif webp txt csv log xlsx docx zip`); executables blocked; `Content-Disposition: attachment` always; malware scan via ClamAV/VirusTotal API before the file becomes downloadable (P1 — until then, warning banner + download only). |
| CI/CD | Signed commits recommended; protected main; deploy only from CI. |
| Deserialisation | No `eval`, no untrusted JSON.parse into classes; JSONB custom fields validated against admin schema. |

### A09:2025 Security Logging & Alerting Failures
| Control | Implementation |
|---|---|
| What is logged | Auth events (login success/fail, MFA, reset, invite), authz denials, admin config changes, exports, attachment downloads, all ticket mutations — with `user_id`, `org_id`, IP, UA, request id. **Never** passwords, tokens, full ticket bodies. |
| Where | pino → Vercel logs → (P1) Logtail/Datadog; security events also in `audit_log` table. |
| Alerts | Sentry for errors; alert rules (P1): > 20 auth failures/5 min from one IP, any `access_denied` burst (> 5/min/user), any RLS policy violation error, SLA job failure, audit‑chain verification failure. |
| Retention | Audit ≥ 1 year; app logs 30 days. |
| Time | All timestamps UTC `timestamptz`. |

### A10:2025 Mishandling of Exceptional Conditions *(new category)*
| Control | Implementation |
|---|---|
| Uniform error handling | `lib/errors.ts`: typed `AppError` → mapped to HTTP status + generic message + error id; stack traces only to Sentry. `error.tsx` boundaries in every route group. |
| Fail closed | Auth/authz helpers throw on *any* uncertainty (missing claim, DB error) — never "default allow". Feature flags default off. |
| Transactions | State transitions + event + SLA timer update happen in **one** DB transaction; partial failure rolls back. Idempotency keys on ticket creation and email ingestion. |
| Resource limits | Body size limit 1 MB for JSON, 25 MB per file (enforced by signed upload policy, not just UI); pagination max 100; query timeouts (`statement_timeout = 10s`); background jobs with retries + dead‑letter. |
| Input edge cases | zod: max lengths on every string, `trim()`, unicode normalisation NFC, reject control chars; integers bounded. |
| Race conditions | Optimistic concurrency on ticket updates (`version` column; stale write → 409 + UI merge prompt). Ticket key from a DB sequence (no read‑then‑write). |
| Time & timezone | SLA math in UTC with `luxon`/`date-fns-tz`; DST‑safe business‑hours calendar tests. |

---

## 4. Additional controls specific to this product

| Area | Control |
|---|---|
| **Multi‑tenant realtime** | Supabase Realtime channels are `ticket:{id}:{visibility}`; subscription authorised via RLS on the underlying `comments` table; clients can't subscribe to `internal`. |
| **Email links** | Deep links go to `/login?next=/portal/tickets/EXP-1042` — `next` validated as relative path. No tokens in ticket links. |
| **Reply‑by‑email (P1)** | Reply address `reply+<ticket_id>.<hmac>@…`; HMAC verified; sender must match a participant; otherwise held for staff review. |
| **Website form → ticket (P1)** | Endpoint requires HMAC signature with shared secret + timestamp (±5 min) + nonce; rate‑limited; Turnstile/hCaptcha on the website form. |
| **Client‑side secrets** | Only `NEXT_PUBLIC_SUPABASE_URL` and anon key reach the browser. Anon key has zero table access thanks to RLS. |
| **Admin step‑up (P1)** | Deleting an org, changing roles, exporting data, editing SLA policy re‑prompt MFA within the last 5 minutes. |
| **Suspicious content** | Comments containing things that look like credentials (`password=`, AWS keys, private key headers) trigger a non‑blocking "you may have pasted a secret" warning to the author (P1). |
| **Data deletion** | Soft delete → 30‑day grace → hard delete job, cascading attachments from storage; export first. |
| **Backups** | Supabase PITR (7 days) + nightly logical dump to separate bucket (own cloud later); quarterly restore drill. |

---

## 5. Secure development lifecycle

1. **Every PR** answers: *Does this touch auth, authz, input, output, files, email, headers, deps?* If yes, link the §3 rows it satisfies.
2. **Static checks in CI**: `tsc --noEmit`, ESLint (with `eslint-plugin-security`, `no-restricted-imports` boundaries, banned `dangerouslySetInnerHTML`), Semgrep (`p/owasp-top-ten`, `p/nextjs`, `p/typescript`), `pnpm audit`, secret scanning (gitleaks).
3. **Dynamic checks**: OWASP ZAP baseline scan against preview deployment on every PR to `main`; authenticated ZAP full scan weekly (P1).
4. **Authz test matrix**: `tests/authz/matrix.test.ts` — for each (role × entity × action) assert allow/deny; generated from `lib/authz/permissions.ts` so a new permission without a test fails CI.
5. **Pre‑release**: run `/security-review` skill in Claude Code on the diff; manual check of headers with securityheaders.com and Mozilla Observatory (target A+).
6. **Incident response**: `docs/runbooks/security-incident.md` (P1) — who to call, how to rotate keys, how to invalidate all sessions (`bump session_version`), how to notify clients.

---

## 6. Verification checklist (copy into PR template)

- [ ] All new tables have `org_id`, RLS enabled, policies for each role
- [ ] New Server Actions/Route Handlers call `requireUser()`/`requirePermission()` first
- [ ] zod schema `.strict()` on every input; max lengths set
- [ ] No `dangerouslySetInnerHTML`, `eval`, string‑built SQL
- [ ] Any new outbound HTTP has allowlisted host
- [ ] New env vars added to `env.ts` schema and `.env.example`
- [ ] Rate limit considered for any new public endpoint
- [ ] Audit event emitted for any mutation
- [ ] Errors mapped through `AppError`; no raw error text to client
- [ ] IDOR e2e test added for any new entity route
- [ ] Client‑role response contains no `internal` comments, `work_logs`, `submissions`, `work_state` or `in_review` (snapshot test)
- [ ] Headers/CSP still pass (`pnpm test:headers`)
