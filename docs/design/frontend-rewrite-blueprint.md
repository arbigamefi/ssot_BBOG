# Frontend Rewrite Blueprint

Date: 2026-05-14

This document plans a clean-room rewrite of the ArbiGameFi frontend. The goal is
not to beautify the existing app in place. The goal is to rebuild the frontend
with a pure physical architecture, a coherent UI/UX system, and no product-code
dependency on prototype or compatibility leftovers.

The companion constitution is `docs/design/north-star.md`.

## 1. Rewrite Thesis

The current frontend accumulated several eras of work in the same routable and
component surface:

- production pages under `frontend/apps/web/src/app`
- prototype pages under the same app router
- multiple shell components in `frontend/apps/web/src/components`
- `cyber-*` and non-cyber primitives exported together from `@ssot/ui`
- shadcn-compatible tokens, `--ag-*` tokens, and `visual-system.ts`
- two casino room paths: the large `app/games/[slug]/pageClient.tsx` and the
  newer `features/games/room/CanonicalRoomPage.tsx`

The rewrite should keep the protocol and data correctness work, but should not
inherit the physical UI structure.

## 2. Non-Negotiables

Keep:

- release manifest consumption
- ABI and calldata encoding correctness
- embedded release and golden-vector expectations
- SSOT runtime/indexer model where it represents protocol truth
- wallet and transaction safety boundaries
- sportsbook feature gates and ops approval boundaries
- contract-driven game metadata and asset metadata

Delete or replace:

- `app/prototype/*` from production app code
- `visual-system.ts`
- `brand-example.css`
- `cyber-*` primitive duplicates
- shell history components that exist only to preserve old layouts
- page-local design systems
- direct page-local hex surfaces, arbitrary shadows, and arbitrary radii
- duplicated marketing/prototype pages
- inert placeholder pages linked from primary navigation

Do not carry compatibility into component internals. If public URL preservation
is needed, use explicit redirects at the app-routing boundary.

## 3. Target Physical Architecture

The rewritten frontend should make folder ownership obvious:

```text
frontend/
  packages/
    ui/
      src/
        tokens/
          theme.css
          tailwind.ts
        primitives/
          button.tsx
          input.tsx
          select.tsx
          tabs.tsx
          dialog.tsx
          table.tsx
        patterns/
          app-shell.tsx
          page-header.tsx
          stat-block.tsx
          ledger-table.tsx
          wallet-gate.tsx
          release-proof.tsx
          risk-panel.tsx
          bet-slip.tsx
        motion/
          presets.ts
        icons/
          index.ts
        styles/
          globals.css
        index.ts
    ssot/
      src/
        encoding/
        indexer/
        release/
        sdk/
  apps/
    web/
      src/
        app/
          layout.tsx
          global-error.tsx
          error.tsx
          (marketing)/
            page.tsx
          (product)/
            layout.tsx
            casino/
              page.tsx
              [slug]/page.tsx
            sportsbook/
              page.tsx
              [marketId]/page.tsx
            portfolio/
              page.tsx
              activity/page.tsx
              claims/page.tsx
            earn/
              page.tsx
            ops/
              page.tsx
          (legal)/
            legal/
              privacy/page.tsx
              terms/page.tsx
              disclaimer/page.tsx
        app-shell/
          ProductProviders.tsx
          WalletProviderIsland.tsx
        features/
          casino/
          sportsbook/
          portfolio/
          earn/
          ops/
          release/
        lib/
          format/
          routes/
          env/
        workers/
```

Rules:

- route groups separate marketing, product, and legal concerns
- product providers live under the product route group, not every static page
- feature folders own product-specific state, hooks, modules, and page sections
- shared UI package owns tokens, primitives, and reusable product patterns
- app code imports shared UI through explicit subpaths where practical

## 4. Target Logical Architecture

Use four layers:

1. Protocol layer: `@ssot/ssot`
   - release parsing
   - ABI resolution
   - golden-vector compatible encoding
   - indexer reducers
   - SDK transaction actions
2. Product data layer: `apps/web/src/features/*/data`
   - read-model hooks
   - query keys
   - view-model mapping
   - no visual styling
3. UI pattern layer: `@ssot/ui/patterns`
   - wallet gate
   - bet slip
   - release proof
   - risk panel
   - ledger table
   - stat strip
