# Deployment checklist

## Preflight
- [ ] Confirm **target chain-id** and RPC provider reliability
- [ ] Confirm `PRIVATE_KEY` corresponds to `GOV` (the deploy script enforces this)
- [ ] Confirm Chainlink VRF v2.5 **Wrapper** address for the target chain
- [ ] Confirm the ERC20 assets you will register (decimals, transfer behavior, blacklists, fee-on-transfer)
- [ ] For v1.3 Sports testnet rehearsal, start from one of:
  - `docs/deploy/base-sepolia-v13-sports.env.example`
  - `docs/deploy/arbitrum-sepolia-v13-sports.env.example`
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
  - bootstrap odds signer, result reporter, challenger, and arbitrator addresses if used
- [ ] Run `make sports-phase0-readiness` locally to prove both the v1.3 Casino+Sports artifact path
  and the Phase 0 mock event lifecycle before using real deployment parameters.
- [ ] Run `ENV_FILE=<filled-env> make sports-testnet-preflight-v13` before broadcasting a public testnet deployment.

## Deploy
- [ ] Run `bash script/ci/install_deps.sh`
- [ ] For legacy v1.2, run `forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast -vvv`
- [ ] For v1.3 router/pool deployments, run `forge script script/DeployV13.s.sol:DeployV13 --rpc-url $RPC_URL --broadcast -vvv`
- [ ] Record the printed addresses

## Postflight
- [ ] Verify core wiring:
  - [ ] `VRFHub.coordinator == adapter` and `VRFHub.adapter == adapter`
  - [ ] `adapter.wrapper == VRF_WRAPPER`
  - [ ] For every registered asset: `BankRegistry.bankFor(asset) != 0`
  - [ ] Each bank has settlement authority set: `Bank.settlementRouter == Hub` for the legacy casino deployment, or `Bank.settlementRouter == SettlementRouter` after the v1.3 router migration
  - [ ] For v1.3: every pool in `PoolRegistry` has the expected `poolId`, asset, Bank, and domain.
  - [ ] For v1.3: Casino pools are allowlisted for `GameHub`, Sports pools are allowlisted for `SportsHub`, and cross-domain allowlists are absent.
  - [ ] For Sports pools: `SportsHub`, `SportsRiskEngine`, signer set hash, reporter set hash, reporter threshold, and effective pool caps are present in `deployments/latest-v13.json`.

- [ ] Generate and verify the release lock (tamper-evident config):
  - [ ] `make release-digest`
  - [ ] `make release-verify`
  - [ ] Generate release notes (must include digest): `TAG_NAME=vX.Y.Z make release-notes`
  - [ ] Enforce strict gate: `STRICT=1 make release-check`
  - [ ] For v1.3, use the v1.3 release path: `make release-digest-v13`, `make release-verify-v13`, `make release-frontend-manifest-v13`, `make release-golden-vectors-v13`, `make release-abis-v13`, and `STRICT=1 make release-check-v13`
  - [ ] (recommended) package artifacts for audit handoff: `TAG_NAME=vX.Y.Z make release-package`
  - [ ] (recommended) commit snapshot + release lock + notes under `deployments/` before tagging a release

- [ ] Run optional fork test:
  - [ ] `FORK_RPC_URL` + `FORK_VRF_WRAPPER` set
  - [ ] `forge test --match-path "test/fork/*" -vvv`

- [ ] Run a minimal smoke bet on a staging environment (small stake, 1 roll)

## Operational safety
- [ ] Decide your risk-in pause policy:
  - `Hub.setRiskInPaused(asset, true/false)`
- [ ] For v1.3, decide per-pool risk-in pause policy and document who can pause/resume each vertical.
- [ ] For SportsHub, confirm operators have rehearsed `docs/ops/runbooks/sportsbook-ops.md` and own alerts for odds signer failures, result finality, direct voids, and exposure caps.
- [ ] Decide on monitoring signals:
  - bet placement / requestId issuance
  - refund credit changes (`VRFHub.refundCreditOf`)
  - bank SSOT snapshots (NAV, reserved, XP buckets)
  - Sports tickets placed/terminalized, result finality pending seconds, exposure reserved, voided markets, oracle config changes, and risk limit changes
