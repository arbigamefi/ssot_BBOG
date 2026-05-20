# 24 · Testing Strategy

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `20-accessibility.md`, `22-performance.md`, `23-security.md` |
| Supersedes | Draft v1 exhaustive testing spec |

Testing protects money-moving flows, release metadata, and user trust. It should
match current scripts instead of describing a future CI stack that does not
exist yet.

## 1. Required Local Gates

Before merging frontend runtime changes:

```bash
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend test:strict
pnpm -C frontend build
```

Docs-only changes can use format/diff checks unless they modify commands,
runbooks, or release contracts.

## 2. What To Test

| Area              | Required coverage                                                             |
| ----------------- | ----------------------------------------------------------------------------- |
| `@ssot/ssot`      | release parsing, encoders, SDK reads/writes, golden vectors                   |
| `@ssot/bet-index` | schema, folding, recent/player queries, idempotent writes                     |
| `apps/keeper`     | queue, scan, state guard, finalizer, health writes                            |
| `apps/web`        | route APIs, casino round state, receipt readback, i18n keys, feature UI logic |
| UI smoke          | browser check when layout or interaction changes                              |

Do not add tests only to satisfy a coverage percentage. Add tests where the
failure would affect money, settlement, release metadata, or primary UX.

## 3. Casino Flow

Casino tests must keep these guarantees covered:

- amount parsing is bigint-safe;
- approval precedes `placeBet` when needed;
- active round polling handles missing bet, waiting, random ready, settled, and
  refundable paths;
- terminal receipt is based on direct chain read or terminal logs;
- raw RPC/viem errors do not render in player UI.

## 4. Bet Index And Keeper

Bet-index and keeper tests cover:

- event folding is idempotent;
- Postgres writes are optional and never block settlement;
- API routes degrade to RPC fallback;
- health snapshots do not conflict with routable API paths;
- keeper checks state before finalizing.

## 5. E2E And Browser QA

Run Playwright/browser QA when changes touch:

- wallet or transaction flow;
- casino room layout;
- result modal or receipt proof;
- sportsbook ticket placement;
- i18n routing or copy;
- mobile layout.

Use:

```bash
pnpm -C frontend e2e
```

For local visual debugging, use the browser against the running dev server.

## 6. Fixtures

Use realistic chain ids, addresses, game ids, bigint amounts, and release
metadata. Avoid random inline values unless the test is specifically about
validation rejection.

Golden vectors and embedded release manifests are contract-facing artifacts.
Do not hand-edit them to make a frontend test pass.

## 7. Do Not Do

- Do not use real private keys in tests.
- Do not hit paid or production RPC endpoints in CI without explicit reason.
- Do not snapshot large HTML trees.
- Do not leave `it.skip` or `it.only` in committed tests.
- Do not hide failing i18n or release checks behind mock copy.
- Do not rely on recent-feed index data for final casino result tests.

## 8. Verification

```bash
pnpm -C frontend format:check
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend test:strict
pnpm -C frontend build
pnpm -C frontend check:bundle
```
