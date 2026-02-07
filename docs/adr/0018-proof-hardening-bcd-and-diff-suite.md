# ADR-0018: Proof hardening — complete B/C/D invariants and initial diff suite

## Context
SSOT v1.1 defines an "Executable SSOT" invariant suite that acts as the protocol's proof gate.
Before this ADR, the implementation primarily exercised A-class solvency invariants (A1..A3)
plus targeted E2E tests.

To progress toward an institution-grade "provably correct" posture, we need:
- stronger stateful coverage of bet lifecycle + reserve alignment (B-class)
- request mapping + transport liveness properties (C-class)
- emergency/pause semantics (D-class)
- and an initial set of reference-model diff tests (ADR-0009) for key game modules.

## Decision
1) **Expand Foundry invariants to cover B/C/D/X properties** in `test/invariants/Invariants.t.sol`:
   - B1/B2 via a handler-side mirror for legal state transitions and terminality
   - B4 via handler-maintained per-asset sums of active bet reserves, compared against `Bank.totalReserved()`
   - C1/C2 via sampled checks that `Hub.requestToBetId(requestId)` is non-zero **only** while `PendingVRF`
   - D1 via dedicated handler actions that assert risk-in and optional outflows fail while paused
   - Debt-out liveness strengthening: if a bet is ready (`RandomReady` / refund timeout elapsed), `finalize` / `refund` must succeed
   - X1 via a simple custody leakage check: `Bank(assetA)` must not hold `assetB` and vice versa

2) **Clear request mapping on fulfill**: `Hub.onRandomWords` now clears `requestToBetId[requestId]` immediately.
   This aligns implementation with ExecutableSSOT C1/C2: requestId is only meaningful while the bet is `PendingVRF`.

3) **Add initial reference-model diff tests** (ADR-0009) for high-signal modules:
   - `test/diff/DiffCoinToss.t.sol`
   - `test/diff/DiffRoulette.t.sol` (raw bitmask params)

The reference models are implemented independently within the tests (including RNG expansion),
and are compared against `IGameModule.resolve(...)` across fuzzed inputs.

## Consequences
- Stronger confidence that changes to Hub/Bank/VRF wiring do not silently break lifecycle invariants.
- Early detection of module semantic drift via diff tests, without requiring a full end-to-end state machine.
- Slightly higher test runtime (more handler actions + diff suites), acceptable for PR gates.

## Alternatives considered
- Rely only on unit E2E tests: rejected (insufficient stateful coverage; too easy to miss edge-case regressions).
- Keep request mapping until finalize/refund: rejected (harder to reason about transport invariants; diverges from ExecutableSSOT C1).
- Build an external off-chain reference harness first: deferred (on-chain diff tests provide immediate value and integrate with CI).
