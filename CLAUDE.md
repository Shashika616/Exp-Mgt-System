# CLAUDE.md — Expendables Client Request Management System

Ticket / client‑request management system for **EXPENDABLES (PVT) LTD** (software & IT services, Gampaha, Sri Lanka). Three surfaces in one Next.js app: **Client Portal** (`/portal`), **Agent Workspace** (`/app`, incl. developers), **Admin Console** (`/app/admin`).

Core loop (requirements §5.4): client raises ticket → **admin assigns to a developer** → developer **logs time + findings**, sets `work_state`, may talk to the client in‑thread → **submits for review** (`in_review`) → admin **approves & replies** (resolved) or **returns**. Every role has its own dashboard.

Status: **specification complete, code not yet scaffolded.** Start by reading the docs below, then scaffold per `docs/architecture.md` §3.

## Read these first (in order)

1. `docs/requirements.md` — what to build, roles, ticket lifecycle, SLA, FR‑IDs, golden paths, priorities (P0 = prototype)
2. `docs/architecture.md` — stack, repo layout, schema, RLS, providers, jobs, migration path
3. `docs/security.md` — OWASP Top 10:2025 controls; **every PR touching auth/data/uploads/email/headers must satisfy it**
4. `docs/design.md` — tokens, type, motion, components, screens
5. `docs/brand-palette.md` — the website's real colours/fonts/images (verified, not guessed)

## Stack (decided — don't re‑litigate)

Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui on Base UI · lucide-react · `motion` · react-hook-form + zod · **Drizzle + postgres.js over `DATABASE_URL`** · PostgreSQL 16 on **Supabase** (Auth / Storage / Realtime via provider interfaces) · pg-boss · Resend · Vitest · Playwright · pnpm.

## Hard rules

### Portability (Supabase now → company's own Postgres later)
- **Never query tables with `supabase-js`.** All data access is Drizzle in `lib/dal/**`. Supabase clients only for Auth, Storage, Realtime — and only through `lib/{auth,storage,realtime}/provider.ts`.
- Migrations are plain SQL in `db/migrations/`. Supabase‑specific SQL goes in `db/migrations/supabase/` only.
- RLS policies use `current_setting('app.user_id' | 'app.org_id' | 'app.role', true)` — never `auth.uid()`.
- No dashboard‑only configuration; everything reproducible from the repo.

### Security (see `docs/security.md`)
- Auth decisions live in layouts, Server Actions and Route Handlers via `requireUser()` / `requirePermission()`. `proxy.ts` only redirects. Never trust middleware for authz.
- Every business table has `org_id` and RLS enabled. Every DAL function takes an `AuthContext` and scopes by org.
- zod `.strict()` on every input; role‑specific schemas (clients cannot submit `priority`, `assignee_id`, `impact`, `visibility`).
- Client roles must never see `comments.visibility = 'internal'`, `work_logs`, `submissions`, `work_state` or the `in_review` status — filter in DAL **and** RLS.
- `dangerouslySetInnerHTML`, `eval`, string‑built SQL are banned. Markdown renders through `rehype-sanitize`.
- Attachments: private bucket, sniff MIME server‑side, allowlist, `Content-Disposition: attachment`, signed URLs ≤ 60 s.
- Emit a `ticket_events` / `audit_log` row for every mutation. Errors go through `lib/errors.ts` (no raw messages to clients).
- Cross‑tenant access returns **404** and logs `access_denied`. Add an IDOR e2e test for any new entity route.

### Design (see `docs/design.md`)
- **Invoke the `apple-design` skill** (`.claude/skills/apple-design/SKILL.md`) before building or reviewing any UI, motion, sheet/drawer, or typography.
- Use the brand tokens from `docs/design.md` §1 verbatim. Navy `#002147` structural, blue `#1470e8` interactive, text `#000a1e`. Shadows are navy‑tinted (`rgba(0,33,71,…)`). Radii 4/8 px — never 16px+.
- Fonts: Inter (headings/labels/numbers, `tabular-nums`) + Source Sans 3 (body) via `next/font/google`.
- Springs (`bounce: 0, duration: 0.3`) for anything touchable; respond on pointer‑down; interruptible; symmetric enter/exit; honour `prefers-reduced-motion`.
- One primary button per view. Undo toasts for reversible actions; confirmation dialogs only for destructive ones.
- Charts: load the `dataviz` skill first.
- Quality bar in `docs/design.md` §12 and performance budgets in `docs/architecture.md` §13 are acceptance criteria, not aspirations.

### Domain
- Ticket lifecycle, priority matrix, SLA rules and role permissions are **data + pure functions** in `lib/domain/**` and `lib/authz/**` — never inline in components or actions. Change the spec (`docs/requirements.md`) before changing behaviour.
- Statuses: `new → open → in_progress → in_review | pending_client | on_hold → resolved → closed`, plus `cancelled`. Reopen and escalation are events/flags, not statuses. `work_state` (`investigating | fix_in_progress | fix_ready | blocked | needs_info`) is the developer's sub‑status; clients never see `in_review`, `work_state`, work logs or submissions.
- Roles: `client_user`, `client_admin`, `agent`, `developer`, `lead`, `admin`, `system`. Developers cannot resolve/close/cancel/reassign/change priority; only `lead`/`admin` review submissions.
- `priority` is computed from `impact × urgency`; override only by `lead`/`admin` with a reason.
- All timestamps `timestamptz` UTC; SLA math via `lib/domain/sla-calendar.ts`.

## Commands (once scaffolded)

```bash
pnpm install --frozen-lockfile
pnpm dev                    # http://localhost:3000
pnpm db:generate            # drizzle-kit generate → review SQL in db/migrations
pnpm db:migrate             # apply to DATABASE_URL
pnpm db:seed                # roles, permissions, categories, default SLA (+ demo data in dev)
pnpm test                   # vitest unit + authz matrix
pnpm test:e2e               # playwright golden paths + IDOR
pnpm test:rls               # pgTAP policy tests
pnpm lint && pnpm typecheck
pnpm security               # semgrep + pnpm audit + gitleaks
```

## Conventions

- Files/dirs kebab‑case; components PascalCase; Server Actions in `lib/actions/<entity>.ts` named `verbEntity` (`resolveTicket`).
- Server Actions are thin: `requireUser → requirePermission → schema.parse → domain → dal → revalidate`.
- Tests mirror `lib/` paths under `tests/unit/`. Every FR‑ID gets an e2e spec `FR-XX-NN.spec.ts`.
- Commit messages: Conventional Commits (`feat(tickets): …`). Reference FR‑IDs.
- Don't add dependencies without a one‑line justification in the PR; no `postinstall` scripts.
- Brand images live in `public/brand/` (copy from `brand-assets/`). The logo PNG has a navy background — only place it on navy.

## Known facts from the website (don't guess)

- Company email appears in two spellings on the site (`expendables.sesolutions@` vs `expendables.sesolution@gmail.com`); **confirm before using** for notifications.
- Address: 63 Parakum Mawatha, Gampaha. Phone: +94 77 631 5240. Timezone: Asia/Colombo.
- Website support promise: "24/7 proactive monitoring, rapid incident response" → P1/P2 SLAs run 24×7.
