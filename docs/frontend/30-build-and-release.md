# 30 · Build, CI & Release

| Owner | Frontend Lead + SRE |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `23-security.md`, `24-testing.md`, `25-observability.md` |
| Supersedes | Draft v1 exhaustive release platform spec |

Build and release rules should make the product reproducible without turning
every PR into a ceremony.

## 1. Runtime

| Concern            | Current choice                     |
| ------------------ | ---------------------------------- |
| Node               | `24.x`                             |
| pnpm               | `9.x`                              |
| Framework          | Next.js 15 App Router              |
| Contracts          | Foundry                            |
| Frontend workspace | `frontend/`                        |
| Durable bet index  | Postgres, local via Docker Compose |

Use the versions declared in root `package.json` and `frontend/package.json`.

## 2. Main Commands

Repository-level:

```bash
pnpm setup
pnpm check
pnpm frontend:dev
pnpm frontend:dev:with-keeper
pnpm frontend:build
pnpm frontend:test:strict
```

Frontend-level:

```bash
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend test:strict
pnpm -C frontend build
pnpm -C frontend check:release
pnpm -C frontend check:bundle
```

Bet-index local Postgres:

```bash
pnpm -C frontend bet-index:db:up
pnpm -C frontend bet-index:db:ps
pnpm -C frontend bet-index:db:logs
pnpm -C frontend bet-index:db:down
```

## 3. CI Shape

Current CI should cover:

- contracts build/test/lint/release checks;
- frontend lint/typecheck/test/test:strict/build;
- bundle budget regression;
- release artifact consistency;
- secret scanning where configured.

UI-heavy PRs should also run Playwright or browser smoke checks. Nightly jobs
can run heavier e2e and preview checks.

## 4. Release Pairing

Frontend releases are paired to contract release artifacts:

- embedded release manifest;
- golden vectors;
- chain deployment manifest;
- release digest.

The frontend must not infer deployment addresses, game ids, token decimals, or
asset metadata when release metadata exists.

## 5. Environment Rules

Public env vars are browser-visible. Keep secrets server-side.

Important public values:

- default chain id;
- public RPC fallback;
- release digest;
- build SHA;
- Sentry DSN;
- WalletConnect project id.

Important private values:

- keeper private key;
- database URL;
- The Odds API key;
- managed RPC/admin keys;
- Sentry auth token.

## 6. Deployment

Before a production deployment:

1. Sync latest contract release artifacts.
2. Run frontend release checks.
3. Run strict frontend tests.
4. Build with the intended environment.
5. Smoke key routes after deployment:
   - `/`;
   - `/casino/dice`;
   - `/sportsbook`;
   - `/portfolio`;
   - `/ops`.
6. Verify keeper and bet-index health if casino is enabled.

## 7. Rollback

Rollback should be operationally simple:

1. Promote the last known-good frontend deployment.
2. Confirm release digest and build SHA.
3. Check `/ops` health and Sentry.
4. Document what changed and what will be fixed forward.

Frontend rollback does not change contract state.

## 8. Feature Flags

Use environment flags for coarse gates:

- sportsbook public access;
- casino keeper UI affordances;
- bet-index read/write enablement;
- experimental games.

Do not ship complex flag platforms until real operations require them.

## 9. Do Not Do

- Do not deploy with dirty generated release artifacts.
- Do not put secrets in `NEXT_PUBLIC_*`.
- Do not skip strict vectors after contract release changes.
- Do not require Docker for normal frontend-only development.
- Do not make Postgres required for keeper settlement.
- Do not release if result receipts depend on recent-feed indexing.

## 10. Verification

```bash
pnpm check
pnpm -C frontend check:release
pnpm -C frontend test:strict
pnpm -C frontend build
pnpm -C frontend check:bundle
```
