# Bank solvency and historical recovery

Use the current generated Bank ABI and one numbered block. Identify the asset by chain and Bank,
not a display pool ID. Amounts remain raw asset units until formatted with verified decimals.

## Accounting

Read `getSSOT`, `exitPayable`, `playerPayableTotal`, `recoveryBacking`, `currentEpoch`,
`activeOpenHolds`, `openHolds`, `activeReserved`, `totalReserved` and `totalSupply`.

- `NAV = B - PF - XP - exitPayable - playerPayableTotal - recoveryBacking` is active capital.
- `getSSOT().R = activeReserved` covers active units in both old and new open holds.
  `totalReserved - activeReserved - sum(epoch.remainingReserve)` is open protocol reserve from full exits.
  Epochs must be completely discovered at one block before deriving this remainder.
- Historical `backingAssets` includes each batch's open exiting reserve and released unclaimed recovery.
  Its sum can be less than `recoveryBacking`: the difference includes open protocol reserve and
  cross-batch floor remainders not yet finally assigned. It is not free LP NAV. Reconcile terminal
  `BetRiskSettled`, per-batch final synchronization and `ProtocolCapitalAccrued` before classifying dust.
- Require `NAV >= activeReserved`, equivalently cash covers PF, XP, fixed exits, player debt,
  all recovery backing and active reserve. Do not clamp a backing deficit away.
- Risk-in and optional-outflow buffers apply to active NAV. New bets cannot use historical backing.
  Fixed LP claims and recovery payments do not use a withdrawal-buffer limit on the entitled amount.
  PF/XP claims still enforce their existing optional-outflow domain.

The SSOT tuple omits fixed LP/player and recovery liabilities, so read their public views separately.
Token admission assumes exact transfers and non-rebasing balances. A recipient or issuer restriction
can prevent cash delivery even when the accounting remains backed.

## Queues, epochs and claims

Read `redeemBatch(currentEpoch)` for the one waiting queue. A nonempty queue remains cancellable until
activation, even after its eligible cutoff. While unpaused, anyone may activate an eligible queue.
Activation segregates only exiting reserve units, records their controllers, burns requested shares
once and prices its liquid cash. It never waits for an older epoch or for recipients to claim.

Discover sealed epochs through `RedeemBatchActivated`, for activated request controllers, including those with zero remaining shares. Read `recoveryEpoch(epochId)` and `getRecovery(epochId, controller)` at the same block.
`claimableAssets` is currently released cash; `pendingAssets` is only a future additional upper bound.
It is not a guaranteed payment or a completion-time promise. Wallet transfers and new deposits do
not transfer an earlier epoch's rights.

`withdraw`/`redeem` claim ordinary liquid entitlements; `claimRecovery` claims a specified historical
epoch. Both require controller/operator authority and stop while paused. Permissionless `syncRedeem`
and `syncRecovery` only perform bookkeeping, including during pause. Final synchronization can release
rounding dust without requiring inactive holders to return; assigned unpaid amounts stay fully backed.

## Incidents and recovery

An unresolved old hold retains its reserve and recovery ownership but cannot gate later queues or
new betting subject to capital and the 128 active-risk-hold limit. Other holds in that epoch can still release claimable recovery. Diagnose
PendingVRF refunds and RandomReady finalization using the [casino runbook](game-finalization-diffs.md).
Never invalidate a winner or erase a recovery right to clear an alert.

Player transfer failure may become a fully backed payable while the hold terminalizes. Its later
`claimPlayerPayable(player)` cannot charge the old epoch again and pays only that player. The keeper discovers
new debts only after their creation block is finalized; this can delay automatic payment. A player
can claim earlier. Monitor the finalized discovery target separately from latest head. RPC, funding
or claim-delivery errors remain degraded through retry backoff until reconciliation succeeds;
unknown token reverts are actionable too.

Monitor historical age from actual activation using finalized chain time and a restart-safe paginated
index. Historical-risk alerts and provider cash-flow indexing wait for finality; compare finalized
coverage with latest head rather than interpreting a caught-up finalized cursor as live coverage.
Staying capital recovers in each terminal transaction without a claim or keeper reinvestment.
Monitor `activeOpenHolds / MAX_ACTIVE_HOLDS` separately from capital utilization.
Ten minutes is an alert threshold, not an exit deadline. Incomplete scanning must remain degraded
rather than reporting that no historical risk exists. Reconcile `RecoveryClaimed` cash events by
beneficiary and distinguish explicit Bank donations. Provider ledger ingestion uses finalized blocks
only; an unavailable or regressing finalized target must report a scan failure.

Verify `ProtocolCapitalAccrued` separately from gameplay protocol fees. Full-exit virtual residuals
and historical final dust follow [ADR-0035](../../adr/0035-recovery-rights-without-exit-blocking.md);
they are not an extra gameplay house-edge allocation.
