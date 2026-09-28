# ADR-0034: Asynchronous LP redemptions, settled in drained batches

- **Status:** Proposed (2026-09-28). The owner accepts or amends it before implementation starts.
- **Applies to:** Banks of the v1.6 release unit and later. Deployed v1.5 Banks are immutable and keep synchronous exits.
- **Amends, for those Banks:** [ADR-0031](0031-bank-risk-reserve-and-withdrawal-buffer.md). Priced batch exits and player payables are exempt from the withdrawal buffer, and synchronous `withdraw`/`redeem` are replaced.
- **Standards:** [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) for deposits; [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540), redeem side only, for redemptions.
- **Trigger:** security scan of `979be07a6` (2026-09-28), finding "LP exit shifts unsettled risk" (P1).

## Context

The Bank prices shares from `totalAssets() = B − PF − XP`, with a virtual offset `V = 10^decimals`:

```text
assets = shares × (totalAssets + V) / (totalSupply + V)
```

`B` already holds the stakes of open positions, and nothing marks what those positions may still pay. `withdraw` and `redeem` check only `paused()` and the optional-outflow cap `NAV − R − WithdrawalBuffer`. That cap limits the amount, not the price.

One root cause has two consequences:

1. A player who is also an LP can place a bet and then redeem at a price that counts their own stake, while keeping the bet's upside. The remaining LPs carry the bet.
2. A bet's random result is on chain (`BetRandomReady`, `getBetRandomWords`) before `finalize` books the payout. Any LP can see a winning result coming and redeem before the loss lands. With keepers polling every 60 seconds, the window is about a minute.

Deposits are not exploitable in the same way. The price already counts pending stakes, so depositing ahead of a known player loss gains nothing, and depositing ahead of a known win loses.

Settlement liveness matters for any batch design. `finalize` catches a failing game module and refunds the stake (`_refundInvalidRandomReadyBet`). But `Bank.settleBet` pushes the payout with `safeTransfer`. If the asset issuer has blacklisted the winner's address, that transfer reverts every time. The bet then stays `RandomReady`, which has no refund path. Today that strands one reserve; under batch settlement it would block every exit from the pool.

Exposure on 2026-09-28: the mainnet v1.5 USDC Bank held 6.02 USDC, with every share held by the operator. The WETH Bank was empty and paused. The v1.6 Banks inherit the same code.

## Decision

### 1. Deposits stay synchronous

`deposit` and `mint` keep their ERC-4626 behaviour at the current book price. A depositor shares, like every LP, in the positions open at that moment. Because casino bets settle within about a minute, those in-flight positions are normally a very small part of the pool. The Earn page states this rule. Two-sided batching is the upgrade path (see Alternatives).

### 2. Redemptions become asynchronous (ERC-7540, redeem side)

- `requestRedeem(shares, controller, owner)` moves `shares` from `owner` into the Bank's custody. The owner, an approved spender or an operator of the owner may call it.
- Requests are aggregated per controller, with `requestId = 0` as ERC-7540 allows. Internally, a controller has pending shares in at most two batches: the one draining and the next one.
- `cancelRedeemRequest(controller)` returns shares that are pending in a batch whose cutoff has not passed. ERC-7540 does not define cancellation; this is our extension.
- Requested shares remain in `totalSupply` and keep bearing the pool's results until their batch is priced.
- `redeem(shares, receiver, controller)` and `withdraw(assets, receiver, controller)` only claim priced amounts. `previewRedeem` and `previewWithdraw` revert, as ERC-7540 requires for asynchronous redemption.
- `setOperator(operator, approved)` lets a controller authorize an operator, such as a keeper, to claim on its behalf. The Bank never pushes assets without a claim.

**Allocation within a batch.** Pricing records the batch's total shares `S_b` and assets `A_b` and adds `A_b` to `exitPayable`; it does not visit any user.

