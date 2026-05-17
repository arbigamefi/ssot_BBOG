# Frontend Rewrite Blueprint — Slim Architecture Reference

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-implementation-roadmap.md` |
| Supersedes | clean-room Gate A/B/C execution playbook |

This file is no longer a gate-driven rewrite plan. The clean-room rewrite has
already cut over. This document now records the surviving architecture,
boundaries, deletion principles, and verification commands.

For current sequencing, use
[`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md).

## 1. Fullstack Boundary

ArbiGameFi is a B2C casino/sportsbook product on a protocol-grade settlement
kernel.

Frontend work must optimize for:

1. player conversion and clarity;
2. LP and portfolio trust;
3. keeper and settlement operations;
4. multilingual launch;
5. contract-release correctness.

It must not optimize for unvalidated white-label or third-party operator
workflows.

## 2. Runtime Boundaries To Keep

| Boundary                      | Keep because                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `frontend/packages/ssot`      | Owns contract-facing release, SDK, encoding, and indexer helpers. It prevents UI code from guessing contract truth. |
| `frontend/apps/keeper`        | Owns automatic casino finalization and health snapshots outside the browser runtime.                                |
| `frontend/packages/bet-index` | Shared durable Postgres read-model used by both web API routes and keeper/backfill.                                 |
| `frontend/apps/web`           | Owns the B2C product UI, API routes, i18n, and browser state.                                                       |
| `frontend/packages/ui`        | Can be reconsidered later, but only after runtime correctness and i18n are stable.                                  |

Do not collapse a boundary merely to reduce package count. Collapse only when
there is one consumer and no runtime, release, or test seam.

## 3. Current Product Route Shape

```text
apps/web/src/app/
├── (marketing)/page.tsx
├── (product)/
│   ├── casino/page.tsx
│   ├── casino/[slug]/page.tsx
│   ├── sportsbook/page.tsx
│   ├── sportsbook/[marketId]/page.tsx
│   ├── portfolio/page.tsx
│   ├── portfolio/activity/page.tsx
│   ├── portfolio/activity/[betId]/page.tsx
│   ├── portfolio/claims/page.tsx
│   ├── earn/page.tsx
│   └── ops/page.tsx
├── (legal)/legal/{privacy,terms,disclaimer}/page.tsx
├── api/bets/recent/route.ts
├── api/bets/player/[address]/route.ts
├── api/sportsbook/odds-snapshot/route.ts
└── ops/casino-keeper-health.json/route.ts
```

Prototype routes and one-line compatibility pages should stay out of the
production App Router.

## 4. Feature Boundaries

| Feature               | Owns                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `features/casino`     | room UX, module stages, placeBet orchestration, round watcher, result receipt, casino audit ledger. |
| `features/sportsbook` | market list/detail, odds snapshot request, ticket placement, result and challenge UI.               |
| `features/portfolio`  | balances, player activity, bet detail, claims, player-scoped history.                               |
| `features/earn`       | LP-facing bankroll and deposit/withdraw surfaces.                                                   |
| `features/ops`        | keeper health, release status, operations surfaces.                                                 |
| `server/betting`      | API read aggregation from durable index and chain fallback.                                         |

Pages compose features. Features may consume `@ssot/ssot`. Shared UI should not
import feature code.

## 5. Product Rules That Survived The Rewrite

- One design-token source.
- No per-game brand color family.
- No hard-coded product UI hex literals.
- No production prototype routes.
- No god `pageClient.tsx` files.
- No raw RPC/viem/server errors as user-facing product copy.
- All user transactions must simulate or plan before broadcast.
- Result receipts must show chain-derived facts, not simulations as proof.
- Normal casino path should be `approve? -> placeBet -> VRF -> keeper finalize
-> result receipt` without asking the player to manually settle.

## 6. Deletion / Cleanup Rules

Safe cleanup candidates:

- one-consumer wrapper files;
- historical compatibility files no longer referenced;
- stale docs that duplicate accepted ADRs or the active roadmap;
- UI helpers that only forward props without owning behavior.

Do not delete:

- contract-release parsing;
- golden-vector encoding tests;
- keeper runtime and health route;
- durable index schema/store code;
- i18n/security/testing/release docs that are still launch requirements.

Every deletion should include `rg` evidence of zero production imports.

## 7. Standard Verification

Use this local gate for frontend changes:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

For changes that affect shared packages or keeper:

```bash
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
```

After `pnpm -C frontend/apps/web build`, restore
`frontend/apps/web/next-env.d.ts` to reference `.next-dev/types/routes.d.ts`
before committing.

## 8. Targeted Verification

Casino round:

```bash
pnpm -C frontend/apps/web test -- \
  src/features/casino/room/casino-round.test.ts \
  src/features/casino/room/resolution.test.ts \
  src/app/\(product\)/casino/\[slug\]/pageClient.test.tsx
```

Keeper:

```bash
pnpm -C frontend/apps/keeper test
pnpm -C frontend dev:with-keeper -- --port 3002
```

Bet index/API:

```bash
pnpm -C frontend/apps/web test -- \
  src/app/api/bets/recent/route.test.ts \
  src/app/api/bets/player/\[address\]/route.test.ts \
  src/server/betting/recent-bets.test.ts
```

## 9. References

- Strategy:
  [`../strategy/fullstack-product-architecture.md`](../strategy/fullstack-product-architecture.md)
- Current roadmap:
  [`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md)
- Casino UX:
  [`casino-placebet-ux.md`](./casino-placebet-ux.md)
- Indexing:
  [`indexing-strategy.md`](./indexing-strategy.md),
  [`durable-bet-index.md`](./durable-bet-index.md)
- Frontend release artifacts:
  [`../frontend/README.md`](../frontend/README.md)
