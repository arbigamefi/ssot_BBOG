# Protocol Constitution (SSOT) v1.1 — Immutable, Clean-Room (Multi-Asset + Multi-Roll)

This document is **normative**. Keywords **MUST / MUST NOT / SHOULD / MAY** are used as defined in RFC 2119.

The constitution defines what the protocol **must be**, not what any legacy implementation happened to do.

v1.1 supersedes v1.0 by:
- Making **multi-asset** a first-class SSOT property (no future “base rewrite”).
- Specifying **multi-roll** semantics (stake/usedTurnover/refund, stopGain/stopLoss, and canonical RNG expansion).
- Freezing **player == receiver** (no recipient separation) to minimize trust surface and proof complexity.

## 0. Core axioms

1. **Per-asset single custody (Bank):** for each supported ERC20 `asset`, all protocol funds
   denominated in `asset` MUST be held in exactly one immutable `Bank(asset)` vault.
   No other contract (including Hub, VRFHub, engines, modules) MAY custody `asset` beyond transient
   transfers during settlement/refund/withdrawals.

2. **Single lifecycle (Hub):** all bets, across all assets, MUST be registered and finalized
   through a single `Hub` with a global `betId` namespace. Each bet MUST bind to exactly one `asset`
   (and therefore exactly one `Bank(asset)`).

3. **Compositional games:** games MUST be implemented as pure modules (no Hub inheritance /
   duplicated state machines). Modules MUST be deterministic given (params, stake spec, pricing snapshot, RNG).

4. **Debt-out liveness:** settlement and refund paths MUST remain live regardless of pause/emergency
   settings and regardless of any optional-outflow safety domains.

5. **Player is receiver:** v1.1 fixes `player == receiver` for all bets and payouts. (Any future
   recipient separation requires a new constitution version.)

## 1. Modules and governance

### 1.1 Modules

- **Bank(asset)** (`src/core/Bank.sol` or `BankVault.sol`):
  - single-asset ERC4626-like vault semantics (LP shares per asset)
  - Accounting SSOT and buckets (`PF / XP / R`) **for that asset**
  - bet escrow/reserve/settle/refund funds API (Hub-only)
  - per-asset turnover tracking for XP unlock gating

- **BankRegistry** (or equivalent immutable mapping):
  - `asset -> Bank(asset)` mapping for supported assets
  - governance MAY add support for new assets by registering a new `Bank(asset)`
  - governance MAY disable risk-in for an asset, but MUST NOT break debt-out for existing bets

- **Hub** (`src/core/Hub.sol`):
  - global bet registry (single `betId` namespace)
  - per-bet asset binding (`bet.asset`, `bet.bank`)
  - pricing snapshots (house edge + skyline)
  - referral plan orchestration (base + delta budgets)
  - VRF orchestration and callback handling
  - permissionless `finalize(betId)` and `refund(betId)` for liveness

- **VRFHub** (`src/core/VRFHub.sol`):
  - `requestId -> (hub, betId)` mapping
  - detach/clear semantics
  - **fulfill never reverts** (soft-ignore unknown/detached)

- **Game Modules** (`src/modules/*`):
  - `validate(params, stakeSpec)` (stakeSpec includes multi-roll fields)
  - `maxPayout(params, stakeSpec)` returning a **worst-case bound** for total outflow
  - `resolve(params, stakeSpec, rng)` returning (at minimum) `payoutGross` and `usedTurnover`
    deterministically

- **Referral system** (`src/engines/referral/*`):
  - registry (first-touch relationship) in a single global namespace (not per-asset)
  - deterministic referral engine (pure math)
  - XP buckets in `Bank(asset)` (liabilities, not LP backing)

### 1.2 Governance

v1.1 is **immutable** (no upgrades). Governance MAY:

- register (asset -> bank) and register games/modules
- set risk-in pause (globally and/or per-asset, depending on implementation)
- set pricing / budget parameters
- set XP unlocking thresholds and vesting duration (per asset)

Governance MUST NOT:

- block debt-out liveness (finalize/refund) for any asset
- withdraw `asset` outside SSOT constraints
- move liabilities between assets (no cross-asset netting)

## 2. Accounting SSOT (per-asset Bank)

For each supported asset `a`, define the Bank vault `Bank(a)` and the following quantities in **token units of `a`**:

### 2.1 Base quantities (per asset)

- `B[a]`  := `IERC20(a).balanceOf(Bank(a))` (ground truth)
- `PF[a]` := protocol fees payable (liability bucket, denominated in `a`)
- `XP[a]` := external payables total (liability bucket, denominated in `a`)
- `NAV[a] := B[a] - PF[a] - XP[a]` (LP backing for asset `a`)
- `R[a]`  := `totalReserved` (worst-case pending bet liability for asset `a`)
- `MinLiq[a](NAV) := NAV * minLiquidityBps[a] / 10_000`
- `Free[a] := NAV[a] - R[a] - MinLiq[a](NAV[a])`

### 2.2 SSOT requirements (per asset)

For every supported asset `a`, the following MUST always hold:

- **(A1[a]) Identity:** `Bank(a).totalAssets()` MUST equal `NAV[a]`.
- **(A2[a]) Non-negativity:** `B[a] >= PF[a] + XP[a]` MUST always hold.
- **(A3[a]) Solvency:** `NAV[a] >= R[a]` MUST always hold.

### 2.3 Optional outflows (per asset)

Optional outflows for asset `a` include:

- LP withdraw/redeem from `Bank(a)`
- protocol fee withdrawals/distributions of `PF[a]`
- XP claims (referral/kickback claims) from `Bank(a)`

For any optional outflow that decreases `B[a]`, `Bank(a)` MUST ensure:

- **(A4[a]) Safety domain:** `NAV_after[a] - R_after[a] >= MinLiq[a](NAV_after[a])`

Debt-out operations (settle/refund) are **not** optional outflows and MUST NOT be blocked by `MinLiq`.

### 2.4 Cross-asset prohibition

The protocol MUST NOT use solvency from one asset to back another:

- There MUST NOT exist any mechanism that transfers liabilities `PF/XP/R` between assets.
- A solvency violation in asset `a` MUST NOT be “fixed” by draining asset `b`.

## 3. Bet lifecycle (Hub SSOT, multi-asset)

### 3.1 States

`None -> Held -> PendingVRF -> RandomReady -> (Settled | Refunded)`

### 3.2 Accepting a bet (Risk-in)

Hub MUST:

1. select `Bank(asset)` via the asset registry and bind the bet to it
2. validate bet params via the game module using the full stake specification (§3.2.2)
3. compute `reserved := maxPayout(params, stakeSpec)`
4. compute a **pricing snapshot** (see §3.2.1)
5. call `Bank(asset).holdBet(betId, player, stake, reserved, snapshotHash)`
6. create a VRF request and bind `requestId -> (hub, betId)` in VRFHub

Bank MUST reject holding a bet if `Free_after[asset] < 0`.

#### 3.2.1 Pricing snapshot (non-retroactive; skyline)

At `placeBet(gameId, asset, params, stakeSpec, affiliate, maxHouseEdgeBps)` the Hub MUST compute and snapshot pricing inputs
such that **accepted bets cannot be repriced retroactively**.

The Hub MUST store a **normalized** `maxHouseEdgeBps` per bet (`0 => defaultHouseEdgeBps`, `>MAX => MAX`)
and include it in the bet's `snapshotHash`.

The remaining skyline construction, bounds, and snapshot fields are unchanged from v1.0.

#### 3.2.2 Stake specification (multi-roll)

A bet MUST include a stake specification:

- `amountPerRoll` (token units of `asset`)
- `betCount` (number of rolls requested)
- `stopGain` (token units; `0` disables)
- `stopLoss` (token units; `0` disables)

Define:

- `stake := amountPerRoll * betCount` (total escrow)
- `stake` MUST be the amount transferred from the player to `Bank(asset)` at hold time.

