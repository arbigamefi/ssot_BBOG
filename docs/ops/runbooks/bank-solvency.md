# Bank solvency and historical recovery

Use the current generated Bank ABI and one numbered block. Identify the asset by chain and Bank,
not a display pool ID. Amounts remain raw asset units until formatted with verified decimals.

## Accounting

Read `getSSOT`, `exitPayable`, `playerPayableTotal`, `recoveryBacking`, `currentEpoch`,
`currentOpenHolds`, `openHolds`, `activeReserved`, `totalReserved` and `totalSupply`.

- `NAV = B - PF - XP - exitPayable - playerPayableTotal - recoveryBacking` is active capital.
- `getSSOT().R = activeReserved` covers only current-epoch holds. Across the complete historical index,
  `activeReserved + sum(epoch.remainingReserve) = totalReserved`.
- Historical `backingAssets` includes remaining risk and released but unclaimed recovery. Its sum is
  `recoveryBacking`; each pocket must cover its remaining reserve. Do not count this reserve twice.
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
Activation segregates only that epoch's reserve, records all original holders, burns requested shares
once and prices its liquid cash. It never waits for an older epoch or for recipients to claim.

Discover sealed epochs through `RedeemBatchActivated`, including epochs in which an account stayed
in the pool. Read `recoveryEpoch(epochId)` and `getRecovery(epochId, controller)` at the same block.
`claimableAssets` is currently released cash; `pendingAssets` is only a future additional upper bound.
It is not a guaranteed payment or a completion-time promise. Wallet transfers and new deposits do
not transfer an earlier epoch's rights.

`withdraw`/`redeem` claim ordinary liquid entitlements; `claimRecovery` claims a specified historical
epoch. Both require controller/operator authority and stop while paused. Permissionless `syncRedeem`
and `syncRecovery` only perform bookkeeping, including during pause. Final synchronization can release
rounding dust without requiring inactive holders to return; assigned unpaid amounts stay fully backed.

## Incidents and recovery

An unresolved old hold retains its reserve and recovery ownership but cannot gate later queues or
adequately funded betting. Other holds in that epoch can still release claimable recovery. Diagnose
PendingVRF refunds and RandomReady finalization using the [casino runbook](game-finalization-diffs.md).
Never invalidate a winner or erase a recovery right to clear an alert.

Player transfer failure may become a fully backed payable while the hold terminalizes. Its later
`claimPlayerPayable(player)` cannot charge the old epoch again and pays only that player.

Monitor historical age from actual activation using chain time and a restart-safe paginated index.
Ten minutes is an alert threshold, not an exit deadline. Incomplete scanning must remain degraded
rather than reporting that no historical risk exists. Reconcile `RecoveryClaimed` cash events by
beneficiary, distinguish explicit Bank donations, and remove orphaned events on reorg.

Verify `ProtocolCapitalAccrued` separately from gameplay protocol fees. Full-exit virtual residuals
and historical final dust follow [ADR-0035](../../adr/0035-recovery-rights-without-exit-blocking.md);
they are not an extra gameplay house-edge allocation.
