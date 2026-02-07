# Protocol Constitution (SSOT) v1.0 — Immutable, Clean-Room

This document is **normative**. Keywords **MUST / MUST NOT / SHOULD / MAY** are used as defined in RFC 2119.

The constitution defines what the protocol **must be**, not what any legacy implementation happened to do.

## 0. Core axioms

1. **Single custody (Bank):** all protocol funds of `ASSET` MUST be held in `Bank`.
2. **Single lifecycle (Hub):** all bets MUST be registered and finalized through a single `Hub` (global `betId`).
3. **Compositional games:** games MUST be implemented as pure modules (no Hub inheritance / duplicated state machines).
4. **Debt-out liveness:** settlement and refund paths MUST remain live regardless of pause/emergency settings.

## 1. Modules and roles

### 1.1 Modules

- **Bank** (`src/core/Bank.sol`):
  - ERC4626-like LP vault
  - Accounting SSOT and buckets (`PF / XP / R`)
  - Bet escrow/reserve/settle/refund funds API (Hub-only)

- **Hub** (`src/core/Hub.sol`):
  - Global bet registry (single `betId` namespace)
  - Pricing snapshots (house edge + skyline)
  - Referral plan orchestration (base + delta budgets)
  - VRF orchestration and callback handling
  - Permissionless `finalize(betId)` and `refund(betId)` for liveness

- **VRFHub** (`src/core/VRFHub.sol`):
  - `requestId -> (hub, betId)` mapping
  - detach/clear semantics
  - **fulfill never reverts** (soft-ignore unknown/detached)

- **Game Modules** (`src/modules/*`):
  - `validate(params, stake)`
  - `maxPayout(params, stake)`
  - `resolve(params, stake, randomWords)` — deterministic

- **Referral system** (`src/engines/referral/*`):
  - Registry (first-touch relationship)
  - Deterministic referral engine (pure math)
  - XP buckets in Bank (liabilities, not LP backing)

### 1.2 Governance

v1.0 is **immutable** (no upgrades). Governance MAY:

- register games
- set risk-in pause
- set pricing / budget parameters
- set XP unlocking thresholds and vesting duration

Governance MUST NOT:

- block debt-out liveness (finalize/refund)
- withdraw `ASSET` outside SSOT constraints

## 2. Accounting SSOT (Bank)

Let the underlying asset be a single ERC20 `ASSET`.

### 2.1 Base quantities

- `B`  := `ASSET.balanceOf(Bank)` (ground truth)
- `PF` := protocol fees payable (liability bucket)
- `XP` := external payables total (liability bucket; includes referral/kickback)
- `NAV := B - PF - XP` (LP backing)
- `R`  := `totalReserved` (worst-case pending bet liability)
- `MinLiq(NAV) := NAV * minLiquidityBps / 10_000`
- `Free := NAV - R - MinLiq(NAV)`

### 2.2 SSOT requirements

- **(A1) Identity:** `totalAssets()` MUST equal `NAV`.
- **(A2) Non-negativity:** `B >= PF + XP` MUST always hold.
- **(A3) Solvency:** `NAV >= R` MUST always hold.

### 2.3 Optional outflows

Optional outflows include:

- LP withdraw/redeem
- protocol fee withdrawals/distributions
- XP claims (referral/kickback claims)

For any optional outflow that decreases `B`, the Bank MUST ensure:

- **(A4) Safety domain:** `NAV_after - R_after >= MinLiq(NAV_after)`

Debt-out operations are **not** optional outflows and MUST NOT be blocked by `MinLiq`.

## 3. Bet lifecycle (Hub SSOT)

### 3.1 States

`None -> Held -> PendingVRF -> RandomReady -> (Settled | Refunded)`

### 3.2 Accepting a bet (Risk-in)

Hub MUST:

1. validate bet params via the game module
2. compute `reserved := maxPayout(params, stake)`
3. compute a **pricing snapshot** (see §3.2.1)
4. call `Bank.holdBet(betId, player, stake, reserved, snapshotHash)`
5. create a VRF request and bind `requestId -> (hub, betId)`

Bank MUST reject holding a bet if `Free_after < 0`.

#### 3.2.1 Pricing snapshot (non-retroactive; skyline)

At `placeBet(gameId, params, stake, affiliate, maxHouseEdgeBps)` the Hub MUST compute and snapshot pricing inputs
such that **accepted bets cannot be repriced retroactively**.

Implementation requirement (SSOT): the Hub MUST store a **normalized** `maxHouseEdgeBps` per bet
(`0 => MAX_HOUSE_EDGE`, `>MAX => MAX`) and include it in the bet's `snapshotHash`.

Definitions:

- `baseHouseEdgeBps` := `defaultHouseEdgeBps`.
- Each affiliate MAY set an explicit `houseEdgeBps` subject to bounds:
  - `houseEdgeBps >= baseHouseEdgeBps`
  - `houseEdgeBps <= baseHouseEdgeBps + maxAffiliateDeltaBps` (or `<= 10_000` if `maxAffiliateDeltaBps == 0`).

**Pricing affiliate selection** (best-effort, non-blocking):

1. Let `pricingAffiliate = referrerOf(player)`.
2. If unbound and `affiliate != 0`, the Hub MUST attempt `bindFor(player, affiliate)` best-effort.
3. If still unbound, the Hub MAY fall back to the provided `affiliate` hint.

**Skyline construction** (bounded to ≤ 6 segments):

Walk the referral chain starting from `pricingAffiliate` for up to 6 hops.
Maintain `curMax = baseHouseEdgeBps`.
Whenever a node has an explicit `houseEdgeBps[node] > curMax`, append a segment:

- `payee = node`
- `incBps = houseEdgeBps[node] - curMax`
- update `curMax = houseEdgeBps[node]`

Set `effectiveHouseEdgeBps = curMax`.

Segments are encoded as packed bytes:

- segment = `address(20 bytes) || uint16 incBps (2 bytes)`
- at most 6 segments
- total length = `22 * segments`

By construction: `sum(incBps) == effectiveHouseEdgeBps - baseHouseEdgeBps`.

The Hub MUST enforce a user-provided maximum:

- if `effectiveHouseEdgeBps > maxHouseEdgeBps`, `placeBet` MUST revert.

The Hub MUST snapshot and store, per bet:

- `pricingAffiliate`, `baseHouseEdgeBps`, `effectiveHouseEdgeBps`
- `deltaSkylineHash = keccak256(deltaSkylineBytes)` (and store the bytes for finalize)
- `referralConfigId` (see §5)

The `snapshotHash` passed to `Bank.holdBet` MUST commit to the pricing snapshot.

### 3.3 Finalization (Debt-out)

For any bet that is `RandomReady`, **anyone** MAY call `Hub.finalize(betId)`.

Settlement MUST satisfy:

- payout computation is deterministic given (params, randomWords, snapshots)
- Bank MUST NOT reduce `payoutGross` due to liquidity, pause, or admin actions
- Bank MUST NOT revert settlement due to referral/fee transfers; those are accrued as liabilities

#### 3.3.1 Fee-on-payout (house edge)

v1.0 implements house edge as **fee-on-payout**:

- `feeOnPayout = payoutGross * effectiveHouseEdgeBps / 10_000`
- `payoutNet = payoutGross - feeOnPayout`

The Bank MUST pay the player `payoutNet + refundAmount` and MUST NOT require any external transfers
(fee sink, referral transfers) to succeed.

#### 3.3.2 Turnover-based budgets (base + delta)

Let `usedTurnover = stake - refundAmount`.

Compute turnover-based house-edge amounts:

- `baseHEAmt = usedTurnover * baseHouseEdgeBps / 10_000`
- `deltaHEAmt = usedTurnover * (effectiveHouseEdgeBps - baseHouseEdgeBps) / 10_000`

