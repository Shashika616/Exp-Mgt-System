# Expendables Client Request Management System

Ticket / client‑request management for **EXPENDABLES (PVT) LTD** — built with Next.js 16 and PostgreSQL (Supabase now, the company's own cloud later).

Three surfaces in one app:

| Surface | Route | Users |
|---|---|---|
| Client Portal | `/portal` | Client users & client admins — raise and track requests |
| Agent Workspace | `/app` | Expendables agents, **developers** & leads — queues, triage, SLAs; developers log work and submit for review |
| Admin Console | `/app/admin` | Admins — users, clients, roles, SLA policies, templates, audit; admin dashboard has the review queue & developer load board |

## Current state

**Specification only.** No application code has been scaffolded yet. The `docs/` folder is complete and is the input for Claude Code to build the prototype; `CLAUDE.md` holds the working rules.

## Repository

```
CLAUDE.md                    ← rules for Claude Code (read first)
PROMPT.md                    ← zero‑shot prompt to hand Claude Code to build the prototype
README.md                    ← this file
docs/
  README.md                  ← index of the specification
  brand-palette.md           ← website colours, fonts, images (verified from source)
  design.md                  ← design system for the app (brand + Apple design principles)
  requirements.md            ← roles, ticket lifecycle, SLA, functional requirements, golden paths
  architecture.md            ← stack, schema, RLS, providers, jobs, migration path
  security.md                ← OWASP Top 10:2025 threat model & controls
brand-assets/
  README.md
  expendables-logo.png       ← 1254×1254 wordmark on navy
  expendables-banner.png     ← 1600×400 banner ("Engineering Tomorrow.")
  expendables-mission-vision.png
  favicon.svg
.claude/skills/apple-design/SKILL.md   ← Apple design skill, invoked for all UI work
```

## Getting started (for the developer / Claude Code)

**Fastest path:** open Claude Code in this folder and paste the prompt from `PROMPT.md`.

1. Read `CLAUDE.md`, then `docs/requirements.md` → `docs/architecture.md` → `docs/security.md` → `docs/design.md`.
2. Scaffold per `docs/architecture.md` §3 (`pnpm create next-app@latest --ts --tailwind --app --src-dir=false`), add the dependencies listed in §1.
3. Create a Supabase project (dev), set `DATABASE_URL` and the `SUPABASE_*` variables from `docs/architecture.md` §9 in `.env.local`.
4. Copy `brand-assets/*` to `public/brand/`.
5. Follow the 4‑week delivery plan in `docs/architecture.md` §12. Golden paths in `docs/requirements.md` §10 define "done" for the prototype.

## Principles in one line each

- **Portable Postgres**: Drizzle + SQL migrations + session‑variable RLS; Supabase used only through provider interfaces.
- **Secure by default**: deny‑by‑default authz in layouts/actions, RLS second layer, OWASP 2025 controls are P0.
- **Real service‑desk semantics**: lifecycle modelled on Jira Service Management, ServiceNow and Zendesk — plus the company's own loop: admin assigns → developer works, logs time/findings, talks to the client in‑thread → submits for review → admin approves & replies.
- **A dashboard per party**: admin/lead, developer, agent, client.
- **Brand‑true, Apple‑polished UI**: website tokens verbatim; springs, materials, typography per the `apple-design` skill.

## After the prototype

The company will test the prototype and add custom requirements. Add them to `docs/requirements.md` with new FR‑IDs; the schema's `custom_fields`, data‑driven roles/permissions, and ticket types/forms are the designed extension points.
