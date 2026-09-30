# Executable SSOT (Invariants) v1.6 — House-edge allocation

This document defines the machine-checkable proof obligations for [SSOT v1.6](SSOT.v1.6.md).

> Related ADR:
>
> - [ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md) (fixed LP share, operator-funded referrals)
> - [ADR-0034](../adr/0034-async-lp-redemption-continuous-betting.md) (asynchronous LP redemptions, section L)

**Status: current prelaunch proof obligations.** Test coverage is mapped below; network acceptance and external audit remain separate.

## Scope & implementation

The authoritative enforcement points after implementation SHOULD include:

- unit tests for the allocation arithmetic in `GameHub` (every row of the SSOT v1.6 worked example);
- unit tests for the `SettlementRouter` cap, including a hub that tries to exceed it;
- casino E2E tests through `GameHub -> SettlementRouter -> Bank`;
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

## B — Accounting

### B1. NAV identity

`NAV = B − PF − XP − exitPayable − playerPayableTotal − recoveryBacking` and `totalAssets() == NAV`
hold after every completed operation. `getSSOT().R == activeReserved()`; totalReserved is a separate global view.

### B2. Solvency

Cash covers PF, XP, fixed LP/player payables and totalReserved. Active NAV covers activeReserved.
Each terminal position's net player payout, refund and all new PF/XP together must not exceed its reserve.

## L — LP exits and historical recovery (ADR-0034/0035)

### L1. Continuous betting and later exits

One waiting queue remains cancellable until activation, including after eligibility. Activation prices
liquid cash, burns requested shares once and isolates only exiting rights. Old holds do not gate later
batches. Zero liquid cash preserves recovery rights. No LP phase pauses betting; ordinary capital,
emergency-pause and the 128 active-risk hold limit remain explicit constraints.

### L2. Reserve ownership and atomic capital recovery

Every original reserve unit belongs once to active capital, exiting batches or the protocol. Active NAV
excludes historical backing. Settlement frees the staying units in the same transaction and updates one
hold plus totals, without scanning batches or holders. Terminal cost includes payout, refund, PF and XP,
including player debt. A later debt claim cannot charge risk twice.

### L3. Pricing and recovery

`E=floor(Q*min(floor(S*(N+V)/(S+V)),N)/S)`. Liquid is `floor(E*(N-R)/N)` and each hold
allocates `floor(activeUnits*E/N)` exiting units. At zero NAV both are zero. A batch recovers
`floor(units*(originalReserve-cost)/originalReserve)` per completed hold. Its controllers receive
proportional floors of cumulative recovery, less prior claims. Test conservation, the direct individual
terminal-price cap and the explicit one-base-unit double-floor bound in the independent integer model.

### L4. Historical ownership and bounded work

Only activated request controllers receive frozen rights. Staying wallet shares carry active exposure
through transfers and deposits. Same-block transfers, subsequent requests, zero active supply and new
LPs cannot modify exited weights. No wallet checkpoint ledger remains. Original reserve denominators
never rebase. Activation and one-batch recovery operations visit at most 128 holds; settlement does
not grow with historical batches. Full exits remove all active-risk slots without erasing old rights.

### L5. Claims, synchronization and residuals

Controllers/operators choose claim receivers. Ordinary and recovery claims stop while paused; sync
remains permissionless without transfers. Partial ordinary withdrawals cannot strand assets without
units, and clearing zero-asset liquid units preserves recovery. Failed transfers revert claims atomically.
Final recovery dust is released once, only after all historical units' final entitlements are assigned;
unclaimed assigned assets stay backed. Virtual residuals and full-exit liquid remainder go to protocol
capital without incrementing gameplay fee counters. Partial exits do not skim all stayers' liquid residual.

### L6. Player payables

Failed payout/refund transfers preserve full debt and terminalization if the entire transaction can
complete. Otherwise everything reverts. Anyone can claim a player payable during pause, only to that
player, and a failed claim retains the debt. Admission enforces exact-transfer token assumptions.

