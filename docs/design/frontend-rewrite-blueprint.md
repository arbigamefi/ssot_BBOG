# Frontend Rewrite Blueprint — Execution Playbook

| Owner | Frontend Lead |
| Status | Draft v2 — execution form, pending Gate A/B/C sign-off |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `10-design-tokens.md`, `11-component-library.md`, `03-information-architecture.md`, `04-page-blueprints.md`, the entire `../frontend/` Engineering SSOT |
| Supersedes | the v1 monolithic Rewrite Blueprint (file contents re-distributed across numbered SSOT docs) |

This is the **execution playbook** for the clean-room frontend rewrite. The
constitutional and specification content lives in the numbered SSOT
documents under [`./`](./) and [`../frontend/`](../frontend/). This file
sequences the work, lists the cutover steps, the deletion ledger, and the
quality gates between phases.

## 1. Non-Negotiables (from `00-charter.md §7`)

| #   | Rule                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------- |
| N1  | Single design-token source ([ADR-0003](./adr/0003-single-design-token-source.md))                                      |
| N2  | No per-game color family ([ADR-0001](./adr/0001-no-per-game-color-family.md))                                          |
| N3  | One `AppShell` with variants                                                                                           |
| N4  | No prototype routes in production App Router ([ADR-0002](./adr/0002-prototype-routes-out-of-production-app-router.md)) |
| N5  | No hex literal in product UI                                                                                           |
| N6  | No external decorative URLs                                                                                            |
| N7  | No god `pageClient.tsx` over 600 lines                                                                                 |
| N8  | Every CTA points to a real product route                                                                               |
| N9  | wagmi / viem / RainbowKit only in approved paths                                                                       |
| N10 | All txs simulate before signing                                                                                        |

CI enforces all 10. See [`../frontend/24-testing.md`](../frontend/24-testing.md) and
[`../frontend/32-ai-pairing.md`](../frontend/32-ai-pairing.md).

## 2. Gates

| Gate             | Closes when                                                                        | What it unlocks            |
| ---------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| **A — Identity** | Layer 0 + Layer 1 docs `Accepted` (Charter / Brand / Voice / IA / Page Blueprints) | UI design begins           |
| **B — System**   | Layer 2 docs `Accepted` + `@ssot/ui` rebuilt + Storybook coverage met              | Page implementation begins |
| **C — Quality**  | Layer 3 + Layer 4 docs `Accepted` + CI green + Sentry/RUM/analytics wired          | Public launch              |

No phase below crosses a gate that has not closed. Until those gates are
closed, this playbook is a Draft execution plan, not approval to rewrite
production pages.

## 3. Target Physical Architecture

```text
frontend/
├── CLAUDE.md                                   # AI-pairing runtime rules
├── packages/
│   └── ui/
│       └── src/
│           ├── tokens/                          # 10-design-tokens.md realization
│           │   ├── arbi-dark.css
│           │   ├── arbi-light.css
│           │   ├── tailwind-preset.ts
│           │   └── VERSION.md
│           ├── primitives/                      # 11-component-library.md §2
│           ├── patterns/                        # 11-component-library.md §4
│           ├── motion/                          # 12-motion.md §5
│           ├── icons/                           # 01-brand.md §5
│           ├── utils/
│           ├── styles/globals.css
│           └── index.ts
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── global-error.tsx
│           │   ├── error.tsx
│           │   ├── (marketing)/
│           │   │   └── page.tsx
│           │   ├── (product)/
│           │   │   ├── layout.tsx
│           │   │   ├── casino/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [slug]/page.tsx
│           │   │   ├── sportsbook/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [marketId]/page.tsx
│           │   │   ├── portfolio/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── activity/page.tsx
│           │   │   │   └── claims/page.tsx
│           │   │   ├── earn/page.tsx
│           │   │   └── ops/page.tsx
│           │   └── (legal)/
│           │       └── legal/
│           │           ├── privacy/page.tsx
│           │           ├── terms/page.tsx
│           │           └── disclaimer/page.tsx
│           ├── app-shell/
│           │   ├── ProductProviders.tsx
│           │   ├── WalletProviderIsland.tsx
│           │   ├── QueryProvider.tsx
│           │   └── ThemeProvider.tsx
│           ├── features/
│           │   ├── casino/
│           │   ├── sportsbook/
│           │   ├── portfolio/
│           │   ├── earn/
│           │   ├── ops/
│           │   └── _shared/
│           ├── i18n/                             # 21-i18n.md
│           ├── lib/
│           │   ├── analytics/                    # 25-observability.md
│           │   ├── format/
│           │   ├── routes/
│           │   ├── env/
│           │   └── storage/
│           ├── workers/
│           ├── sandbox/                          # 02 (replaces the old /prototype routes)
│           └── middleware.ts                    # ADR-0002 enforcement
└── pnpm-workspace.yaml
```

