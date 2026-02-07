# Executable SSOT (Invariants) v1.0

This document defines the **machine-checkable** invariant suite that MUST hold under fuzzed
execution.

It is intended to be implemented as Foundry invariants (`StdInvariant`) plus targeted unit tests
(E2E flows). Together, they form the protocol’s primary “proof gate”.

> Related ADRs:
> - ADR-0009 (reference model diff tests)
> - ADR-0010 (invariant completion + run policy)

## Notation (Bank is the truth source)

Bank SSOT quantities:

- `B`  = `ASSET.balanceOf(Bank)`
- `PF` = `protocolFeesPayable()`
- `XP` = `externalPayablesTotal()`
- `NAV = B - PF - XP` (underflow => violation)
- `R`  = `totalReserved()`
- `MinLiq = NAV * minLiquidityBps / 10_000`
- `Free = NAV - R - MinLiq`

## A — Accounting & solvency (Bank owner)

### A1. NAV identity
**Statement:** `totalAssets() == NAV`  
**Check:** after every state transition  
**Owner:** Bank  
**Implementation:** `test/invariants/Invariants.t.sol::invariant_A1_A2_A3`

### A2. Non-negativity (no NAV underflow)
**Statement:** `B >= PF + XP`  
**Check:** after every state transition  
**Owner:** Bank  
**Implementation:** `invariant_A1_A2_A3`

### A3. Reserve coverage
**Statement:** `NAV >= R`  
**Check:** after every state transition  
**Owner:** Bank (primary)  
**Implementation:** `invariant_A1_A2_A3`

### A4. Optional outflow safety domain
**Statement:** after a successful optional outflow, `NAV - R >= MinLiq(NAV)`  
**Check:** after `withdraw/redeem/claim/fee-withdraw` succeeds  
**Owner:** Bank  
**Implementation:** enforced as a post-condition in handler actions (see `docs/audit/invariants-map.md`).

> Note: `settle/refund` are **debt-out** and MUST NOT be blocked by `MinLiq`.

## B — Bet lifecycle & reserve alignment (Hub + Bank)

### B1. Terminality (planned)
**Statement:** once a bet is Settled/Refunded, it cannot become non-terminal again  
**Owner:** Hub  
**Planned:** milestone 1.5 (handler tracks terminal betIds)

### B2. Legal state transitions (planned)
**Statement:** only `None -> Held -> PendingVRF -> RandomReady -> (Settled | Refunded)`  
**Owner:** Hub  
**Planned:** milestone 1.5

### B3. Bounded settlement
**Statement:** per bet, settlement MUST satisfy:

- `payoutGross + refundAmount <= reserved`
- `payoutNet <= payoutGross`

**Owner:** Bank (hard checks), Hub/module (parameter correctness)  
**Implementation:** enforced by `Bank.settleBet()` and exercised by E2E tests.

### B4. Total reserved equals sum of active reserves
**Statement:** `R == Σ reserved(bet in nonTerminalStates)`  
**Owner:** Bank (total), Hub (enumeration is test-side via handler)  
**Implementation:** `test/invariants/Invariants.t.sol::invariant_B4_totalReserved_matches_open_holds`

## C — VRF request mapping & liveness (VRFHub owner)

### C3. fulfill never reverts
**Statement:** `VRFHub.fulfillRandomWords` MUST never revert, even for unknown/detached requests  
**Owner:** VRFHub  
**Implementation:** soft-ignore behavior + E2E/invariant sequences.

### C1/C2. Request lifecycle matches bet state
**Statement:** requestId is active iff bet is PendingVRF, and requestId maps to a single betId  
**Owner:** Hub + VRFHub  
**Implementation:** `test/invariants/Invariants.t.sol::invariant_C1_C2_requests_match_bet_state`

### C4. Detach prevents late settlement
**Statement:** after refund/finalize, request mappings are cleared such that late fulfill cannot
settle the bet  
**Owner:** Hub + VRFHub  
**Implementation:**
- unit: `test/unit/E2E.t.sol::test_refund_detach_late_fulfill_no_effect`
- handler action: `action_lateFulfillRefunded`

## D — Pause / Emergency semantics

### D1. Risk-in pause freezes risk-in + optional outflows
**Statement:** when `riskInPaused == true`, Risk-in and optional outflows MUST fail, but debt-out
MUST remain live.  
**Owner:** Bank + Hub  
**Implementation:** `test/invariants/Invariants.t.sol::invariant_D1_pause_maxWithdraw_is_zero`

### D2. No ASSET backdoor (planned)
**Statement:** no privileged path can extract `ASSET` in a way that violates A3/A4.  
**Owner:** Bank  
**Planned:** milestone 1.5 (ADR-0010)

## P — Pricing, skyline, and budget integrity (Hub owner)

### P1. Skyline identity and bounds
**Statement:** for each bet:

- `effectiveHouseEdgeBps >= baseHouseEdgeBps`
- `effectiveHouseEdgeBps <= 10_000`
- `deltaSkylineHash == keccak256(deltaSkylineBytes)`
- `sum(incBps) == effectiveHouseEdgeBps - baseHouseEdgeBps`
- `effectiveHouseEdgeBps <= maxHouseEdgeBps` (per-bet snapshot)

**Owner:** Hub  
**Implementation:**
- invariant: `test/invariants/Invariants.t.sol::invariant_P1_skyline_identity_and_bounds`
- unit: `test/unit/E2E.t.sol::test_maxHouseEdge_snapshot_reverts_when_effective_exceeds_max`

### P3. Budget bounds and conservation (planned)
**Statement:** finalized bets MUST satisfy budget bounds and conservation (no leakage).  
**Owner:** Hub + ReferralEngine + Bank  
**Planned:** milestone 1.5 (ADR-0010)

## E — Referral / XP integrity (permissionless)

### E1. XP bucket identity
**Statement:** `XP == xpAccruedTotal + xpLockedTotal + xpHoldbackTotal`  
**Owner:** Bank  
**Implementation:** `test/invariants/Invariants.t.sol::invariant_E1_XP_bucket_identity`

### E2. Bucket moves preserve XP_total (planned)
**Statement:** `unlockXPLocked` / `syncXPHoldback` MUST preserve XP_total (moves only).  
**Owner:** Bank  
**Planned:** milestone 1.5 (ADR-0010)

### E3. Claim is optional outflow (planned)
**Statement:** claims MUST be pause-gated and MUST obey A4.  
**Owner:** Bank  
**Planned:** milestone 1.5 (ADR-0010)

## Proof gates (run policy)

We treat proofs as **gates**, not “best effort”. Two profiles are defined:

- **PR gate (fast):** unit tests + invariants at default runs + diff tests (small profile)
- **Nightly gate (deep):** invariants and diff tests at large runs/steps across multiple seeds

Run policy is defined in ADR-0010, and the implementation plan is tracked in
`docs/plan/Milestone-1.5-Proof-Hardening.md`.
