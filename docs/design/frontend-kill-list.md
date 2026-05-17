# Frontend Cleanup Inventory

| Owner | Frontend Lead |
| Status | Active reference |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-implementation-roadmap.md` |
| Supersedes | clean-room physical inventory and legacy prototype-first route plans |

This file is no longer a rewrite ledger. It is a short inventory for deciding
whether a cleanup is still valid under the current lean B2C frontend strategy.
Execution order remains in
[`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md).

## Keep Boundaries

Do not collapse these only to reduce file or package count:

| Boundary | Why it stays |
| --- | --- |
| `frontend/packages/ssot/**` | Contract-facing SDK, encoding, release manifests, generated ABI surfaces, and golden-vector tests. |
| `frontend/packages/bet-index/**` | Shared durable bet read model used by web API routes and keeper. |
| `frontend/apps/keeper/**` | Separate runtime for automatic casino settlement and durable feed backfill. |
| `deployments/**` | Contract-generated release artifacts and verification materials. |
| `docs/frontend/{21,23,24,30}-*.md` | Launch requirements for i18n, security, testing, and release operations. |

## Already Removed

These should not reappear in production code:

| Area | Current expectation |
| --- | --- |
| Prototype routes | No `frontend/apps/web/src/app/prototype`. |
| Legacy casino aliases | No `/dice`, `/cointoss`, `/roulette`, `/keno` App Router pages. |
| Placeholder product routes | `/invest`, `/liquidity`, `/claims`, `/referral`, `/account`, `/bets` should not return as production pages. |
| Old shell history | No `SiteChrome`, `TrustShell`, `ImmersiveGameLayout`, `PrototypeGameLayout`, or `ShellSwitcher` in product code. |
| Old token systems | No `visual-system.ts`, `--ag-*`, hard-coded product UI hex, or `cyber-*` UI components. |
| Public keeper health files | No `apps/web/public/ops/casino-keeper-health.json`; health is served by a route from `.runtime`. |

## Cleanup Still Allowed

Only apply when the file has a single owner and the move improves readability:

- move module-private UI from `features/casino/room` into
  `features/casino/modules/<slug>`;
- fold tiny one-use wrapper components into their direct owner;
- remove stale docs that are fully superseded by an ADR, test, or the active
  roadmap;
- remove stale generated files that are not release artifacts.

Do not use this list to justify deleting runtime boundaries or launch-required
docs.

## Current Checks

```bash
test ! -d frontend/apps/web/src/app/prototype
rg -n "prototype|compat|legacy|visual-system|cyber-" frontend/apps/web/src frontend/packages
rg -nE "SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher" frontend/apps/web/src
find frontend/apps/web/public -path '*ops*' -maxdepth 5 -print
```

All target-state checks are expected to be empty unless a future ADR explicitly
changes the frontend architecture.
