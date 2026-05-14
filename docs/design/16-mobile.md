# 16 · Mobile & Responsive

| Owner | Frontend Lead + Design Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `10-design-tokens.md`, `11-component-library.md` |
| Supersedes | — |

ArbiGameFi is a **mobile-aware web** product, not a mobile-first native app.
The mobile experience must work fully, but design decisions optimize for
desktop first. This document specifies what "works fully" means.

## 1. Stance

- Mobile is a **first-class web target**, not a downgraded layout.
- We do not ship native iOS / Android apps in v1.
- PWA install is supported (manifest, theme color, icons) but no
  service-worker offline support beyond Next.js defaults.
- We do not build mobile-only routes.

## 2. Breakpoints

Aligned to Tailwind defaults:

| Token | Width     | Notes                                                   |
| ----- | --------- | ------------------------------------------------------- |
| `sm`  | ≥ 640 px  | first non-mobile breakpoint (large phone, small tablet) |
| `md`  | ≥ 768 px  | tablet portrait                                         |
| `lg`  | ≥ 1024 px | tablet landscape / small desktop                        |
| `xl`  | ≥ 1280 px | desktop                                                 |
| `2xl` | ≥ 1536 px | wide desktop                                            |

### Page-density rules per breakpoint

| Breakpoint      | Layout                                        |
| --------------- | --------------------------------------------- |
| `< sm` (mobile) | Single column, full-width panels, no sidebar  |
| `sm`–`md`       | Single column, breathing room                 |
| `md`–`lg`       | 2-column allowed; sidebars collapse to drawer |
| `lg`+           | 2-column default; 3-column allowed            |
| `2xl`+          | Cap shell at 1600 px; no edge-to-edge prose   |

Anti-pattern: a desktop 3-col grid forced into 3 cols at `sm` via scroll
overflow. Stack instead.

## 3. Touch Targets

| Target                                           | Minimum size                                |
| ------------------------------------------------ | ------------------------------------------- |
| Primary tap target (button, link cell, nav item) | 44 × 44 px                                  |
| Secondary tap target (icon button, chip)         | 36 × 36 px (with 8 px padding for hit area) |
| Form input minimum height                        | 44 px                                       |
| Slider thumb                                     | 24 px visual; 44 px hit zone                |
| Spacing between adjacent targets                 | ≥ 8 px                                      |

ESLint rule (`24-testing.md`) flags `<button>` / `<a>` with computed
heights below 44 px in product UI.

## 4. Header & Navigation

### 4.1 Header

```text
┌──────────────────────────────────────────────────┐
│ [Wordmark]  [Nav...]            [Wallet  ☰]      │  ≥ md
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ [Wordmark]              [Wallet  ☰]              │  < md
└──────────────────────────────────────────────────┘
```

- Below `md`, primary nav collapses behind the `☰` button.
- The wallet pill stays in the header.
- The release-proof and theme toggle move inside the nav drawer.

### 4.2 Nav drawer (`< md`)

- Full-height right drawer.
- Items mirror primary nav from `03-information-architecture.md §4`.
- Tappable height ≥ 44 px per item.
- Closes on route change.

### 4.3 No bottom tab bar

We do not use a bottom-tab bar in v1. Rationale:

- Bottom tabs imply mobile-first; we are not.
- Wallets and signing operations require visible context above the keyboard.
- The hamburger drawer covers the route set adequately.

If a future ADR justifies a bottom bar, it must include accessibility,
keyboard, and SafeArea analysis.

## 5. Casino Room on Mobile

Critical surface. Stacking order:

```text
GameHeader
  ↓
GameStage  (animated, can shrink to 60vh max)
  ↓
BetSlip    (sticky-bottom on scroll)
  ↓
ResultFeed (collapses to "View results" accordion)
  ↓
RiskCard
```

### 5.1 BetSlip sticky-bottom

On `< md`, the bet slip sticks to the bottom of the viewport with a thin
shadow `--elev-2`. The user always has the primary CTA visible.

Constraints:

- height ≤ 40 % of viewport
- safe-area-inset-bottom respected on iOS
- collapses to chip mode if the result feed is tapped

### 5.2 No fixed-height game stage

Game stages must adapt: dice scales to 60 vh max, roulette wheel to 70 vh
max, keno board to grid layout with horizontal-scroll-on-overflow.

## 6. Sportsbook on Mobile