## 4. Logical Layers

1. **Protocol layer** — `@ssot/ssot` (SDK, indexer, release).
2. **Product data layer** — `apps/web/src/features/*/data` (TanStack Query hooks).
3. **Product action layer** — `apps/web/src/features/*/actions` (tx flow hooks).
4. **UI pattern layer** — `@ssot/ui/patterns`.
5. **Page composition layer** — `apps/web/src/app/.../page.tsx`.

Arrows flow downward. Pages never import wagmi/viem; patterns never
import features; primitives never import patterns. See
`docs/frontend/32-ai-pairing.md §5` for the boundary contract.

## 5. Server / Client Boundary

Default: React Server Components.

Client Component required only for: wallet, IndexedDB, bigint form inputs,
WebSocket subscriptions, animation, charts with browser APIs.

Providers (wagmi, RainbowKit, React Query, theme) mount in the **product
route group** (`(product)/layout.tsx`), not the root layout. Marketing
and legal pages skip the wallet provider entirely.

## 6. Delivery Sequence

Each phase is a **shippable increment**. Do not start phase N+1 until
phase N's quality gate passes.

### Phase 0 — Gate A (Identity)

- Land all Layer 0 + Layer 1 SSOT docs.
- Produce hi-fi concepts for every primary route (desktop + mobile).
- Land ADR-0001, ADR-0002, ADR-0003.

Exit when: docs `Accepted`, ADRs `Accepted`, concept package approved.

### Phase 1 — Token + Primitive Rebuild (Gate B start)

1. Implement `frontend/packages/ui/src/tokens/arbi-dark.css` + `arbi-light.css`.
2. Rewrite `tailwind-preset.ts` to consume the variables.
3. Rebuild primitives: Button, Input, NumberInput, Select, Tabs, Dialog,
   Drawer, Popover, Tooltip, Table, Skeleton, Toast, Badge, StatusDot,
   Progress, Alert, Separator.
4. Storybook 100% primitive coverage.
5. Visual regression baseline.

Exit when: primitives shipped, stories passing axe, ADR-0003 acceptance
criteria met.

### Phase 2 — Pattern Build

1. Implement patterns: AppShell, PageHeader, EmptyState, ErrorState,
   WalletGate, ReleaseProof, StatBlock, StatStrip, LedgerTable, FilterBar,
   CopyButton, AddressDisplay, AmountDisplay, TxStatusChip, TxStepper,
   BetSlip, TicketSlip, RiskPanel, AnimatedNumber.
2. Storybook ≥ 80% pattern coverage.
3. Mobile stories per pattern.

Exit when: patterns shipped, ≥ 80% Storybook coverage, visual baseline.

### Phase 3 — Route Skeleton (Gate B close)

1. Create `app/(marketing)`, `app/(product)`, `app/(legal)` route groups.
2. Implement `<AppShell variant>` per route group layout.
3. Wire `ProductProviders` island; ensure marketing has no wagmi bundle.
4. Implement `middleware.ts` blocking `/prototype/*`.
5. Add `apps/web/src/sandbox/` for design sandbox (ADR-0002).

Exit when: bundle budgets per route met
([`../frontend/22-performance.md §3`](../frontend/22-performance.md)),
route map matches [`03-information-architecture.md §3`](./03-information-architecture.md).

### Phase 4 — Marketing + Legal Pages

1. Implement `/` from the new patterns.
2. Implement `/legal/{privacy,terms,disclaimer}`.
3. Real-data reserve ticker; no mockLiveFeed.
4. Visual baseline and Lighthouse on home.

Exit when: Lighthouse ≥ 95 mobile / 98 desktop on `/`, every CTA points to
a live product route.

### Phase 5 — Casino Vertical

