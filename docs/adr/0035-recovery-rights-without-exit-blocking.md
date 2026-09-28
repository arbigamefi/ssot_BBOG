# ADR-0035: Preserve old risk without blocking later LP exits

- **Status:** Accepted and implemented. Accounting model and Bank accounting independently reviewed; local contract and consumer validation is complete. External audit and fresh network acceptance remain required. See the [candidate evidence](../audit/v1.6-audit-scope.md).
- **Scope:** the current prelaunch Bank. Replace the affected accounting and consumers together; no compatibility contract, migration path, token market or second Bank.
- **Required outcomes:** ordinary LP operations never stop adequately funded betting; an unresolvable old position never gates a later redemption batch; original holders retain the old position's losses and recovery rights.

## What can be paid

A redemption separates available cash from rights against unresolved positions. The request remains cancellable until activation. Activation prices its available cash and records its historical recovery rights. The controller pulls the cash through the usual asynchronous redemption claim; later recovery is claimed separately.

This is not a guarantee of full cash payment by a deadline. If every asset backs a genuinely unresolved obligation, available cash can be zero. The remaining entitlement stays owned and backed; it is not destroyed by a reserve haircut. Later batches do not wait for that obligation. A player remains entitled to the correct outcome, never a forced invalid refund.

## Epochs isolate all old risk once

Every accepted hold records its current Bank epoch. At redemption activation:

1. Snapshot current active NAV `N`, real share supply `S`, and only the current epoch's reserve `R0` and open-hold count. Require `S > 0` and `N >= R0`.
2. Segregate the entire `R0`, including the portions economically belonging to staying LPs. Older epochs are already segregated and must not be counted again.
3. Freeze the beneficial share ownership of **all** current LPs. The boundary is this transaction's ordering, not wall-clock eligibility or an earlier bet placement.
4. Price the queued batch's available cash, burn its queued shares once, and advance the current epoch before any subsequent share change can overwrite the snapshot.

Only a waiting request queue remains. There is no unique isolated exit slot and no maximum number of unfinished historical epochs that can block new requests, activation or betting. An old settlement updates its own epoch and global totals only. Different epochs can settle and be claimed in any order.

The Bank still enforces available capital and independent emergency pauses. These requirements do not promise unlimited underwriting after capital leaves, transaction inclusion, or immunity to a token-wide freeze.

## One frozen curve, then holder allocation

Keep the virtual offset `V` used by synchronous deposits. `V` is one thousandth of a token, in both assets and shares (one base unit for assets below three decimals). The virtual position's share of value, about `V/(S+V)` of each recovery in a profitable pool, goes to protocol capital under the residual rules below; a one-token `V` would take about 14% of every recovery in a 6 USDC pool. At one thousandth it is negligible, while a first-depositor donation must still be about a thousand times the deposit it attacks and is almost all captured by the virtual position. Compute the aggregate real-LP curve before allocating to individual holders:

```text
G(x) = min(floor(S * (x + V) / (S + V)), x)
L = N - R0
Q = shares in the redeeming batch
batch liquid assets = floor(Q * G(L) / S)

C = cumulative actual terminal cost of this epoch's old holds
R = remaining reserve of those holds
D = R0 - C - R                      // safely released cash
H = G(L + D) - G(L)                  // cumulative real-LP recovery
U = D - H                           // cumulative virtual-capital residual

holder's cumulative recovery = floor(snapshotUnits * H / S)
new claim = cumulative recovery - previously claimed recovery
```

Actual cost includes player net payout, refund, PF and every XP bucket. It is charged when the hold terminates, including when a failed transfer creates a player payable. Paying that debt later cannot charge this epoch again. Every terminal cost must fit its hold's original reserve.

`G` is nondecreasing with integer increments at most one. Therefore `D`, `H` and `U` are nondecreasing as holds terminate with `cost <= reserve`. Recovery from completed holds can be claimed while another hold in the same epoch remains stuck. At complete terminalization, `G(L) + H = G(N-C)`: the real-LP aggregate retains its frozen final-value curve.

Use cumulative allocation, not independently rounded release increments. For a holder `q`, its liquid allocation plus recovery is at most `floor(q * G(N-C) / S)`, and hence at most its original real-equity-capped quote, before the usual batch/controller rounding. Deposits immediately before a boundary do not acquire a more generous reserve-redemption formula. The model tests this boundary; it does not prove arbitrary economic strategies harmless.

