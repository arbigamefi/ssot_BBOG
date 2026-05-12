# Architecture Overview

## Goals

- **SSOT-driven correctness:** define the protocol as a set of invariants and enforce them in tests.
- **Minimized trust surface:** Bank trusts only the settlement authority; VRFHub is transport-only; games are pure modules.
- **Institution-grade auditability:** everything important is queryable and reconstructible.

## Module boundaries

### Bank (funds + accounting SSOT)
- Custodies `ASSET`
- Maintains accounting buckets: PF / XP / R
- Implements ERC4626-like LP vault with `totalAssets() == NAV`
- Settlement-authority-only bet funds API (`holdBet/settleBet/refundBet`)
- Optional outflows (LP withdrawals, XP claims, fee withdrawals) are constrained by SSOT domain checks

### Hub (bet lifecycle SSOT)
- Global `betId`
- Orchestrates VRF requests and manages bet state machine
- Permissionless `finalize` and `refund` for liveness

### VRFHub (transport SSOT)
- Maps `requestId -> (hub, betId)`
- Supports `detach`
- `fulfill...` never reverts (soft-ignore unknown/detached; try/catch hub calls)

### Game modules (pure semantics)
- Deterministic functions: validate, maxPayout, resolve
- No lifecycle state machine
- No custody and no direct Bank access

### Referral system
- Registry: first-touch, anti-cycle
- Engine: deterministic math
- Bank: XP buckets as liabilities (accrued/locked/holdback) + permissionless unlock/sync

## Dependency direction (hard rule)

- `core/Bank.sol` MUST NOT depend on Hub, VRFHub, or modules.
- `core/Hub.sol` depends only on interfaces and modules.
- `core/VRFHub.sol` MUST NOT depend on Bank or modules.
- `modules/*` MUST NOT depend on core contracts.

## Data flows

### 1) Place bet
1. UI/SDK obtains a deterministic fee quote: `Hub.quoteVRFFee(betCount) -> (feeWei, callbackGasLimit)`.
2. User calls `Hub.placeBet(gameId, asset, params, stakeSpec, affiliate, maxHouseEdgeBps)` **payable** with `msg.value >= feeWei`.
3. Hub validates params + stake spec and computes `reserved = module.maxPayout(params, stakeSpec)`.
4. The settlement authority calls `Bank(asset).holdBet(betId, player, stake, reserved, snapshotHash)`.
5. Hub forwards the charged VRF fee to `VRFHub.requestRandomWords(..., payer=player)` and records the `requestId`.
6. Any overpayment is refunded best-effort; failed refunds accrue `refundCredit` claimable later (debt-out).

### 2) Fulfill + finalize
1. **Non-adapter mode:** the coordinator calls `VRFHub.fulfill...` directly.
2. **Adapter mode (Chainlink Wrapper):** `Wrapper -> Adapter.rawFulfillRandomWords -> VRFHub.fulfill...`.
3. VRFHub calls `Hub.onRandomWords(requestId, words)` in a try/catch (soft-fails; **never reverts**).
4. Anyone calls `Hub.finalize(betId)`.
5. Hub resolves payout via module and the settlement authority calls `Bank(asset).settleBet(...)`.

### 3) Referral unlock / vesting
- Anyone calls:
  - `Bank.unlockXPLocked(payee, sourcePlayer)` when turnover threshold is met
  - `Bank.syncXPHoldback(payee)` to release holdback linearly into accrued
- Claim remains an optional outflow and is gated by SSOT withdrawal domain.
