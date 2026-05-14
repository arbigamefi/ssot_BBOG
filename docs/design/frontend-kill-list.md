# Frontend Clean-Room Kill List

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `frontend-rewrite-blueprint.md`, `03-information-architecture.md`, `11-component-library.md` |
| Supersedes | ad-hoc frontend cleanup notes and legacy prototype-first route plans |

This is the physical inventory for the clean-room frontend rewrite. It decides
which files are deleted, rewritten, preserved, or kept only as routing boundary
glue. It does not authorize code changes by itself; it scopes Phase 1+ work.

## 1. Decision Labels

| Label             | Meaning                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| **Keep**          | File or package remains authoritative. No rewrite unless future proof fails.           |
| **Rewrite**       | Existing behavior may be reimplemented, but the file does not survive.                 |
| **Delete**        | Remove physically after its replacement or route boundary lands.                       |
| **Move**          | Preserve as non-production reference or sandbox artifact.                              |
| **Redirect**      | Keep only a route-boundary file that calls `redirect()`. No legacy component survives. |
| **Rebuild tests** | Keep the behavior being tested, but rewrite tests against the new architecture.        |

## 2. Hard Boundary

```text
Keep:    frontend/packages/ssot/**, deployments/**, protocol release artifacts
Rebuild: frontend/apps/web/src/{app,components,features}, frontend/packages/ui/src/{components,themes,styles}
```

The UI may be thrown away. The protocol adapter layer may not. `@ssot/ssot`
owns byte-level correctness against release manifests and golden vectors.

## 3. Keep: Protocol And Release Truth

| Path                                     | Decision | Reason                                                            |
| ---------------------------------------- | -------- | ----------------------------------------------------------------- |
| `frontend/packages/ssot/src/encoding/**` | Keep     | ABI-compatible params and stake encoding; golden-vector verified. |
| `frontend/packages/ssot/src/sdk/**`      | Keep     | Typed read/write boundary for contracts and tx pipeline.          |
| `frontend/packages/ssot/src/indexer/**`  | Keep     | Event reducers and facts store are protocol-facing, not visual.   |
| `frontend/packages/ssot/src/release/**`  | Keep     | Release manifest parser and embedded release wiring.              |
| `frontend/packages/ssot/src/abis/**`     | Keep     | Generated or release-derived ABI truth.                           |
| `frontend/packages/ssot/src/fixtures/**` | Keep     | Test fixtures for release and vector behavior.                    |
| `deployments/**`                         | Keep     | Contract-generated release artifacts; UI is consumer only.        |

## 4. Preserve Framework Infrastructure

| Path                                      | Decision        | Notes                                                                                  |
| ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `frontend/package.json`                   | Keep/adjust     | Keep pnpm workspace, scripts; add new CI scripts later.                                |
| `frontend/apps/web/package.json`          | Keep/adjust     | Keep Next, React, wagmi, viem, RainbowKit, TanStack Query, Sentry, Playwright, Vitest. |
| `frontend/apps/web/tailwind.config.ts`    | Rewrite imports | Continue consuming `@ssot/ui` preset, but preset moves to token source.                |
| `frontend/packages/ui/tailwind.config.ts` | Rewrite imports | Point at new token/preset files.                                                       |
| `frontend/apps/web/tsconfig.json`         | Keep/adjust     | Add aliases only if needed by rewrite.                                                 |
| `frontend/packages/ui/tsconfig.json`      | Keep/adjust     | Update paths after primitives/patterns split.                                          |
| `frontend/apps/web/public/**`             | Keep/augment    | Existing brand assets stay; add `textures/noise.svg` and OG assets.                    |
| `frontend/apps/web/src/workers/**`        | Keep/adjust     | Current bank/hub workers may be reused; imports move to new data layer.                |

## 5. Rewrite: App Routes