- A controller holding `s` of the batch's shares is entitled to `floor(s × A_b / S_b)`.
- The entitlement is added to the controller's claimable totals the first time the controller interacts with the Bank after pricing: a request, a cancellation or a claim. View functions return the same values without writing them.
- Each batch counts the shares and assets assigned this way. Once all `S_b` shares are assigned, the unassigned remainder `A_b − assigned assets` leaves `exitPayable` and returns to NAV. Until then it stays a liability of at most one unit per participant.

**Claims across batches.** Each controller keeps two running totals, `claimableShares` and `claimableAssets`. Priced batches only add to them; nothing is ever overwritten.

- `redeem(s)` pays `floor(s × claimableAssets / claimableShares)`. Redeeming every claimable share pays every claimable asset.
- `withdraw(a)` pays exactly `a` and consumes `ceil(a × claimableShares / claimableAssets)` shares. It reverts if it would consume every remaining share while leaving assets behind; the controller then withdraws all its assets or redeems all its shares instead.

The order of partial claims therefore cannot change what a controller receives in total, and no claim leaves assets without shares.

### 3. Batches by time, settled by anyone

- Cutoffs fall on fixed boundaries every `batchPeriod`. Governance sets `batchPeriod` within `[MIN_BATCH_PERIOD, MAX_BATCH_PERIOD]`. Proposed: 1 hour to 7 days, initially 1 day. A change applies to batches opened after it.
- A batch opens with its first request and takes the next boundary as its cutoff. Without pending requests there is no batch, and betting is never stopped.
- **The cutoff takes effect by time, not by a call.** `holdBet` itself rejects new positions while any unpriced batch has reached its cutoff. Requests and cancellations are split by the same timestamp: at or after the cutoff, a request joins the next batch and the draining batch can no longer be cancelled.
- The Bank holds at most two unpriced batches: the one draining and the next. If the next batch also reaches its cutoff while the first is still draining, a request that would open a third batch reverts. No cutoff is ever extended.
- `settleBatch()` can be called by anyone and prices batches in order. It requires that the cutoff has passed, the batch is not yet priced, and `openHolds == 0`, where `openHolds = totalBetsHeld − totalBetsSettled − totalBetsRefunded`. Every hold ends exactly once, through `settleBet` or `refundBet`, so no new counter is needed; `totalReserved == 0` is not used as the signal. `settleBatch()` then:
  - prices the batch's shares with the Bank's own conversion, `_convertToAssets(batchShares, Floor)`, which is the formula deposits use, virtual offset included;
  - burns those shares and moves the assets into `exitPayable`;
  - records the batch as priced. Betting resumes only when no unpriced batch has reached its cutoff. If the next batch has already reached its cutoff, it can be priced at once, because no position was opened after the first cutoff.
- Deposits stay open while a batch drains.

### 4. Exit payables are isolated

- `exitPayable` is a liability outside NAV, like PF and XP. Later bets neither pay into it nor draw on it.
- Claims draw only on `exitPayable`, so the ADR-0031 withdrawal buffer does not apply to them. "The last LP can exit in full" means all the equity of their shares; the virtual offset's portion stays in the pool as dust.
- PF and XP are already deducted from NAV. Settling a batch does not wait for any payee to claim.

### 5. A payout transfer cannot block settlement

- `settleBet` and `refundBet` attempt the transfer to the player. If it fails, the amount is credited to `playerPayable[player]` and the reserve is released, so the position still reaches its terminal state.
- A player payable is a debt, like a payout. Claiming it is exempt from `pause` and from every buffer, and it pays only to the player's own address. A payable owed to an address the issuer has blacklisted therefore waits until the issuer lifts the block; it cannot be redirected elsewhere.
- Only transfer failures are converted. Other settlement reverts, such as the Router's allocation cap or the reserve check, indicate a bug and are kept unreachable by review and tests. A valid winner is never turned into a refund to finish a drain.
- An issuer-wide token pause still stops payouts and claims. That is an external assumption, stated on the pool page.

