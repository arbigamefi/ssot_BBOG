# Base mainnet v1.3 readiness packet

Status: **NO-GO until every approval row below is linked and every command is green**

This packet prepares a Base mainnet v1.3 deployment review. It is not broadcast authorization. It
exists to keep the B2C casino launch path explicit while preventing SportsHub public risk-in from
slipping past the controls already defined in `docs/ops/sportsbook-production-controls.md` and
`docs/ops/sportsbook-phase2-gonogo-2026-05-14.md`.

## Scope

In scope:

- Base mainnet chain id `8453`.
- v1.3 router/pool topology: `Bank -> SettlementRouter -> GameHub / SportsHub`.
- Two USDC pools by default: pool `1` for Casino and pool `2` for Sports.
- Mainnet release artifacts, frontend embedded release, keeper readiness, and Postgres-backed bet
  index readiness.

Out of scope:

- Broadcasting a deployment.
- Opening public sportsbook risk-in.
- Changing audited v1.3 contract behavior.

## Decision gates

| Area | Required state | Decision |
| --- | --- | --- |
| Casino contracts | Fresh Base mainnet v1.3 deploy, release lock, frontend sync, keeper primary+backup ready | Pending |
| Casino public play | Small-stake canary passes from wallet approve/placeBet through VRF, keeper finalize, terminal receipt | Pending |
| Sports contracts | May be deployed as part of the v1.3 topology only if env/risk/role values are approved | Pending |
| Sports public risk-in | `make sports-phase2-gonogo-v13` records GO and every linked approval is current | **NO-GO** |
| Frontend | Embedded `chain-8453.json` passes release check and read-only smoke | Pending |
| Operations | Keeper, Postgres bet index, alerts, and rollback owners are assigned | Pending |

## Environment template

For a Casino+Sports topology review, start from:

```bash
cp docs/deploy/base-mainnet-v13.env.example .env.base-mainnet-v13
```

For a casino-only launch review, start from:

```bash
cp docs/deploy/base-mainnet-v13-casino.env.example .env.base-mainnet-v13-casino
```

Fill all placeholders from the approved deployment packet. Do not copy Base Sepolia role hashes,
role addresses, bankroll caps, or deployer keys.

The template repeats defaults such as referral budgets and bank thresholds intentionally. Mainnet
reviewers should approve those values explicitly instead of relying on script defaults.

## Pre-broadcast command order

Run these commands before any `--broadcast` invocation for the Casino+Sports topology:

```bash
bash script/ci/install_deps.sh
make sports-phase0-readiness
ENV_FILE=.env.base-mainnet-v13 make sports-mainnet-preflight-v13
make sports-phase2-gonogo-v13
pnpm -C frontend keeper:build
pnpm -C frontend/apps/keeper test
```

Notes:

- `sports-mainnet-preflight-v13` checks the RPC chain id, `GOV`/`PRIVATE_KEY` match, VRF wrapper
  bytecode, every pool asset bytecode, Sports raw caps, role-set hashes, and role addresses.
- For Base mainnet `8453`, the preflight also requires the canonical Chainlink VRF v2.5 wrapper and
  canonical Circle USDC address recorded in the env template. Re-check both official tables on
  deploy day before broadcast.
- Both mainnet preflight paths require `LP_DECIMALS_i` to match the ERC20 `decimals()` value read
  from `POOL_ASSET_i`, preventing USDC-style 6-decimal assets from being deployed with an 18-decimal
  LP/release mismatch.
- `sports-phase2-gonogo-v13` is expected to remain NO-GO until the sportsbook production packet is
  formally updated. A failing/no-go result blocks public sportsbook entrypoints and SportsHub market
  risk-in; it does not by itself block a casino-only launch review.
- If the deployment plan is casino-only, use a separate casino-only env and deployment review. Do
  not leave a half-approved Sports pool in a public mainnet env.

For a casino-only launch review, replace the topology preflight with:

```bash
ENV_FILE=.env.base-mainnet-v13-casino make casino-mainnet-preflight-v13
make casino-frontend-access-check-v13
```

Do not run `DeployV13` with `NUM_POOLS=2` unless the Sports pool values are approved for the
deployment record; a deployed Sports pool must still remain closed to public risk-in until Phase 2
records GO.

## Broadcast and release lock

Broadcast only after the pre-broadcast gates are reviewed:

Casino-only launch review:

```bash
source .env.base-mainnet-v13-casino
FOUNDRY_PROFILE=default forge script script/DeployV13.s.sol:DeployV13 --rpc-url "$RPC_URL" --broadcast -vvv
```

Casino+Sports topology review:

```bash
source .env.base-mainnet-v13
FOUNDRY_PROFILE=default forge script script/DeployV13.s.sol:DeployV13 --rpc-url "$RPC_URL" --broadcast -vvv
```

Immediately lock and verify the release:

```bash
make release-digest
make release-verify
STRICT=1 make release-check
TAG_NAME=vX.Y.Z make release-notes
TAG_NAME=vX.Y.Z make release-package
```

Commit the generated deployment snapshot, release lock, release notes, frontend manifest, golden
vectors, ABI index, and release package metadata before any frontend sync.

## Frontend sync and smoke

After the release package exists:

```bash
pnpm -C frontend ssot:sync -- --from dist/ssot-release-chain-8453-<block>-<digest>.tar.gz
pnpm -C frontend check:release
pnpm -C frontend check:mainnet-release
pnpm -C frontend smoke:release-readonly -- --chain-id 8453
pnpm -C frontend/apps/web test -- src/server/security-headers.test.ts
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
```

