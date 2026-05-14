# ArbiGameFi Frontend North Star

Date: 2026-05-14

This document is the frontend design-system SSOT for the current Next.js app and
shared `@ssot/ui` package. It turns the frontend audit into migration rules that
can be executed in small PRs without breaking sportsbook, casino, release, or
wallet flows.

## 1. Current Findings

The frontend currently has enough product surface to ship, but it lacks a single
design-system spine. The highest-impact problems are:

- Three design token systems coexist:
  - shadcn-compatible HSL tokens in
    `frontend/packages/ui/src/themes/default.css`
  - ad-hoc `--ag-*` variables and global classes in
    `frontend/packages/ui/src/styles/globals.css`
  - class-string tokens in
    `frontend/packages/ui/src/themes/visual-system.ts`
- Production routes and prototype routes share the same routable app surface.
- Product pages use hardcoded dark hex values, per-game color palettes, inline
  shadows, and many one-off radius values.
- The casino game client has grown into a multi-game page controller instead of
  a small shell plus per-game modules.
- Several shell/layout components represent historical design experiments
  instead of one product shell with variants.
- Some marketing promises point to placeholder pages, which damages trust more
  than a visually plain page would.

The conclusion is not "rewrite the frontend." The correct move is to establish
one token source, one shell model, one route taxonomy, and then migrate the
highest-traffic surfaces first.

## 2. Product Direction

The frontend should feel institutional, precise, and transparent. The closest
reference category is Polymarket, Hyperliquid, Linear, and Vercel Dashboard; not
arcade casino portals.

The product personality:

- dark by default, but not pure-black everywhere
- sparse accent usage
- data-forward panels over decorative cards
- predictable wallet, bet, ticket, and LP flows
- visual proof surfaces for release artifacts, contract addresses, and SSOT
  data
- casino and sportsbook presented as protocol verticals, not separate brands

## 3. Token Rules

### 3.1 Single Token Source

All color, radius, shadow, and focus styling must resolve to CSS variables
defined by `@ssot/ui`.

Allowed token homes:

- `frontend/packages/ui/src/themes/default.css` during the v3 Tailwind phase
- a future `arbi-dark.css` if the theme file is split for clarity
- Tailwind preset aliases generated from those CSS variables

Disallowed token homes:

- TypeScript objects that export Tailwind class strings as tokens
- page-local hex literals for surfaces or brand colors
- duplicated `--ag-*` and shadcn variables that represent the same concept
- external decorative URLs for noise or gradients

### 3.2 Color System

Keep one brand color, one accent color, and semantic colors only for state.

Suggested dark theme token set:

```css
:root {
  --surface-0: 220 39% 4%;
  --surface-1: 220 35% 7%;
  --surface-2: 220 30% 11%;
  --surface-3: 220 26% 16%;

  --fg: 210 40% 98%;
  --fg-muted: 215 16% 65%;
  --fg-subtle: 215 14% 45%;

  --border: 220 20% 18%;
  --border-soft: 220 14% 14%;

  --brand: 255 92% 66%;
  --brand-soft: 255 92% 66% / 0.12;
  --brand-ring: 255 92% 66% / 0.45;

  --accent: 170 84% 60%;

  --success: 145 65% 52%;
  --warn: 38 92% 60%;
  --danger: 0 84% 62%;
}
```

Rules:

- Use `--brand` for CTA, focus, selected tabs, links, and active progress.
- Use `--accent` only for live indicators, winning highlights, and key data
  emphasis.
- Use `--success`, `--warn`, and `--danger` only for semantic state.
- Do not assign a unique color family to each game. Differentiate games by
  icon, shape, copy, and interaction, not by competing palettes.

### 3.3 Surfaces

Replace repeated dark hex literals with semantic surfaces:

- page background: `surface-0`
- raised app shell: `surface-1`
- cards and panels: `surface-2`
- hover and active fill: `surface-3`

After Phase 1, these literals should not exist in product UI:

- `#050505`
- `#0a0a0a`
- `#020202`
- ad-hoc near-black variants used as panel backgrounds

### 3.4 Radius

Use four radius levels:

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
}
```

Mapping:

- `sm`: inputs, buttons, compact table cells
- `md`: small panels, list items, menu surfaces
- `lg`: major cards and side panels
- `xl`: hero-scale composed surfaces only

Avoid page-local arbitrary radius values such as `rounded-[2rem]` unless a
component has a documented exception.

### 3.5 Elevation

Use elevation tokens instead of inline arbitrary shadows.

Suggested levels:

```css
:root {
  --elev-1: 0 1px 2px rgb(0 0 0 / 0.4);
  --elev-2: 0 4px 16px rgb(0 0 0 / 0.35), 0 1px 2px rgb(0 0 0 / 0.4);
  --elev-3: 0 12px 32px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.4);
  --elev-glow:
    0 0 0 1px hsl(var(--brand-ring)), 0 8px 32px hsl(var(--brand) / 0.18);
}
```

Shadows describe hierarchy. They are not a substitute for layout or color.

### 3.6 Typography

Use a small, stable type system:

- sans: `Inter` or `Geist Sans`
- mono: `JetBrains Mono`
- no more than eight text roles:
  - display-xl
  - display-lg
  - display-md
  - title-lg
  - title-md
  - body
  - caption
  - mono

Hero-scale type belongs only on marketing or first-screen product entrypoints.
Panels, tables, bet tickets, and dashboards should use compact title and body
roles.

### 3.7 Motion

Motion should feel functional and restrained.

Rules:

- Avoid repeated `transition-all` and `hover:scale-105` scatter.
- Define shared motion presets for fade, slide, press, and number transition.
- Respect `prefers-reduced-motion`.
- Animate state changes and route transitions, not every decorative element.

### 3.8 Icons

Use one icon language for product UI. Heroicons may stay while the app already
uses them, but custom SVG icon families and page-local icon systems should be
consolidated behind shared components.

## 4. Route Taxonomy

Production app routes should describe product areas, not the design-history of
the app.

Target taxonomy:

```text
app/
  page.tsx
  casino/[slug]/page.tsx
  sportsbook/page.tsx
  sportsbook/[marketId]/page.tsx
  portfolio/page.tsx
  portfolio/activity/page.tsx
  portfolio/claims/page.tsx
  earn/page.tsx
  ops/page.tsx
  legal/privacy/page.tsx
  legal/terms/page.tsx
  legal/disclaimer/page.tsx
