# Executable SSOT (Invariants) v1.1 — Multi-Asset + Multi-Roll

This document defines the **machine-checkable** invariant suite that MUST hold under fuzzed execution.

It is intended to be implemented as Foundry invariants (`StdInvariant`) plus targeted unit tests (E2E flows).
Together, they form the protocol’s primary “proof gate”.

> Related ADRs:
> - ADR-0009 (reference model diff tests)
> - ADR-0010 (invariant completion + run policy)
> - ADR-0012 (multi-asset SSOT architecture)
> - ADR-0013 (multi-roll semantics + canonical RNG expansion)

## Notation

The protocol supports a finite set of whitelisted assets `Assets = {a1, a2, ...}`.
Each asset `a` has exactly one immutable vault `Bank(a)`.

Per-asset SSOT quantities:

- `B[a]`   = `IERC20(a).balanceOf(Bank(a))`
- `PF[a]`  = `Bank(a).protocolFeesPayable()`
- `XP[a]`  = `Bank(a).externalPayablesTotal()`
- `NAV[a]` = `B[a] - PF[a] - XP[a]` (underflow => violation)
- `R[a]`   = `Bank(a).totalReserved()`
- `MinLiq[a] = NAV[a] * minLiquidityBps[a] / 10_000`
- `Free[a] = NAV[a] - R[a] - MinLiq[a]`

Bet quantities (per betId):

- `asset(betId)` = the ERC20 asset bound to the bet
- `bank(betId)`  = `Bank(asset(betId))`
- `stake(betId)` = total escrow (`amountPerRoll * betCount`)
- `reserved(betId)` = worst-case outflow bound
- `refundAmount` and `usedTurnover` are settlement-time values:
  - `usedTurnover = stake - refundAmount`

## A — Accounting & solvency (per-asset Bank)

### A1[a]. NAV identity (for every supported asset)
**Statement:** `Bank(a).totalAssets() == NAV[a]`  
**Check:** after every state transition  
**Owner:** Bank(a)

### A2[a]. Non-negativity (no NAV underflow)
**Statement:** `B[a] >= PF[a] + XP[a]`  
**Check:** after every state transition  
**Owner:** Bank(a)

### A3[a]. Reserve coverage
**Statement:** `NAV[a] >= R[a]`  
**Check:** after every state transition  
**Owner:** Bank(a)

### A4[a]. Optional outflow safety domain
**Statement:** after a successful optional outflow in `Bank(a)`, `NAV[a] - R[a] >= MinLiq[a](NAV[a])`  
**Check:** after `withdraw/redeem/claim/fee-withdraw` succeeds  
**Owner:** Bank(a)

> Note: `settle/refund` are **debt-out** and MUST NOT be blocked by `MinLiq`.

## B — Bet lifecycle & reserve alignment (Hub + Bank)

### B1. Terminality
**Statement:** once a bet is Settled/Refunded, it cannot become non-terminal again  
**Owner:** Hub  
**Implementation:** handler tracks terminal betIds; asserts no state regression

### B2. Legal state transitions
**Statement:** only `None -> Held -> PendingVRF -> RandomReady -> (Settled | Refunded)`  
**Owner:** Hub  
**Implementation:** handler maintains a state machine mirror for each betId

### B3. Bounded settlement (per bet, per asset)
**Statement:** settlement MUST satisfy:

- `payoutGross + refundAmount <= reserved`
- `refundAmount <= stake`
- `0 <= usedTurnover = stake - refundAmount <= stake`
- `payoutNet <= payoutGross`

**Owner:** Bank(a) (hard checks), Hub/module (parameter correctness)  
**Implementation:** enforced by `Bank(a).settleBet()` + exercised by E2E and invariants.

### B4. Total reserved equals sum of active reserves (per asset)
**Statement:** for each asset `a`:

`R[a] == Σ reserved(bet in nonTerminalStates AND asset(bet)==a)`

**Owner:** Bank(a) (total), Hub (enumeration test-side via handler)  
**Implementation:** invariant enumerates open betIds per asset and compares with `Bank(a).totalReserved()`.

### B5. Turnover accounting uses usedTurnover (not stake)
**Statement:** for each settled bet, the per-asset turnover increment equals `usedTurnover`.  
**Owner:** Bank(a)  
**Implementation:** E2E asserts: `playerTurnover_after - before == stake - refundAmount`.

## C — VRF request mapping & liveness (VRFHub owner)

### C1/C2. Request lifecycle matches bet state
**Statement:** requestId is active iff bet is PendingVRF, and requestId maps to a single betId  
**Owner:** Hub + VRFHub  
**Implementation:** invariant checks mapping consistency

### C3. fulfill never reverts
**Statement:** `VRFHub.fulfillRandomWords` MUST never revert, even for unknown/detached requests  
**Owner:** VRFHub  
**Implementation:** soft-ignore behavior + E2E/invariant sequences.

### C4. Detach prevents late settlement
**Statement:** after refund/finalize, request mappings are cleared such that late fulfill cannot settle the bet  
**Owner:** Hub + VRFHub  
**Implementation:** unit + invariant action `lateFulfill` after terminal states

## D — Pause / Emergency semantics

### D1[a]. Risk-in pause freezes risk-in + optional outflows (per asset)
**Statement:** when risk-in is paused for asset `a`, Risk-in and optional outflows in `Bank(a)` MUST fail,
but debt-out MUST remain live.  
**Owner:** Bank(a) + Hub  
**Implementation:** invariant asserts `maxWithdraw == 0` and `placeBet` reverts, while `finalize/refund` remain callable.

## X — Cross-asset isolation (multi-asset SSOT)

### X1. No cross-asset custody leakage
**Statement:** a bet bound to asset `a` MUST NOT transfer any other asset `b != a`.  
**Owner:** Hub + Banks  
**Implementation:** E2E: snapshot balances of unrelated assets before/after settle/refund and assert unchanged.

### X2. No cross-asset liability netting
**Statement:** for each asset `a`, A1[a]/A2[a]/A3[a]/A4[a] hold independently; failure in one asset cannot be masked by another.  
**Owner:** All  
**Implementation:** invariants are checked per asset independently.

## Proof gates (run policy)

We treat proofs as **gates**, not “best effort”.

- **PR gate (fast):** unit tests + invariants at default runs + diff tests (small profile)
- **Nightly gate (deep):** invariants and diff tests at large runs/steps across multiple seeds

Run policy is defined in ADR-0010, and the implementation plan is tracked in:
- `docs/plan/Milestone-1.5-Proof-Hardening.md`
- `docs/plan/Milestone-2.0-MultiAsset-Foundation.md`
- `docs/plan/Milestone-2.1-MultiRoll-Framework.md`