The read-only smoke must use a Base mainnet RPC endpoint and must not require a wallet or broadcast.
If `smoke:release-readonly` fails on `quoteVRFFee`, PoolRegistry rows, Bank SSOT, SportsHub wiring,
or bytecode checks, stop and fix the release artifact before changing frontend code.

Production web environment must also include a Sentry DSN and CI-only source-map upload secret:

- `NEXT_PUBLIC_ENV=production`.
- `NEXT_PUBLIC_SENTRY_RELEASE` set to the deploy commit SHA or signed release tag.
- `NEXT_PUBLIC_SENTRY_DSN` set for client and server error capture.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` set only in CI/deploy secrets for source
  map upload.
- Sentry events scrub raw wallet addresses, signatures, and private-key-like URL parameters.
- `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED=false` until an approved
  `casino.frontend-access.v1` memo passes `REQUIRE_APPROVED=1`.

After deploying the web app, verify the production health endpoint:

```bash
curl -fsS https://<web-host>/api/healthz | jq .
```

The top-level `status` must be `ok` before public traffic. On chain `8453`, the endpoint degrades
until `chain-8453.json` is embedded, the primary keeper health snapshot is fresh, and the web API is
serving recent bets from the durable Postgres index.

The same checks are exposed for operators and support at:

```text
https://<web-host>/status
```

## Casino keeper readiness

Before any public casino traffic:

- Validate `docs/ops/casino-frontend-access.md` in approval mode and only then set
  `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED=true` for the production web deployment.
- Install the primary and backup units from `frontend/deploy/casino-keeper/`.
- Follow `docs/ops/runbooks/casino-keeper-production.md`.
- Follow `docs/ops/runbooks/bet-index-production.md` for managed Postgres backup and restore
  evidence.
- Use `KEEPER_CHAIN_ID=8453` and `KEEPER_RELEASE_PATH` pointing at the embedded `chain-8453.json`.
- Use two independent RPC providers and two independent hosts/regions.
- Confirm `/ops/casino-keeper-health.json` reports the expected chain id, role, cursor, and last
  successful finalize timestamp.
- Confirm `/api/healthz` reports `status: "ok"` and `checks.keeper.status: "ok"`.
- Run one small-stake casino canary and archive placeBet, VRF fulfill, keeper finalize, terminal
  receipt, and Bank SSOT readbacks using `docs/deploy/base-mainnet-casino-canary-template.md`.

## Sports NO-GO controls

SportsHub remains a production-blocked surface until these are all linked:

- `docs/ops/sportsbook-key-custody-roles.md` approved role custody packet.
- `docs/ops/sportsbook-provider-evidence-policy.md` and provider-specific evidence approval.
- `docs/ops/sportsbook-frontend-access.md` approved jurisdiction/frontend access packet.
- `docs/ops/sportsbook-bankroll-risk-caps.md` approved mainnet caps.
- `docs/ops/sportsbook-ops-coverage.md` approved operator coverage.
- Fresh Base mainnet or public-testnet football canary evidence using current code and providers.

Required checks before SportsHub public risk-in:

```bash
REQUIRE_APPROVED=1 make sports-role-custody-check-v13 ROLE_CUSTODY_FILE=<approved-role-custody.json>
REQUIRE_APPROVED=1 make sports-provider-policy-check-v13 PROVIDER_POLICY_FILE=<approved-provider-policy.json>
REQUIRE_APPROVED=1 make sports-frontend-access-check-v13 FRONTEND_ACCESS_FILE=<approved-frontend-access.json>
REQUIRE_APPROVED=1 make sports-bankroll-caps-check-v13 BANKROLL_CAPS_FILE=<approved-bankroll-caps.json>
REQUIRE_APPROVED=1 make sports-ops-coverage-check-v13 OPS_COVERAGE_FILE=<approved-ops-coverage.json>
PHASE2_PACKET=<go-packet.md> make sports-phase2-gonogo-v13
```

## Final GO checklist

- [ ] Base mainnet env reviewed and stored outside `docs/`.
- [ ] Casino frontend-access memo approved with
      `REQUIRE_APPROVED=1 make casino-frontend-access-check-v13 FRONTEND_ACCESS_FILE=<approved-casino-frontend-access.json>`.
- [ ] Deployer/governance/treasury/key custody sign-off linked.
- [ ] VRF wrapper and USDC addresses re-checked against official sources on deploy day.
- [ ] `REQUEST_GAS_PRICE_WEI` refreshed on deploy day.
- [ ] Pool ids/domains/assets/LP metadata reviewed.
- [ ] Sports risk caps and role hashes approved, or Sports pool removed from the launch env.
- [ ] Pre-broadcast commands green.
- [ ] Deployment broadcast tx hashes archived.
- [ ] Explorer verification complete or a documented verification exception exists.
- [ ] Release digest, frontend manifest, golden vectors, notes, and package generated and committed.
- [ ] Frontend embedded release synced and read-only smoke green.
- [ ] Sentry DSN configured, source maps uploaded from CI, and address/signature scrubbing verified.
- [ ] Primary and backup casino keepers live and healthy.
- [ ] Postgres bet index live, backed up, restore-tested, and connected to web API routes.
- [ ] `/api/healthz` reports `ok` for release, keeper, and bet-index checks.
- [ ] Small-stake casino canary complete with terminal receipt.
- [ ] SportsHub public risk-in remains disabled unless Phase 2 records GO.