```

Migration rules:

- Old game aliases such as `/dice`, `/roulette`, `/cointoss`, and `/keno`
  should redirect to `/casino/<slug>`.
- Prototype routes should leave the production app router or be gated from
  production indexing and navigation.
- Placeholder pages must either become real product pages or be removed from
  primary navigation and marketing CTAs.

## 5. Shell Model

The target state is one app shell with variants:

```tsx
type AppShellVariant = "marketing" | "default" | "game" | "compact";
```

The shell owns:

- global page background
- header/nav
- wallet connect placement
- route-level width constraints
- footer or legal links
- focus and skip-link behavior

Page-specific components should not re-create global chrome, background layers,
or navigation.

## 6. Casino Game Architecture

The frontend should mirror the contract architecture: one `GameHub` path with
per-game modules.

Target layout:

```text
features/game/
  GameRoom.tsx
  BetPanel.tsx
  ResultFeed.tsx
  registry.ts
  modules/
    DiceModule.tsx
    CoinTossModule.tsx
    RouletteModule.tsx
    KenoModule.tsx
    BaccaratModule.tsx
    PlinkoModule.tsx
    SicBoModule.tsx
    SlotsModule.tsx
```

Ownership:

- `GameRoom` owns wallet, asset, stake, VRF quote, submit state, and shared
  status surfaces.
- each game module owns parameter inputs, params encoding, odds view, and
  result presentation for exactly one game.
- `registry.ts` is the only place where slugs map to modules.

New games should add one module and one registry entry. They should not expand a
central page switch indefinitely.

## 7. Migration Plan

### Phase 0: Guardrail Document

Land this document and link it from the docs index. This creates the shared
decision record before touching high-blast-radius UI files.

Acceptance:

- `docs/design/north-star.md` exists.
- `docs/README.md` links to it.
- no runtime code changes.

### Phase 1: Visual Stop-Loss

Goal: reduce inconsistency without changing app behavior.

Tasks:

- add the final surface, foreground, brand, accent, radius, and elevation CSS
  variables in `@ssot/ui`
- map Tailwind aliases to those variables
- replace repeated dark background literals with surface aliases
- replace external decorative noise URLs with a local asset
- mark `visual-system.ts` and `cyber-*` components as deprecated before
  deletion
- gate or move prototype routes away from production navigation and indexing
- normalize global body background to one controlled layer

Do not combine Phase 1 with a Tailwind major upgrade.

Acceptance:

```bash
rg "#050505|#0a0a0a|#020202" frontend/apps/web/src frontend/packages/ui/src
rg "grainy-gradients.vercel.app" frontend/apps/web/src frontend/packages/ui/src
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
```

The two `rg` commands should return no product UI usages after the migration.

### Phase 2: Product Structure

Goal: one shell, one game framework, fewer routable promises.

Tasks:

- converge shell components into `AppShell` variants
- split the casino game page into `GameRoom`, shared panels, and modules
- redirect old game aliases to `/casino/<slug>`
- consolidate `/account`, `/bets`, `/claims`, and `/referral` into portfolio
  surfaces
- consolidate `/invest` and `/liquidity` into an `earn` surface
- turn `/sportsbook` from a placeholder/control room into the approved
  product-gated sportsbook entrypoint only after ops approval

Acceptance:

- no prototype route appears in the production sitemap
- the casino room entrypoint loads only the active game module
- home CTAs all point to real pages with product content
- typecheck and app build pass

### Phase 3: Experience Quality

Goal: make the product feel finished.

Tasks:

- add shared motion presets
- add animated numbers for protocol and bet metrics
- add visual regression coverage for home, casino, sportsbook, portfolio, earn,
  and ops
- add axe checks for keyboard and contrast regressions
- consider Tailwind v4 only after Phase 1 and Phase 2 are stable

Acceptance:

- Storybook builds
- visual regression baseline exists for primary pages
- keyboard focus is visible and consistent
- text contrast meets WCAG AA for normal product text

## 8. PR Sizing

Recommended PR boundaries:

1. design north-star docs only
2. token alias addition with no page rewrites
3. hardcoded dark surface replacement
4. local noise asset and global background simplification
5. prototype route gating
6. shell consolidation
7. casino game-room decomposition
8. portfolio and earn route consolidation

Avoid mixing token deletion, route moves, and game client refactors in one PR.
That would make review and rollback harder than necessary.

## 9. Definition Of Done

A frontend PR that claims to follow this document should state:

- which phase it belongs to
- which routes changed
- whether any public URLs changed
- whether any wallet, bet, or release-artifact path changed
- proof commands run
- known exceptions to token, radius, or color rules

Minimum proof for visual-system work:

```bash
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
git diff --check
```

For route or interactive UI work, add browser verification of the changed
routes.
