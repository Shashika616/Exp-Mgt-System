# EXPENDABLES (PVT) LTD — Brand Palette & Image Inventory

> **Purpose:** Single source of truth for colours, type, spacing and imagery so the
> ticket-management system visually matches the public website.
> **Everything in this file was read directly from the website source or measured from
> the image files — nothing is estimated.** Where a value is *derived* (e.g. sampled
> from a PNG) the method is stated.

| | |
|---|---|
| **Source repo audited** | `/Users/as/Documents/Expendable-website/Expendables-website` |
| **Primary files** | `app/globals.css`, `app/layout.tsx`, `lib/site-data.ts`, `public/favicon.svg`, `public/brand/*.png`, every `app/**/page.tsx` and `components/site/*.tsx` |
| **Audit date** | 2026-09-12 |
| **Website stack** | Next.js 16.1.6 · React 19.2.6 · Tailwind CSS 4.2.1 · `@base-ui/react` 1.7.0 · `lucide-react` 1.31.0 · TypeScript 5.9.3 · Node ≥ 22.13 |

---

## 1. Company identity (from the site)

| Field | Value | Source |
|---|---|---|
| Legal name | **EXPENDABLES (PVT) LTD** | `app/layout.tsx`, header, footer |
| Brand wordmark | **EXPENDABLES { Software Solutions }** | `brand-assets/expendables-logo.png` (visually verified) |
| Tagline | **Engineering Tomorrow.** | `brand-assets/expendables-banner.png`, `expendables-mission-vision.png` (visually verified) |
| Meta description | "Enterprise software solutions, IT consulting, cloud architecture, and technical support from EXPENDABLES (PVT) LTD." | `app/layout.tsx` |
| Mission | "To engineer intelligent, scalable, and reliable software solutions that solve real-world business and industrial challenges." | `lib/site-data.ts` `COMPANY_MISSION` |
| Vision | "To shape a future where intelligent technology, automation, and innovation empower businesses to operate smarter, grow faster, and achieve more." | `lib/site-data.ts` `COMPANY_VISION` |
| Email (mailto href) | `expendables.sesolutions@gmail.com` | `app/contact/page.tsx`, `app/faq/page.tsx` |
| Email (displayed text) | `expendables.sesolution@gmail.com` ⚠️ missing "s" — see §9 | `app/contact/page.tsx` |
| Office | 63 Parakum Mawatha, Gampaha (Sri Lanka) | `app/contact/page.tsx` |
| Phone | +94 77 631 5240 (`+94776315240`) | `app/contact/page.tsx` |
| Services | Custom Software Development · Web & App Development · IT Consulting · Technical Support & Maintenance (24/7 monitoring, rapid incident response) | `lib/site-data.ts` `SERVICES` |
| Core values | Integrity · Innovation · Client‑Centricity | `app/about/page.tsx` |
| Stats shown | 100+ Projects · 10+ Years · 50+ Clients | `app/about/page.tsx` |

---

## 2. Typography

Loaded via Google Fonts in `app/globals.css` line 1:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap
```

| Token | Stack | Used for |
|---|---|---|
| `--font-heading` | `Inter, Arial, Helvetica, sans-serif` | `h1–h6`, `.eyebrow`, `.text-label`, all `.text-display / .text-headline-*` |
| `--font-sans` | `'Source Sans 3', Arial, Helvetica, sans-serif` | `body` and all body copy |

### Type scale (exact values from `globals.css`)

| Class | Font | Size | Weight | Line‑height | Tracking | Extra |
|---|---|---|---|---|---|---|
| `.text-display` | Inter | `clamp(32px, 5vw, 48px)` | 700 | 1.2 | 0 | |
| `.text-headline-lg` | Inter | `clamp(28px, 4vw, 36px)` | 700 | 1.2 | 0 | |
| `.text-headline-md` | Inter | 24px | 600 | 1.3 | 0 | |
| `.text-headline-sm` | Inter | 20px | 600 | 1.4 | 0 | |
| `.text-body-lg` | Source Sans 3 | 18px | 400 | 1.6 | — | |
| `.text-body-md` | Source Sans 3 | 16px | 400 | 1.6 | — | |
| `.text-body-sm` | Source Sans 3 | 14px | 400 | 1.5 | — | |
| `.text-label` | Inter | 14px | 500 | 1 | 0.05em | |
| `.eyebrow` | Inter | 14px | 500 | 1 | 0.05em | `uppercase`, colour `--secondary-container` |

Header wordmark: `.text-headline-sm font-bold uppercase text-primary` → "EXPENDABLES (PVT) LTD".

---

## 3. Colour palette

The site uses a **Material‑3‑style token set** (light scheme only — `<html class="light">`, a `dark` variant is declared but **no dark values exist**). All 47 colour tokens below are copied verbatim from `:root` in `app/globals.css`.

**"Uses"** = number of Tailwind utility occurrences (`bg-*`, `text-*`, `border-*`, `fill-*`, `from-*`, `to-*`, `outline-*`, `ring-*`, `shadow-*`) across every `.tsx` file. This tells you which tokens *actually define the look* vs. which are just available.

### 3.1 Core brand colours (most used — replicate these first)

| Token | Hex | Uses | Role on the website |
|---|---|---|---|
| `--primary` | `#000a1e` | 46 | Near‑black navy. All headings, wordmark, primary text, icon colour in cards |
| `--primary-container` | `#002147` | 16 | **Brand navy.** Primary buttons (`Get a Quote`, `Get in Touch`, `Send Message`), active filter pill, stats band background, outline‑button border/text |
| `--secondary-container` | `#1470e8` | 28 | **Brand blue / accent.** Card top‑border (4px), eyebrow text, focus rings, button hover, "View All →" links, check icons, ring colour (`--color-ring`) |
| `--secondary` | `#0058bd` | 23 | Link hover, active nav underline, contact icons, success‑message text, "View Project →" |
| `--on-surface-variant` | `#44474e` | 24 | Body copy / muted text, nav links (inactive), descriptions |
| `--surface` / `--background` | `#f8f9fa` | 13 / 2 | Page background, header background, card backgrounds |
| `--surface-container-lowest` | `#ffffff` | 5 | Hero section background, `SoftCard` background, mission/vision cards |
| `--outline-variant` | `#c4c6cf` | 9 | Borders (`--color-border`, `--color-input`), card outlines (often at `/30` or `/60` opacity) |
| `--outline` | `#74777f` | 9 | Category eyebrows ("FinTech Infrastructure"), "Trusted by" label, subtle borders (`/20`), form‑field border at 20% |
| `--tertiary-container` | `#192229` | 1 | **Footer background** (dark slate‑navy) |
| `--on-tertiary` | `#ffffff` | 7 | Footer headings / hover links |
| `--on-tertiary-container` | `#818a92` | 7 | Footer body text & links |
| `--on-primary` | `#ffffff` | 6 | Text on navy buttons / stats band |
| `--error` | `#ba1a1a` | 2 | Form validation errors (`--color-destructive`) |

