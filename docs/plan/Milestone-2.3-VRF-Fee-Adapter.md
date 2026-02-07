# Milestone 2.3 — Charged VRF Fee (Native) + Adapter-ready VRFHub

Goal: reach **refactored v0.7.8 parity** for VRF fee charging while preserving SSOT axioms.

## Scope
1) Make `Hub.placeBet` payable and require a per-bet VRF fee paid in native token.
2) Provide a deterministic quote endpoint for UIs/SDKs.
3) Implement best-effort refund of overpayment (**多退少补**).
4) Ensure no privileged withdrawal backdoor for charged oracle fees.

## Deliverables
- `Hub.quoteVRFFee(betCount)`
- `VRFHub.quote(...)` + `VRFHub.requestRandomWords(..., payer)` payable
- `VRFHub.claimRefund()` for failed refund transfers
- Bet snapshots: `vrfFeePaid/vrfFeeCharged/vrfCallbackGasLimit`
- Update tests: E2E / invariants / stateful diff to pay VRF fees

## Non-goals (this milestone)
- Full Chainlink production adapter (VRFV2Wrapper/Coordinator integration)
  (planned as Milestone 2.4)

## Acceptance
- `FOUNDRY_PROFILE=pr forge test -vvv` passes
- `FOUNDRY_PROFILE=nightly forge test --match-path test/diff/StatefulSystemDiff.t.sol -vvv` passes