4. Page composition layer: `apps/web/src/app`
   - route metadata
   - server/client boundary
   - section composition
   - page-specific copy

Pages should not directly assemble wagmi calls, calldata encoding, indexer
reducers, or raw table styling. They compose feature view models and UI
patterns.

## 5. Server And Client Boundaries

Default to React Server Components for static and read-mostly surfaces.

Server component by default:

- marketing sections
- legal content
- product page shells
- route metadata
- static release descriptions
- empty/loading/error copy

Client component only when needed:

- wallet connection
- connected-account views
- transaction submit flows
- indexedDB-backed read models
- live indexer status
- interactive bet parameters
- sportsbook ticket placement
- charts that require browser APIs

Provider rules:

- the root layout should stay as small as possible
- wallet, wagmi, RainbowKit, and React Query provider setup should be isolated
  to product routes or a provider island
- feature code must not import RainbowKit directly
- feature code should consume typed SDK and data hooks

## 6. Route And Product Model

Final production routes:

```text
/
/casino
/casino/dice
/casino/cointoss
/casino/roulette
/casino/keno
/casino/plinko
/casino/sicbo
/casino/slots
/casino/baccarat
/sportsbook
/sportsbook/[marketId]
/portfolio
/portfolio/activity
/portfolio/claims
/earn
/ops
/legal/privacy
/legal/terms
/legal/disclaimer
```

Legacy route handling:

- `/dice`, `/cointoss`, `/roulette`, and `/keno` may redirect to
  `/casino/<slug>`.
- `/account` and `/bets` may redirect to portfolio routes.
- `/invest` and `/liquidity` may redirect to `/earn`.
- `/prototype/*` must not ship as production app routes.

Redirects are acceptable as boundary glue. They must not require legacy page
components, shells, or duplicated content.

## 7. UI/UX Concept Package

Before implementation, produce and approve a concept package for the whole
product, not just the homepage.

Required desktop concepts:

- marketing first viewport and downstream proof sections
- casino directory
- casino room with bet slip, result state, and ledger panel
- sportsbook market list and ticket placement
- portfolio overview and activity ledger
- earn/LP page
- ops/control-room page

Required mobile concepts:

- marketing first viewport
- casino room
- sportsbook ticket placement
- portfolio activity

The concept package must define:

- brand palette and token mapping
- type scale
- route-level layout grid
- shell/header behavior
- interaction states
- empty/loading/error states
- modal/drawer behavior
- table/list density
- mobile navigation
- icon style
- motion rules

Do not implement page UI before this package is accepted, except for small
architecture spikes that render no production route.

## 8. Design System Build Order

Build the shared design system before rebuilding pages:

1. tokens
   - surfaces
   - text
   - borders
   - brand/accent/semantic colors
   - radii
   - elevation
   - motion
   - typography
2. primitives
   - button
   - input
   - select
   - tabs
   - dialog/drawer
   - table
   - skeleton
   - tooltip
   - toast
3. product patterns
   - AppShell
   - WalletGate
   - BetSlip
   - TicketCard
   - LedgerTable
   - ReleaseProof
   - RiskPanel
   - StatBlock
   - EmptyState
4. feature modules
   - casino modules
   - sportsbook modules
   - portfolio modules
   - earn modules
   - ops modules

Each primitive must include:

- default
- hover
- active
- disabled
- loading
- focus-visible
- error where applicable
- compact and comfortable density where applicable

## 9. Casino Rebuild

The casino frontend should mirror `GameHub + IGameModule`.

Target feature layout:

```text
features/casino/
  data/
    useCasinoCatalog.ts
    useCasinoBets.ts
  room/
    CasinoRoom.tsx
    CasinoRoomHeader.tsx
    CasinoBetRail.tsx
    CasinoLedger.tsx
  modules/
    registry.ts
    dice/
    cointoss/
    roulette/
    keno/
    plinko/
    sicbo/
    slots/
    baccarat/
```

Module contract:

```ts
type CasinoGameModule = {
  slug: string;
  label: string;
  encodeParams(input: unknown): `0x${string}`;
  getDefaultInput(): unknown;
  getSummary(input: unknown): Array<{ label: string; value: string }>;
  InputPanel(props: ModuleInputProps): JSX.Element;
  ResultView(props: ModuleResultProps): JSX.Element;
};
```