### 3.2 Surface ramp (elevation / containers)

| Token | Hex | Uses | Where |
|---|---|---|---|
| `--surface-container-lowest` | `#ffffff` | 5 | Hero, SoftCard, mission/vision cards, popover |
| `--surface-bright` | `#f8f9fa` | 0 | — |
| `--surface` | `#f8f9fa` | 13 | Page, header, cards, form container |
| `--background` | `#f8f9fa` | 2 | `body` |
| `--surface-container-low` | `#f3f4f5` | 8 | Outline‑button hover, clients logo band, portfolio image well, gradient stops |
| `--surface-container` | `#edeeef` | 3 | "Core Offering" chip, mobile‑nav hover (`--color-muted`) |
| `--surface-container-high` | `#e7e8e9` | 2 | Tag pills on portfolio cards, avatar well |
| `--surface-container-highest` | `#e1e3e4` | 1 | Contact map container |
| `--surface-variant` | `#e1e3e4` | 8 | Section divider borders (`border-surface-variant`) |
| `--surface-dim` | `#d9dadb` | 0 | — |
| `--surface-tint` | `#465f88` | 0 | — |

### 3.3 Primary family

| Token | Hex | Uses | Where |
|---|---|---|---|
| `--primary` | `#000a1e` | 46 | Headings/text |
| `--on-primary` | `#ffffff` | 6 | Text on primary |
| `--primary-container` | `#002147` | 16 | Buttons, stats band |
| `--on-primary-container` | `#708ab5` | 0 | — |
| `--primary-fixed` | `#d6e3ff` | 2 | `IconBubble` background; active mobile‑nav item (`--color-accent`) |
| `--primary-fixed-dim` | `#aec7f6` | 0 | — |
| `--on-primary-fixed` | `#001b3d` | 1 | `IconBubble` icon colour (`--color-accent-foreground`) |
| `--on-primary-fixed-variant` | `#2d476f` | 0 | — |
| `--inverse-primary` | `#aec7f6` | 0 | — |

### 3.4 Secondary family

| Token | Hex | Uses | Where |
|---|---|---|---|
| `--secondary` | `#0058bd` | 23 | Link hover, nav active, icons |
| `--on-secondary` | `#ffffff` | 0 | — |
| `--secondary-container` | `#1470e8` | 28 | Accent, focus ring, card top‑border |
| `--on-secondary-container` | `#fefcff` | 0 | — |
| `--secondary-fixed` | `#d8e2ff` | 4 | Stats numbers on navy band; "Our Mission/Vision" pill bg (`/40`, `/50`) |
| `--secondary-fixed-dim` | `#adc6ff` | 3 | Stats labels on navy band; vision‑card glow (`/15`, `/25`) |
| `--on-secondary-fixed` | `#001a41` | 0 | — |
| `--on-secondary-fixed-variant` | `#004494` | 0 | — |

### 3.5 Tertiary family (footer)