- Market list rows stack vertically; outcome chips reflow into 2 columns.
- Market detail: outcomes appear above ticket slip (sticky-bottom slip again).
- Odds expiry countdown stays visible at all times.

## 7. Portfolio & Earn

- Tables convert to **stacked card view** on `< md` (handled by
  `<LedgerTable>` pattern).
- Stat strips wrap to 2 × N grid.
- Deposit / withdraw flows present as full-screen drawer rather than modal.

## 8. Ops on Mobile

Lower priority but must be functional. Stats stack; tables scroll
horizontally with sticky first column. No card view (operators expect data
density).

## 9. PWA

### 9.1 Manifest

```json
{
  "name": "ArbiGameFi",
  "short_name": "ArbiGameFi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#04060f",
  "theme_color": "#04060f",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 9.2 Install affordance

- No automatic install prompt.
- A subtle `Install app` row appears in the nav drawer when
  `beforeinstallprompt` event fires.
- Dismissible; remembers dismissal in `localStorage` for 30 days.

### 9.3 No service worker beyond Next.js defaults

We do not ship custom offline caching for v1. A future ADR may add an
"offline-first marketing" mode.

## 10. iOS / Safari Specifics

- Use `100dvh` instead of `100vh` for layouts that fill the viewport (avoid
  notch math).
- Test the bet-slip sticky-bottom on iOS Safari with the address-bar
  collapse/expand cycle.
- Use `inputmode="decimal"` on `<NumberInput>` for the iOS numeric keypad.
- Disable double-tap zoom on primary CTAs via `touch-action: manipulation`.
- Test `100vw` overflow with iOS scrollbar overlap.

## 11. Accessibility (mobile-specific)

- `viewport` meta: `width=device-width, initial-scale=1, viewport-fit=cover`.
  No `maximum-scale=1` (it blocks zoom).
- Don't disable pinch-to-zoom anywhere.
- Touch focus outlines must remain visible (don't `outline: none` without
  replacement).
- Voice-over labels match visual labels (no hidden CTAs).

## 12. Performance (mobile-specific)

| Metric                        | Target                                         |
| ----------------------------- | ---------------------------------------------- |
| LCP (p75 RUM mobile, slow 4G) | < 2.5 s                                        |
| INP (p75 RUM mobile)          | < 200 ms                                       |
| Initial JS per route (gz)     | ≤ 110 KB on mobile (lower than desktop budget) |
| Image weight per route        | ≤ 200 KB (LQIP + AVIF/WebP)                    |

Enforced by `../frontend/22-performance.md`.

## 13. Forbidden Patterns

- Hamburger menu coexisting with a visible desktop nav.
- Modals that don't fit the mobile viewport (always use full-screen drawer
  on `< sm`).
- Floating action buttons (FABs).
- Pull-to-refresh.
- Horizontal carousels for primary navigation.
- Charts with hover-only tooltips (must have tap fallback).
- Fixed-height iframes.
- Auto-play video / animation triggered by scroll.

## 14. How To Enforce

```bash
# Touch-target heuristic — uses computed CSS at build via critical lint
node scripts/check-touch-targets.mjs

# 100vh ban (in favor of 100dvh)
rg -nE "h-screen|100vh\\b" frontend/apps/web/src \
  | rg -v "// 100dvh-safe"

# inputmode set on number inputs
node scripts/check-inputmode.mjs

# no <meta name="viewport" content="maximum-scale=1">
rg -nE "maximum-scale=1" frontend/apps/web

# PWA manifest exists and is correct shape
node scripts/check-manifest.mjs
```

## 15. Migration

The current frontend has partial mobile support but inconsistent breakpoint
usage and several `100vh` instances. Rewrite is the opportunity to:

- consolidate to `100dvh`
- align breakpoints to the table in §2
- adopt sticky-bottom BetSlip
- add manifest icons (currently `apple-touch-icon.png` exists; `192/512`
  maskable icons must be generated)
- drop the prototype-only mobile layouts (`PrototypeGameLayout`, removed)

## 16. Glossary

| Term          | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| dvh           | Dynamic viewport height — accounts for iOS Safari URL bar |
| LQIP          | Low-quality image placeholder                             |
| PWA           | Progressive Web App                                       |
| Maskable icon | A PWA icon with safe-zone padding for adaptive shapes     |
| Touch target  | The hit area for a tap interaction                        |
