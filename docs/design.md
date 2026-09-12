# Design System — Expendables Client Request Management

> Visual + interaction specification for the ticket / client‑request management system.
> Built on two inputs:
> 1. **The public website's real tokens** — see [`brand-palette.md`](./brand-palette.md). Values marked *(site)* are copied from it verbatim.
> 2. **Apple's design foundations** — the `apple-design` skill at [`.claude/skills/apple-design/SKILL.md`](../.claude/skills/apple-design/SKILL.md). Invoke it whenever building or reviewing UI.
>
> Anything marked **(new)** does not exist on the website and was authored for this system.

---

## 0. Design intent in one paragraph

The website reads as *enterprise, calm, navy‑and‑blue, low‑radius, generous whitespace, thin lucide icons, subtle lift shadows*. The management system keeps that identity but is a **tool people use for hours**, so density goes up, decoration goes down, and the feel of *directness* (instant feedback, interruptible motion, translucent chrome, keyboard‑first) comes from the Apple principles. The emotion we want a support agent to feel: **calm control**. The emotion a client should feel: **confidence that someone competent is on it**.

Apple's eight principles, applied here:

| Principle | Concrete commitment in this product |
|---|---|
| Purpose | Every screen answers one job: *triage*, *work a ticket*, *report*, *request help*. No dashboards for their own sake. |
| Agency | Undo for every non‑destructive action (toast with "Undo"); confirmation dialog **only** for delete/close‑with‑data‑loss. |
| Responsibility | Clients never see internal notes; PII only where needed; audit log for everything that changes a ticket. |
| Familiarity | Conventional ticketing metaphors (inbox, status pills, assignee avatar, thread). Same control always in the same place. |
| Flexibility | Works on a 13" laptop at 100% *and* on a phone (client portal). Column visibility, saved views, density toggle. |
| Simplicity | Common path first (create → assign → resolve). Advanced fields one level deeper (SLA overrides, custom fields). |
| Craft | Every spacing/timing value in this doc is deliberate and defensible. Nothing random. |
| Delight | Comes from the above. **No confetti.** A ticket resolving should feel like a clean click, not a party. |

---

## 1. Colour tokens

### 1.1 Light theme *(site)* — default

Copy these **exactly** into `app/globals.css`. Names match the website so components could be shared later.

```css
:root {
  /* Brand */
  --primary:                    #000a1e;  /* headings, primary text */
  --on-primary:                 #ffffff;
  --primary-container:          #002147;  /* brand navy — buttons, sidebar */
  --on-primary-container:       #708ab5;
  --primary-fixed:              #d6e3ff;  /* icon bubbles, selected rows */
  --primary-fixed-dim:          #aec7f6;
  --on-primary-fixed:           #001b3d;
  --on-primary-fixed-variant:   #2d476f;

  --secondary:                  #0058bd;  /* link hover, active nav */
  --on-secondary:               #ffffff;
  --secondary-container:        #1470e8;  /* accent, focus ring, card top-border */
  --on-secondary-container:     #fefcff;
  --secondary-fixed:            #d8e2ff;  /* info badge bg */
  --secondary-fixed-dim:        #adc6ff;
  --on-secondary-fixed:         #001a41;
  --on-secondary-fixed-variant: #004494;

  --tertiary:                   #040b11;
  --on-tertiary:                #ffffff;
  --tertiary-container:         #192229;  /* website footer; app: dark sidebar alt */
  --on-tertiary-container:      #818a92;
  --tertiary-fixed:             #dbe4ed;
  --tertiary-fixed-dim:         #bfc8d0;
  --on-tertiary-fixed:          #141d23;
  --on-tertiary-fixed-variant:  #3f484f;

  /* Surfaces */
  --background:                 #f8f9fa;
  --on-background:              #191c1d;
  --surface:                    #f8f9fa;
  --on-surface:                 #191c1d;
  --surface-variant:            #e1e3e4;
  --on-surface-variant:         #44474e;  /* muted text */
  --surface-dim:                #d9dadb;
  --surface-bright:             #f8f9fa;
  --surface-container-lowest:   #ffffff;  /* cards, popovers */
  --surface-container-low:      #f3f4f5;
  --surface-container:          #edeeef;
  --surface-container-high:     #e7e8e9;
  --surface-container-highest:  #e1e3e4;
  --surface-tint:               #465f88;
  --inverse-surface:            #2e3132;
  --inverse-on-surface:         #f0f1f2;
  --inverse-primary:            #aec7f6;

  /* Outline & error */
  --outline:                    #74777f;
  --outline-variant:            #c4c6cf;  /* borders, inputs */
  --error:                      #ba1a1a;
  --on-error:                   #ffffff;
  --error-container:            #ffdad6;
  --on-error-container:         #93000a;
}
```