| Token | Hex | Uses | Where |
|---|---|---|---|
| `--tertiary` | `#040b11` | 0 | — |
| `--on-tertiary` | `#ffffff` | 7 | Footer headings |
| `--tertiary-container` | `#192229` | 1 | Footer background |
| `--on-tertiary-container` | `#818a92` | 7 | Footer text/links |
| `--tertiary-fixed` | `#dbe4ed` | 0 | — |
| `--tertiary-fixed-dim` | `#bfc8d0` | 0 | — |
| `--on-tertiary-fixed` | `#141d23` | 1 | Footer base text colour |
| `--on-tertiary-fixed-variant` | `#3f484f` | 0 | — |

### 3.6 Neutrals, outline, error, inverse

| Token | Hex | Uses | Where |
|---|---|---|---|
| `--on-surface` | `#191c1d` | 3 | Body text colour on `<body>`, testimonial quotes |
| `--on-background` | `#191c1d` | 0 | — |
| `--on-surface-variant` | `#44474e` | 24 | Muted text |
| `--outline` | `#74777f` | 9 | Eyebrows, subtle borders |
| `--outline-variant` | `#c4c6cf` | 9 | Borders / inputs |
| `--error` | `#ba1a1a` | 2 | Validation |
| `--on-error` | `#ffffff` | 0 | — |
| `--error-container` | `#ffdad6` | 0 | — |
| `--on-error-container` | `#93000a` | 0 | — |
| `--inverse-surface` | `#2e3132` | 0 | — |
| `--inverse-on-surface` | `#f0f1f2` | 0 | — |

### 3.7 Tailwind semantic aliases (from `@theme inline`)

These map shadcn‑style names onto the tokens above. Keep the same mapping in the new system.