1. Implement `features/casino/` per
   [`04-page-blueprints.md §3`](./04-page-blueprints.md):
   - `data/useCasinoCatalog.ts`, `useCasinoBets.ts`
   - `room/CasinoRoom.tsx`, `CasinoBetRail.tsx`, `CasinoLedger.tsx`
   - `modules/registry.ts` + one module (Dice) end-to-end
2. Ship `/casino`, `/casino/dice`.
3. Add `/casino/cointoss`, `/casino/roulette`, `/casino/keno` by registering
   modules; no new central code per game.
4. Add `/casino/baccarat`, `/casino/plinko`, `/casino/sicbo`, `/casino/slots`
   the same way (per `v1.3` contract additions).

Exit when: all 8 games live, no `pageClient.tsx` over 600 lines, golden
vectors equality green.

### Phase 6 — Portfolio + Earn

1. Implement `features/portfolio/` and `features/earn/`.
2. Ship `/portfolio`, `/portfolio/activity`, `/portfolio/claims`, `/earn`.
3. Wire claim flows for XP buckets + refundCredit.
4. Wire LP deposit / withdraw with A4 check.

Exit when: portfolio and earn surfaces complete; redirects from
legacy routes live.

### Phase 7 — Sportsbook Vertical

1. Implement `features/sportsbook/` per
   [`04-page-blueprints.md §4`](./04-page-blueprints.md).
2. Ship `/sportsbook` (read-only initially; ticket placement behind ops gate).
3. EIP-712 odds signature panel, challenge / arbitration states.

Exit when: read flows live, ticket placement gated until ops approves,
audit `NEW-H1` mitigation surfaced (see contract audit
`docs/audit/FullAudit-2026-05.md`).

### Phase 8 — Ops Rebuild

1. Implement `/ops` per
   [`04-page-blueprints.md §9`](./04-page-blueprints.md).
2. Dense tables, severity strips, runbook links.

Exit when: control-room surfaces ready for production operators.

### Phase 9 — Deletion + Cutover (Gate C close)

Run the deletion ledger (§7) end-to-end.

Run the full quality matrix (§8). When all checks pass, launch.

## 7. Deletion Ledger

Run deletions in this order. Each row is one PR.

| #   | What                                                                                                                                                                                                          | From                      | When safe                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------- |
| D1  | `apps/web/src/app/prototype/**`                                                                                                                                                                               | App Router                | after Phase 3                |
| D2  | All `*Shell*.tsx` competing layouts (`SiteChrome`, `AppShell`, `TrustShell`, `ImmersiveGameLayout`, `PrototypeGameLayout`, `RoomHud`, `LowerRoomTabs`, `HeroProofRibbon`, `TrustStatsStrip`, `ShellSwitcher`) | components                | after Phase 3                |
| D3  | `frontend/packages/ui/src/themes/visual-system.ts`                                                                                                                                                            | `@ssot/ui`                | after Phase 1                |
| D4  | `frontend/packages/ui/src/themes/brand-example.css`                                                                                                                                                           | `@ssot/ui`                | after Phase 1                |
| D5  | `cyber-*` primitives (`cyber-button`, `cyber-input`, `cyber-table`, `cyber-header`, `cyber-icons`, `cyber-layout`, `cyber-slider`)                                                                            | `@ssot/ui/components/ui/` | after Phase 1                |
| D6  | `app/games/[slug]/pageClient.tsx` (2030 LOC)                                                                                                                                                                  | App Router                | after Phase 5                |
| D7  | Legacy `/dice`, `/cointoss`, `/roulette`, `/keno` page files                                                                                                                                                  | App Router                | after Phase 5 redirects land |
| D8  | Legacy `/account`, `/bets`, `/claims`, `/referral` page files                                                                                                                                                 | App Router                | after Phase 6                |
| D9  | Legacy `/invest`, `/liquidity` page files                                                                                                                                                                     | App Router                | after Phase 6                |
| D10 | External texture URLs (`grainy-gradients.vercel.app`)                                                                                                                                                         | grep + replace            | after Phase 1                |

Each deletion PR must include `rg` evidence (no remaining imports / usages).

## 8. Quality Matrix (final pre-launch)