### 1.2 Semantic status colours **(new)**

The website has no success/warning colours. These are authored to sit inside the Material‑3 tonal logic of the existing set (same lightness bands as `--secondary-container` / `--secondary-fixed`). Blue and red rows reuse **real** site tokens.

| Semantic | Foreground | Background (badge) | Border | Source |
|---|---|---|---|---|
| `info` / Open | `#0058bd` (`--secondary`) | `#d8e2ff` (`--secondary-fixed`) | `#adc6ff` | *(site)* — note: `#1470e8` on this bg is only 3.6:1, so the darker site blue is used for badge text |
| `success` / Resolved | `#146b3f` | `#d5f2e0` | `#9ad9b6` | **(new)** |
| `warning` / Pending / SLA‑at‑risk | `#9a5b00` | `#ffe9c2` | `#f2c46b` | **(new)** |
| `danger` / Urgent / SLA‑breached | `#ba1a1a` (`--error`) | `#ffdad6` (`--error-container`) | `#f2a9a3` | *(site)* |
| `neutral` / Closed / Low | `#44474e` (`--on-surface-variant`) | `#e1e3e4` (`--surface-variant`) | `#c4c6cf` | *(site)* |
| `progress` / In Progress | `#5b3fd6` | `#e7e0ff` | `#c2b3ff` | **(new)** — violet, distinct from brand blue so "open" ≠ "being worked" |
| `review` / In Review (staff only) | `#0e6f6a` | `#d2f1ee` | `#8fd6cf` | **(new)** — teal; the hand‑off state between developer and admin. Client never sees it (label stays "Being worked on") |
| `work_state` chips (staff only) | `investigating` neutral · `fix_in_progress` progress · `fix_ready` success · `blocked` danger · `needs_info` warning | | | reuse the rows above; rendered as a small secondary chip next to the status badge |

All pairs pass WCAG AA (≥ 4.5:1) for foreground‑on‑badge text — measured: info 5.19 · success 5.49 · warning 4.57 · danger 5.00 · neutral 7.23 · progress 5.28 · review 5.02.

### 1.3 Dark theme **(new)** — optional, ship after MVP

The site is light‑only. If a dark theme is built, derive it from the brand navy rather than neutral grey so it still feels like Expendables:

```css
:root[data-theme="dark"] {
  --background:                #0a1220;   /* between banner #011b3e and mission #011530, lifted */
  --surface:                   #0a1220;
  --surface-container-lowest:  #060c17;
  --surface-container-low:     #0f1828;
  --surface-container:         #141f31;
  --surface-container-high:    #1a2639;
  --surface-container-highest: #212e43;
  --surface-variant:           #2b3850;
  --on-surface:                #e6ebf3;
  --on-surface-variant:        #aab4c5;
  --outline:                   #7f8aa0;
  --outline-variant:           #33405a;
  --primary:                   #e6ebf3;   /* headings become light */
  --primary-container:         #1470e8;   /* buttons use accent blue on dark */
  --on-primary:                #ffffff;
  --secondary:                 #68c4ff;   /* favicon light-blue */
  --secondary-container:       #2e9eff;   /* favicon bright-blue */
  --secondary-fixed:           #163a6b;
  --error:                     #ffb4ab;
  --error-container:           #93000a;
  --on-error-container:        #ffdad6;
}
```

