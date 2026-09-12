# Brand assets

Copied byte‑for‑byte from the public website repo (`public/brand/` and `public/favicon.svg`) on 2026‑09‑12. Full analysis, measured colours and usage notes: [`../docs/brand-palette.md`](../docs/brand-palette.md) §3.8 and §6.

| File | Size | Content (visually verified) | Use in the system |
|---|---|---|---|
| `expendables-logo.png` | 1254 × 1254, PNG RGB | White "EXPENDABLES { Software Solutions }" wordmark on navy `#01204c` | Sidebar wordmark (on navy), email header, login panel. **Has an opaque navy background** — never place on white. |
| `expendables-banner.png` | 1600 × 400, PNG RGB | Wordmark + "ENGINEERING TOMORROW." on navy `#011b3e` with circuit‑line motif | Login page hero, email header (cropped), Open Graph image |
| `expendables-mission-vision.png` | 1600 × 400, PNG RGB | "EXPENDABLES SOFTWARE SOLUTIONS — Engineering Tomorrow." + short Mission/Vision blurbs on navy `#011530` | Optional login/onboarding hero (unused on the website) |
| `favicon.svg` | 64 × 64 | Navy `#001b3d` rounded square, white "E", blue `#2e9eff` "X", light‑blue `#68c4ff` rules | App favicon / PWA icon source |

When scaffolding the app, copy this folder to `public/brand/`.