Rules:

- no central page switch for every game interaction
- no per-game brand color family
- every module owns only game-specific input/result logic
- stake, asset, wallet, quote, submit, and ledger are shared

## 10. Sportsbook Rebuild

The sportsbook frontend should be built as a separate vertical over SportsHub,
not as a casino game.

Target feature layout:

```text
features/sportsbook/
  data/
    useSportsbookMarkets.ts
    useSportsbookTickets.ts
    useProviderStatus.ts
  markets/
    MarketList.tsx
    MarketFilters.tsx
    MarketRow.tsx
  ticket/
    SportsTicketSlip.tsx
    OddsSnapshotPanel.tsx
  risk/
    SportsRiskBanner.tsx
    BankrollCapsPanel.tsx
  settlement/
    ResultStatusPanel.tsx
```

Rules:

- odds and provider evidence must be visually inspectable
- fixed-odds MVP must show snapshot time and source
- public ticket placement remains gated by the ops go/no-go rule
- result and dispute states must be first-class UI states, not hidden text

## 11. Portfolio And Earn Rebuild

Portfolio replaces fragmented `/account`, `/bets`, `/claims`, and referral
surfaces.

Portfolio sections:

- account summary
- open positions / tickets
- activity ledger
- claims
- referral or affiliate state, if enabled

Earn replaces `/invest` and `/liquidity`.

Earn sections:

- Bank/LP overview
- NAV and reserve status
- deposit and withdraw actions
- pending withdrawal or debt-out state
- risk documentation
- release proof and address proof

Marketing must not link to these pages until the linked page has product-grade
content and state handling.

## 12. Ops Rebuild

Ops should be an operational control room, not a styled marketing page.

Required surfaces:

- release and chain snapshot
- indexer state
- provider readiness
- protocol caps
- recent events
- runbook links
- paused/gated states

Use dense tables, stat strips, and clear severity states. Avoid hero-scale
typography and decorative cards.

## 13. Deletion And Cutover Plan

Delete in this order:

1. duplicate prototype routes after concept decisions are extracted
2. duplicate shell components after the new AppShell lands
3. `visual-system.ts` after token aliases and primitives land
4. `cyber-*` primitives after replacements land
5. old route pages after redirects are added
6. old casino page after the module registry path is live
7. placeholder pages after portfolio, earn, and sportsbook routes are live

Deletion PRs must include `rg` evidence for removed imports. Do not leave dead
files in `src/` for "maybe later."

## 14. Quality Gates

Minimum checks for every rewrite PR:

```bash
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend/apps/web test
git diff --check
```

Design-system PRs also require:

```bash
pnpm -C frontend/packages/ui test
pnpm -C frontend storybook:build
```

Visual QA PRs require browser screenshots for:

- desktop
- mobile
- loading state
- empty state
- error or gated state

The rewrite is not complete until:

- `rg "app/prototype" frontend/apps/web/src` returns no production references
- `rg "visual-system" frontend` returns no references
- `rg "cyber-" frontend/apps/web/src frontend/packages/ui/src` returns no
  production component references
- `rg "#050505|#0a0a0a|#020202" frontend/apps/web/src frontend/packages/ui/src`
  returns no product UI usages
- `rg "grainy-gradients.vercel.app" frontend` returns no usages
- every primary route has loading, empty, error, and connected-wallet states

## 15. Suggested Delivery Sequence

1. approve this blueprint and the North Star constitution
2. produce the full UI/UX concept package
3. rebuild `@ssot/ui` tokens, primitives, and product patterns
4. build the new route skeleton with route groups and provider islands
5. rebuild marketing and legal routes
6. rebuild casino directory and one casino room module
7. port remaining casino modules through the registry contract
8. rebuild portfolio and earn
9. rebuild sportsbook read-only state, then ticket placement after ops approval
10. rebuild ops
11. delete old routes, shells, prototypes, cyber primitives, and visual-system
12. run full proof gates and browser visual QA

Do not start the full page rewrite before the concept package is accepted. The
largest risk is not implementation difficulty; it is rebuilding a second
inconsistent system because the visual language was not fixed first.
