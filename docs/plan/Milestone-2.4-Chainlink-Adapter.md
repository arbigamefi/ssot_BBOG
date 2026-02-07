# Milestone 2.4: Chainlink VRF v2.5+ Wrapper Adapter

## Goal
Connect SSOT VRF fee semantics to a real Chainlink request path (Wrapper), while preserving SSOT constitution:
- fulfill NEVER reverts
- debt-out liveness for `refundCredit`
- no privileged oracle-fee sweep/backdoor

## Deliverables
- `IVRFAdapter` interface
- `ChainlinkV2PlusWrapperAdapter` (adapter acts as the Wrapper consumer and forwards callback to VRFHub)
- `MockVRFV2PlusWrapper` for local tests
- Unit tests validating:
  - payable VRF fee charge + best-effort overpay refund still works
  - callback path: Wrapper -> Adapter -> VRFHub -> Hub
  - refundCredit is claimable if best-effort refund fails (debt-out liveness)

## Proof Gates
- System-level stateful diff in adapter mode (`test/diff/StatefulSystemDiffAdapter.t.sol`) MUST pass:
  - wrapper ETH collected == sum(vrfFeeCharged over all bets)
  - VRFHub ETH balance == sum(refundCredit over all players)
  - claimRefund clears credits even when risk-in is paused

- Adapter-mode invariants (`test/invariants/InvariantsAdapter.t.sol`) MUST pass:
  - hub/adaptor retain no ETH
  - wrapper retains exactly the charged VRF fees
  - VRFHub retains only refund credits, and credit claims never fail when credit exists

## Notes
- Wrapper uses `msg.sender` as the consumer; therefore the adapter must implement the callback entrypoint
  and forward to VRFHub.
- VRFHub `coordinator` is configured to the adapter address in adapter mode.

## Follow-ups
- Add deployment config for real networks (wrapper address, gas price policy, confirmations, etc.).
- Expand adapter-mode diff coverage across wider parameter domains and longer step traces.