Two rejected shortcuts have concrete counterexamples:

- With `N=2, S=2, V=1, R0=1`, two holders of one share each independently calculating their curve difference would claim two asset units against one reserved unit. Calculate aggregate `H` first.
- Starting at `N=200, S=100, V=100, R0=200`, a new deposit of 100 receives 66 shares. Combining the liquid virtual quote with ordinary real-share reserve allocation can return 118 after a zero-cost old outcome. Retain the frozen curve for recovery as well.

## Backing and residual ownership

Let `P` be the global backing retained for historical epochs, including released but unclaimed recovery. Let `LP` be priced ordinary exit liabilities and `PP` player payables:

```text
active NAV = B - PF - XP - LP - PP - P
active reserve = current epoch's open reserve
global reserve = active reserve + sum(historical remaining reserves)
```

Sealing adds `R0` to `P`. An old terminalization subtracts its cost from `P` while raw NAV falls by that same cost. Moving newly recognized `U` to protocol-owned liabilities decreases `P` and increases PF equally. A recovery payment to an external receiver decreases cash and `P` equally. Terminalization, residual allocation and external claims cannot change active NAV; new LPs do not acquire old recovery when reserve is released. An authorized claim whose receiver is the Bank itself is an explicit donation to active NAV, as with ordinary exit claims; it is not an automatic redistribution.

The residual ownership rule is:

- `U` belongs to protocol capital and is recorded as PF payable, never new-LP NAV. It is the virtual branch's residual, not a fee deducted from `H`. Record it separately from gameplay fee accrual and house-edge metrics.
- On a **full** real-share exit, the already-liquid residual `L-G(L)` also becomes protocol capital. Later deposits cannot take ownerless liquid value. Do not skim this residual from all remaining LPs on partial exits; that would impose a different recurring economic rule.
- A closed epoch's holder rounding remainder stays backed until every snapshot unit has had its final entitlement assigned. Permissionless per-holder final synchronization then releases only `H - sum(final holder entitlements)` to protocol capital once. Assigned but unclaimed entitlements stay backed. An inactive holder need not return personally, and there is no expiry or governance seizure of their rights.
- The ordinary redeeming batch still allocates its liquid total by controller. A full-exit batch's final rounding remainder goes to protocol capital even if new LPs have since deposited. For partial-exit batches the existing liquid-remainder rule can remain; it is separate from historical risk recovery.

No claim may spend the remaining reserve. For each pocket, its retained backing must cover its remaining reserve plus all released entitlements not yet paid or reassigned under the explicit residual rules. All-zero active supply does not extinguish any historical entitlement.

## Historical ownership without a holder loop

Use the already pinned OpenZeppelin `Checkpoints.Trace256` for wallet balances, keyed by the internal epoch. Do not add a voting/delegation system or hand-written checkpoint search. Record each epoch/controller's net queued shares separately and freeze them on activation:

```text
snapshotUnits(account, epoch)
  = walletBalanceAt(account, epoch) + queuedControllerShares(epoch, account)
```

`walletBalanceAt(Bank, epoch)` is always zero for this ledger: Bank escrow is not a second owner of controller shares. Zero and Bank addresses are invalid controllers. A request from one owner to another controller transfers the requested shares' current economic rights to that controller; historical rights from already sealed epochs stay with their earlier holder. Cancellation changes only the current epoch's request weight and wallet balance. Future transfers, minting, burning, or claim synchronization cannot alter a sealed epoch's weight.

Advance the internal epoch even when no reserve is isolated. Block-number checkpoints are insufficient: transfers after activation in the same block must not change the pre-activation snapshot. Keep historical request weights independently of the current controller queue slot.

Reject ordinary mint/transfer destinations equal to the Bank; only the internal request path may create share escrow. This removes ambiguous direct-to-Bank donations from the recovery denominator. Every share counted in `S` must have exactly one beneficiary. Verify all external share entry points, including delegated transfers and deposit receivers.

Each recovery query, synchronization and claim names one epoch. Use bounded caller-selected batches only if needed; never scan every historical epoch inside deposit, transfer, bet settlement, redemption, or a standard max/pending view. Checkpoint lookup is logarithmic; hold settlement and epoch rollover are constant work. Sealed epoch IDs are exactly `1 .. currentEpoch-1`. The SDK pages those IDs at a fixed block to discover rights, without scanning empty block ranges. Events remain the index for cash flows; neither query path becomes the authority for ownership.