Ease the theme switch (`transition: background-color 200ms, color 200ms` on `body`) — abrupt brightness jumps are an accessibility problem (Apple §14).

### 1.4 Colour usage rules

1. **Navy (`--primary-container`) is structural**: sidebar, primary buttons, selected state. Not for large content areas.
2. **Blue (`--secondary-container`) is interactive**: links, focus rings, active tab underline, the 4px card top‑accent. If it's blue, it's clickable or focused.
3. **Text is `--primary` (near‑black navy), never pure black.** Muted text is `--on-surface-variant`.
4. Status colours appear **only** in badges, dots, and SLA bars — never as page backgrounds.
5. Put colour on a **solid** layer, not on a translucent one (Apple §12 vibrancy rule).

---

## 2. Typography

### 2.1 Faces *(site)*

- Headings, labels, numbers, table headers: **Inter** 400/500/600/700
- Body, descriptions, comments: **Source Sans 3** 400/500/600
- Load with `next/font/google` (self‑hosted, no layout shift) instead of the CSS `@import` the website uses.
- Tabular numerals for IDs, times, counts: `font-variant-numeric: tabular-nums`.

### 2.2 Scale — website scale, with Apple's size‑specific tracking **(adjusted)**

The website uses `letter-spacing: 0` everywhere. Apple §15: *tracking is size‑specific*. So headings tighten as they grow, small labels open up. Body stays at 0.

| Role | Size | Weight | Line‑height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | `clamp(28px, 3.5vw, 36px)` | 700 | 1.15 | **−0.02em** | Page titles on marketing‑style pages (login, empty states). Smaller than website's 48px — this is an app. |
| `headline-lg` | 28px | 700 | 1.2 | **−0.015em** | Screen titles ("Tickets", "Client: Acme") |
| `headline-md` | 22px | 600 | 1.3 | **−0.01em** | Ticket subject on detail page, dialog titles |
| `headline-sm` | 18px | 600 | 1.4 | 0 | Card titles, section headings |
| `body-lg` | 16px | 400 | 1.6 | 0 | Ticket description, comment bodies |
| `body-md` | 14px | 400 | 1.55 | 0 | Default UI text, table cells |
| `body-sm` | 13px | 400 | 1.5 | 0 | Metadata, timestamps, helper text |
| `label` | 13px | 500 | 1 | **+0.04em** | Buttons, tabs, form labels (site uses 14px/0.05em) |
| `overline` / eyebrow | 11px | 600 | 1 | **+0.08em**, uppercase | Section eyebrows, table headers, badge text |
| `mono` | 13px | 500 | 1.4 | 0 | Ticket keys (`EXP‑1042`), code in comments — `ui-monospace, SF Mono, Menlo` |

Spacing in `rem`; the layout must survive the browser text‑size setting at 125%.

---

## 3. Spacing, radius, elevation

### 3.1 Spacing

4px base grid. Tailwind defaults. Named constants *(site)*:

| Token | Value | Use |
|---|---|---|
| `--spacing-page` | `clamp(16px, 3vw, 32px)` | Content‑area horizontal padding |
| `--spacing-gutter` | 24px | Grid gaps between cards |
| Sidebar width | 260px expanded / 64px collapsed **(new)** | |
| Top bar height | 56px **(new)** — website header is 80px, too tall for an app | |
| Table row height | 44px comfortable / 36px compact **(new)** | Density toggle |
| Card padding | 24px (site uses 32px; reduced for density) | |
| Dialog / sheet padding | 24px | |
| Form field height | 40px (site: 44px) — 44px on touch (client portal) | Minimum 44×44 hit target on touch |

### 3.2 Radius *(site — note these are tight)*

```
--radius-sm: 2px   (chips inside tables)
--radius-md: 4px   (inputs, buttons, badges)     ← website's rounded / rounded-lg
--radius-lg: 8px   (cards, popovers, dialogs)    ← website's rounded-xl / 2xl
--radius-xl: 12px  (sheets, large modals)         (new)
--radius-full      (pills, avatars, filter chips)
```

