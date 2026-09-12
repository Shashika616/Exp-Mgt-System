# Expendables Client Request Management System

Ticket / client-request management for **EXPENDABLES (PVT) LTD** - one Next.js 16 monolith with three surfaces:

| Surface | Route | Who |
|---|---|---|
| Client Portal | `/portal` | client users & client admins - raise and track requests, reply, confirm/reopen |
| Agent Workspace | `/app` | agents, **developers** (My work, work log, submit for review), leads |
| Admin Console | `/app/admin` | admins - staff, clients, categories, SLA policies, templates, settings, audit; review queue on the dashboard |

Stack: Next.js 16 (App Router, Server Actions) · React 19 · TypeScript strict · Tailwind 4 · Base UI · `motion` · Drizzle + postgres.js over `DATABASE_URL` · PostgreSQL 16 (Supabase in production, Docker locally) · Vitest · Playwright · pnpm.

Spec lives in [`docs/`](docs/README.md); working rules in [`CLAUDE.md`](CLAUDE.md); build state in [`docs/STATUS.md`](docs/STATUS.md).

## Running locally

Prerequisites: Node ≥ 22.13, pnpm 12 (`corepack enable`), Docker Desktop.

```bash
docker compose up -d db            # PostgreSQL 16 + pgTAP on localhost:54329 (creates the app_rw role)
cp .env.example .env.local         # defaults run fully offline: local auth, local file storage, log email
pnpm install --frozen-lockfile
pnpm db:migrate                    # plain SQL migrations (db/migrations)
pnpm db:seed                       # roles, permissions, categories, SLA policies + realistic demo data
pnpm dev                           # http://localhost:3000
```

Works with npm as well (`npm install`, then `npm run db:migrate`, `npm run db:seed`, `npm run dev`).

### Demo accounts

**Password for every account below: `Expendables#2026!`**
Admin and lead also need a 6-digit TOTP code - add the secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` to Google Authenticator / 1Password (or use recovery code `recovery-code-1`).

| Role | Email |
|---|---|
| Admin (TOTP required) | `admin@expendables.lk` |
| Lead (TOTP required) | `lead@expendables.lk` |
| Agents | `nimal@expendables.lk`, `tharushi@expendables.lk` |
| Developers | `kasun@expendables.lk`, `ishara@expendables.lk`, `ravindu@expendables.lk` |
| Client admin / users (Ceylon Agro) | `sanduni@ceylonagro.example` / `priyantha@…`, `malith@…` |
| Other client admins | `roshan@serendibfreight.example`, `chamari@ruhunumf.example`, `harsha@kandytextile.example`, `menaka@islandhealth.example`, `amila@colomboproperty.example` |

Emails (invitations, magic links, notifications) are written to `.local/outbox.jsonl` in development - open it to follow links. Admins and leads must enter a TOTP code; add the secret above to any authenticator app.

## Commands

```bash
pnpm dev                 # dev server
pnpm build && pnpm start # production build
pnpm lint                # ESLint (architecture boundaries, banned APIs)
pnpm typecheck           # tsc --noEmit
pnpm test                # Vitest: domain unit tests + generated authz matrix (coverage: pnpm test:coverage)
pnpm test:rls            # pgTAP row-level-security tests
pnpm test:e2e            # Playwright: 6 golden paths, IDOR, client snapshot, a11y (builds first; resets + seeds the DB)
pnpm security            # pnpm audit
pnpm db:generate         # drizzle-kit generate → review SQL in db/migrations
pnpm db:reset            # DEV ONLY: drop + recreate schema
pnpm cron [job]          # run a background job by hand (sla-tick | notify-flush | daily-stats | all)
pnpm tsx db/seed/first-admin.ts <email> "<name>"   # production bootstrap: single-use admin invitation
```

## Deploying

Vercel (Hobby) + Supabase (free): see [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md). Swapping auth / storage / email / database: [`docs/runbooks/providers.md`](docs/runbooks/providers.md).

## Layout

```
app/            routes: (auth) · (app)/app (staff) · (portal)/portal (clients) · api/{attachments,cron,files,orgs,admin}
components/     ui (Base UI + tokens) · shell · tickets · dashboards · portal · admin · charts · auth
lib/            auth · authz · dal (Drizzle, org-scoped, RLS context) · domain (pure) · actions · schemas (zod) · jobs · storage · email · ratelimit · design
db/             schema (Drizzle) · migrations (SQL) · migrations/supabase · policies/tests (pgTAP) · seed · docker
emails/         React Email templates
tests/          unit · authz · e2e
docs/           specification, runbooks, STATUS.md, PROGRESS.md
```
