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

`deposit` and `mint` keep their current virtual-offset book price. A depositor shares, like every LP, in the positions open at that moment. Settlement latency alone does not bound the amount of in-flight exposure. The Earn page states this risk and the real-equity ceiling on redemptions below, including the resulting deposit/redemption price difference when the pool has lost value. Two-sided batching is the upgrade path (see Alternatives).

### 2. Redemptions become asynchronous (ERC-7540, redeem side)

- `requestRedeem(shares, controller, owner)` moves `shares` from `owner` into the Bank's custody. The owner, an approved spender or an operator of the owner may call it.
- A successful request assigns its rights to `controller`, including when `owner` is different. A finite ERC-20 allowance is consumed on the request unless the caller is the owner or an approved operator of the owner; it grants no subsequent authority over another controller's requests.
- Requests are aggregated per controller, with `requestId = 0` as ERC-7540 allows. Internally, a controller has pending shares in at most two batches: the one draining and the next one.
- `cancelRedeemRequest(controller)` may be called only by that controller or its current operator. It returns all that controller's shares in the batch whose cutoff has not passed to the controller itself. ERC-7540 does not define cancellation; this is our extension. No per-original-owner cancellation ledger is needed.
- Requested shares remain in `totalSupply` and keep bearing the pool's results until their batch is priced.
- `redeem(shares, receiver, controller)` and `withdraw(assets, receiver, controller)` only claim priced amounts. `previewRedeem` and `previewWithdraw` revert, as ERC-7540 requires for asynchronous redemption.
- `setOperator(operator, approved)` follows ERC-7540: an operator can request, cancel and claim for the controller, and may send what it claims to any receiver. As an operating rule, the site never asks users to approve a protocol-run operator and keepers are never operators; users claim for themselves. Users may still approve any operator they choose, which the protocol cannot prevent. The Bank never pushes assets without a claim.
- Claim authorization is checked against the controller and its current operators, not against the former owner's ERC-20 allowance. Only an authorized claimant chooses the receiver. Reject zero controller/receiver addresses and zero-share requests.
- Escrowed shares are protected from every other outflow: `rescueToken` rejects both the underlying asset and the Bank's own share token (`address(this)`). A direct share transfer to the Bank creates no redemption request or claim; batch burns and cancellations use only the recorded escrow amounts.

**Interface completeness.** The current Bank is ERC-4626-like, not a complete ERC-7540 implementation. The new Bank must supply the standard request views and events, operator methods, ERC-165 support and ERC-7575 `share()` view, as well as the synchronous ERC-4626 deposit views and previews. `share()` returns the Bank itself. `maxWithdraw(controller)` and `maxRedeem(controller)` report the effective claimable totals after lazy synchronization, return zero while LP claims are paused, and do not quote pending requests or wallet-held shares. Their values must not be inferred from the live share conversion. Claimable shares are accounting units already burned at batch pricing, so claims never burn them a second time. Standard conformance is an explicit implementation gate against the linked specifications, including applicable overloads; the name of the interface alone is not evidence of conformance.

**Allocation within a batch.** Pricing records the batch's total shares `S_b` and assets `A_b` and adds `A_b` to `exitPayable`; it does not visit any user.

- A controller holding `s` of the batch's shares is entitled to `floor(s × A_b / S_b)`.
- Before a request, cancellation or claim, the Bank checks the controller's at most two batch slots, adds each priced entitlement to its claimable totals exactly once, and clears that slot before reusing it. View functions return the same effective values without writing them.
- Anyone may call `syncRedeem(controller)` to perform this same bounded bookkeeping, including while the Bank is paused. It cannot transfer assets or shares, cancel a request, choose a receiver or change an authorization. An inactive controller therefore need not return before its entitlement can be assigned and the batch's rounding remainder released.
- Each batch counts the shares and assets assigned this way. Until all `S_b` shares are assigned, `A_b − assigned assets` includes the full entitlements of controllers not yet synchronized and stays in `exitPayable`. Once all shares are assigned, only the rounding remainder is left unassigned; it leaves `exitPayable` and returns to NAV exactly once. This final remainder is nonnegative and strictly less than one smallest asset unit per participating controller in total. Assigned but unclaimed assets remain in `exitPayable`.

**Claims across batches.** Each controller keeps two running totals, `claimableShares` and `claimableAssets`. Priced batches only add to them; nothing is ever overwritten.

- `redeem(s)` pays `floor(s × claimableAssets / claimableShares)`. Redeeming every claimable share pays every claimable asset. If those assets are zero, redeeming the remaining shares still clears them and returns zero without attempting a token transfer.
- `withdraw(a)` pays exactly `a` and consumes `ceil(a × claimableShares / claimableAssets)` shares. It reverts if it would consume every remaining share while leaving assets behind; the controller then withdraws all its assets or redeems all its shares instead.

