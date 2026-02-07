# ADR-0021: Chainlink VRF v2.5+ Wrapper Adapter (Native Payment)

## Status
Accepted

## Context
SSOT v1.2 introduces charged VRF fee semantics (native token, overpay refund best-effort, `refundCredit` claimable).
To achieve production parity with `bankroll_protocol_refactored_v0.7.8`, we need to integrate a real VRF provider
(Chainlink VRF v2.5+ Wrapper) without violating SSOT constitution:
- fulfill MUST NEVER revert
- debt-out liveness: `refundCredit` claimable independent of pause
- no privileged oracle-fee sweep/backdoor

### Wrapper constraint
The Chainlink Wrapper treats `msg.sender` as the consumer and calls the consumer back with random words.
Therefore, an intermediate adapter must act as the consumer, then forward to VRFHub.

## Decision
Introduce an adapter layer:
- `IVRFAdapter` interface
- `ChainlinkV2PlusWrapperAdapter` implementation
- `MockVRFV2PlusWrapper` for local tests

Callback flow:
1. Hub calls `VRFHub.requestRandomWords{value: msg.value}(..., payer)`.
2. VRFHub computes `feeCharged` and refunds overpay best-effort to `payer` (or credits).
3. If an adapter is configured, VRFHub forwards `feeCharged` to the adapter via `requestRandomWordsInNative(...)`.
4. Adapter calls the Chainlink wrapper to create a provider request (adapter is the consumer).
5. Wrapper calls `adapter.rawFulfillRandomWords(requestId, randomWords)`.
6. Adapter forwards best-effort to `VRFHub.fulfillRandomWords(requestId, randomWords)`.
7. VRFHub calls `Hub.onRandomWords(...)` in a try/catch and MUST NOT revert.

Coordinator gating:
- VRFHub `coordinator` MUST be set to the adapter address (the only address that forwards fulfill calls into VRFHub).

## Consequences
- placeBet remains payable (VRF fee).
- VRFHub supports two modes:
  - Internal fee model (no adapter) for simplified tests/local use.
  - Adapter mode for Chainlink Wrapper.
- Trust surface remains minimal:
  - Only VRFHub is trusted by Bank/Hub.
  - Adapter is a thin proxy with no custody of ERC20 assets.
