# Deployment checklist

## Preflight
- [ ] Confirm **target chain-id** and RPC provider reliability
- [ ] Confirm `PRIVATE_KEY` corresponds to `GOV` (the deploy script enforces this)
- [ ] Confirm Chainlink VRF v2.5 **Wrapper** address for the target chain
- [ ] Confirm the ERC20 assets you will register (decimals, transfer behavior, blacklists, fee-on-transfer)
- [ ] For v1.3 Sports testnet rehearsal, start from one of:
  - `docs/deploy/base-sepolia-v13-sports.env.example`
  - `docs/deploy/arbitrum-sepolia-v13-sports.env.example`
- [ ] For Base mainnet v1.3 readiness, start from:
  - `docs/deploy/base-mainnet-v13-casino.env.example` for casino-only launch review
  - `docs/deploy/base-mainnet-v13.env.example`
  - `docs/deploy/base-mainnet-v13-readiness.md`
- [ ] Decide initial:
  - `BANK_MIN_LIQ_BPS_i`
  - referral budgets + holdback
  - refund timeout
- [ ] For v1.3 deployments, decide every pool row:
  - `POOL_ID_i`
  - `POOL_ASSET_i`
  - `POOL_DOMAIN_i` (`1=Casino`, `2=Sports`, `3=Future`)
- [ ] For every Sports pool, approve raw-unit Sports risk caps:
  - `SPORTS_MAX_STAKE`
  - `SPORTS_MAX_PAYOUT`
  - `SPORTS_MAX_MARKET_RESERVED`
  - `SPORTS_MAX_OUTCOME_RESERVED`
  - `SPORTS_MAX_EVENT_RESERVED`
- [ ] For every Sports pool, approve oracle/governance policy:
  - `SPORTS_ODDS_SIGNER_SET_HASH`
  - `SPORTS_RESULT_REPORTER_SET_HASH`
  - `SPORTS_RESULT_REPORTER_THRESHOLD`
  - `SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS`
  - bootstrap odds signer, result reporter, challenger, and arbitrator addresses if used
- [ ] Run `make sports-phase0-readiness` locally to prove both the v1.3 Casino+Sports artifact path
  and the Phase 0 mock event lifecycle before using real deployment parameters.
- [ ] Run `ENV_FILE=<filled-env> make sports-testnet-preflight-v13` before broadcasting a public testnet deployment.
- [ ] Run the matching Base mainnet preflight before any v1.3 deployment review. These are env/RPC/code sanity gates, not broadcast approvals:
  - casino-only: `ENV_FILE=<filled-base-mainnet-casino-env> make casino-mainnet-preflight-v13`
  - Casino+Sports: `ENV_FILE=<filled-base-mainnet-env> make sports-mainnet-preflight-v13`
- [ ] Before public Base mainnet casino risk-in, run the final no-broadcast GO gate with approved
  access and synced frontend release:
  `CASINO_ENV_FILE=<filled-base-mainnet-casino-env> WEB_ENV_FILE=<filled-web-production-env> FRONTEND_ACCESS_FILE=<approved-casino-frontend-access.json> make casino-mainnet-gonogo-v13`

## Deploy
- [ ] Run `bash script/ci/install_deps.sh`
- [ ] Run a no-broadcast `forge script ...` simulation. Confirm it completes and does not write
  `deployments/latest-v13.json` unless `WRITE_DRY_RUN_ARTIFACTS=true` was intentionally set.
- [ ] Run `forge script script/DeployV13.s.sol:DeployV13 --rpc-url $RPC_URL --broadcast -vvv`
- [ ] Record the printed addresses

## Postflight
- [ ] Verify core wiring:
  - [ ] `VRFHub.coordinator == adapter` and `VRFHub.adapter == adapter`
  - [ ] `adapter.wrapper == VRF_WRAPPER`
  - [ ] Each bank has settlement authority set: `Bank.settlementRouter == SettlementRouter`
  - [ ] Every pool in `PoolRegistry` has the expected `poolId`, asset, Bank, and domain.
  - [ ] Casino pools are allowlisted for `GameHub`, Sports pools are allowlisted for `SportsHub`, and cross-domain allowlists are absent.
  - [ ] For Sports pools: `SportsHub`, `SportsRiskEngine`, signer set hash, reporter set hash, reporter threshold, challenge timeout, and effective pool caps are present in `deployments/latest-v13.json`.