Bounds:
- `betCount` MUST be within a protocol-defined safe bound (e.g., `1..MAX_BET_COUNT`).
- `amountPerRoll` MUST be non-zero.
- `stopGain` and `stopLoss` MAY both be zero (no early stop). If non-zero, they MUST be within safe bounds
  to avoid overflow and griefing (implementation-defined).

## 3.3 Finalization (Debt-out)

For any bet that is `RandomReady`, **anyone** MAY call `Hub.finalize(betId)`.

Settlement MUST satisfy:

- payout computation is deterministic given (params, stakeSpec, snapshots, RNG)
- Bank MUST NOT reduce `payoutGross` due to liquidity, pause, or admin actions
- Bank MUST NOT revert settlement due to referral/fee transfers; those are accrued as liabilities

### 3.3.1 Fee-on-payout (house edge)

v1.1 implements house edge as **fee-on-payout**:

- `feeOnPayout = payoutGross * effectiveHouseEdgeBps / 10_000`
- `payoutNet = payoutGross - feeOnPayout`

`Bank(asset)` MUST pay the player `payoutNet + refundAmount` and MUST NOT require any external transfers
(fee sink, referral transfers) to succeed.

### 3.3.2 Used turnover and refund (multi-roll semantics)

For a bet with `stakeSpec` and final outcome:

- `usedTurnover` MUST be the total amount actually wagered across executed rolls.
- `refundAmount := stake - usedTurnover`.

Requirements:

- `0 <= usedTurnover <= stake`
- `0 <= refundAmount <= stake`
- **Turnover accounting:** all turnover-based quantities (budgets, XP gating turnover, etc.) MUST use
  `usedTurnover`, not `stake`.

### 3.3.3 Canonical stopGain / stopLoss semantics

Define per-roll running totals during resolution:

- `usedTurnoverSoFar` (sum of wagered amounts)
- `payoutGrossSoFar` (sum of gross payouts)

Define running profit:

- `profitSoFar := payoutGrossSoFar - usedTurnoverSoFar`

Stop conditions are evaluated **after** each roll is applied:

- if `stopGain > 0` and `profitSoFar >= stopGain` then resolution MUST stop early
- if `stopLoss > 0` and `profitSoFar <= 0 - stopLoss` then resolution MUST stop early

If both are enabled and both would be satisfied after a roll, stopping is still the same (stop early).
(Which one “triggered” is informational only.)

When stopping early:
- `usedTurnover` is fixed at `usedTurnoverSoFar`
- remaining un-wagered escrow MUST be refunded via `refundAmount`

### 3.3.4 Canonical RNG expansion (multi-roll)

VRF provides one or more 256-bit random words to Hub. The protocol defines a canonical RNG expansion to
derive per-roll randomness deterministically from a seed.

Let:
- `seed := randomWords[0]`
- `domain := "SSOT_RNG_V1"`

For roll index `i` (0-based), derive:

- `r[i] := uint256(keccak256(abi.encodePacked(domain, betId, i, seed)))`

If a module needs multiple independent random values per roll, it MUST derive them by extending the
domain separation with an inner index `j`:

- `r[i,j] := uint256(keccak256(abi.encodePacked(domain, betId, i, j, seed)))`

Modules MUST NOT use any external state (blockhash, timestamp, tx origin, etc.) as randomness.

### 3.3.5 Turnover-based budgets (base + delta)

Let `usedTurnover` be defined as in §3.3.2.

Compute turnover-based house-edge amounts:

- `baseHEAmt = usedTurnover * baseHouseEdgeBps / 10_000`
- `deltaHEAmt = usedTurnover * (effectiveHouseEdgeBps - baseHouseEdgeBps) / 10_000`

Then compute budgets using the bet's snapped referral config:

- `baseBudget = baseHEAmt * baseBudgetBps / 10_000`
- `deltaBudget = deltaHEAmt * deltaBudgetBps / 10_000`

