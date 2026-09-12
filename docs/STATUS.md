# Build status — prototype

Date: 2026-09-13. Every P0 requirement from `docs/requirements.md` §7 with its state, followed by deviations from the spec
(all deviations are owner decisions taken during the build or documented trade-offs). ✅ done and verified · ⚠️ done with a caveat · ❌ not done.

## Verification (all green)

| Check | Result |
|---|---|
| `pnpm lint` | 0 errors (ESLint boundaries: portal → `lib/dal/portal` only; components never import DAL/providers; `db/**` only from DAL; `dangerouslySetInnerHTML` only in `SafeHtml`) |
| `pnpm typecheck` | clean, `strict` + `noUncheckedIndexedAccess` |
| `pnpm test` | 435 unit + authz-matrix tests; domain/authz coverage 95 % statements / 93 % branches |
| `pnpm test:rls` | 38 pgTAP assertions on RLS policies |
| `pnpm test:e2e` | 19 Playwright specs: 6 golden paths (§10), IDOR/role scope, client snapshot (security.md §6), axe zero violations, mobile portal |
| `pnpm security` | `pnpm audit`: no known vulnerabilities |

## Functional requirements (P0)

| ID | Requirement | State | Notes |
|---|---|---|---|
| FR-AUTH-01 | Password + magic link; ≥ 12 chars; breached-password check; rate-limited | ✅ | HIBP k-anonymity check on invite/reset (local provider); Supabase leaked-password protection when `AUTH_PROVIDER=supabase`. Limits: 5/min/IP, 10/h/account, 3/h magic link |
| FR-AUTH-02 | Invite-only accounts | ✅ | admin invites staff/contacts; client_admin invites colleagues; first admin via `db/seed/first-admin.ts` |
| FR-AUTH-03 | TOTP mandatory for admin/lead | ✅ | enforced in `requireUser()` on every request, not only at login; recovery codes; optional for other roles (enforced once enrolled) |
| FR-AUTH-04 | Single-use invites, 7-day expiry | ✅ | hashed tokens; replay shows "already used" |
| FR-AUTH-05 | Password reset, uniform response | ✅ | |
| FR-AUTH-06 | 12 h idle staff / 30 d clients; sign out everywhere | ✅ | local provider enforces idle timeouts; `session_version` pin invalidates all sessions on both providers. ⚠️ with Supabase Auth the idle timeout is Supabase's session setting |
| FR-CP-01 | Type picker → per-type form; attachments; autosave draft | ✅ | attachments uploaded right after the ticket exists (private path needs the id) |
| FR-CP-02 | Confirmation screen + email with key & first-response target | ✅ | |
| FR-CP-03 | My requests list, filters, search | ✅ | |
| FR-CP-04 | client_admin sees all org requests + per-contact filter | ✅ | |
| FR-CP-05 | Thread (public only), reply + attachments, target dates, Reopen / Cancel / Follow-up | ✅ | |
| FR-CP-09 | Mobile-first, bottom-sheet new request | ✅ | drag-to-dismiss sheet |
| FR-AG-01 | Queues with live counts | ✅ | |
| FR-AG-02 | Table: sort/filter, saved views, column chooser, density, J/K/Enter | ✅ | ⚠️ keyset "load more" pages of 50 instead of virtualisation (never renders > 200 rows) |
| FR-AG-03 | Bulk assign / status / priority | ✅ | priority via impact (matrix); merge-as-duplicate is P1 |
| FR-AG-04 | Detail: thread public/internal, composer tabs, attachments, @mention, canned | ✅ | |
| FR-AG-05 | Properties panel | ✅ | status prompts for required fields, hold reason, impact/urgency → priority, override (lead), category, assignee + workload, participants/watchers, tags, SLA clocks + extend, links, escalate |
| FR-AG-06 | Take / reassign | ✅ | ⚠️ reassignment note is supported by the DAL but not exposed in the picker UI |
| FR-AG-07 | Create on behalf (pick org → contact / create contact inline) | ✅ | |
| FR-AG-09 | ⌘K search: tickets, clients (+ actions) | ✅ | |
| FR-AG-11 | Time tracking | ✅ | see FR-DEV-02 |
| FR-AG-13 | Realtime on detail | ❌ | **removed by owner decision** — changes are delivered as in-app notifications + email; no background updates |
| FR-DEV-01 | My work queue by work_state, priority then SLA | ✅ | dashboard columns + queue |
| FR-DEV-02 | Work log with timer, totals, 24 h edit window | ✅ | total maintained by trigger in the same transaction |
| FR-DEV-03 | work_state from panel; blocked/needs_info require note; admin notified | ✅ | |
| FR-DEV-04 | Submit-for-review sheet with structured fields | ✅ | time adjust needs a reason |
| FR-DEV-05 | Developer public replies, "Visible to client" banner, display name "Engineer, Expendables" | ✅ | gated by `developer_public_reply` server-side |
| FR-DEV-06 | Developer cannot resolve/close/cancel/reassign/change priority — hidden and server-enforced | ✅ | authz matrix + state machine + RLS + e2e |
| FR-DEV-07 | Review queue; review sheet: approve & reply / return / ask client | ✅ | reviewer cannot review own submission; submissions immutable after decision (trigger + RLS) |
| FR-ORG-01 | Orgs: name, tier, timezone, SLA policy, notes, status | ✅ | business hours live on the SLA policy |
| FR-ORG-02 | Contacts per org, invite, deactivate (immediate) | ✅ | deactivation bumps `session_version` + revokes provider sessions |
| FR-ORG-03 | Org page: open tickets, SLA performance, activity | ✅ | |
| FR-ADM-01 | Staff users & roles, invite, deactivate, MFA reset | ✅ | last admin protected; own role immutable |
| FR-ADM-02 | Categories/subcategories, canned responses | ✅ | hold reasons / resolution codes are fixed lists (P1 to make editable) |
| FR-ADM-03 | SLA policies, calendars, holidays | ✅ | |
| FR-ADM-04 | Email templates with placeholders + preview | ✅ | used by the notification sender |
| FR-ADM-05 | Auto-close settings | ❌→⚠️ | **auto-close removed by owner decision**; the settings page holds the remaining workflow policies (developer reply policy, self-assign, time visibility) |
| FR-ADM-06 | Audit log viewer, filters, CSV | ✅ | formula-injection-safe CSV |
| FR-CH-01/02 | Portal / agent channels | ✅ | |
| FR-NT-01 | Requester/participant emails on create, reply, status, resolved, closed | ✅ | branded React Email; queued in-transaction, sent by `notify-flush`. Rating link is P1 |
| FR-NT-02 | Assignee/lead emails: assigned, client reply, mention, at-risk, breach | ✅ | |
| FR-NT-03 | In-app notification centre | ✅ | |
| FR-RP-01 | Admin/lead dashboard | ✅ | tiles, 30-day trend, developer load board, review queue, SLA per client, escalations |
| FR-RP-02 | Developer dashboard | ✅ | |
| FR-RP-03 | Agent dashboard | ✅ | |
| FR-RP-04 | Client dashboard | ✅ | monthly summary for client_admin; hours only when the org opts in |
| FR-AU-01 | Immutable event log with actor, IP, UA, diff | ✅ | `ticket_events` + `audit_log`, INSERT-only for the app role, append-only triggers |
| FR-AU-03 | Soft delete | ✅ | hard-delete retention job is P1 |

