# ADR-0037: Launch-candidate authority, pause, capacity and void design

- **Status:** Proposed, 2026-10-11. B0 design freeze for the [launch candidate](../release/launch-candidate.zh-CN.md) (§5 step 1, §7).
  Work package B starts only after an independent review without blockers, the external auditor's pre-review and the
  Owner's answers to §11. Until then the current code and the [constitution](../constitution/SSOT.v1.6.md) stay authoritative.
- **Scope:** B1 (admission timelock and the risk-reducing role), B2 (per-player capacity), B3 (pause semantics),
  B4 (dead tree-adapter branch), B5 (void of unbookable results) and B6 (per-game disable). B7–B9 change no interface
  this document defines.
- **Fixed by the Owner (2026-10-11, plan §3):** 72-hour asymmetric timelock; independent guardian multisig; pause never
  blocks LP withdrawals; void tries settlement first, becomes eligible 24 h after the VRF request, may be triggered by the
  Safe or the guardian and by anyone after 7 days, applies to every eligible bet of the Bank, refunds the stake and not
  the VRF fee; 128 open holds per Bank and 2 per player. Every other economic rule stays unchanged.

## 1. Context

- Audit F-03: hub, pool and game admission takes effect immediately, so a compromised governance key could admit a
  draining hub or module without an LP exit window.
- Audit F-04 and plan review B-1: `Bank.lpAccounting` reports `Paused` before any other check (`Bank.sol:276-295`), so a
  pause closes LP withdrawals; an immediate pause plus a queued attack would remove the exit window (review PoC P1, P2).
- Audit F-05: `MAX_OPEN_HOLDS = 128` is Bank-wide (`Bank.sol:34, 486`), so one player can fill it.
- Plan review B-2 and M-5: a result that can never be booked keeps `VRFHub.unbookedResultCount[bank] > 0`
  (`VRFHub.sol:128, 148`), which closes deposits and withdrawals for the whole pool; `refund` covers only an undelivered
  request (`GameHub.sol:607-627`).
- Freeze sign-off FC5: `_allocationLeaf` keeps a `maxLoss == 0` test that `_allocate` makes unreachable
  (`LiquidityVault.sol:210-228`).
- Base runs the Azul hardfork (EIP-7825) since 2026-04-20 on Sepolia and 2026-05-28 on mainnet: a transaction may use at
  most 16,777,216 gas. The 60 most recent mainnet blocks read on 2026-10-11 contained no transaction above that value.

## 2. Authority model

| Holder | Kind | Powers | Set by |
| --- | --- | --- | --- |
| `GovernanceTimelock` T | contract | `governance` of PoolRegistry, GameHub, every Bank and ReferralRegistry; every `onlyGov` function | constructor of those contracts (§9) |
| Safe (2/3) | multisig | T proposer and canceller; `sentinel` of PoolRegistry, GameHub and every Bank | T roles at construction; `setSentinel` through T |
| guardian | independent multisig, signers disjoint from the Safe, never an EOA | T canceller; `Bank.guardian` (pause); opening a void window for its Bank (§7.3) | T role at construction; `Bank.setGuardian` through T |
| anyone | — | executing ready T operations; settlement, refund and in-window void; `activateEdgeChange`; player-payable claims | — |

`GovernanceTimelock` extends OpenZeppelin `TimelockController` 5.5 only in its constructor:
`constructor(uint256 minDelay, address[] proposers, address[] cancellers, address[] executors)` calls the parent with
`admin = address(0)` and grants `CANCELLER_ROLE` to each extra canceller. The parent already grants proposers both
roles and grants `DEFAULT_ADMIN_ROLE` only to T itself, so role changes and `updateDelay` are T operations. Release values:
`minDelay = 259,200`, proposers `[Safe]`, cancellers `[guardian]`, executors `[address(0)]`. No temporary admin and no
zero-delay bootstrap exist (review P6).

`Sentinel` is a new abstract contract next to `Governable` (`src/access/Sentinel.sol`): `address public sentinel`,
`setSentinel(address)` (`onlyGov`, zero disables the role), event `SentinelSet(address indexed sentinel)` and modifier
`onlyGovOrSentinel`. PoolRegistry, GameHub and Bank inherit it; ReferralRegistry does not, because it has no
risk-reducing action. The sentinel can only decline or stop risk; it cannot admit, loosen a parameter or move funds.