The order of partial claims therefore cannot change what a controller receives in total, and no claim leaves assets without shares.

### 3. Batches by time, settled by anyone

- Cutoffs fall on multiples of `batchPeriod` in Unix time. Governance sets `batchPeriod` within `[MIN_BATCH_PERIOD, MAX_BATCH_PERIOD]`. Proposed: 1 hour to 7 days, initially 1 day. A change applies to batches opened after it.
- A batch opens with its first request and takes the first boundary strictly after that request as its cutoff; a request made exactly on a boundary joins the batch after it. If every request is cancelled before that cutoff, the empty batch is retired immediately and frees its slot; it neither blocks betting nor needs pricing. No allocation divides by zero batch shares. A later request opens a batch at the next fixed boundary as usual. Without pending requests there is no batch, and betting is never stopped.
- **The cutoff takes effect by time, not by a call.** `holdBet` itself rejects new positions while any unpriced batch has reached its cutoff. Requests and cancellations are split by the same timestamp: at or after the cutoff, a request joins the next batch and the draining batch can no longer be cancelled.
- The Bank holds at most two unpriced batches: the one draining and the next. If the next batch also reaches its cutoff while the first is still draining, a request that would open a third batch reverts. No cutoff is ever extended.
- `settleBatch()` can be called by anyone, except while the Bank is paused, and prices batches in order. It requires that the cutoff has passed, the batch is not yet priced, and `openHolds == 0`, where `openHolds = totalBetsHeld − totalBetsSettled − totalBetsRefunded`. Every hold ends exactly once, through `settleBet` or `refundBet`, so no new counter is needed; `totalReserved == 0` is not used as the signal. `settleBatch()` then:
  - snapshots `N = totalAssets()`, `S = totalSupply` and `Q = batchShares`, with `0 < Q <= S`, and computes `A_b = min(_convertToAssets(Q, Floor), floor(Q * N / S))` using `Math.mulDiv`;
  - burns those shares and moves the assets into `exitPayable`;
  - records the batch as priced. Betting resumes only when no unpriced batch has reached its cutoff. If the next batch has already reached its cutoff, it can be priced at once, because no position was opened after the first cutoff.
- Deposits stay open while a batch drains.

**A position that cannot settle.** Under strict draining, a position that never reaches a terminal state keeps its batch unpriced, so that pool's exits and betting stop until it settles. Synchronous exits only stranded one reserve. Any bounded exit around such a position has to decide who bears its remaining range of outcomes: exiting LPs, staying LPs or both, and whether exiters keep a claim on what it finally releases. That changes LP economic rights and is a separate decision (see Open decisions). Until it is made, such a position is an incident for operations, and admission (section 7) is what keeps it from happening.

**Real-equity ceiling.** The virtual asset offset is not cash. If `N < S`, converting all real shares with the unbounded virtual formula can exceed `N`; the existing optional-outflow check used to reject that payment. For example, with six decimals, `S = 10e6`, `N = 5e6` and `V = 1e6`, the virtual quote is `5_454_545`, although only `5_000_000` asset units belong to LPs. The proportional ceiling above preserves both backing and the remaining LPs' proportionate real equity. Capping only at the whole pool's NAV would allow an early batch to consume the remaining LPs' share of a severely depleted pool. When `N >= S`, the original virtual quote is unchanged; when `N == 0`, the batch prices at zero and its shares can still be burned and cleared. This ceiling is a solvency rule, independent of the withdrawal buffer. All pricing inputs, the burn and the new liability are one atomic operation.

### 4. Exit payables are isolated

- `exitPayable` is a liability outside NAV, like PF and XP. Later bets neither pay into it nor draw on it.
- Claims draw only on `exitPayable`, so the ADR-0031 withdrawal buffer does not apply to them. The real-equity ceiling always applies when pricing. If the whole real supply exits after a loss, the batch receives the available NAV; in a profitable pool the virtual offset can retain a residual. Per-controller rounding is handled separately above.
- PF and XP are already deducted from NAV. Settling a batch does not wait for any payee to claim.

### 5. A payout transfer cannot block settlement