- [ ] Generate and verify the release lock (tamper-evident config):
  - [ ] `make release-digest`
  - [ ] `make release-verify`
  - [ ] Generate release notes (must include digest): `TAG_NAME=vX.Y.Z make release-notes`
  - [ ] Enforce strict gate: `STRICT=1 make release-check`
  - [ ] (recommended) package artifacts for audit handoff: `TAG_NAME=vX.Y.Z make release-package`
  - [ ] (recommended) commit snapshot + release lock + notes under `deployments/` before tagging a release
        using `git add -f`, because `deployments/` is ignored by default
  - [ ] Confirm core release artifacts are tracked: `make release-artifacts-tracked-v13`

- [ ] Run optional fork test:
  - [ ] `FORK_RPC_URL` + `FORK_VRF_WRAPPER` set
  - [ ] `forge test --match-path "test/fork/*" -vvv`

- [ ] Run a minimal smoke bet on a staging environment (small stake, 1 roll)

## Operational safety
- [ ] Decide your risk-in pause policy:
  - `GameHub`/`SportsHub` pool controls as applicable
- [ ] Decide per-pool risk-in pause policy and document who can pause/resume each vertical.
- [ ] For SportsHub, confirm operators have rehearsed `docs/ops/runbooks/sportsbook-ops.md` and own alerts for odds signer failures, result finality, direct voids, and exposure caps.
- [ ] For SportsHub public-testnet Phase 1 closeout, run
  `ENV_FILE=<role-env> make sports-phase1-closeout-v13` and archive the output with the rehearsal
  evidence.
- [ ] For the football MVP product canary, run or rehearse
  `make sports-football-canary-v13` using the flow in
  `docs/deploy/worldcup-football-mvp-canary-2026.md`.
- [ ] Before any public sportsbook frontend, approve `docs/ops/sportsbook-production-controls.md`
  sections for managed key custody, provider evidence, and public frontend controls.
- [ ] For SportsHub frontend access, run
  `REQUIRE_APPROVED=1 make sports-frontend-access-check-v13 FRONTEND_ACCESS_FILE=<approved-frontend-access.json>`
  before enabling public sportsbook entrypoints or third-party frontend risk-in.
- [ ] Before any SportsHub mainnet canary or public risk-in, run `make sports-phase2-gonogo-v13`
  and confirm the Phase 2 packet records GO with every production approval linked.
- [ ] Before any Base mainnet casino launch, follow `docs/deploy/base-mainnet-v13-readiness.md`,
  install the Base mainnet primary/backup casino keepers from `frontend/deploy/casino-keeper/`, run
  `docs/ops/runbooks/bet-index-production.md`, and archive one small-stake terminal receipt canary
  using `docs/deploy/base-mainnet-casino-canary-template.md`.
- [ ] For SportsHub production roles, run
  `REQUIRE_APPROVED=1 make sports-role-custody-check-v13 ROLE_CUSTODY_FILE=<approved-role-custody.json>`
  before allowlisting routine odds/reporting/challenge/arbitration keys.
- [ ] For SportsHub provider/evidence approval, run
  `REQUIRE_APPROVED=1 make sports-provider-policy-check-v13 PROVIDER_POLICY_FILE=<approved-provider-policy.json>`
  before opening provider-backed market risk-in.
- [ ] For SportsHub mainnet canary caps, run
  `REQUIRE_APPROVED=1 make sports-bankroll-caps-check-v13 BANKROLL_CAPS_FILE=<approved-memo.json>`
  before copying `SPORTS_MAX_*` values into the deploy env.
- [ ] For SportsHub operator coverage, run
  `REQUIRE_APPROVED=1 make sports-ops-coverage-check-v13 OPS_COVERAGE_FILE=<approved-ops-coverage.json>`
  before opening market risk-in.
- [ ] Decide on monitoring signals:
  - bet placement / requestId issuance
  - refund credit changes (`VRFHub.refundCreditOf`)
  - bank SSOT snapshots (NAV, reserved, XP buckets)
  - Sports tickets placed/terminalized, result finality pending seconds, exposure reserved, voided markets, oracle config changes, and risk limit changes