Do **not** use 16px+ radii; the brand is crisp, not bubbly.

### 3.3 Elevation

| Level | Value | Use |
|---|---|---|
| 0 | none, `1px solid --outline-variant/60` | Table, inline cards |
| 1 *(site `.soft-lift`)* | `0 4px 20px rgba(0,33,71,0.08)` | Cards, dropdowns |
| 1‑hover *(site)* | `0 8px 30px rgba(0,33,71,0.12)` + `translateY(-2px)` (site uses ‑4px; halved for app density) | Hoverable cards only |
| 2 **(new)** | `0 12px 40px rgba(0,33,71,0.16)` | Popovers, command palette |
| 3 **(new)** | `0 24px 64px rgba(0,10,30,0.28)` | Sheets, dialogs (over a scrim) |

Shadows are always navy‑tinted (`0,33,71` = `#002147`), never grey — this is the single most "Expendables" detail.

---

## 4. Materials & depth (Apple §12)

- **Top bar**: translucent. `background: rgba(248,249,250,0.72); backdrop-filter: blur(20px) saturate(180%)`. Content scrolls underneath. **No 1px bottom border** — use a scroll‑edge fade (a 24px gradient mask under the bar that appears only once content has scrolled ≥ 1px).
- **Sidebar**: heavier, structural. Solid `--primary-container` (#002147) with white/`#adc6ff` text. Dark, heavy material = structural region. Active item: `rgba(255,255,255,0.10)` bg + 2px left rule in `--secondary-container`.
- **Sheets / drawers** (ticket quick‑view, new ticket): `background: rgba(255,255,255,0.88); backdrop-filter: blur(24px)`; bigger surface → stronger blur + deeper shadow (level 3). Paired with a scrim `rgba(0,10,30,0.32)` when modal. **Never stack two light translucent surfaces.**
- **Popovers / menus**: solid `--surface-container-lowest`, level 2 shadow, `transform-origin` at the trigger.
- **Materialize, don't fade**: sheets/popovers animate `opacity`, `scale(0.96→1)` and `backdrop-filter blur(0→24px)` together on enter.
- Honour `prefers-reduced-transparency: reduce` → solid surfaces, no blur. `prefers-contrast: more` → solid + 1px contrasting border.

---

## 5. Motion (Apple §1–§11, §14)

Library: **`motion`** (Framer Motion v12+, `import { motion, animate } from 'motion/react'`). Use springs for anything the user can touch; CSS transitions only for hover/colour.

| Interaction | Spring | Notes |
|---|---|---|
| Default UI (menus, popovers, tab indicator, badge change) | `{ type: 'spring', bounce: 0, duration: 0.3 }` | Critically damped. No overshoot. |
| Sheet / drawer open & close | `{ type: 'spring', bounce: 0.15, duration: 0.35 }` | Slight bounce **only** because it's a physical panel; drag‑to‑dismiss carries release velocity into the spring. |
| Row reorder / kanban card drop | `{ type: 'spring', bounce: 0.2, duration: 0.4 }` | Momentum interaction. |
| Toast enter/exit | `{ type: 'spring', bounce: 0, duration: 0.35 }` | Same path in and out (slide from bottom‑right, exit to bottom‑right). |
| Hover / colour | CSS `transition: 150ms ease-out` | Not gesture‑driven, fine as CSS. |
| Button press | CSS `:active { transform: scale(0.97) }`, `transition: transform 100ms` | Feedback on **pointer‑down**, never on release. |

Rules:

1. **Respond on pointer‑down.** Every button, row, chip highlights instantly on press.
2. **Never lock input during a transition.** A sheet that is closing can be grabbed and reopened; the new spring starts from the *current* on‑screen value.
3. **Symmetric paths.** A drawer that enters from the right exits to the right. A popover grows from its trigger and shrinks back into it.
4. **Anchored origins.** `transform-origin` = trigger's position for every popover/menu/command palette.
5. **Drag‑to‑dismiss sheets** (mobile client portal): 1:1 tracking with `setPointerCapture`, respect grab offset, rubber‑band past the top, decide commit vs. cancel by **velocity sign** at release, project momentum with `d = 0.998`.
6. **Optimistic UI**: status change, assignee change, comment post all apply instantly; revert with a toast on failure.
7. **Skeletons, not spinners** for page loads; a thin 2px `--secondary-container` progress line under the top bar for navigations > 150ms.
8. **`prefers-reduced-motion: reduce`**: replace all slides/springs with 150ms opacity cross‑fades; no scale, no parallax, no bounce.
9. Animate only `transform` and `opacity`. Add `will-change: transform` only right before motion starts.

---

## 6. Iconography

`lucide-react`, stroke width **1.75** in navigation and toolbars, **1.5** at ≥ 32px decorative sizes *(site uses 1.2–1.8)*. Size 16px inline with text, 20px in nav/buttons, 24px in empty states.

Recommended mapping (keep consistent everywhere):

| Concept | Icon |
|---|---|
| Tickets / inbox | `Inbox` |
| New ticket | `Plus` |
| Client / organisation | `Building2` *(site)* |
| Contact / user | `UserRound` / `UsersRound` *(site)* |
| Assignee | `UserRoundCheck` |
| Priority | `Flag` |
| SLA / due | `Timer` |
| Status: open | `CircleDot` |
| Status: in progress | `LoaderCircle` (static) |
| Status: in review | `ClipboardCheck` |
| Work log / time | `Timer` (timer), `NotebookPen` (entry) |
| Submit for review | `Send` |
| Developer | `Code2` *(site)* |
| Blocked | `OctagonAlert` |
| Status: pending client | `Clock` |
| Status: resolved | `CheckCircle2` *(site)* |
| Status: closed | `CircleCheck` filled / `Archive` |
| Internal note | `Lock` |
| Attachment | `Paperclip` |
| Search / command | `Search` / `Command` |
| Settings | `Settings` |
| Reports | `BarChart3` |
| Notification | `Bell` |
| Support/Help | `Headphones` *(site)* |
| Security | `ShieldCheck` *(site)* |

---

## 7. Components

Build on **shadcn/ui** (Radix or Base UI primitives — the site already uses `@base-ui/react` 1.7.0; keep Base UI for consistency) restyled with the tokens above. Every component has: default, hover, pressed, focus‑visible, disabled, loading (where async), error (inputs).

### 7.1 Buttons

| Variant | Style | Use |
|---|---|---|
| `primary` *(site)* | `bg-primary-container text-on-primary hover:bg-secondary-container`, radius‑md, h‑10, px‑4, label type | One per view: "Create ticket", "Save" |
| `outline` *(site)* | `border-[1.5px] border-primary-container text-primary-container hover:bg-surface-container-low` | Secondary actions |
| `ghost` **(new)** | `text-primary hover:bg-surface-container` | Toolbar/table actions |
| `destructive` **(new)** | `bg-error-container text-on-error-container hover:bg-error hover:text-on-error` | Delete, close without resolution |
| `link` | `text-secondary hover:text-primary underline-offset-4` | Inline |
| Sizes | `sm` h‑8 · `md` h‑10 · `lg` h‑11 (44px, touch) · `icon` 36×36 | |

Focus: `outline 2px solid --secondary-container; outline-offset 2px` *(site)*. Loading: swap label for a 16px spinner, keep width (no layout shift).

### 7.2 Inputs

`h-10`, `rounded-md`, `border border-outline-variant`, `bg-surface-container-lowest`, `px-3`, `text-body-md`. Focus: border `--secondary-container` + `ring-3 ring-secondary-container/25` *(site's `ring/50` softened)*. Error: border `--error` + helper in `--error` **inline, on blur — not on submit** (Apple §16 feedback rule). Labels above, `label` type, `text-primary`. Required marker: `--error` asterisk.

### 7.3 Badges (status / priority / SLA)

`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 overline-type` using §1.2 pairs. Status badges carry a 6px leading dot; priority badges carry a `Flag` icon. Never colour‑only — always icon or text too.

### 7.4 Cards *(site `SoftCard`, densified)*

`rounded-lg bg-surface-container-lowest border border-outline-variant/40 p-6`, level‑1 shadow. The 4px `border-t-4 border-secondary-container` top‑accent *(site)* is reserved for **the single primary card on a screen** (e.g. the ticket description card on the detail page). Not on every card.

### 7.5 Data table

- Header: `overline` type, `text-on-surface-variant`, `bg-surface-container-low`, sticky.
- Rows: 44px (compact 36px), `border-b border-outline-variant/40`, hover `bg-surface-container-low`, selected `bg-primary-fixed/50` + 2px left rule `--secondary-container`.
- Row is a single click target (whole row opens the ticket); checkbox + row actions appear on hover/focus.
- Column config, sort, saved views. Virtualised past 200 rows.
- Empty state: 24px icon, headline‑sm, one sentence, one primary button.

### 7.6 Sheet / drawer

Right‑side, 480px (ticket quick view) / 560px (new ticket). Translucent material (§4). Header: title + close (`X`) top‑right; footer: actions right‑aligned. Drag handle on mobile (bottom sheet). Enter/exit along the same edge.

### 7.7 Dialog

Only for **destructive / irreversible** confirmation. 420px, solid surface, level‑3 shadow, scrim. Primary action is the *safe* default; destructive action styled `destructive`. Title states the consequence ("Delete ticket EXP‑1042? This cannot be undone.").

### 7.8 Command palette (⌘K)

Solid `--surface-container-lowest`, level‑2, 640px, grows from top‑centre. Searches tickets, clients, actions ("Assign to…", "Set status…"). Result rows 40px.

### 7.9 Toast

Bottom‑right, 360px, `bg-inverse-surface text-inverse-on-surface` *(site tokens)*, radius‑md, 6s auto‑dismiss, always includes **Undo** when the action is reversible. Success uses a 4px left rule in `success`; error in `--error`.

### 7.10 Avatar

Initials on `--primary-fixed` bg / `--on-primary-fixed` text, `rounded-full`, 24/32/40px. Client‑org avatars are `rounded-md` to distinguish orgs from people.

### 7.11a Work log & submission (staff only)

- **Work log panel** on the ticket (right column, under properties): total time as a headline number (`tabular-nums`, e.g. `4h 35m`), then entries newest‑first: date · minutes · `work_state` chip · note. "Log work" opens an inline row (not a dialog) with minutes, note, state; a **timer** button starts/stops and prefills minutes. Timer running → a subtle pulsing dot in the top bar so it's never forgotten.
- **Submit for review** is a right sheet (560px) with the structured fields (findings, root cause, changes, verification, resolution code, proposed reply, time). Proposed‑reply field is styled like the client composer (white card, "Visible to client after admin approval" banner). Primary button "Submit to admin" — the only navy button on the sheet.
- **Review sheet** (admin): two panes — left = submission (read‑only, teal top‑accent), right = editable client reply prefilled from the proposal + resolution code. Footer: `Approve & reply` (primary) · `Return with notes` (outline) · `Ask client` (ghost). Returning requires notes; the return note appears in the thread as an internal note addressed to the developer.
- In the **thread**, a submission shows as a teal card "Submitted for review by Nimal · 4h 35m" with a collapsed summary; approve/return outcomes render as timeline events. Clients see none of this.

### 7.11 Timeline / activity thread

Vertical rule `--outline-variant`, dot per event (colour = semantic), comment bubbles `bg-surface-container-low rounded-lg p-4`. **Internal notes** get `bg-[#fff8e6] border-l-2 border-warning` and a `Lock` icon — visually unmistakable so an agent never confuses them with client‑visible replies.

---

## 8. Layout & screens

### 8.1 App shell (staff)

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Top bar (translucent): breadcrumb · ⌘K · 🔔 · avatar │
│ navy     ├──────────────────────────────────────────────┤
│ 260px    │                                              │
│          │  Content (max-w 1400px, px-page)             │
│ Dashboard│                                              │
│ Tickets  │  (agent/admin: queues · developer: My work)  │
│ Review   │  (admin/lead only, badge = awaiting count)   │
│ Clients  │                                              │
│ Reports  │                                              │
│ Admin    │  (admin only)                                │
│          │                                              │
│ ──────── │                                              │
│ wordmark │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Sidebar shows the white wordmark from `brand-assets/expendables-logo.png` (crop to wordmark; or set the PNG as a 40px‑tall image on the navy — the PNG background `#01204c` is within 5/255 of `#002147`, so it blends).
- Collapse to 64px icon rail (`⌘B`). Tooltips on rail items.

### 8.2 Client portal

Simpler, top‑nav layout (no sidebar): banner strip with the wordmark, "My requests", "New request", profile. Mobile‑first; bottom sheet for new request on phones. Uses the same tokens; primary button is the same navy.

### 8.3 Screen inventory

| Screen | Job | Key elements |
|---|---|---|
| Login | Get in fast | Split: left navy panel with `expendables-mission-vision.png` cropped or the banner; right form. Magic link + password. |
| **Admin / lead dashboard** | Run the desk | Stat tiles (open · unassigned · **awaiting review** · at‑risk · breached today · avg first response · avg resolution); created‑vs‑resolved line (30 d); **developer load board** — one row per developer: assigned count, `work_state` distribution bar, blocked count, hours this week; review queue (oldest first, time in review); SLA attainment per client; recent escalations. Every tile is a link to the filtered list. |
| **Developer dashboard** | Know what to do next | "My work" kanban‑style columns by `work_state` (investigating · fix in progress · fix ready · blocked · needs info) with priority + SLA due on each card; "Returned from review" and "Client replied" strips at top; hours today / this week with a 7‑day sparkline; running‑timer indicator. |
| **Agent dashboard** | Keep the queue moving | Unassigned, my tickets, pending‑client aging (buckets 1/3/7 d), at‑risk, today's first‑response %. |
| **Client dashboard** (`/portal`) | Confidence at a glance | "Needs your reply" (highlighted) · open requests with status + next target date · recently resolved (Confirm / Reopen) · for `client_admin`: monthly summary tiles (created, resolved, avg resolution, SLA met %, hours logged if enabled) · "New request" primary button always visible. |
| Inbox / Tickets | Triage | Filter bar (status, priority, assignee, client, SLA), saved views tabs, data table, bulk actions bar (appears from bottom when rows selected). |
| Ticket detail | Work it | Two‑column: left = subject, description card (top‑accent), activity thread, reply composer (tabs: *Reply to client* / *Internal note*; developers see a "Visible to client" banner on the first tab); right = properties panel (status, `work_state` for developers, priority, assignee, client, contact, category, SLA clock, tags, watchers) + **work log panel** (§7.11a), sticky. Developer sees `Log work` / `Submit for review` as the primary actions; admin sees `Review` when `in_review`. |
| New ticket (sheet) | Capture | Client → contact → subject → description → priority → category → attachments. Autosave draft. |
| Clients | Manage orgs | Table → org detail: contacts, open tickets, SLA policy, notes. |
| Reports | See health | Stat tiles (open, overdue, avg first‑response, avg resolution), trend line, per‑agent load, per‑client volume. Follow the `dataviz` skill when charting. |
| Settings | Configure | Team & roles, categories, SLA policies, email templates, integrations, branding. |
| Client portal: My requests | Track | Card list with status badge + last update; tap → thread. |
| Client portal: New request | Ask | Short form; attachments; confirmation screen with ticket key. |

### 8.4 Wayfinding (Apple §16)

Every screen shows: where am I (breadcrumb + title), where can I go (sidebar), what's here (title + count), how to get out (`Esc` closes any sheet/dialog; breadcrumb link back). Never trap the user.

---

## 9. Accessibility checklist

- All text ≥ 4.5:1; large text ≥ 3:1. Status colours never the sole signal.
- Keyboard: `Tab` order follows visual order; `⌘K` palette; `J/K` move through ticket list; `Enter` opens; `Esc` closes; `R` focuses reply.
- Visible focus ring everywhere (`--secondary-container`, 2px, offset 2px).
- Live regions (`aria-live="polite"`) for toasts and status updates.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`.
- Touch targets ≥ 44×44 on the client portal.
- Semantic HTML: `<table>` for tables, `<nav aria-label>`, `<main>`, headings in order.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| Navy‑tinted shadows | Grey or black shadows |
| 4px / 8px radii | 16px+ pill‑cards |
| One primary button per view | Three blue buttons in a row |
| Inline validation on blur | Validation only on submit |
| Undo toasts | Confirmation dialogs for reversible actions |
| Springs, `bounce: 0` default | `ease-in-out 300ms` on everything |
| Translucent top bar with scroll‑edge fade | Opaque bar with a hard 1px border |
| Wordmark on navy | Wordmark on white (the PNG has a navy background) |
| Thin lucide icons | Filled/duotone icon sets |
| `Inter` for numbers with `tabular-nums` | Proportional digits in tables |

---

## 11. Files this doc expects to exist in the codebase

```
app/globals.css              ← tokens from §1, type utilities from §2
lib/design/motion.ts         ← spring presets from §5
lib/design/status.ts         ← status/priority → colour/icon map (§1.2, §6)
components/ui/*              ← shadcn/Base UI components restyled per §7
components/shell/*           ← sidebar, top bar, command palette
public/brand/*               ← copied from ../brand-assets
```

---

## 12. Quality bar — what "real, clean, optimised" means here

Ship nothing that fails this list. Review every screen against it with the `apple-design` skill loaded.

1. **Real data shapes, not lorem ipsum.** Seed with realistic Sri Lankan/enterprise client names, plausible subjects ("Invoice PDF export fails for LKR amounts > 1M"), real timestamps across weeks, varied SLA states — so every state of every component is exercised.
2. **Every component has every state**: empty, loading (skeleton), error (inline, with retry), partial, long‑text overflow, 0/1/many, RTL‑safe truncation, dark theme (if enabled). Storybook or a `/dev/kitchen-sink` route (dev‑only) shows them side‑by‑side.
3. **Nothing jumps.** No layout shift on load, hover, focus, or data refresh. Fixed heights for rows/tiles; skeletons match final geometry.
4. **Nothing is slower than the hand.** Feedback on pointer‑down; optimistic writes; skeleton within 100 ms; budgets in `architecture.md` §13 enforced in CI.
5. **Hierarchy is obvious at arm's length.** Squint test: one primary action, the ticket subject is the loudest text, status/priority readable as colour + icon + word.
6. **Density is a choice, not an accident.** Comfortable/compact toggle; tables align numbers right with `tabular-nums`; 4px grid everywhere.
7. **Copy is specific.** "Assign to a developer" not "Submit"; "Waiting for you — reply to continue" not "Pending". Error messages say what to do next.
8. **Keyboard‑complete.** Every flow (create → assign → log work → submit → review → resolve) can be done without a mouse; focus is visible and never lost after a sheet closes (returns to the trigger).
9. **Motion is quiet.** Springs with `bounce: 0`; nothing loops; reduced‑motion respected; no page‑level transitions.
10. **Secure by appearance too.** Internal notes, work logs and submissions are visually unmistakable (lock icon, amber/teal rules) so no one pastes them into a client reply by mistake; the client composer says who will see it.
11. **Accessible by default.** Axe passes with zero violations in CI; contrast checked for every badge pair; live regions for toasts and timer.
12. **Consistent.** Same control in the same place on every screen; the properties panel order never changes; icon → meaning mapping from §6 is fixed.