### L7. Consumers

SDK quotes and history pages share a block identity. Historical discovery includes every activated
request controller, including a controller with zero remaining wallet shares. Recovery cash is attributed once to its holder, independently of caller
and receiver, with explicit Bank donations distinguished. Reorg replacement removes orphaned cash
facts. Wallet-zero and incomplete-history cases retain visible historical rights and uncertainty.

### L8. Standard surface

The Bank answers ERC-165 for ERC-7540 operators (`0xe3bc4e65`), asynchronous redemption (`0x620ee8e4`),
ERC-7575 (`0x2f0a18c5`) and its share (`0xf815c03d`), not asynchronous deposits. `previewRedeem` and
`previewWithdraw` revert. Standard max/pending views cover ordinary requests only; recovery is separate.

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

### Casino admission (ADR-0034 stage 2)

`GameHubE2E` covers all eight admitted casino modules at `betCount=100`, both XP eligibility states,
six skyline segments and nine nonzero awards. Successful finalization must preserve the module's result,
clear exactly one hold, allocate the correct liabilities and permit batch pricing and LP claim. A failed
whole transaction must preserve the pending position and all balances for retry. Router allocation-cap
errors must revert; they must not become invalid-module refunds. Parameters above 64 bytes must be
rejected before a position or VRF request is created.

Run `make test-casino-admission` to apply the 3,000,000-gas call envelope with isolated transaction gas
accounting; PR CI runs the same target. Asset/provider and network acceptance are separate release checks.