- `settleBet` and `refundBet` attempt the transfer to the player. If it fails, the amount is credited to `playerPayable[player]` and the reserve is released, so the position still reaches its terminal state.
- A player payable is a debt, like a payout. Anyone may trigger its claim, which is exempt from `pause` and from every buffer and always pays the player's own address, so a player contract without a claim path of its own is not stranded. A payable owed to an address the issuer has blacklisted therefore waits until the issuer lifts the block; it cannot be redirected elsewhere.
- Only transfer failures are converted. Other settlement reverts, such as the Router's allocation cap or the reserve check, indicate a bug and are kept unreachable by review and tests. A valid winner is never turned into a refund to finish a drain.
- Reuse the pinned OpenZeppelin `SafeERC20.trySafeTransfer` for the initial payout/refund attempt; do not add a general catch around settlement. This requires admitted assets to leave balances unchanged on a failed transfer: `trySafeTransfer` returning false does not itself undo a token's side effects. A token that moves funds and then returns false fails admission. A successful transfer and a new payable are mutually exclusive. Payable claims decrease the player balance and aggregate liability before the transfer, use the existing reentrancy guard, and revert atomically on failure so the debt is preserved. An aggregate `playerPayableTotal` supports constant-time NAV; it is distinct from the derived open-position count. Settlement counters continue to record the amount owed at terminalization and are not incremented again on claim. Separate payable-created/paid events let consumers distinguish an unpaid award from cash received.
- An issuer-wide token pause still stops payouts and claims. That is an external assumption, stated on the pool page.

With `exitPayable` and the aggregate `playerPayableTotal`:

```text
NAV = B − PF − XP − exitPayable − playerPayableTotal
```

This holds in every place the Bank computes NAV, through one internal function: the share price, `getSSOT`, the risk-in check in `holdBet`, the optional-outflow cap and the claim checks.

At every externally observable completed operation, `B >= PF + XP + exitPayable + playerPayableTotal + totalReserved`. Paying either new payable to an external receiver reduces cash and that liability equally and leaves NAV unchanged; an authorized LP claim directed to the Bank itself is instead a donation back to NAV. Pricing a batch reduces NAV and increases `exitPayable` by the same amount. Asset admission retains the existing exact-transfer, non-rebasing accounting assumption; changing token behavior or an issuer removing backing is outside this guarantee.

### 6. Emergency pause

`pause` keeps its current scope. It stops risk-in and optional outflows: deposits, LP exit claims, and PF and XP claims. It does not stop settlements, refunds or player-payable claims. Normal batch operation never uses it.

### 7. Scope of the first version

Batch exits require that every position a pool can hold has a public, bounded path to a terminal state. The first version admits casino hubs and modules that pass that acceptance. Sports pools are not admitted until the sports deadlines (ADR-0033 and its successors) are complete.

Admission is enforced with the existing PoolRegistry Hub/pool allowlist and deployment verification, covering every pool ID that points to a Bank. Removing an admission stops new positions without disabling settlement of existing ones. `PendingVRF` refunds currently read a mutable global timeout, but its contract maximum is one day: absent fulfillment, every position accepted before a cutoff is refund-eligible by cutoff plus one day regardless of later permitted timeout changes. This is an eligibility bound, not an inclusion or payout guarantee. `RandomReady` positions continue through the admitted module and referral engine's valid finalization path. Maximum bet count, referral allocation, all refund branches, gas bounds and duplicate/late callbacks must pass end-to-end acceptance; no generic timeout cancels an already valid winner.

### 8. Operating targets, not guarantees

- A batch should drain within one VRF round, about a minute today. There is no proven upper bound: the bound depends on section 5 and on every `RandomReady` bet being finalizable.
- Keepers discover the Bank's batches, finalize `RandomReady` bets, submit eligible `PendingVRF` refunds, and then call `settleBatch` in order. They reconcile missed events and restarts from on-chain state, tolerate another caller winning a race, and alert when a drain runs longer than 10 minutes. A healthy finalizer that simply skips `PendingVRF` does not satisfy this requirement. Drain age is measured from the chain cutoff and survives a keeper restart; alert-delivery state advances only after successful delivery, using the existing health/notification path.
- Players see betting on the pool pause while it drains. LPs see exits priced within one `batchPeriod` plus the drain.

## Invariants

These become tests.