| Alias | → Token |
|---|---|
| `background` | `--background` (#f8f9fa) |
| `foreground` | `--on-surface` (#191c1d) |
| `card` / `card-foreground` | `--surface` / `--on-surface` |
| `popover` / `popover-foreground` | `--surface-container-lowest` / `--on-surface` |
| `primary-foreground` | `--on-primary` (#ffffff) |
| `secondary-foreground` | `--on-secondary` (#ffffff) |
| `muted` / `muted-foreground` | `--surface-container` (#edeeef) / `--on-surface-variant` (#44474e) |
| `accent` / `accent-foreground` | `--primary-fixed` (#d6e3ff) / `--on-primary-fixed` (#001b3d) |
| `destructive` | `--error` (#ba1a1a) |
| `border` / `input` | `--outline-variant` (#c4c6cf) |
| `ring` | `--secondary-container` (#1470e8) |

### 3.8 Colours that exist only in image / SVG assets (measured)

| Asset | Colour | Hex | How obtained |
|---|---|---|---|
| `favicon.svg` background | Deep navy | `#001b3d` | Literal `fill` in SVG (`rect rx=10`) — same value as `--on-primary-fixed` |
| `favicon.svg` "E" glyph | White | `#ffffff` | Literal `fill` |
| `favicon.svg` "X" glyph | Bright blue | `#2e9eff` | Literal `fill` — **not in the CSS token set** |
| `favicon.svg` accent lines | Light blue | `#68c4ff` @ 55% opacity | Literal `stroke` — **not in the CSS token set** |
| `expendables-logo.png` background | Brand navy | `#01204c` | Dominant pixel (76.7% of image) via Pillow histogram. Visually ≈ `--primary-container #002147` (Δ ≈ 1–5 per channel) |
| `expendables-banner.png` background | Deep navy | `#011b3e` (range `#00183c`–`#031b3f`) | Dominant pixel (25.7%); gradient/circuit overlay causes spread |
| `expendables-mission-vision.png` background | Darkest navy | `#011530` (range `#00142f`–`#021633`) | Dominant pixel (43.5%) |
| Logo / banner text | White | `#ffffff` | Dominant non‑navy pixel |

> **Recommendation for the system:** treat `#002147` (`--primary-container`) as *the* brand navy for UI, and `#1470e8` (`--secondary-container`) as the accent. The favicon blues (`#2e9eff`, `#68c4ff`) are only appropriate on dark navy surfaces (e.g. a dark sidebar or login hero).

### 3.9 Shadows, gradients & opacity recipes actually used

| Name | Value | Where |
|---|---|---|
| `.soft-lift` rest | `box-shadow: 0 4px 20px rgba(0, 33, 71, 0.08)` | All cards, hero image, form container |
| `.soft-lift` hover | `box-shadow: 0 8px 30px rgba(0, 33, 71, 0.12); transform: translateY(-4px)`; `transition: transform .2s ease, box-shadow .2s ease` | same |
| Header | Tailwind `shadow-sm` on `bg-surface`, fixed, `h-20` | `site-header.tsx` |
| Hero image overlay | `bg-gradient-to-tr from-primary-container/20 to-transparent` | `app/page.tsx` |
| Mission icon tile | `bg-gradient-to-br from-primary-container to-secondary-container` + `shadow-md shadow-primary-container/20` | `app/about/page.tsx` |
| Vision icon tile | `bg-gradient-to-br from-secondary to-secondary-container` + `shadow-md shadow-secondary/20` | `app/about/page.tsx` |
| Section gradient | `bg-gradient-to-b from-surface-container-low via-surface to-surface-container-low/50` | `app/about/page.tsx` |
| Glow orbs | `bg-secondary-container/15 blur-3xl`, `bg-primary-container/15 blur-3xl` (opacity‑30 wrapper) | `app/about/page.tsx` |
| Form field border | `color-mix(in srgb, var(--outline) 20%, transparent)`; focus → `--secondary-container` | `.form-field` |
| Client logos | `grayscale opacity-60/75` → colour on hover | home, clients |

---

## 4. Radius, spacing & layout constants

| Token / class | Value | Notes |
|---|---|---|
| `--radius-sm` | `0.125rem` (2px) | |
| `--radius-md` | `0.25rem` (4px) | |
| `--radius-lg` | `0.25rem` (4px) | ⚠️ **Overrides Tailwind's default `rounded-lg` (8px) down to 4px** |
| `--radius-xl` | `0.5rem` (8px) | |
| `--radius-2xl` | `0.5rem` (8px) | |
| Radii used in markup | `rounded` (4px default), `rounded-lg` (=4px), `rounded-xl` (=8px), `rounded-2xl` (=8px), `rounded-full` | Cards → `rounded-xl`; buttons → `rounded-lg`/`rounded`; pills/filters → `rounded-full` |
| `--spacing-page` | `clamp(16px, 3vw, 32px)` | Horizontal page padding (`.px-page`) |
| `--spacing-gutter` | `24px` | Grid gap (`.gap-gutter`) |
| `--spacing-site` | `1200px` | Max content width (`.max-w-site`) |
| Header height | `h-20` = 80px, `body` has `pt-20` | Fixed header |
| Section padding | `py-20` (80px); hero `md:py-[120px]`; footer `py-20` | `PageSection` |
| Button | `min-h-11` (44px), `px-6 py-3`, `.text-label`, `active:scale-[0.98]` | `ButtonLink` |
| Form field | `min-height: 44px; padding: 10px 12px; font-size: 16px` | `.form-field` |
| Card padding | `p-8` (32px); mission cards `p-8 lg:p-10` | `SoftCard` |
| Card accent | `border-t-4 border-secondary-container` | `SoftCard`, portfolio cards, about hero image |
| Icon bubble | `size-16 rounded-full bg-primary-fixed text-on-primary-fixed`, icon `size-8 strokeWidth 1.7` | `IconBubble` |
| Service icon | `size-10 text-primary strokeWidth 1.6` | |

---

## 5. Iconography

Library: **`lucide-react` 1.31.0**, default stroke widths 1.2–1.8 (thin, professional).

Icons used on the site: `ArrowRight`, `Building2`, `CheckCircle2`, `Cloud`, `Code2`, `DatabaseZap`, `Eye`, `Globe2`, `Handshake`, `Headphones`, `Landmark`, `Lightbulb`, `Mail`, `MapPin`, `Menu`, `Phone`, `Quote`, `Shield`, `ShieldCheck`, `Smartphone`, `Sparkles`, `Target`, `UsersRound`, `X`.

---

## 6. Local image assets (copied to `brand-assets/`)

All four files were opened and inspected; descriptions are what is *actually in the image*.

| File | Dimensions | Format | What it contains (verified) | Where the website uses it |
|---|---|---|---|---|
| `expendables-logo.png` | 1254 × 1254 | PNG, 8‑bit RGB, 320 KB | Square navy (`#01204c`) tile. White stencil‑style wordmark **"EXPENDABLES"** with **"{ Software Solutions }"** in monospace beneath. No icon/mark — pure wordmark. | `app/about/page.tsx` hero image (alt text wrongly says "Modern corporate IT office…" — see §9) |
| `expendables-banner.png` | 1600 × 400 | PNG, 8‑bit RGB, 314 KB | Wide navy (`#011b3e`) banner, faint circuit‑board line pattern on both edges with glowing dots. Centre: white "EXPENDABLES", "{ Software Solutions }", thin rule + "ENGINEERING TOMORROW." | Open Graph & Twitter card image (`app/layout.tsx`) |
| `expendables-mission-vision.png` | 1600 × 400 | PNG, 8‑bit RGB, 296 KB | Darkest navy (`#011530`) banner, circuit pattern bottom‑right. Right‑aligned white heading "EXPENDABLES SOFTWARE SOLUTIONS", light‑blue "Engineering Tomorrow.", then two columns: ⊕ **MISSION** "Build smart, scalable software that solves real‑world problems." · ⌃ **VISION** "Shape a future where technology empowers every idea." | **Not referenced anywhere in the code** (unused asset) |
| `favicon.svg` | 64 × 64 viewBox | SVG | Rounded square (`rx=10`) `#001b3d`; white "E", bright‑blue `#2e9eff` "X", two `#68c4ff` horizontal rules at 55% opacity | Browser favicon |

> ℹ️ The short mission/vision lines on the PNG differ from the longer `COMPANY_MISSION` / `COMPANY_VISION` strings in `site-data.ts`. Both are "real"; the PNG is the condensed version.

---

## 7. External images (21 URLs — all verified live)

Every URL below was fetched with `curl -L` on **2026-09-12** and returned **`HTTP 200`, `content-type: image/jpeg`** (sizes 12–72 KB). They are hosted on Google's `lh3.googleusercontent.com/aida-public` CDN — **the company does not own or control these files**. Treat them as placeholders; do not depend on them in the management system.

Rendered through `<BrandImage>` = `next/image` with `unoptimized`, `width={1200} height={800}`.

| # | Alt text (from source) | Used where | Status | URL |
|---|---|---|---|---|
| 1 | Clean financial dashboard on a laptop in a modern office | `FEATURED_PROJECTS` → home page "Featured Implementations" — **Global Payment Gateway Integration** (`lib/site-data.ts:64`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuC4HOpO31oJUfw9HqFLjAnQQ9QBWazEMTeA05qMABygBLWAuWF58n0W9co-PimjyUYbaPO_mMT7Jy-ElVgiNnCyMzaDo8x01d_0KEY4-_EP2ucqMV9zK_9zUias8Elgvr5mtSDqLXWrVza8Ue24fRSl9riiFec_6Xd-2woUPWA7bjYVaHsZRPIIm58ZWWHpLuvwiV2RoiObA71PMUUSyrK-uYntI6Spu5ayDYUX9A5jhEUxJljS0K1xn2BRkk9s32yvrI1JxLThtss` |
| 2 | High-tech server room with blue data flow lighting | `FEATURED_PROJECTS` → home page "Featured Implementations" — **Enterprise Data Migration & Scaling** (`lib/site-data.ts:74`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCBoyRdiBUfcMV_1x-1gph-MeFa251NBwqfrHvugW_aD7JomcatGAcYr7cLBo5Z-7Br5gQVXSLpm3_DXcEOaDGUk-SedrDX2eUTgMeSCOs6as1fi9J7CEUhNpOc5yAs9n33x3tw0jjJduxmIUOK3twLUzH_bhyQRBAmnMs7KPIpl68Ej5PgUux9SSmP3CTaWv7alSDgoOMZCHTsTyMRLmV3syAzGQhzmVbQXLyXUpaapWYtdkaiqsfHzzYf2dakJi93qO8KgoXN90E` |
| 3 | Healthcare professional using a custom tablet application | `FEATURED_PROJECTS` → home page "Featured Implementations" — **Patient Record Management Suite** (`lib/site-data.ts:84`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDMNVMFDu-j4fJ09kFx2GaMEmcbMF74j36slqOLCs1Xz3IlAJOaWkQm5VzjY6kfpQfVOATFB1ugla_TRhm6xWio7QUJgDHYDoT7dFMSe6siYRFmcZ1M8XIVii07eaM8dHIxWtXahqZDKL-gyYwN-Bwe8GpKiq4286-ZdaVp9PjPmRGWpjm2oAKINn3uAJCLoyweJE0geRFrK3dc207_W8hcfMNPSkgLc0vNCz0EtgdZSwH4O0T1-kY56-xsyHeHowOMo4WgwmXwG8M` |
| 4 | Enterprise logistics dashboard with analytics and maps | `PORTFOLIO_PROJECTS` → /our-works grid — **Global Logistics Platform** (`lib/site-data.ts:96`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCDSMGEOne7_LQoXEByZBoCHi1wJSeER41Q18uh8m2OvOIjQpA7sieMHOYGZPMQFU-BPrIQSRZOhxi2J-VvsP2cRVqJxs3lWQ3GktiApsX_3pZE0AmEiB0jZwDBmv34g0xZOGBxT0jI3vw849_9Sd2xII1mIPCyvmwuCCfsrSxc-LvcrjDl9Vs_UaA2PZLzFANdPHOPs_j9C6GEpdmX2v2IEEbFpEHte2lAHQ9_gGN7IGVkMvfLfYHn9r6mb9HOVYMB9623rGAV1Ro` |
| 5 | Mobile banking application displayed on a smartphone | `PORTFOLIO_PROJECTS` → /our-works grid — **FinSecure Mobile Banking** (`lib/site-data.ts:107`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuACxYvUeHPaBkTHj4wZdmX_RNpbdy6ohK-O2_0oUdCwqeDU9Jw0csoFZBggc-cG7zW-Zuja5rO6phLmnbthZb9s0Faq8Rdf4GnK1DB1lSAlkha0_wo5DCFV25_KYixSESXTI_Kvv9mvZvi0qP4ms14FaBmvE-kqdbBq60OduQuWwt1YpIUyEKNAMptIHepg3jDvYlFTdFLn5ZBjI35M8Mt2YkVKiKrs_FCiXFfLxZiJaAVC-3ph_kab1o46pOrj968ONOxqDXVdKOY` |
| 6 | Server racks in a modern data center | `PORTFOLIO_PROJECTS` → /our-works grid — **Cloud Migration Strategy** (`lib/site-data.ts:117`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuB3o0gZ-HUWiuzJjFJ8d0hT2GKRAvQfK2SHQIpB-uAQf2EZurmhuI1uqN_mlUeFoTpvbym1OEgseooKKrtBdoW62mEtbG9xhfy7TfG2mmckKQo4NltKNaim9bHyFvkUwDy_BNqxd4oPDBEIbAVpgKaSAPma1AlpE39slHot1HY9BdlnhZBhXetPlvWcdvIpPvabWktljbiFzgilzHcjDNqLJx-cWv-6oiB4fYGg8h7LEJ0MQScqpvHBsQmqvPBmCwU3IRGNoRYVw40` |
| 7 | Software engineers collaborating around a laptop | `PORTFOLIO_PROJECTS` → /our-works grid — **Agile Transformation** (`lib/site-data.ts:127`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDBEp-Qb6LIaTMG1G5LdVOCaEt3e3NQw5l3XPtTjN_rmkaYwcE37D5SiMbjpTDYBkg3_SUKFGGSml_P5BDAC-N1Z_fSktytEIanW36fzr6d-_juW5D3hQbTIisLAUKT9Bx8HFQSxiKiwurydLPC-D7-g1_6qEsbruo_k-2PrIfqABA3U2NnPMj2F3MWmOmf9NTAv8Mih_ChR5TPumY21GYVZR8ScKwfr7WdCNKuP7vzazCjAVvbcNGrBn7iazldciaC3tbcWRxsUlE` |
| 8 | Minimal e-commerce storefront interface on a tablet | `PORTFOLIO_PROJECTS` → /our-works grid — **NextGen E-Commerce** (`lib/site-data.ts:137`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDTVVbQfgX_2yLHjBNSAco05feq5RZb37XBaV2VuDh69YdxV9YBoCfTWoxTtxdIOeWr_U9kWZdJBXOwpqWl5XomwzHBHedYfI-6WZPiAe32YryIt22BNBj_9v5USZpwNvk4id-GwT84GBkvQ1AYeqZ4uWeYqR-pvc3jD6VDsIrk46v42_MGn6cJBH8fO2I6phy6JUWw_k7arg4U1Bw6iZcmZxafAIc1cWGvjIFJC5XXLiqRzSloXgx3h0nJgHBHSGEuDxmevCR60ho` |
| 9 | Abstract cybersecurity network visualization | `PORTFOLIO_PROJECTS` → /our-works grid — **SecureNet Protocol** (`lib/site-data.ts:147`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCUTaIAOpKtJzpbUH6bDLA8smuH5X17rv_ON3gQ815YGQn8leYtJfVn2tnS5sWHwvo2Vp6HUOMLh17I1JCIKh56BXHKTUzpBZGdrP4M46EgeKVk897T9I5_rQAE49f1_1rts8MpLU2EbuaZkiYRdCkDkdpZxkMJbxfARM_r3KSKhOtzPUJ88sLUuvw_0FyECJpA--61dXAyNRp02cZ9z84w79qeTEqFky1vIF528DqI7MYc7EtLyaSNF3zB8LIpinUcPMvzT94j__I` |
| 10 | Global financial institution logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:169`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuD6MLghO_240CYtJrLHcpFoShu68bpPNkZh7GUYYe4e-AYpizWwfC6a6W4qUnHMhlc3axvmdut0olu4oT_CtnSJht1GZvDv54V7kp9_iywNS2Ct1TjeciyCjlddcpYM92KydbWoxBU8n6e9UCwVYBnLGW8T2Q8kYcLWmPtnGOBA46gSeRlvqmJnGefu0Bt1KTs_ZxS2CCUfI2JLkuiQ9W3VRHsNtg0Wg1X2_chd6M_EkA50V_GEgEgUatND2UB4jc23CH3tAEEuSck` |
| 11 | Logistics company logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:173`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDipUuWLYAXvgwPZ7aHg9DbWmL1Dgn_zOnAaQ3Z2QLwL769yk861spBms60XYW2mlf6NDaCKAxaSosIK0ug8CZu6FoZB1wOwyEKh18kmVHvJrtiCReBdsW-Uh9P2q3zsGaz4PJFR-_IyGC4ieO30EQ3zPR-BGYp2FiswdP8g6JWggkGCVuScOZWADWF5kHve5tg7nTLDgRCEELXD8k6ioPEYSiRlXlkCiAQNMJVMJ3qMddMT6XNVs_BtdEHSfi9gW5_Fl_XvG6MlWU` |
| 12 | Healthcare provider logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:177`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDwwiOAPZU_uWa00HoBcI7ShDs165XVwqZi_iJHIQKnaS7meGncJSNctVs2U1TabMl10huOV43ZIAvl6U5Oeix8Kj3xoSBrN7FrbX7EmwWq2IVAGpP-kAkF4Bl-vvXaGn9FLomCHVFDGGOEfFKupRotv6489IMOQtp0eO5w1aSKFFsp_SkM5_QyplH6trEeiK_N0p5UUeFX0stgGbKlHnPUVJytt_2HppzW8emUIBk-iaQIM51j4vgpdOsDUweXJLqOSVNlHyzySGs` |
| 13 | Data analytics firm logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:181`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuD4JG0z2uxy0bLvtADfmtrzYh7LoqyzqDJZl90CT_Lj_fevmK_90l83zKzP2GJh6AeMyYmbRr4pizzF8Cs0XVEHjXITO0Oy2xVJ9kNz_SDJHmnPi8DOTEAYl7MdiqCm2kto7xq7IwBEYgf3ovxhIWjJOFi7UAg5f18UQvlfXVO5jqHSwjHbXtho3_U8Aw1eEwyNXWhuYRfPiNan6BlxRy1LZ9Pr_Ziad_bzqG9JFRveX1P7FqnnrJPL3vZWqs8ZdDJbHgEFcSSYBGA` |
| 14 | Manufacturing conglomerate logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:185`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDHHXqwJMOdjhgEbLDqLnymf5v7z5EsCHEao4hPukUpocA2bX6BWk_RuxlexvRq45ipp_4G7_F4rpYbcwSN3px99YtiCLi-pW7S2JohebxZkjAsLWoE_hMPMYxweqWB-Z5vP2P4LC2NikaMK22pbUDSvni-Kzabxk4UNzUgurutIXdcfmRlxk6LpsjdKFC_g61hkYv2qgUp0ihw8AKYtvGTuEeD6cUWSNiDZ0kqHpob5k_sBYbWlzULbsfofcaKzGn_LaGvR0I4xYk` |
| 15 | E-commerce platform logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:189`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuA9YgiAjYIItins-PAgv7a5B-DchuNzqIcKB5ptX4QWVZbHvrQqnQBiCWL82mXvzpXIU13nSy665OneNabbEiC3b3hTtWaxM4Wv9lqGoASD6Sgv_8NnCqJI3eMy4bpbQICcK0gtyMG58eNoZpVkaWwvBAl0om4tQfspf00GzdJryOkJrqAFz1lC-p76cJ4wrJBSDbVhMsXAJH10b-0P3fjLLT7C0kZuC2z_M6lNHrSF5raQ-4MCMJtd4meiylY8-RwXE6PjaQQ5sg4` |
| 16 | Commercial real estate developer logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:193`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCar3wsB3sp7aBuq_v7s4gxNqWTR_wYQqF2b2vqMxR8q95QfKTKMOJoyRPZBQuOtlZf6lTzjnTUn7VP2kb7h_cqIpp2ecN_YtTSykyIKuZKs-nT9o5zRVkSX5hh7TlvO55xbXh7ZLzSFVy1Bc4uFyB8qxr-ZJpEYXWPzgpKX9Df0NggXApvZgVZbE9pNv8H_yyUMrAtbLMgwyqffuRS4mjucQZwITHA-ebG3T2G0HihTuENo9qby33RebH-qbg0WEr_trMI7u71D2A` |
| 17 | Energy sector logo | `CLIENT_LOGOS` → /clients "Our Partners in Transformation" (rendered grayscale, `max-h-12`) (`lib/site-data.ts:197`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuDDxaTQaaXN94u_nZ-HXvHKX1Q5qNO3Piu8H7TIOMZ2cFTqN9ULV5wkH4miG0l5kdBpCjgk0u9Pz53-IgAHqeOOhEYzq4EDKyyvhY2cHZMtq1NfdPKWPcDnDQvuSyKMG-M86bo-3i8ZZ4NFEq_brwECA0485Gt6t7q80QSu3OqYcraeFUo9kwpS9V2JAXjxuNldWiiKimtjv5OMlZ3E1arSiLOvSMKXr_sVLHoBvGz6x27a9nRrwdYv3kn1Wc-cdL4zvdm9yJKjktI` |
| 18 | Corporate IT team reviewing code and analytics in a bright office | Home hero image (right column, `h-[400px] lg:h-[600px]`, navy gradient overlay) (`app/page.tsx:70`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCLVdwZMfXXYxEI34AzoQmM7k9mH0JJabAFGpOpUPW77KOrR7FLrdmB1zc1uRvp_S5zdilyN-Jymt2sxl7-Lmx_O_iFRmW6d2VTDf5ge4FmBFaCl3CQ5o5sLBHI2ocVinnRoyOlRsZvLVl7PVQ_by2-UM5PysrdLfUPHUyxulGictR3XxyWoQzWoBCrZzgIlqR9al1EMMjSeozW2wHaV2lYaC1G5zg3s74ruzOwzK9k8rAv-v3JP-nTExI25JU7W61QeCA6vLExFqw` |
| 19 | Sarah Jenkins | /clients — testimonial avatar (Sarah Jenkins, `size-12`) (`app/clients/page.tsx:61`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuAottBorzD952xXLYDNgk2GodvH7aTx7s4eSsIKVZGkfhx-7X1F17btk6PxXtDZtJORCUm5R7-6Lf7Z6qfhKWXHf8KTD9Wge6VLCb3r_NepFK_4WNnC4FXOnZ7iwEN3pzoMOOnmjCf3NkS7rA6d1wRrHKJ5WRYrQVM5Ydc7aaMtzT1_2ntTr4r7o7SqAlhwldwvuft8NFj19vcqR6xC3vgoFu60XYiC17Z9YgwO6Za5r4_rguWv2ugt2U4ei1IGiIcCjmBsETO33a8` |
| 20 | Enterprise data center | /clients — "Enterprise Scale Delivered" card image (`h-48`) (`app/clients/page.tsx:93`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCkW_omGcXOA3Gkfh010O_36qG-Xw7FpwYq4_mkoUh_fq0dKoIKOiZPp_bvPDZYuky_HZBhr_DjIRsqmoSpTs3m_GNDoJc822JX6-yz6M6Q4t_cWRNoy7QlmsQVMzhIEqvgZzbdo81w36jx471kLdTeufM8eBYjZkCe0IMAO-SBnTpBW47Gb6k89tA8eltWNE4tgX8K65TIoh3s5qJJoEHbW1PcLFA82cMq3WlqBTPiL05-uoYC7c9UyBmfT5R_oNagh1XMCGoi__U` |
| 21 | Minimal corporate technology district map | /contact — map placeholder (`opacity-80 mix-blend-multiply`) (`app/contact/page.tsx:56`) | 200 image/jpeg | `https://lh3.googleusercontent.com/aida-public/AB6AXuCqcikXRYDVh2BgfBx-6yWYa5tEkAEnqbWBag0eT8tO6pjnryHruolZ-9mnOXZDt4ESbH6N_vT8EOAhdd8PauR7rLbZs1fhBNZS3em10ZvMU9xYea6oghKVzjt35e3JoP-t2RbnzvQErBl0kkHmmw-CTD4M5emyioPEb6rp9jthtLemT_PDu7wSDnJt2_aJNxImqu0Pcm7FdRQPPZJqN-uFM7RYvDsk6HV6dOfNA8jsWRWRoWPhqL8ux3aZ_TstoX-PxU0KScA0ZWE` |

---

## 8. Component recipes (for replicating the look)

```tsx
// Primary button (ButtonLink variant="primary")
"inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-label
 bg-primary-container text-on-primary hover:bg-secondary-container
 transition-all duration-200 active:scale-[0.98]
 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"

// Outline button (ButtonLink variant="outline")
"border-[1.5px] border-primary-container bg-transparent text-primary-container hover:bg-surface-container-low"

// SoftCard
"soft-lift group flex flex-col rounded-xl border-t-4 border-secondary-container bg-surface-container-lowest p-8"

// Filter pill (active / inactive)
"rounded-full border px-6 py-3 text-label"
  + "border-primary-container bg-primary-container text-on-primary"
  | "border-outline/20 bg-transparent text-primary hover:border-secondary hover:text-secondary"

// Tag chip
"rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant"

// Status pill (about page style)
"inline-flex items-center gap-2 rounded-full border border-secondary-container/20 bg-secondary-fixed/40
 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary-container"

// Nav link (active)
"border-b-2 border-secondary pb-1 text-label text-secondary"

// Footer
"bg-tertiary-container text-on-tertiary-fixed"  headings: text-on-tertiary  links: text-on-tertiary-container hover:text-on-tertiary
```

---

## 9. Discrepancies & things to fix / not copy

| # | Finding | Impact for the new system |
|---|---|---|
| 1 | Displayed email `expendables.sesolution@gmail.com` (contact page text) ≠ `mailto:` href and FAQ `expendables.sesolutions@gmail.com` | **Confirm the correct address with the company** before using it for notifications. The `mailto:` + FAQ value (with "s") appears twice, the typo once. |
| 2 | About page hero uses `expendables-logo.png` with alt "Modern corporate IT office with teams collaborating around workstations" | Alt is wrong; the image is the wordmark. Use correct alt in the new system. |
| 3 | `expendables-mission-vision.png` is never referenced | Available for use (e.g. login page hero) but currently orphaned. |
| 4 | Footer says `© 2024` | Use dynamic year. |
| 5 | `metadataBase` = `https://expendables-pvt-ltd.abuzz-flute-4888.chatgpt.site` | Temporary hosting domain, not a real company domain. |
| 6 | `--radius-lg` is 4px (Tailwind default 8px) | The site's radii are **tighter** than Tailwind defaults. Match this (see design.md) or consciously deviate. |
| 7 | Dark mode variant declared but no dark tokens | The site is light‑only. The system's dark theme (if any) must be authored fresh. |
| 8 | 21 portfolio/client/testimonial images are third‑party CDN placeholders | Never use them as "client logos" in a real ticketing UI. |
| 9 | Contact form does not submit anywhere ("Connect an API endpoint to send it live") | The ticket system is the natural backend for this form. |
| 10 | Testimonial names (Sarah Jenkins, Marcus Vance, Elena Rodriguez, David Chen) and client names are illustrative | Do not seed the system with them as real clients. |
