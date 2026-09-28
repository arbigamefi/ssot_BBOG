# Executable SSOT (Invariants) v1.6 — House-edge allocation

This document defines the machine-checkable proof obligations for [SSOT v1.6](SSOT.v1.6.md).

v1.6 extends ExecutableSSOT v1.3. All v1.3 statements remain in force, except where section A below
replaces the v1.0 turnover-budget obligations for casino positions in a v1.6 release unit.

> Related ADR:
>
> - [ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md) (fixed LP share, operator-funded referrals)
> - [ADR-0034](../adr/0034-async-lp-redemption-drained-batches.md) (asynchronous LP redemptions, section L)

**Status: implemented in source; not audited or deployed.** Every obligation below has tests, listed in
[Test mapping](#test-mapping). The v1.5 baseline they replace was pinned by
`test/unit/HouseEdgeAllocationV15.t.sol` at commit `efb83e0a4`, which proved that v1.5 accrues the full
turnover edge to PF and XP.

## Scope & implementation

The authoritative enforcement points after implementation SHOULD include:

- unit tests for the allocation arithmetic in `GameHub` (every row of the SSOT v1.6 worked example);
- unit tests for the `SettlementRouter` cap, including a hub that tries to exceed it;
- migrated casino E2E tests through `GameHub -> SettlementRouter -> Bank`;
- a reference-model differential test (ADR-0009) that recomputes each allocation independently;
- invariant handlers that mix referred and unreferred players, refunds, multi-roll bets and schedule changes.

## Notation

- `Pos[i]` = router position `i`; `U[i] = Pos[i].stake − refundAmount[i]`
- `edge[i]` = `Pos[i].edgeBps`, recorded at `openPosition`
- `E[i] = floor(U[i] × edge[i] / 10000)`; `O[i] = floor(E[i] × (10000 − LP_SHARE_BPS) / 10000)`
- `PF_new[i]`, `XP_new[i]` = protocol fees and all referral liabilities (accrued + locked + holdback) created
  by settling `i`
- `Snap[i]` = base edge, effective edge, referral schedule version and payees snapshotted at acceptance

---

## A — Allocation

### A1. Conservation

For every settled casino position `i`: `lpRetained[i] + PF_new[i] + XP_new[i] = E[i]`, with
`lpRetained[i] = E[i] − O[i]` under the reference hub.

### A2. LP floor at the settlement boundary

For every settled position `i`, enforced by the Router from its own record:
`PF_new[i] + XP_new[i] ≤ O[i]`. A settlement that would exceed it MUST revert.

### A3. Referral cap

For every settled casino position: `R0 + R1 + R2 ≤ floor(E_b × MAX_REFERRAL_BPS / 10000)`.

### A4. Payee existence

`R0 > 0` only if the player had a bound referrer at acceptance. `R1 > 0` only if the L1 payee in `Snap[i]` is
non-zero. `R2 > 0` only if the L2 payee in `Snap[i]` is non-zero. Nothing is paid beyond L2.

### A5. Unclaimed share goes to protocol

`PF_new[i] = O[i] − R0 − R1 − R2 − M` exactly. No missing-payee or rounding amount increases any other
payee or `lpRetained[i]`.

### A6. Refunds allocate nothing

For every refunded position (timeout refund or invalid-result refund): `PF_new = XP_new = 0`.

### A7. Non-retroactivity

The allocation of `i` depends only on `U[i]` and `Snap[i]`. Governance changes to the base edge, markup cap
or referral schedule after acceptance MUST NOT change it.

### A8. Edge bound

For every opened position: `edge[i] ≤ MAX_HOUSE_EDGE_BPS`. While `maxAffiliateDeltaBps = 0`, the effective
edge equals the base edge and `M = 0`.

### A9. Sports positions

For every settled sports position: `PF_new = XP_new = 0` and `edge[i] = 0`.

## B — Accounting (unchanged obligations restated for v1.6 units)

### B1. NAV identity

`NAV = B − PF − XP − exitPayable − playerPayableTotal` and `totalAssets() == NAV` hold after every operation.
`getSSOT()` keeps its tuple, so its `NAV` field is not `B − PF − XP` once either payable is non-zero.

### B2. Solvency

`B ≥ PF + XP + exitPayable + playerPayableTotal` and `NAV ≥ R` hold after every operation.

## L — LP exits (ADR-0034)

### L1. Exits wait for every position

A batch is priced only after its cutoff and while no position is open (`openHolds == 0`). Requested shares
stay in `totalSupply` and bear the pool's results until then. The scan's two counterexamples fail against the
synchronous Bank and pass.

### L2. Cutoffs close betting

From a batch's cutoff until it is priced, `holdBet` refuses new positions. A cutoff is the first multiple of
`batchPeriod` strictly after the batch's first request and never moves. At most two batches are unpriced; a
request that would need a third reverts. Cancelling every request before the cutoff retires the batch.

### L3. Pricing

A batch of `q` shares is priced at `min(q × (N + V) / (S + V), q × N / S)`, with `N`, `S` read in the same
transaction, burned at once and added to `exitPayable`. Later bets neither pay into nor draw on it.

### L4. Claims

Only the controller or its operator claims, to a receiver it chooses, and not while paused. Claims draw on
`exitPayable` only, without the withdrawal buffer. The order of partial claims does not change the total, and
no claim leaves claimable assets without claimable shares.

### L5. Assignment

Synchronization is permissionless and idempotent, touches at most two slots, and agrees with the views. Once
every share of a batch is assigned, its rounding remainder leaves `exitPayable` exactly once.

### L6. Escrow

The Bank holds exactly the unpriced batches' shares. Rescue, allowances and other controllers cannot move
them. Cancellation returns shares to the controller.

### L7. Player payables

A refused payout or refund becomes a player payable and the position still ends. A transfer that ran out of
gas reverts instead. Anyone may trigger a payable claim, also while paused; it pays only the player, and a
failed claim keeps the debt.

### L8. Standard surface

The Bank answers ERC-165 for ERC-7540 operators (`0xe3bc4e65`), asynchronous redemption (`0x620ee8e4`),
ERC-7575 (`0x2f0a18c5`) and its share (`0xf815c03d`), and not for asynchronous deposits. `previewRedeem` and
`previewWithdraw` revert.

## G — Governance

### G1. Constants

`LP_SHARE_BPS = 5000`, `MAX_REFERRAL_BPS = 3500`, `MAX_HOUSE_EDGE_BPS = 500`,
`EDGE_CHANGE_DELAY = 7 days` and `MAX_REFUND_TIMEOUT_SECONDS = 1 day` have no setter.

### G2. Delayed changes

A base-edge change, or an increase of `maxAffiliateDeltaBps`, cannot take effect before its queued time plus
`EDGE_CHANGE_DELAY`.

### G3. Schedule validity

No referral schedule with `l0 + l1 + l2 > MAX_REFERRAL_BPS` can be created or activated.

### G4. Guardian scope

The guardian can pause and cannot change any allocation parameter.

### G5. Refund timeout bound

No refund timeout above `MAX_REFUND_TIMEOUT_SECONDS` can be set, at deployment or later. A bet still pending
VRF is therefore refundable at most one day after placement, and `placedAt + refundTimeoutSeconds` cannot
overflow.

## Test mapping

| Obligation                     | Tests                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 Conservation                | `HouseEdgeAllocationV16`: worked examples and `testFuzz_allocationConservesTheEdge`; `StatefulSystemDiff` recomputes every settlement independently                                                                                                                                   |
| A2 LP floor at the Router      | `SettlementRouter.t.sol` cap tests and `testFuzz_settlementAcceptedIffWithinOperatorShare`; `SettlementRouterInvariants.invariant_allocation_never_exceeds_operator_share`                                                                                                            |
| A3 Referral cap                | `testFuzz_allocationConservesTheEdge`; `test_scheduleCapAndVersions`                                                                                                                                                                                                                  |
| A4 Payee existence             | `test_workedExample_noReferrer`, `test_nothingIsPaidBeyondL2`, fuzzed chains of depth 0 to 2                                                                                                                                                                                          |
| A5 Unclaimed share to protocol | worked examples; `test_roundingRemaindersAccrueToProtocol`                                                                                                                                                                                                                            |
| A6 Refunds allocate nothing    | `test_timeoutRefundAllocatesNothing`, `test_partialRefundAllocatesOnUsedTurnoverOnly`; `SecurityFixes` invalid-result refunds                                                                                                                                                         |
| A7 Non-retroactivity           | `test_bindingAfterAcceptanceDoesNotAddPayees`, `test_uplineBindingAfterAcceptanceDoesNotAddL2`, `test_scheduleChangeAfterAcceptanceDoesNotApply`, `test_baseEdgeChangeWaitsForDelayAndIsNotRetroactive`; `StatefulSystemDiff` late bindings and governance changes                    |
| A8 Edge bound                  | `test_openPosition_rejectsEdgeAboveMax` and the Router invariant; `test_markupStartsDisabled`, `test_staleAffiliateEdgeIsClampedToTheCurrentCap`, `test_staleAffiliateEdgeIsClampedToALowerCap`                                                                                       |
| A9 Sports positions            | `SportsHubTicket` asserts edge `0`; `test_zeroEdgePositionCannotAccrueAnything`                                                                                                                                                                                                       |
| B1 NAV identity, B2 solvency   | checked after every settlement in `HouseEdgeAllocationV16`; `BankInvariants`                                                                                                                                                                                                          |
| L1 Exits wait                  | `BankPendingExposure` (both counterexamples); `test_settleBatchWaitsForTheCutoffEveryPositionAndUnpause`, `test_requestEscrowsSharesThatKeepBearingResults`                                                                                                                           |
| L2 Cutoffs                     | `test_cutoffIsTheFirstBoundaryStrictlyAfterTheFirstRequest`, `test_bettingClosesAtTheCutoffWithoutAnyCall`, `test_aRequestNeedingAThirdUnpricedBatchReverts`, `test_cancellingEveryRequestRetiresTheBatch`; `BankInvariants.invariant_batches_close_betting_and_price_at_real_equity` |
| L3 Pricing                     | `test_profitablePoolPricesAtTheVirtualOffsetQuote`, `test_depletedPoolPricesAtItsRealEquity`, `test_zeroNavBatchClearsItsSharesWithoutATransfer`, `test_twoDueBatchesArePricedInOneCall`, `test_pricedAssetsAreIsolatedFromLaterBets`; the invariant above                            |
| L4 Claims                      | `test_partialClaimOrderDoesNotChangeTheTotal`, `test_withdrawCannotConsumeEveryShareAndLeaveAssets`, `test_onlyTheControllerOrItsOperatorClaimsAndPicksTheReceiver`, `test_pauseStopsClaimsButNotRequestsSyncOrCancellation`, `test_exitsAreExemptFromTheWithdrawalBuffer`            |
| L5 Assignment                  | `test_remainderReturnsToNavOnceEveryShareIsAssigned`, `test_viewsAgreeWithStoredStateAfterSync`; `BankInvariants.invariant_priced_exits_are_conserved`                                                                                                                                |
| L6 Escrow                      | `test_escrowedSharesCannotBeRescuedOrMovedByOthers`, `test_cancelReturnsSharesToTheControllerBeforeTheCutoffOnly`, `test_requestSpendsAFiniteAllowanceButNotAnOperatorOrInfiniteOne`; `BankInvariants.invariant_escrow_matches_pending_requests`                                      |
| L7 Player payables             | `test_refusedPayoutBecomesAPayableAndTheBatchStillPrices`, `test_refusedRefundBecomesAPayable`, `test_payoutThatRanOutOfGasRevertsInsteadOfBecomingAPayable`, `test_everyNavComputationSubtractsBothPayables`; `BankInvariants` blocks and unblocks players                           |
| L8 Standard surface            | `test_supportsTheErc7540RedeemAndErc7575InterfaceIds`, `test_theBankIsItsOwnShareToken`, `test_redemptionPreviewsRevertAndDepositViewsFollowPause`                                                                                                                                    |
| G1 Constants                   | `test_constants`                                                                                                                                                                                                                                                                      |
| G2 Delayed changes             | `test_baseEdgeChangeWaitsForDelayAndIsNotRetroactive`, `test_markupIncreaseWaitsForDelay_decreaseIsImmediate`, `test_cancelledBaseEdgeChangeCannotActivate`                                                                                                                           |
| G3 Schedule validity           | `test_scheduleCapAndVersions`; `SecurityFixes` referral-config tests                                                                                                                                                                                                                  |
| G4 Guardian scope              | `test_onlyGovernanceChangesAllocationParameters`                                                                                                                                                                                                                                      |
| G5 Refund timeout bound        | `test_refundTimeoutIsBoundedToOneDay`, `test_constructorRefusesARefundTimeoutAboveOneDay`; `DeploymentV16.testRefundTimeoutAboveOneDayIsRefusedBeforeBroadcast`                                                                                                                       |

Unless another file is named, tests are in `test/unit/HouseEdgeAllocationV16.t.sol`.
