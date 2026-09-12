# Specification index

Read in this order.

| # | File | What it answers |
|---|---|---|
| 1 | [requirements.md](./requirements.md) | Who uses it (incl. the **developer** role), what a ticket is, the lifecycle (statuses incl. `in_review`, transitions, auto‑close), the **admin → developer → review → client** delivery loop (§5.4), priority matrix, SLA rules, role dashboards, every functional requirement with an ID and priority (P0 = prototype), notification matrix, non‑functional requirements, golden paths, open questions for the company |
| 2 | [architecture.md](./architecture.md) | Stack and why, portability rules (Supabase → own cloud), repo layout, data model + SQL, RLS policies, domain modules, jobs, auth flow, realtime, env vars, migration steps, ADRs, 4‑week plan |
| 3 | [security.md](./security.md) | Assets, attacker personas, OWASP Top 10:2025 → concrete controls for this stack, product‑specific controls, secure SDLC, PR checklist |
| 4 | [design.md](./design.md) | Design intent, colour tokens (light = website, dark = new), status colours, typography with size‑specific tracking, spacing/radius/elevation, materials, motion springs, icon map, component specs, app shell and screen inventory, accessibility, do/don't |
| 5 | [brand-palette.md](./brand-palette.md) | Everything extracted from the public website source: company facts, fonts, all 47 colour tokens with usage counts, measured image colours, radii/spacing, icons, local brand images (inspected), 21 external images (each verified HTTP 200), component class recipes, discrepancies found |

Related: [`../CLAUDE.md`](../CLAUDE.md) (working rules), [`../brand-assets/`](../brand-assets/README.md), [`../.claude/skills/apple-design/SKILL.md`](../.claude/skills/apple-design/SKILL.md).

## Sources consulted

- Website source: `/Users/as/Documents/Expendable-website/Expendables-website` (audited 2026‑09‑12)
- Zendesk ticket lifecycle & auto‑close rules; Jira Service Management default statuses & request types; ServiceNow incident states & Impact×Urgency priority — links in `requirements.md` §13
- OWASP Top 10:2025 — <https://owasp.org/Top10/2025/0x00_2025-Introduction/>
- Next.js 16 `proxy.ts` guidance and CVE‑2025‑29927 — referenced in `security.md` A01 and `architecture.md` ADR‑07
- Apple WWDC design talks, distilled in the `apple-design` skill