Then compute budgets using the bet's snapped referral config (see §5):

- `baseBudget = baseHEAmt * baseBudgetBps / 10_000`
- `deltaBudget = deltaHEAmt * deltaBudgetBps / 10_000`

Non-budget portions accrue as protocol fees:

- `nonBudgetBase = baseHEAmt - baseBudget`
- `nonBudgetDelta = deltaHEAmt - deltaBudget`

Budgets MUST be distributed by the referral engine as **liability accruals** (XP buckets), not transfers.
Any unallocated budget MUST be returned as `sink` and accrued as protocol fees.

### 3.4 Refund (Debt-out)

If VRF has not completed within `refundTimeoutSeconds`, **anyone** MAY call `Hub.refund(betId)`.

Refund MUST:

- return principal to player via `Bank.refundBet`
- detach VRF request so late callbacks cannot finalize the bet

## 4. VRF transport (VRFHub)

- fulfill MUST **never revert**.
- unknown/detached requestId MUST be soft-ignored (emit and return).
- detach MUST prevent late fulfill from driving valid settlement.

## 5. Referral / XP (liabilities; permissionless)

XP is split into three buckets per payee:

- `xpAccrued`: claimable now
- `xpLocked`: unlockable when turnover threshold is met
- `xpHoldback`: released via rolling linear vesting

### 5.1 XP is not LP backing

XP MUST be counted as a liability:

- `XP = xpAccruedTotal + xpLockedTotal + xpHoldbackTotal`
- `NAV = B - PF - XP`

### 5.2 Permissionless unlock (locked -> accrued)

- Any account MAY call `unlockXPLocked(payee, sourcePlayer)`.
- Unlock condition MUST be a pure predicate over on-chain state (e.g., `turnover[sourcePlayer] >= threshold`).
- Unlock MUST be a bucket move only (no transfers), so it MUST remain live even during pause.

### 5.3 Permissionless linear vesting (holdback -> accrued)

- Any account MAY call `syncXPHoldback(payee)`.
- The released amount MUST be a pure function of:
  - `xpHoldback[payee]`
  - `holdbackLastSync[payee]`
  - `holdbackVestingEnd[payee]`
- Sync MUST be a bucket move only (no transfers), so it MUST remain live even during pause.

### 5.4 Claim is optional outflow

`claimXPAcrued(amount, receiver)` (where `payee == msg.sender`) is an optional outflow:

- MUST be blocked by risk-in pause
- MUST satisfy (A4) safety domain

### 5.5 Referral plans (base + delta)

Referral rewards are computed in two independent components:

1. **Base plan** (`baseBudget`): multi-level upline distribution with `levelBps`.
   - Level 0 MAY represent a player kickback.
2. **Delta plan** (`deltaBudget`): skyline-based distribution proportional to `incBps` segments.

Both components MUST:

- apply the same eligibility rule (immediate vs locked) using turnover thresholds
- apply holdback as a bucketed liability (holdback -> accrued via linear vesting)
- return unallocated amounts as `sink` (accrued as protocol fees)

## 6. Observability & audit surface

The protocol MUST expose:

- `Bank.getSSOT()` (B/PF/XP/NAV/R/minLiq/free)
- `Hub.getBet(betId)` (player, state, stake, reserved, requestId, timestamps, hashes, pricing snapshot)
- events sufficient to reconstruct:
  - bet lifecycle
  - reserve changes
  - XP accrual/unlock/sync/claim
  - fee accruals

## 7. Forbidden behaviors (MUST NOT)

- LP withdrawals that reduce backing below solvency/reserve constraints.
- Settlement or refund blocked by pause, minLiquidity, or admin approval.
- Any admin/emergency function that can transfer `ASSET` out of Bank without SSOT checks.
- Any VRF callback path that can revert and permanently brick fulfillment.
