# Deployment checklist

## Preflight
- [ ] Confirm **target chain-id** and RPC provider reliability
- [ ] Confirm `PRIVATE_KEY` corresponds to `GOV` (the deploy script enforces this)
- [ ] Confirm Chainlink VRF v2.5 **Wrapper** address for the target chain
- [ ] Confirm the ERC20 assets you will register (decimals, transfer behavior, blacklists, fee-on-transfer)
- [ ] Decide initial:
  - `BANK_MIN_LIQ_BPS_i`
  - referral budgets + holdback
  - refund timeout

## Deploy
- [ ] Run `bash script/ci/install_deps.sh`
- [ ] Run `forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast -vvv`
- [ ] Record the printed addresses

## Postflight
- [ ] Verify core wiring:
  - [ ] `VRFHub.coordinator == adapter` and `VRFHub.adapter == adapter`
  - [ ] `adapter.wrapper == VRF_WRAPPER`
  - [ ] For every registered asset: `BankRegistry.bankFor(asset) != 0`
  - [ ] Each bank has hub set: `Bank.hub == Hub`

- [ ] Generate and verify the release lock (tamper-evident config):
  - [ ] `make release-digest`
  - [ ] `make release-verify`
  - [ ] Generate release notes (must include digest): `TAG_NAME=vX.Y.Z make release-notes`
  - [ ] Enforce strict gate: `STRICT=1 make release-check`
  - [ ] (recommended) package artifacts for audit handoff: `TAG_NAME=vX.Y.Z make release-package`
  - [ ] (recommended) commit snapshot + release lock + notes under `deployments/` before tagging a release

- [ ] Run optional fork test:
  - [ ] `FORK_RPC_URL` + `FORK_VRF_WRAPPER` set
  - [ ] `forge test --match-path "test/fork/*" -vvv`

- [ ] Run a minimal smoke bet on a staging environment (small stake, 1 roll)

## Operational safety
- [ ] Decide your risk-in pause policy:
  - `Hub.setRiskInPaused(asset, true/false)`
- [ ] Decide on monitoring signals:
  - bet placement / requestId issuance
  - refund credit changes (`VRFHub.refundCreditOf`)
  - bank SSOT snapshots (NAV, reserved, XP buckets)
