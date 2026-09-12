# Zero‑shot prompt for Claude Code

Open Claude Code in `/Users/as/Documents/Expendables-System` and paste everything below the line.

---

Build the **Expendables Client Request Management System** prototype in this directory, end to end, from the specification already here. Do not ask me clarifying questions — every decision is in the docs; where a doc says "prototype default", use it.

**Read first, in this order, before writing any code:** `CLAUDE.md`, `docs/requirements.md`, `docs/architecture.md`, `docs/security.md`, `docs/design.md`, `docs/brand-palette.md`. Load the `apple-design` skill (`.claude/skills/apple-design/SKILL.md`) before building any UI, and the `dataviz` skill before any chart.

**What "done" means:** all six golden paths in `docs/requirements.md` §10 pass as Playwright e2e tests, every **P0** requirement (FR‑AUTH, FR‑CP, FR‑AG, FR‑DEV, FR‑ORG, FR‑ADM, FR‑NT, FR‑RP, FR‑AU) is implemented, the authz matrix and IDOR tests pass, RLS pgTAP tests pass, `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` are green, and the app runs with `pnpm dev` against a Supabase project whose credentials I will put in `.env.local` (create `.env.example` with every variable from `docs/architecture.md` §9 and stop to tell me when you need real values — mock nothing silently).

**Stack and rules are fixed** (`CLAUDE.md`): Next.js 16 App Router + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui on Base UI + lucide‑react + `motion` + react‑hook‑form/zod + **Drizzle over `DATABASE_URL`** + PostgreSQL on Supabase used only through the provider interfaces for Auth/Storage/Realtime + pg‑boss + Resend + Vitest + Playwright + pnpm. Never query tables with `supabase-js`. RLS uses session variables, never `auth.uid()`. Auth checks live in layouts/Server Actions/Route Handlers, never only in `proxy.ts`.

**Build in this order, committing after each step with Conventional Commits that reference FR‑IDs:**

1. Scaffold the repo exactly as `docs/architecture.md` §3; `env.ts` with zod; `globals.css` with the tokens from `docs/design.md` §1 verbatim and the type scale from §2; `next/font` for Inter + Source Sans 3; copy `brand-assets/*` to `public/brand/`; security headers + nonce CSP from `docs/security.md` A02; ESLint boundaries from `architecture.md` §3.
2. Database: Drizzle schema + SQL migrations for every table in `architecture.md` §4.2 (including `work_logs`, `submissions`, `org_settings`), RLS policies from §4.3 for every table, `app_rw` role grants, seed for roles/permissions/categories/default SLA policy, and pgTAP tests for the policies.
3. Auth + authz: Supabase Auth behind `lib/auth/provider.ts`; `requireUser()` / `requirePermission()`; invite‑only flows (invite, magic link, password, TOTP for admin/lead); `lib/authz/permissions.ts` with the generated role × permission matrix test.
4. Domain (pure, unit‑tested ≥ 90 %): ticket state machine from `requirements.md` §5.2 including `in_review`, priority matrix §4.3, SLA calendar/timers §6, first‑response rule §5.3, review rules §5.4, work‑log rules.
5. App shell per `design.md` §8.1 (navy sidebar, translucent top bar with scroll‑edge fade, ⌘K palette, notifications) and the client portal shell §8.2.
6. Tickets: create (portal type‑picker forms + agent on‑behalf), queues/table with saved views and keyboard nav, detail page with thread (public/internal, visually distinct), composer, properties panel, attachments via private bucket + signed URLs, realtime on detail.
7. **Support delivery loop** (`requirements.md` §5.4, FR‑DEV): assign to developer, developer "My work", work log panel with timer, `work_state`, submit‑for‑review sheet, admin review queue + review sheet (approve & reply / return / ask client), developer public replies gated by `org_settings.developer_public_reply`.
8. SLA jobs, auto‑close, notifications (React Email templates, in‑app centre), notification matrix §8.
9. Admin console (users, orgs/contacts, categories, SLA policies, templates, auto‑close settings, audit log viewer).
10. **Four dashboards** (admin/lead, developer, agent, client) per FR‑RP‑01..04 and `design.md` §8.3, with the `daily_ticket_stats` aggregation job.
11. Seed realistic demo data (`design.md` §12, item 1): 6 client orgs, 3 developers, 2 agents, 1 admin, ~150 tickets across every status/priority/SLA state/work_state, work logs and submissions — so every dashboard and component state is populated.
12. Polish + hardening pass: walk every screen against `design.md` §12 quality bar and the `apple-design` checklist; run the `security-review` skill; Lighthouse against `architecture.md` §13 budgets; axe zero violations; fix everything found.
13. Write `README.md` "Running locally" + `docs/runbooks/deploy.md`, and a `docs/STATUS.md` listing every P0 FR‑ID with ✅/⚠️ and any deviation from the spec with the reason.

**Constraints while working:** keep Server Actions thin (`requireUser → requirePermission → schema.parse → domain → dal → revalidate`); zod `.strict()` on every input with role‑specific schemas; emit `ticket_events` for every mutation; errors through `lib/errors.ts`; no `dangerouslySetInnerHTML`, `eval`, or string‑built SQL; markdown through `rehype-sanitize`; no new dependency without a one‑line justification; no `postinstall` scripts. Clients must never receive internal comments, work logs, submissions, `work_state` or `in_review` — add the snapshot test from `security.md` §6. Use the company facts in `CLAUDE.md` (Asia/Colombo, 24×7 for P1/P2) and leave the notification "from" address as a placeholder with a TODO because the website shows two spellings of the email.

Work autonomously through all 13 steps. Report progress after each step in one short paragraph, and finish with the `docs/STATUS.md` summary and the exact commands to run it.