```bash
# Tokens
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "rounded-(2xl|3xl|\\[)" frontend/apps/web/src frontend/packages/ui/src
rg -nE "transition-all|animate-(pulse|bounce|spin|ping)" frontend/apps/web/src
rg -nE "from .*visual-system" frontend/
rg -nE "--ag-" frontend/apps/web/src frontend/packages/ui/src

# Routes
test ! -d frontend/apps/web/src/app/prototype
node scripts/check-route-blueprints.mjs

# Imports
rg -nE "from 'wagmi'|from 'viem'|from '@rainbow" frontend/apps/web/src \
  | rg -v "app-shell/WalletProviderIsland|features/.*/data|features/.*/actions|@ssot/ui"

# Game client size
awk 'FNR==1{file=FILENAME} END{print FILENAME, NR}' frontend/apps/web/src/features/casino/room/*.tsx \
  | awk '{ if ($2 > 600) print "FAIL: " $1 " has " $2 " lines"; }'

# Tests, lint, types
pnpm typecheck
pnpm lint
pnpm test
pnpm test:contract

# Storybook coverage
node scripts/check-storybook-coverage.mjs

# Lighthouse / a11y / bundle / e2e
pnpm lighthouse:ci
pnpm e2e
pnpm e2e:a11y
node scripts/check-bundle-budget.mjs

# Security
gitleaks detect
pnpm audit --prod
node scripts/check-csp-headers.mjs

# Doc freshness
node scripts/check-doc-freshness.mjs
```

All must return zero violations / pass.

## 9. Rollback

The frontend has no database migrations. Rollback is a Vercel deployment
promotion: ≤ 5 minutes. Detailed steps in
[`../frontend/30-build-and-release.md §7`](../frontend/30-build-and-release.md).

## 10. Don'ts (carry-overs)

- Do not preserve historical component names "for compatibility" inside
  the new app code. Redirects belong at the routing boundary, not in
  components.
- Do not run two App Shells in parallel "during transition". The cutover
  happens in one PR.
- Do not start Phase N+1 if Phase N's quality gate isn't green.
- Do not delete a directory without rg-evidence of zero remaining imports.
- Do not bundle a deletion PR with new feature work.

## 11. Where The v1 Content Went

The v1 monolithic Blueprint (539 lines) discussed 15 topics. Their new
homes:

| v1 §                            | Now lives in                                          |
| ------------------------------- | ----------------------------------------------------- |
| §1 Rewrite Thesis               | `00-charter.md §2` + this file §0                     |
| §2 Non-Negotiables              | `00-charter.md §7` + this file §1                     |
| §3 Physical Architecture        | this file §3                                          |
| §4 Logical Architecture         | this file §4 + `14-data-and-state.md §1`              |
| §5 Server/Client                | this file §5 + `14-data-and-state.md §2`              |
| §6 Route & Product Model        | `03-information-architecture.md §3`                   |
| §7 UI/UX Concept Package        | `04-page-blueprints.md`                               |
| §8 Design System Build Order    | this file §6 (Phase 1-2)                              |
| §9 Casino Rebuild               | this file §6 (Phase 5) + `04-page-blueprints.md §3`   |
| §10 Sportsbook Rebuild          | this file §6 (Phase 7) + `04-page-blueprints.md §4`   |
| §11 Portfolio & Earn Rebuild    | this file §6 (Phase 6) + `04-page-blueprints.md §5-8` |
| §12 Ops Rebuild                 | this file §6 (Phase 8) + `04-page-blueprints.md §9`   |
| §13 Deletion & Cutover          | this file §7                                          |
| §14 Quality Gates               | this file §8 + `../frontend/24-testing.md`            |
| §15 Suggested Delivery Sequence | this file §6                                          |

The v1 file is preserved in git history. This v2 replaces it; do not
expand v2 with content that should live in a numbered SSOT doc.

## 12. References

- Charter [`00-charter.md`](./00-charter.md)
- IA [`03-information-architecture.md`](./03-information-architecture.md)
- Page Blueprints [`04-page-blueprints.md`](./04-page-blueprints.md)
- Tokens [`10-design-tokens.md`](./10-design-tokens.md)
- Components [`11-component-library.md`](./11-component-library.md)
- ADRs [`adr/`](./adr/)
- Engineering SSOT [`../frontend/INDEX.md`](../frontend/INDEX.md)
- AI runtime rules [`../../frontend/CLAUDE.md`](../../frontend/CLAUDE.md)
