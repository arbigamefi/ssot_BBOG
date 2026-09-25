# Architecture Overview

This describes component boundaries. For v1.5 publication scope, pinned mechanisms and limitations, use the [technical whitepaper](../WHITEPAPER.zh-CN.md) and [release facts](../release/STATUS-v1.5.zh-CN.md). SportsHub is not deployed in the current releases.

## Goals

- **SSOT-driven correctness:** define the protocol as a set of invariants and enforce them in tests.
- **Minimized trust surface:** Bank trusts only the settlement authority; VRFHub is transport-only; games are pure modules.
- **Auditability:** expose accounting and lifecycle evidence with explicit limits on index completeness and replay.

## Module boundaries

### Bank (funds + accounting SSOT)

- Custodies `ASSET`
- Maintains accounting buckets: PF / XP / R
- Implements ERC4626-like LP vault with `totalAssets() == NAV`
- Settlement-router-only bet funds API (`holdBet/settleBet/refundBet`)
- Optional outflows (LP withdrawals, XP claims, fee withdrawals) are constrained by SSOT domain checks

### PoolRegistry (pool authority SSOT)

- Maps each `poolId` to an immutable asset + Bank + domain tuple
- Tracks pool active state
- Tracks which vertical hubs are registered and allowed for each pool

### SettlementRouter (position settlement authority SSOT)

- Allocates global `positionId`
- Snapshots owner hub, pool, Bank, player, stake, reserve, and lifecycle state
- Is the only production caller allowed to invoke Bank bet settlement APIs
- Enforces owner-hub-only settlement/refund

### GameHub (casino lifecycle SSOT)

- Owns casino bet lifecycle for pure RNG game modules
- Orchestrates VRF requests and maps requests to router `positionId`
- Permissionless `finalize` and `refund` for liveness
- Routes all funds movement through `SettlementRouter`

### SportsHub (sports lifecycle SSOT)

- Owns sports market/ticket/result lifecycle
- Enforces odds, market state, result finality, challenge, and void semantics
- Routes all funds movement through `SettlementRouter`

### VRFHub (transport SSOT)

- Maps `requestId -> (hub, betId)`
- Supports `detach`
- Fulfillment soft-ignores unknown/detached requests and catches downstream hub failures; this is not an unconditional no-revert guarantee.

### Game modules (pure semantics)

- Deterministic functions: validate, maxPayout, resolve
- No lifecycle state machine
- No custody and no direct Bank access

### Referral system

- Registry: first-touch, anti-cycle
- Engine: deterministic math
- Bank: XP buckets as liabilities (accrued/locked/holdback) + permissionless unlock/sync

## Dependency direction (hard rule)

- `core/Bank.sol` MUST NOT depend on GameHub, SportsHub, VRFHub, or modules.
- `core/SettlementRouter.sol` is the only Bank settlement authority and does not custody funds.
- `core/GameHub.sol` owns casino lifecycle and MUST NOT call Bank settlement APIs directly.
- `core/SportsHub.sol` owns sports lifecycle and MUST NOT call Bank settlement APIs directly.
- `core/VRFHub.sol` MUST NOT depend on Bank or modules.
- `modules/*` MUST NOT depend on core contracts.

## Data flows

### 1) Place bet

1. UI/SDK obtains a deterministic fee quote: `GameHub.quoteVRFFee(betCount) -> (feeWei, callbackGasLimit)`.
2. User calls `GameHub.placeBet(gameId, poolId, params, stakeSpec, affiliate, maxHouseEdgeBps)` **payable** with `msg.value >= feeWei`.
3. GameHub validates params + stake spec and computes `reserved = module.maxPayout(params, stakeSpec)`.
4. GameHub opens a router position: `SettlementRouter.openPosition(poolId, player, stake, reserved, snapshotHash)`.
5. SettlementRouter snapshots the pool/Bank and calls `Bank.holdBet(positionId, player, stake, reserved, snapshotHash)`.
6. GameHub forwards the charged VRF fee to `VRFHub.requestRandomWords(..., payer=player)` and records the `requestId`.
7. Any overpayment is refunded best-effort; failed refunds accrue `refundCredit` claimable later (debt-out).

### 2) Fulfill + finalize

1. **Non-adapter mode:** the coordinator calls `VRFHub.fulfill...` directly.
2. **Adapter mode (Chainlink Wrapper):** `Wrapper -> Adapter.rawFulfillRandomWords -> VRFHub.fulfill...`.
3. VRFHub calls `GameHub.onRandomWords(requestId, words)` in a try/catch. A failed hub callback is recorded and is not automatically retried; a still-pending bet may become eligible for timeout refund.
4. Anyone calls `GameHub.finalize(positionId)`.
5. GameHub resolves payout via the selected module and calls `SettlementRouter.settlePosition(...)`.
6. SettlementRouter calls the snapshotted Bank's `settleBet(...)`.

### 3) Referral unlock / vesting

- Anyone calls:
  - `Bank.unlockXPLocked(payee, sourcePlayer)` when turnover threshold is met
  - `Bank.syncXPHoldback(payee)` to release holdback linearly into accrued
- Claim remains an optional outflow and is gated by SSOT withdrawal domain.