1. Shares in a redemption request bear the pool's results until their batch is priced.
2. No position opened at or after a batch's cutoff counts toward that batch, and the cutoff cannot be extended. There are at most two unpriced batches, and betting is closed while any unpriced batch has reached its cutoff.
3. Batch assets equal the virtual-offset quote bounded by the batch's proportional real NAV at the same settlement state. They never exceed that real equity, including zero-NAV and all-share exits; the uncapped virtual quote still applies when `NAV >= totalSupply`.
4. A priced batch's assets are isolated: `exitPayable` is untouched by later bets.
5. Every open position can reach a terminal state; a failed payout transfer does not revert settlement.
6. PF and XP are deducted before pricing, and settlement does not wait for any claim.
7. Claims are independent of one another and cannot be repeated. Pricing a batch does not iterate over users. The order of a controller's partial claims does not change its total, and no partial withdrawal leaves claimable assets without claimable shares.
8. Once every share of a priced batch is assigned, `exitPayable` holds no unassigned remainder of that batch. Synchronization is permissionless and idempotent, touches at most two controller slots, and leaves assigned but unclaimed assets reserved. Stored and view-computed entitlements agree after synchronization.
9. Player-payable claims succeed while the Bank is paused and pay only the player.
10. Every NAV computation subtracts both new payables.
11. The scan's two counterexamples (`BankPendingExposureEvidence`), rewritten as safety assertions, fail against the current Bank and pass against the new one.
12. Cancelling every request before cutoff retires the empty batch without pricing or blocking betting. Zero-asset entitlements can be cleared by redeeming their shares, without a token transfer.
13. The Bank's share balance covers every pending escrowed share. Neither rescue nor another controller's allowance/operator can remove them. Cancellation returns shares to the request controller, and claims never burn shares twice.
14. Cash covers PF, XP, both new payables and remaining reserves. A failed transfer creates exactly one payable without moving assets; a failed claim preserves it; successful external claims do not change NAV or count the payout again. An LP claiming to the Bank itself explicitly donates the amount back to NAV.
15. `maxWithdraw`, `maxRedeem`, pending/claimable views, SDK balances and events agree on wallet, escrowed, priced and paid amounts. Keeper restart and missed-event recovery reach settlement or eligible refund, then batch pricing, without relying on a player to return.
16. LP exit assets reach a controller's receiver only through that controller's (or its operator's) claim. Players are still paid directly at settlement, and only a failed payout transfer becomes a claimable payable.

## Alternatives considered

- **Two-sided batching** (deposits queued too): gives the clearest risk attribution, since new LPs bear risk only from the next batch. Deposits then wait up to a batch, and pending deposits need an escrow ledger. Deferred; adopt it if institutional LPs require it or if in-flight exposure becomes material.
- **Pricing open positions at expected value** (the gTrade approach of valuing open positions): keeps exits instant. It needs an expected payout from every game module, and exits would still have to be blocked while results are revealed but unsettled. Rejected.
- **Deposit allowlist:** stops outside attackers only. It remains an option for an operator-only phase, not a fix.
- **Parallel capital cohorts:** betting continues during drains, at the cost of separate capital per cohort and a much larger review surface. Rejected.

## Consequences

- The Bank ABI changes (the ERC-7540 redeem side, new events). The SDK, Earn page, indexer and keeper follow; the keeper calls `settleBatch` and alerts on long drains. Game rooms read the pool's batch state and tell players betting resumes after settlement, instead of surfacing the `holdBet` revert.
- Keep v1.5 contract addresses, ABIs and synchronous flows associated with their deployed identity. Detect async capability per Bank; a chain ID alone does not identify the Bank version. Preserve the existing `getSSOT` tuple shape and add separate views for new liabilities/batches, updating consumers so they do not infer `NAV = B - PF - XP` for the async Bank. The SDK reads actual claimable asset amounts rather than `convertToAssets(maxRedeem)`, and its LP position includes requested and claimable rights after wallet shares enter escrow. Player receipts distinguish a finalized payable from a completed cash transfer.
- `src/core/Bank.sol` and `IBank` change, so the v1.6 audit scope reopens and is frozen again after implementation.
- v1.5 Banks are unchanged. The mainnet v1.5 pool holds only operator capital, and no new LP capital is added before a Bank with this design ships.
- A new Base Sepolia deployment exercises full batch cycles before the external audit.
- The two release-import findings and the Sports finding from the original scan remain open. Their deferred remediation is separate from the LP implementation. A public release still needs an accepted artifact-authentication path; async-redemption tests cannot close those findings. The preserved remediation worktree's earlier two-sided-cohort plan is historical evidence, superseded for LP architecture by this ADR.

## Open parameters

- `MIN_BATCH_PERIOD`, `MAX_BATCH_PERIOD` and the initial `batchPeriod`.
- The drain alert threshold.
- Whether deposits should pause when a pool's in-flight share exceeds a limit (not proposed now).

## Open decisions

- **Bounded exit when a position cannot settle.** To be decided in its own ADR before outside LP capital is admitted to these Banks. It must say who bears the unresolved position's outcomes (exiting LPs, staying LPs or both), whether exiters keep a claim on its eventual release, whether an affected request may be withdrawn instead, who may trigger it, and what happens if every LP exits. Pricing the exiting shares at the position's full reserve, as briefly drafted on 2026-09-28, was withdrawn: it imposed a permanent, involuntary haircut on exiting LPs and could leave the released value without an owner.