## Claims and consumers

The [ERC-7540 request and claim flow](https://eips.ethereum.org/EIPS/eip-7540#request-lifecycle) remains pull-based. Ordinary `withdraw`/`redeem` pays the priced liquid entitlement. Historical recovery is a separate extension with its own event and per-epoch view; an ordinary cash claim never cancels it. Controllers or their chosen operators authorize receiver redirection. Keepers receive no user operator authorization.

Keep the existing emergency-pause boundary: it stops activation, ordinary LP claims and recovery payments, while settlements and player-payable claims remain live. Historical entitlement synchronization remains permissionless and available during pause because it transfers no tokens and changes no beneficiary. Zero liquid assets do not prevent a controller redeeming all positive ordinary claim units for zero; that clears only those units. Zero available recovery causes no token transfer and never deletes the underlying historical right. Failed recovery transfers atomically preserve the claim. Claims and synchronization must be idempotent and cannot finalize the same units twice.

The implementation must expose the liquid request quote and recovery state from Solidity so the SDK does not duplicate `G/H` pricing. All views used together must read the same block. No caller can treat a zero active wallet balance as absence of historical recovery.

- Keeper activates eligible queues without waiting for any old pocket. Existing finalization/refund logic continues. Historical-pocket monitoring is paginated and recoverable after restart; alerts never gate later activation. Discover pocket creation for all snapshot holders, including those who never submitted a redemption request.
- Earn shows queued shares, priced cash, and historical recovery separately. An upper bound on recovery is not cash available to withdraw or a promised payment. Incomplete historical discovery and unsettled recovery must be shown as incomplete or uncertain; the current simple realized-plus-open-value display cannot label them a complete final return.
- Recovery payments enter the existing LP cash-flow ledger and PnL calculations. Attribute cash to the entitled holder, not the operator or chosen receiver, and record it exactly once. Epoch creation, segregation and mere availability are not cash receipts. Events, reorg rollback and idempotent replay must cover recovery as well as ordinary withdrawals; an explicit donation to the Bank must not be represented as external cash received.
- Remove the single-isolated-batch fields, waiting gates, keeper pricing job and obsolete UI states when replacing them. Do not retain alternate contract modes or generated compatibility ABIs.

## Implementation and acceptance gates

The executable candidate is `test/model/recovery_pocket_model.py`:

```sh
python3 -m unittest discover -s test/model -p 'recovery_pocket_model.py' -v
```

All 26 tests passed in the author and independent root runs. They cover 104,544 integer curve states,
18,614 three-holder allocation states, 7,990 deposit/liquid/recovery exit states, six old-settlement
orders, and nine successive epochs while the first hold remains open, with positive liquid payments
in all eight later exits. The model additionally checks
partial releases, frozen controller ownership, full exits/new deposits, protocol residual allocation,
final dust and player-payable costs. These are finite-domain and scenario checks, not a proof of every
possible strategy. Copy-based ownership snapshots serve as an independent oracle; they do not validate
the eventual Checkpoints implementation or its same-block writes. Model evidence does not establish
Solidity authorization, token behavior, gas limits, event indexing, ERC conformance or deployment readiness.

Implement in this order:

1. Freeze the arithmetic, residual rules and ownership ledger with independent model counterexamples.
2. Replace Bank/interface accounting and adapt existing security assertions; add permanent-old-position, second/third exit, mixed-controller, same-block transfer, complete exit/new-deposit, all-zero liquidity, partial recovery, and failed-claim/retry tests. Check runtime size and historical settlement gas with the canonical compiler settings. At 2,000 optimizer runs the Bank runtime is 24,318 bytes, leaving 258 bytes below EIP-170; recheck after every source change.
3. Generate the single ABI set and update SDK, cash ledger/indexer, keeper and Earn together. Exercise real local Bank integration with old pockets still open and include replay/reorg and pagination.
4. Run unit, invariant, mutation and browser gates for the new source identity, then freeze the source/ABI set for external audit and fresh network acceptance.

A permanently open first epoch must coexist with positive cash payments from later exits; preserving only the ability to submit a request is insufficient. This is exercised in the model, Solidity and real local Bank integration suites. Local validation does not replace external audit or fresh network acceptance.