## 3. Function classification

"T" means `onlyGov` with T as governance, so the call waits 72 hours and either canceller can stop it.

| Contract | Function | Who | Note |
| --- | --- | --- | --- |
| all `Governable` | `transferGovernance` | T | release check: `pendingGovernance == 0` |
| all `Governable` | `acceptGovernance` | pending governance | not used at launch (§9) |
| PoolRegistry | `registerPool` | T | new: requires `bank.governance() == governance` and `bank.pendingGovernance() == 0` |
| PoolRegistry | `setPoolActive`, `setHubRegistered`, `setHubAllowedForPool` | `false`: T or sentinel; `true`: T | `setHubRegistered(hub, true)` also requires `hub.governance() == governance` |
| GameHub | `setRefundTimeout`, `queueEdgeChange`, `createReferralConfig`, `setActiveReferralConfig`, `registerGame` | T | an edge change waits 72 h plus the existing 7 days |
| GameHub | `cancelEdgeChange` | T or sentinel | |
| GameHub | `disableGame` (B6) | T or sentinel | irreversible (§6) |
| GameHub | `openVoidWindow` (B5) | T, sentinel or the pool Bank's guardian | §7.3 |
| GameHub | `voidBet` (B5) | anyone inside the eligibility rule | §7.2 |
| Bank | `setRiskInPaused(true)` | T, sentinel or guardian | |
| Bank | `setRiskInPaused(false)` | T | the guardian can cancel it (residual R-3) |
| Bank | `setMinBetAmount`, `setRiskReserveBps`, `setWithdrawalBufferBps`, `setHoldbackVestingSeconds`, `setMinPlayerTurnoverForUnlock`, `setGuardian`, `rescueToken`, `claimProtocolFees` | T | any direction |
| Bank | `setSettlementRouterOnce`, `setRandomnessConsumerOnce` | T | one-shot, in the wiring batch |
| ReferralRegistry | `setBinderOnce` | T | one-shot, in the wiring batch |
| T | `schedule`, `scheduleBatch` / `cancel` / `execute*` / `updateDelay`, `grantRole`, `revokeRole` | Safe / Safe or guardian / anyone after the delay / T | a new delay applies only to operations scheduled afterwards (P6) |

SettlementRouter, VRFHub and LiquidityVault keep no administrator.

Code immutability of an admitted hub or module (no proxy, no `DELEGATECALL`, `CALLCODE` or `SELFDESTRUCT`, review S-6)
is an admission-review and release-verification check against the certified codehash, not an on-chain bytecode scan
(decision D4). The 72-hour queue gives reviewers and LPs the time to run it on any queued `registerGame` or hub.

## 4. Pause (B3)

A pause blocks new positions (`holdBet`, `placeBet`), new LP deposits and the optional PF/XP outflows
(`claimProtocolFees`, `claimXPAccrued`). It never blocks settlement, timeout refunds, voids, `claimPlayerPayable`,
the permissionless XP unlocks, or LP withdrawals.

- `Bank.lpAccounting` no longer looks at the pause. It returns `Busy`, then `InvalidAccounting` or `Unavailable`, then
  `UnbookedResult`, otherwise `Ready`. `LPStatus.Paused` is removed from the enum.
- `ILiquidityVaultBank` gains `riskInPaused()` (Bank already implements it). `LiquidityVault._addDeposit` reverts
  `DepositsPaused()` while it is true, before the existing status check. `withdrawDeposit` and `depositState` are
  otherwise unchanged; the unbooked-result fence, accounting validity, reentrancy guard, 24-hour cooldown and `L - K`
  still apply.
- `RiskInPausedSet` gains the caller: `RiskInPausedSet(bool paused, address indexed caller)`.
- Bank NatSpec states the rule above, closing F-04 as a behavior change.
- Emergency procedure: on a suspicious queued operation, the Safe or guardian cancels it and the sentinel deactivates the
  pool or disables the game; a pause is not needed to protect LPs.

## 5. Per-player capacity (B2)