Non-budget portions accrue as protocol fees (in `PF[asset]`).
Budgets MUST be distributed by the referral engine as **liability accruals** (XP buckets), not transfers.
Any unallocated budget MUST be returned as `sink` and accrued as protocol fees.

## 3.4 Refund (Debt-out)

If VRF has not completed within `refundTimeoutSeconds`, **anyone** MAY call `Hub.refund(betId)`.

Refund MUST:

- return `stake` to player via `Bank(asset).refundBet`
- detach VRF request so late callbacks cannot finalize the bet

## 4. VRF transport (VRFHub)

- fulfill MUST **never revert**
- unknown/detached requestId MUST be soft-ignored (emit and return)
- detach MUST prevent late fulfill from driving valid settlement

## 5. Referral / XP (liabilities; permissionless, per-asset)

### 5.1 XP is per-asset and not LP backing

For each asset `a`, XP MUST be counted as a liability in `Bank(a)`:

- `XP[a] = xpAccruedTotal[a] + xpLockedTotal[a] + xpHoldbackTotal[a]`
- `NAV[a] = B[a] - PF[a] - XP[a]`

There MUST NOT be any cross-asset XP netting.

### 5.2 Permissionless unlock (locked -> accrued)

For each asset `a`:

- Any account MAY call `unlockXPLocked(payee, sourcePlayer)` on `Bank(a)`.
- Unlock condition MUST be a pure predicate over on-chain state within `Bank(a)`
  (e.g., `turnover[a][sourcePlayer] >= threshold[a]`).
- Unlock MUST be a bucket move only (no transfers), so it MUST remain live even during pause.

### 5.3 Permissionless linear vesting (holdback -> accrued)

For each asset `a`:

- Any account MAY call `syncXPHoldback(payee)` on `Bank(a)`.
- The released amount MUST be a pure function of:
  - `xpHoldback[a][payee]`
  - `holdbackLastSync[a][payee]`
  - `holdbackVestingEnd[a][payee]`
- A new holdback award MUST NOT extend an active `holdbackVestingEnd[a][payee]` while unreleased holdback remains.
  If no unreleased holdback remains, the new award starts a fresh vesting schedule.
- Sync MUST be a bucket move only (no transfers), so it MUST remain live even during pause.

### 5.4 Claim is optional outflow

For each asset `a`, `claimXPAcrued(amount)` is an optional outflow:

- MUST be blocked by risk-in pause for that asset
- MUST satisfy (A4[a]) safety domain

### 5.5 Referral plans (base + delta)

Referral rewards are computed in two independent components:

1. **Base plan** (`baseBudget`): multi-level upline distribution with `levelBps`.
2. **Delta plan** (`deltaBudget`): skyline-based distribution proportional to `incBps` segments.

Both components MUST:
- be computed from `usedTurnover` (not `stake`)
- apply the same eligibility rule (immediate vs locked) using turnover thresholds **for the same asset**
- apply holdback as a bucketed liability (holdback -> accrued via linear vesting)
- return unallocated amounts as `sink` (accrued as protocol fees in the same asset)

## 6. Observability & audit surface

The protocol MUST expose:

- For each asset `a`: `Bank(a).getSSOT()` returning `B/PF/XP/NAV/R/minLiq/free` and config
- `Hub.getBet(betId)` returning (player, asset, bank, state, stakeSpec, reserved, requestId, timestamps, hashes, pricing snapshot)
- events sufficient to reconstruct:
  - bet lifecycle (including asset)
  - reserve changes
  - XP accrual/unlock/sync/claim (including asset)
  - fee accruals (including asset)

## 7. Forbidden behaviors (MUST NOT)

- Any Hub/module/engine custody of user funds beyond transient transfers.
- LP withdrawals that reduce backing below per-asset solvency/reserve constraints.
- Settlement or refund blocked by pause, minLiquidity, or admin approval.
- Any admin/emergency function that can transfer `asset` out of `Bank(asset)` without SSOT checks.
- Any VRF callback path that can revert and permanently brick fulfillment.
- Any cross-asset netting, rehypothecation, or liability migration.