| Obligation                     | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 Conservation                | `HouseEdgeAllocationV16`: worked examples and `testFuzz_allocationConservesTheEdge`; `StatefulSystemDiff` recomputes every settlement independently                                                                                                                                                                                                                                                                                                                     |
| A2 LP floor at the Router      | `SettlementRouter.t.sol` cap tests and `testFuzz_settlementAcceptedIffWithinOperatorShareAndCombinedReserve`; `SettlementRouterInvariants.invariant_allocation_never_exceeds_operator_share`                                                                                                                                                                                                                                                                            |
| A3 Referral cap                | `testFuzz_allocationConservesTheEdge`; `test_scheduleCapAndVersions`                                                                                                                                                                                                                                                                                                                                                                                                    |
| A4 Payee existence             | `test_workedExample_noReferrer`, `test_nothingIsPaidBeyondL2`, fuzzed chains of depth 0 to 2                                                                                                                                                                                                                                                                                                                                                                            |
| A5 Unclaimed share to protocol | worked examples; `test_roundingRemaindersAccrueToProtocol`                                                                                                                                                                                                                                                                                                                                                                                                              |
| A6 Refunds allocate nothing    | `test_timeoutRefundAllocatesNothing`, `test_partialRefundAllocatesOnUsedTurnoverOnly`; `SecurityFixes` invalid-result refunds                                                                                                                                                                                                                                                                                                                                           |
| A7 Non-retroactivity           | `test_bindingAfterAcceptanceDoesNotAddPayees`, `test_uplineBindingAfterAcceptanceDoesNotAddL2`, `test_scheduleChangeAfterAcceptanceDoesNotApply`, `test_baseEdgeChangeWaitsForDelayAndIsNotRetroactive`; `StatefulSystemDiff` late bindings and governance changes                                                                                                                                                                                                      |
| A8 Edge bound                  | `test_openPosition_rejectsEdgeAboveMax` and the Router invariant; `test_markupStartsDisabled`, `test_staleAffiliateEdgeIsClampedToTheCurrentCap`, `test_staleAffiliateEdgeIsClampedToALowerCap`                                                                                                                                                                                                                                                                         |
| A9 Sports positions            | `SportsHubTicket` asserts edge `0`; `test_zeroEdgePositionCannotAccrueAnything`                                                                                                                                                                                                                                                                                                                                                                                         |
| B1 NAV identity, B2 solvency   | checked after every settlement in `HouseEdgeAllocationV16`; `BankInvariants`                                                                                                                                                                                                                                                                                                                                                                                            |
| L1 Old-risk ownership          | `BankPendingExposure`; `BankAsyncRedemption`; real Hub/Router continuity test in `GameHubE2E`                                                                                                                                                                                                                                                                                                                                                                           |
| L2 Continuous betting          | `GameHubE2E.test_asyncExitKeepsBettingLiveAndHistoricalRecoveriesSeparate`; `BankInvariants.invariant_historical_epochs_preserve_ownership_backing_and_current_risk`                                                                                                                                                                                                                                                                                                    |
| L3 Frozen pricing              | `BankAsyncRedemption`: exit-only recovery and atomic staying capital, full exits, deposits and reserve allocation; `test/model/recovery_pocket_model.py`; `BankInvariants`                                                                                                                                                                                                                                                                                              |
| L4 Claims                      | `test_partialClaimOrderDoesNotChangeTheTotal`, `test_withdrawCannotConsumeEveryShareAndLeaveAssets`, `test_onlyTheControllerOrItsOperatorClaimsAndPicksTheReceiver`, `test_pauseStopsClaimsButNotRequestsSyncOrCancellation`, `test_exitsAreExemptFromTheWithdrawalBuffer`                                                                                                                                                                                              |
| L5 Assignment                  | `test_remainderReturnsToNavOnceEveryShareIsAssigned`, `test_viewsAgreeWithStoredStateAfterSync`; `BankInvariants.invariant_priced_exits_are_conserved`                                                                                                                                                                                                                                                                                                                  |
| L6 Queued escrow               | `BankAsyncRedemption`: cancellation before activation, allowances and rescue; `BankInvariants.invariant_escrow_matches_pending_requests`                                                                                                                                                                                                                                                                                                                                |
| L7 Player payables             | `test_refusedPayoutBecomesAPayableAndTheBatchStillPrices`, `test_refusedRefundBecomesAPayable`, `test_tokenOutOfGasPreservesTheWholePayoutAsPayable`, `test_proxyTokenOutOfGasPreservesTheWholePayoutAsPayable`, `test_tokenOutOfGasPreservesTheWholeRefundAsPayable`, `test_proxyTokenPaysDirectlyWithEnoughGas`, `test_underfundedSettlementRollsBackTheWholePosition`, `test_everyNavComputationSubtractsBothPayables`; `BankInvariants` blocks and unblocks players |
| L8 Standard surface            | `test_supportsTheErc7540RedeemAndErc7575InterfaceIds`, `test_theBankIsItsOwnShareToken`, `test_redemptionPreviewsRevertAndDepositViewsFollowPause`                                                                                                                                                                                                                                                                                                                      |
| G1 Constants                   | `test_constants`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| G2 Delayed changes             | `test_baseEdgeChangeWaitsForDelayAndIsNotRetroactive`, `test_markupIncreaseWaitsForDelay_decreaseIsImmediate`, `test_cancelledBaseEdgeChangeCannotActivate`                                                                                                                                                                                                                                                                                                             |
| G3 Schedule validity           | `test_scheduleCapAndVersions`; `SecurityFixes` referral-config tests                                                                                                                                                                                                                                                                                                                                                                                                    |
| G4 Guardian scope              | `test_onlyGovernanceChangesAllocationParameters`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| G5 Refund timeout bound        | `test_refundTimeoutIsBoundedToOneDay`, `test_constructorRefusesARefundTimeoutAboveOneDay`; `DeploymentV16.testRefundTimeoutAboveOneDayIsRefusedBeforeBroadcast`                                                                                                                                                                                                                                                                                                         |

Unless another file is named, tests are in `test/unit/HouseEdgeAllocationV16.t.sol`.