With `exitPayable` and `playerPayable`:

```text
NAV = B − PF − XP − exitPayable − playerPayable
```

This holds in every place the Bank computes NAV, through one internal function: the share price, `getSSOT`, the risk-in check in `holdBet`, the optional-outflow cap and the claim checks.

### 6. Emergency pause

`pause` keeps its current scope. It stops risk-in and optional outflows: deposits, LP exit claims, and PF and XP claims. It does not stop settlements, refunds or player-payable claims. Normal batch operation never uses it.

### 7. Scope of the first version

Batch exits require that every position a pool can hold has a public, bounded path to a terminal state. The first version admits casino hubs and modules that pass that acceptance. Sports pools are not admitted until the sports deadlines (ADR-0033 and its successors) are complete.

### 8. Operating targets, not guarantees

- A batch should drain within one VRF round, about a minute today. There is no proven upper bound: the bound depends on section 5 and on every `RandomReady` bet being finalizable.
- Keepers call `settleBatch` and alert when a drain runs longer than 10 minutes.
- Players see betting on the pool pause while it drains. LPs see exits priced within one `batchPeriod` plus the drain.

## Invariants

These become tests.

1. Shares in a redemption request bear the pool's results until their batch is priced.
2. No position opened at or after a batch's cutoff counts toward that batch, and the cutoff cannot be extended. There are at most two unpriced batches, and betting is closed while any unpriced batch has reached its cutoff.
3. The batch price equals the Bank's own conversion at settlement. A deposit and a batch exit made at the same state convert at the same rate, rounding aside.
4. A priced batch's assets are isolated: `exitPayable` is untouched by later bets.
5. Every open position can reach a terminal state; a failed payout transfer does not revert settlement.
6. PF and XP are deducted before pricing, and settlement does not wait for any claim.
7. Claims are independent of one another and cannot be repeated. Pricing a batch does not iterate over users. The order of a controller's partial claims does not change its total, and no partial withdrawal leaves claimable assets without claimable shares.
8. Once every share of a priced batch is assigned, `exitPayable` holds no unassigned remainder of that batch.
9. Player-payable claims succeed while the Bank is paused and pay only the player.
10. Every NAV computation subtracts both new payables.
11. The scan's two counterexamples (`BankPendingExposureEvidence`), rewritten as safety assertions, fail against the current Bank and pass against the new one.

## Alternatives considered

- **Two-sided batching** (deposits queued too): gives the clearest risk attribution, since new LPs bear risk only from the next batch. Deposits then wait up to a batch, and pending deposits need an escrow ledger. Deferred; adopt it if institutional LPs require it or if in-flight exposure becomes material.
- **Pricing open positions at expected value** (the gTrade approach of valuing open positions): keeps exits instant. It needs an expected payout from every game module, and exits would still have to be blocked while results are revealed but unsettled. Rejected.
- **Deposit allowlist:** stops outside attackers only. It remains an option for an operator-only phase, not a fix.
- **Parallel capital cohorts:** betting continues during drains, at the cost of separate capital per cohort and a much larger review surface. Rejected.

## Consequences

- The Bank ABI changes (the ERC-7540 redeem side, new events). The SDK, Earn page, indexer and keeper follow; the keeper calls `settleBatch` and alerts on long drains.
- `src/core/Bank.sol` and `IBank` change, so the v1.6 audit scope reopens and is frozen again after implementation.
- v1.5 Banks are unchanged. The mainnet v1.5 pool holds only operator capital, and no new LP capital is added before a Bank with this design ships.
- A new Base Sepolia deployment exercises full batch cycles before the external audit.

## Open parameters

- `MIN_BATCH_PERIOD`, `MAX_BATCH_PERIOD` and the initial `batchPeriod`.
- The drain alert threshold.
- Whether deposits should pause when a pool's in-flight share exceeds a limit (not proposed now).