| Current path                                            | Target                                       | Decision                                                       |
| ------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `frontend/apps/web/src/app/page.tsx`                    | `app/(marketing)/page.tsx`                   | Rewrite from accepted concept and marketing sections.          |
| `frontend/apps/web/src/app/games/page.tsx`              | `app/(product)/casino/page.tsx`              | Rewrite casino directory.                                      |
| `frontend/apps/web/src/app/games/[slug]/page.tsx`       | `app/(product)/casino/[slug]/page.tsx`       | Rewrite route composer.                                        |
| `frontend/apps/web/src/app/games/[slug]/pageClient.tsx` | `features/casino/room/**` + modules          | Delete after replacement; no 2,030 LOC god component survives. |
| `frontend/apps/web/src/app/dice/page.tsx`               | `/casino/dice`                               | Redirect boundary only.                                        |
| `frontend/apps/web/src/app/dice/pageClient.tsx`         | `features/casino/modules/dice/**`            | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/cointoss/page.tsx`           | `/casino/cointoss`                           | Redirect boundary only.                                        |
| `frontend/apps/web/src/app/cointoss/pageClient.tsx`     | `features/casino/modules/cointoss/**`        | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/roulette/page.tsx`           | `/casino/roulette`                           | Redirect boundary only.                                        |
| `frontend/apps/web/src/app/roulette/pageClient.tsx`     | `features/casino/modules/roulette/**`        | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/keno/page.tsx`               | `/casino/keno`                               | Redirect boundary only.                                        |
| `frontend/apps/web/src/app/keno/pageClient.tsx`         | `features/casino/modules/keno/**`            | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/sportsbook/page.tsx`         | `app/(product)/sportsbook/page.tsx`          | Rewrite on SportsHub read model and feature gate.              |
| `frontend/apps/web/src/app/sportsbook/pageClient.tsx`   | `features/sportsbook/**`                     | Rewrite.                                                       |
| `frontend/apps/web/src/app/account/page.tsx`            | `/portfolio`                                 | Redirect boundary or delete after new route.                   |
| `frontend/apps/web/src/app/bets/page.tsx`               | `/portfolio/activity`                        | Redirect boundary or delete after new route.                   |
| `frontend/apps/web/src/app/bets/[betId]/page.tsx`       | `/portfolio/activity` detail route if needed | Rewrite or redirect after IA decision.                         |
| `frontend/apps/web/src/app/claims/page.tsx`             | `/portfolio/claims`                          | Redirect boundary.                                             |
| `frontend/apps/web/src/app/claims/pageClient.tsx`       | `features/portfolio/claims/**`               | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/referral/page.tsx`           | `/portfolio` tab                             | Redirect boundary.                                             |
| `frontend/apps/web/src/app/referral/pageClient.tsx`     | `features/portfolio/referral/**` if enabled  | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/invest/page.tsx`             | `/earn`                                      | Redirect boundary.                                             |
| `frontend/apps/web/src/app/liquidity/page.tsx`          | `/earn`                                      | Redirect boundary.                                             |
| `frontend/apps/web/src/app/liquidity/pageClient.tsx`    | `features/earn/**`                           | Rewrite/delete.                                                |
| `frontend/apps/web/src/app/ops/page.tsx`                | `app/(product)/ops/page.tsx`                 | Rewrite as dense ops control room.                             |
| `frontend/apps/web/src/app/privacy/page.tsx`            | `app/(legal)/legal/privacy/page.tsx`         | Rewrite in legal layout.                                       |
| `frontend/apps/web/src/app/terms/page.tsx`              | `app/(legal)/legal/terms/page.tsx`           | Rewrite in legal layout.                                       |
| `frontend/apps/web/src/app/disclaimer/page.tsx`         | `app/(legal)/legal/disclaimer/page.tsx`      | Rewrite in legal layout.                                       |
| `frontend/apps/web/src/app/layout.tsx`                  | root layout                                  | Rewrite to keep root provider-light.                           |
| `frontend/apps/web/src/app/error.tsx`                   | route error boundary                         | Rewrite using new error pattern.                               |
| `frontend/apps/web/src/app/global-error.tsx`            | global error boundary                        | Rewrite using new error pattern.                               |
| `frontend/apps/web/src/app/globals.css`                 | token import only                            | Rewrite.                                                       |

## 6. Move: Prototypes And Sandbox

| Current path                                                 | Target                                        | Decision                                                       |
| ------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------- |
| `frontend/apps/web/src/app/prototype/**`                     | `frontend/apps/web/src/sandbox/**`            | Move or delete after extracting useful concepts. Not routable. |
| `frontend/apps/web/src/app/prototype/components/**`          | `frontend/apps/web/src/sandbox/components/**` | Move only if still useful for design review.                   |
| `frontend/apps/web/src/components/PrototypeGameLayout.tsx`   | sandbox or delete                             | Not product code.                                              |
| `frontend/apps/web/src/components/PrototypeHeader.tsx`       | sandbox or delete                             | Not product code.                                              |
| `frontend/apps/web/src/app/prototype/FigmaCaptureScript.tsx` | sandbox tooling                               | Move if still used by design capture.                          |

## 7. Delete: Shell History

| Current path                                               | Target                                    | Decision                                   |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `frontend/apps/web/src/components/SiteChrome.tsx`          | `@ssot/ui/patterns/AppShell`              | Delete after new shell lands.              |
| `frontend/apps/web/src/components/AppShell.tsx`            | `@ssot/ui/patterns/AppShell`              | Replace; current wrapper does not survive. |
| `frontend/apps/web/src/components/TrustShell.tsx`          | `AppShell variant=\"product\"`            | Delete.                                    |
| `frontend/apps/web/src/components/ImmersiveGameLayout.tsx` | `CasinoRoom` layout                       | Delete.                                    |
| `frontend/apps/web/src/components/ShellSwitcher.tsx`       | none                                      | Delete.                                    |
| `frontend/apps/web/src/components/RoomHud.tsx`             | `CasinoRoomHeader`                        | Rewrite/delete.                            |
| `frontend/apps/web/src/components/LowerRoomTabs.tsx`       | `@ssot/ui/primitives/Tabs` + room pattern | Rewrite/delete.                            |
| `frontend/apps/web/src/components/HeroProofRibbon.tsx`     | `ReleaseProof` pattern                    | Rewrite/delete.                            |
| `frontend/apps/web/src/components/TrustStatsStrip.tsx`     | `StatStrip` pattern                       | Rewrite/delete.                            |
| `frontend/apps/web/src/components/TrustTableShell.tsx`     | `LedgerTable` pattern                     | Rewrite/delete.                            |
| `frontend/apps/web/src/components/SiteFooter.tsx`          | `AppShell` slot                           | Rewrite/delete.                            |

## 8. Rewrite: Feature Layer

| Current path                                | Target                                                         | Decision                                                         |
| ------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `frontend/apps/web/src/features/games/**`   | `features/casino/**`                                           | Rewrite into catalog/data/room/modules.                          |
| `frontend/apps/web/src/features/betting/**` | `features/casino/actions` + shared `@ssot/ui/patterns/BetSlip` | Rewrite; keep useful state-machine ideas only.                   |
| `frontend/apps/web/src/features/bets/**`    | `features/portfolio/data` + `features/casino/data`             | Rewrite view-model hooks.                                        |
| `frontend/apps/web/src/features/account/**` | `features/portfolio/data`                                      | Rewrite.                                                         |
| `frontend/apps/web/src/features/ops/**`     | `features/ops/data`                                            | Rewrite or adapt.                                                |
| `frontend/apps/web/src/features/tx/**`      | `features/*/actions` shared tx flow                            | Rewrite around `13-web3-ux.md`.                                  |
| `frontend/apps/web/src/ssot/**`             | `features/_shared/release` or app-shell providers              | Keep behavior, move/rename as needed.                            |
| `frontend/apps/web/src/app/providers/**`    | `apps/web/src/app-shell/**`                                    | Rewrite provider island; do not mount wallet providers globally. |

## 9. Rebuild: `@ssot/ui`

| Current path                                            | Target                                                   | Decision                                    |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| `frontend/packages/ui/src/themes/default.css`           | `src/tokens/arbi-dark.css` + `arbi-light.css`            | Replace.                                    |
| `frontend/packages/ui/src/themes/visual-system.ts`      | none                                                     | Delete.                                     |
| `frontend/packages/ui/src/themes/brand-example.css`     | none                                                     | Delete.                                     |
| `frontend/packages/ui/src/themes/theme.ts`              | token CSS + preset                                       | Delete.                                     |
| `frontend/packages/ui/src/themes/index.ts`              | token exports if needed                                  | Rewrite.                                    |
| `frontend/packages/ui/src/styles/globals.css`           | imports token CSS + minimal base                         | Rewrite; remove `--ag-*`.                   |
| `frontend/packages/ui/src/tailwind-preset.ts`           | `src/tokens/tailwind-preset.ts`                          | Rewrite.                                    |
| `frontend/packages/ui/src/components/ui/cyber-*`        | primitives/patterns                                      | Delete.                                     |
| `frontend/packages/ui/src/components/ui/button.tsx`     | `src/primitives/button.tsx`                              | Rewrite or move and retokenize.             |
| `frontend/packages/ui/src/components/ui/input.tsx`      | `src/primitives/input.tsx`                               | Rewrite or move and retokenize.             |
| `frontend/packages/ui/src/components/ui/data-table.tsx` | `src/primitives/table.tsx` + `patterns/ledger-table.tsx` | Rewrite.                                    |
| `frontend/packages/ui/src/components/protocol/**`       | `src/patterns/**` or `apps/web/src/features/**`          | Split by ownership; retokenize.             |
| `frontend/packages/ui/src/i18n/**`                      | app i18n per `21-i18n.md`                                | Delete or replace; current scaffold unused. |
| `frontend/packages/ui/src/stories/**`                   | new Storybook coverage                                   | Rewrite.                                    |
| `frontend/packages/ui/src/lib/utils.ts`                 | keep if generic                                          | Keep/adjust.                                |

## 10. Test Files

| Current path                                  | Decision                              |
| --------------------------------------------- | ------------------------------------- |
| `frontend/packages/ssot/src/**/*.test.ts`     | Keep.                                 |
| `frontend/apps/web/src/app/**/*.test.tsx`     | Rebuild against new routes.           |
| `frontend/apps/web/src/features/**/*.test.ts` | Rebuild where logic survives.         |
| `frontend/packages/ui/src/**/*.test.tsx`      | Rebuild for new primitives/patterns.  |
| `frontend/apps/web/src/smoke.test.ts`         | Rewrite to primary route smoke suite. |

## 11. Historical Docs

| Current path                | Decision                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| `frontend/docs/frontend/**` | Historical reference only. New SSOT is under `docs/design` and `docs/frontend`. |
| `docs/frontend/README.md`   | Keep. It remains the release-artifact contract.                                 |
| `docs/design/**`            | Active planning SSOT for clean-room rewrite.                                    |
| `docs/frontend/{20..32}.md` | Active engineering-quality SSOT for clean-room rewrite.                         |
| `frontend/CLAUDE.md`        | Active AI assistant runtime rules.                                              |

## 12. Don'ts

- Do not edit `frontend/packages/ssot/**` as part of UI cleanup.
- Do not keep old page components for compatibility.
- Do not move prototype files into production route groups.
- Do not delete tests for preserved protocol behavior.
- Do not create temporary duplicate shells while porting pages.
- Do not ship a half-tokenized UI package.

## 13. How To Enforce

```bash
# Protocol layer untouched by UI rewrite PRs
git diff --name-only origin/master...HEAD | rg '^frontend/packages/ssot/' && exit 1

# No prototype routes in production app
test ! -d frontend/apps/web/src/app/prototype

# No legacy token systems
rg -nE "visual-system|--ag-|cyber-" frontend/apps/web/src frontend/packages/ui/src

# No old shell names in production code
rg -nE "SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher" frontend/apps/web/src
```

Some commands are target-state checks. They become blocking CI after the
corresponding rewrite phase lands.