## Deviations from the spec (and why)

| Area | Spec | Built | Reason |
|---|---|---|---|
| Auto-close | resolved → closed after N days; pending reminders | none — closing is a human action | owner decision ("it's the admin's, developer's or customer's decision to drop the ticket, not the system's") |
| Realtime | Supabase Realtime / SSE on ticket detail | none; notifications + email | owner decision: live updates hold no value here; avoids Vercel invocation cost |
| Jobs | pg-boss worker + Vercel Cron every minute | plain job functions behind `/api/cron/[job]` scheduled by Supabase `pg_cron` (+ optional opportunistic tick) | Vercel Hobby has no long-lived processes and daily-only cron; pg_cron is free |
| Rate limiting | Upstash Redis | Postgres-backed limiter behind the same interface | owner: no Redis |
| Email | Resend | `log` adapter (server log + dev outbox) behind `EmailProvider` | owner: not Resend; mailbox spelling unconfirmed — `EMAIL_FROM` is a placeholder with a TODO |
| Auth | Supabase Auth only | Supabase adapter **and** a self-owned Postgres adapter (`AUTH_PROVIDER=local`) | owner asked for swappable/own auth; local adapter is also what CI/e2e run on |
| `DATABASE_URL` as the only DB pointer | — | `DATABASE_ADMIN_URL` added for migrations/seed | the app role has no DDL rights by design |
| SLA P2 resolution "1 business day" on a 24×7 calendar | ambiguous | 24 h | Jira semantics; editable per policy in the admin console |
| Ticket list virtualisation | `@tanstack/react-virtual` past 200 rows | keyset pagination, 50 per page | simpler; never renders more than a page |
| P2 dark theme | optional, after MVP | not built | light-only like the website |

## Not verified in this environment

- `lib/auth/supabase.ts` and `lib/storage/supabase.ts` are implemented from the Supabase SDK contracts but were not exercised against a live project (no credentials). First run against your project: follow `docs/runbooks/deploy.md` §5.
- Lighthouse budgets (architecture.md §13) were not measured with `@lhci/cli` (not installed; no network CI). The app ships Server Components, `loading.tsx` skeletons, `next/font`, and `LazyMotion`; the portal first-load JS is dominated by React + Next runtime.

## Open questions for the company (from requirements §12)

1. Which mailbox becomes `EMAIL_FROM` — `expendables.sesolutions@gmail.com` or `…sesolution@…`?
2. Sri Lanka public holidays list for the SLA calendar (admin → SLA policies → holidays).
3. Should logged time be shown to clients by default? (Currently per-org opt-in; enterprise demo orgs opt in.)