- `uint256 public constant MAX_OPEN_HOLDS_PER_PLAYER = 2;` and `mapping(address => uint256) public openHoldsOf;` in Bank.
- `holdBet` reverts `PlayerOpenHoldLimit(player)` when `openHoldsOf[player] >= 2`, after the Bank-wide check, and
  increments the count. `_applyHold`, shared by settle, refund and void, decrements it. A direct Router or Bank caller is
  therefore limited too (audit PoC F-05).
- The decrement adds one cold slot read and write (about 5,000 gas) to the callback path; certificate v5 includes it.
- Residual R-4: 64 addresses fill a Bank. K0-4 alerts when `openHolds()` approaches 128.

## 6. Per-game disable (B6)

- `mapping(bytes32 => bool) public gameDisabled;` `disableGame(bytes32 gameId)` requires a registered, enabled game,
  sets the flag and emits `GameDisabled(bytes32 indexed gameId, address indexed caller)`.
- `placeBet` and `quoteVRFFee` revert `GameIsDisabled(gameId)`. Accepted bets keep `betModule[betId]` and settle,
  refund or void unchanged.
- There is no re-enable: `registerGame` already refuses a used `gameId`, so a restored game is a new `gameId` through T and
  a new certificate entry.

## 7. Void of unbookable results (B5)

### 7.1 States

New terminal values: `BetState.Voided`, `PositionState.Voided`, `IVRFHub.RequestState.Voided`. A void applies only to a
bet whose request is `Received`, that is a seed is stored and the result is unbooked. That covers GameHub `RandomReady`
and GameHub `PendingVRF` when delivery to GameHub failed entirely (M-5); `voidBet` records the random first, exactly as
`finalize` does. An undelivered request (`Awaiting`) keeps the existing timeout `refund`; the two paths are disjoint.

### 7.2 Eligibility and the settlement attempt

`GameHub.voidBet(uint256 betId) returns (bool voided)`, `nonReentrant`:

1. The bet's bound request is `Received`; otherwise `BadState` or `InvalidRandomReceipt`.
2. Eligible when `now >= vrfRequestedAt + VOID_DELAY` and `vrfRequestedAt <= voidCohortEnd[bank]` (§7.3), or when
   `now >= vrfRequestedAt + PUBLIC_VOID_DELAY`; otherwise `VoidNotEligible(betId, now, eligibleAt)`. `vrfRequestedAt`
   is already stored at request time, so the callback writes nothing new.
3. If the bet is `PendingVRF`, record the random (`_recordRandom`).
4. Gas check, then attempt: the transaction must leave at least `VOID_SETTLEMENT_GAS` for an only-self
   `finalizeFromCallback(betId, seed)` child while keeping `VOID_RESERVE_GAS` outside it; otherwise
   `VoidGasTooLow(available, required)` and nothing changes. A short-gas call can never void.
5. If the child succeeds, the bet is settled normally (its usual events and accounting) and `voidBet` returns false.
6. If it fails, the void branch runs with the reserved gas and records the first 32 bytes of the revert data. It calls no
   module, no engine, no tree write and no token transfer.

### 7.3 Every eligible bet of the Bank, no selection

One transaction cannot void every eligible bet: each needs its own 10M-gas settlement attempt, a Bank can hold 128 open
positions, and a transaction is capped at 16,777,216 gas. The decision is therefore made per Bank and executed per bet:

- `openVoidWindow(uint64 poolId)` (T, the GameHub sentinel, or the guardian of that pool's Bank) requires
  `unbookedResultCount(bank) > 0`, sets `voidCohortEnd[bank] = block.timestamp` (never decreasing) and emits
  `VoidWindowOpened(uint64 indexed poolId, address indexed bank, uint64 cohortEnd, address indexed caller)`.
- From then on anyone may void any bet of that Bank requested at or before `cohortEnd`, once it is 24 hours old and its
  settlement still fails in the void transaction. The privileged caller cannot pick bets, and anyone, including a keeper
  or an affected player, can complete the set. Bets requested later need a new window or their own 7-day limit.
- A transient failure (for example an issuer freeze that is later lifted) is the case where waiting changes outcomes;
  opening a window then is an operating decision for the whole Bank, recorded on-chain and alerted by K0-4.

### 7.4 Effects of a void

| Where | Change |
| --- | --- |
| GameHub | `state = Voided`, `resolvedAt = now`; terminal receipt `refundAmount = stake`, payouts and fee 0; `getBetTerminal` reports `Voided`; `getBetRandomWords` also returns the seed for `Voided`; `BetVoided(uint256 indexed positionId, address indexed caller, uint256 stake, bytes32 settlementErrorPrefix)` |
| SettlementRouter | `voidPosition(positionId)`: owner hub only, `Held` only, `state = Voided`, `PositionVoided(uint256 indexed positionId, address indexed hub, uint64 indexed poolId, uint256 stake)` |
| Bank | `voidBet(betId)`, `onlySettlementRouter`, `nonReentrant`, open hold only, no pause check: `_applyHold(h, betId, h.stake)`, then `playerPayable[player] += stake` and `playerPayableTotal += stake` without a transfer, `totalBetsVoided += 1`, `totalVoided += stake`, `_requireAccounting()`, `BetVoided(uint256 indexed betId, address indexed player, uint256 stake)` |
| LiquidityVault | unchanged: `applySettlement` with `cost == stake` only releases `released` from `lockedLiquidity` (`LiquidityVault.sol:179-196`) |
| VRFHub | `acknowledgeVoid(requestId)`: owning hub only, `Received` only, position `Voided`, `state = Voided`, `--unbookedResultCount[bank]`, `ResultVoided(uint256 indexed requestId, address indexed bank)`; mutually exclusive with `acknowledge` |

Accounting: P −= stake and PP += stake (Bank cash unchanged), R −= reserved, K −= released; the tree, Vault cash,
turnover, house-edge allocation, XP and PF are unchanged. `openHolds()` becomes
`totalBetsHeld − totalBetsSettled − totalBetsRefunded − totalBetsVoided` and `getPerformance` reports the two new
counters. The player claims with `claimPlayerPayable`, which works while paused. The VRF native fee is not refunded.
When the count reaches zero the LP fence reopens with no known pending result, so a void opens no new informed-LP window.

### 7.5 Shared failure components and scope

The void branch still needs Bank and Vault accounting validity and USDC `balanceOf` (review P5c), consistent Router and
VRFHub state, and the two reentrancy guards. An issuer freeze of the Vault or the Bank is covered (P5a, P5b); an
accounting-class failure is not, and then the LP fence is `InvalidAccounting` anyway.

## 8. Tree adapter cleanup (B4)

`_allocationLeaf` drops the unreachable `maxLoss == 0` test: `if (cutoff == last) return cutoff;`. `_allocate` remains
the only caller and returns before it when `maxLoss == 0`. Against the ADR-0034 invalidation clause: B4 changes no tree
write, and B5 adds a terminal path that writes no tree storage, books nothing into an empty root and writes no node after
`nextNode - 1`, so the k>0 preview skip and UNUSED_SUFFIX arguments are unaffected. Acceptance: tree-equivalence and
differential gates and `test_lossWithZeroReleasedCapitalIsRejected` unchanged.

## 9. Deployment model (decision D1)

Recommended: every governed contract is constructed with `governance = T`. The deployer then holds no power at any time.
The Safe schedules one T batch with the wiring (`setBinderOnce`, `setSettlementRouterOnce`, `setRandomnessConsumerOnce`,
`setGuardian`, `setSentinel` ×3, `setWithdrawalBufferBps`, `registerPool`, `setHubRegistered`, `setHubAllowedForPool`,
eight `registerGame`, then `setPoolActive(false)`). Anyone executes it after 72 hours. LPs can deposit while the pool
is inactive; activation is a second 72-hour operation. Nothing can take risk before the batch runs: the Bank has no router and the registry has no pool.

Alternative (plan §10 as written): the deployer wires the system, transfers governance and the Safe queues the four
`acceptGovernance` calls. The deployer key then remains governance for at least 72 hours and the release must prove from
events that it sent nothing in that window.

## 10. Parameters and verification

| Name | Value | Where |
| --- | --- | --- |
| `minDelay` | 259,200 s | T constructor; release check `getMinDelay()` and a single `MinDelayChange` |
| `VOID_DELAY` | 24 hours from `vrfRequestedAt` | GameHub constant |
| `PUBLIC_VOID_DELAY` | 7 days from `vrfRequestedAt` | GameHub constant |
| `VOID_SETTLEMENT_GAS` | 10,000,000 (decision D3; plan range 5M–10M) | GameHub constant; above 4× the v4 consumer callback limit of 2,447,746 |
| `VOID_RESERVE_GAS` | set from measurement, at most 600,000 | GameHub constant; a test runs the void branch after the child consumed its whole budget |
| `MAX_OPEN_HOLDS` / `MAX_OPEN_HOLDS_PER_PLAYER` | 128 / 2 | Bank constants |
| Per-transaction gas cap | 16,777,216 | network fact; a test proves a void transaction fits with at least 1,000,000 to spare |

Release verification (plan §10, A11) additionally checks: `sentinel == Safe` on PoolRegistry, GameHub and every Bank;
`Bank.guardian` equals the only canceller besides the Safe; T's runtime is pinned in `coreRuntimes`; and it replays
`SentinelSet`, `GuardianSet`, `GameDisabled`, `VoidWindowOpened`, `RiskInPausedSet` and T's `RoleGranted`,
`RoleRevoked`, `CallScheduled`, `CallExecuted`, `Cancelled` and `MinDelayChange`. K0-4 alerts on all of them.

Acceptance tests (plan §7.6 plus the review PoCs, all in `test/`):

- B1: F-03 PoC rejected; every `true`-direction admission waits 72 h; the sentinel's `false` directions are immediate;
  a mature NFT exits inside the window even while paused (P1); a rogue guardian cannot freeze LP funds (P2); no operation
  is queued at handover (P6); `registerPool` and `setHubRegistered` refuse a target under another governance.
- B2: the third open hold of one player is rejected at Bank level; settle, refund and void each release one.
- B3: deposits revert while paused; a withdrawal succeeds while paused and still respects the fence, cooldown and `L - K`.
- B4: as §8.
- B5: a bookable bet settles inside `voidBet`; a call before 24 h, or between 24 h and 7 days outside a window, reverts;
  after 7 days anyone voids; `VoidGasTooLow` below the floor; the count drops by exactly one; `acknowledge` and
  `acknowledgeVoid` exclude each other; works while paused; Vault and Bank issuer freeze (P5a, P5b); accounting fault
  out of scope (P5c); `PendingVRF` with a `Received` request; a window cannot be opened without an unbooked result.
- B6: a disabled game rejects bets and quotes; its accepted bets still settle, refund and void.

## 11. Decisions for the Owner

- **D1 deployment model** (§9): construct with `governance = T` (recommended), or deployer handover as in plan §10.
- **D2 "all eligible bets, no selection"** (§7.3): a per-Bank window opened by the Safe or guardian with permissionless
  per-bet execution (recommended; a single transaction cannot attempt more than one settlement under the gas cap).
- **D3 settlement-attempt floor:** 10,000,000 gas (recommended) inside the approved 5M–10M range.
- **D4 code immutability of hubs and modules:** checked at admission review and release verification against the
  certified codehash (recommended), not by an on-chain bytecode scan.
- **D5 stale timelock operations** (review S-9): T operations have no expiry, and anyone may execute a ready one. Either
  K0-4 alerts and a cancellation deadline (plan §9 and §12, recommended) or a 14-day grace period added to
  `GovernanceTimelock` by overriding `execute` and `executeBatch` (more custom code in audit scope).

## 12. Residuals and disclosures

- R-1: LP ordering risk, unchanged (ADR-0034 "Pre-inclusion ordering").
- R-2: the 72-hour window protects a full LP exit only under the plan's §7.1 conditions; with continuous counterparty
  betting a large LP is not guaranteed a full exit.
- R-3: a rogue guardian can cancel any operation, including its own replacement and an unpause; since B3 this stops new
  bets and deposits but freezes no LP or player funds.
- R-4: per-player capacity is Sybil-able (§5).
- R-5: a void refunds only the stake; the VRF native fee is not refunded. A window opened during a transient failure lets
  affected bets void instead of settling later.
- Disclosure (C4, C5): the void rule replaces "an unknown error cannot turn a winner into a refund" with "after a
  settlement attempt fails in the void transaction, at least 24 hours after the request, the stake is refunded"; terms and
  LP materials state the timelock, the exit formula, that pause never blocks withdrawals, the per-player cap, the
  sentinel and guardian powers and R-1 to R-5.
