# ADR-0037: Launch-candidate authority, pause, capacity and void design

- **Status:** Proposed, 2026-10-11, revision 2. B0 design freeze for the [launch candidate](../release/launch-candidate.zh-CN.md) (§5 step 1, §7).
  The independent review of revision 1 (`ee9216d7f`; `dist/independent-review-b0-2026-10-11/`, MANIFEST `71de1eb5…`)
  returned ACCEPT_WITH_CONDITIONS with no blocking finding. Revision 2 answers its seven required changes (B0-M1–M7) and
  adopts six of its seven suggestions; the seventh (S5) is decision D7. Work package B starts after the Owner answers §11
  and the external auditor's pre-review. Until then the current code and the [constitution](../constitution/SSOT.v1.6.md)
  stay authoritative.
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
- Audit F-04 and plan review B-1: `Bank.lpAccounting` reports `Paused` right after the reentrancy check, before the
  accounting and unbooked-result checks (`Bank.sol:276-295`), so a pause closes LP withdrawals; an immediate pause plus a
  queued attack would remove the exit window (review PoC P1, P2).
- Audit F-05: `MAX_OPEN_HOLDS = 128` is Bank-wide (`Bank.sol:34, 486`), so one player can fill it.
- Plan review B-2 and M-5: a result that can never be booked keeps `VRFHub.unbookedResultCount[bank] > 0`
  (`VRFHub.sol:128, 148`), which closes deposits and withdrawals for the whole pool; `refund` covers only an undelivered
  request (`GameHub.sol:607-627`).
- Freeze sign-off FC5: `_allocationLeaf` keeps a `maxLoss == 0` test that `_allocate` makes unreachable
  (`LiquidityVault.sol:210-228`).
- Network: Base's Azul hardfork activates EIP-7825 (Base Sepolia 2026-04-20, Base mainnet 2026-05-28). A transaction may
  use at most 16,777,216 gas; deposit transactions are exempt. Neither `eth_call` and `eth_estimateGas` on the public RPCs
  nor Forge's test EVM apply the cap, so tests compute it explicitly (§10).

## 2. Authority model

| Holder | Kind | Powers | Set by |
| --- | --- | --- | --- |
| `GovernanceTimelock` T | contract | `governance` of PoolRegistry, GameHub, every Bank and ReferralRegistry; every `onlyGov` function | constructor of those contracts (§9) |
| Safe (2/3) | multisig | T proposer and canceller; `sentinel` of PoolRegistry, GameHub and every Bank | T roles at construction; `setSentinel` through T |
| guardian | independent multisig, signers disjoint from the Safe, never an EOA | T canceller; `Bank.guardian` (pause); opening a void window for its Bank's pool (§7.3) | T role at construction; `Bank.setGuardian` through T |
| anyone | — | executing ready T operations; settlement, refund and in-window void; `activateEdgeChange`; player-payable claims | — |

`GovernanceTimelock` (`src/access/GovernanceTimelock.sol`) extends OpenZeppelin `TimelockController` 5.5 only in its
constructor: `constructor(uint256 minDelay, address[] memory proposers, address[] memory cancellers, address[] memory executors)`
reverts `InvalidTimelockConfig()` when a proposer or canceller is zero or a canceller is also a proposer, calls the parent
with `admin = address(0)` and grants `CANCELLER_ROLE` to each canceller. The parent already grants proposers both roles
and grants `DEFAULT_ADMIN_ROLE` only to T itself, so role changes and `updateDelay` are T operations. Release values:
`minDelay = 259,200`, proposers `[Safe]`, cancellers `[guardian]`, executors `[address(0)]`. No temporary admin and no
zero-delay bootstrap exist (review P6, R1).

`Sentinel` (`src/access/Sentinel.sol`) is `abstract contract Sentinel is Governable`: `address public sentinel`,
`setSentinel(address)` (`onlyGov`, zero disables the role), event `SentinelSet(address indexed sentinel)` and modifier
`onlyGovOrSentinel`. Inheritance: `PoolRegistry is IPoolRegistry, Sentinel`; `GameHub is IGameHub, Sentinel, ReentrancyGuard`;
`Bank is IBank, Sentinel, Pausable, ReentrancyGuard`. Storage therefore begins with `governance`, `pendingGovernance`,
`sentinel`; OpenZeppelin 5.5 `ReentrancyGuard` uses a namespaced slot. Certificate v5 redoes the binding (O3).
ReferralRegistry stays `Governable` only: it has no risk-reducing action. The sentinel can only decline or stop risk: it
cannot admit, loosen a parameter or transfer funds. Opening a void window does change outcomes for the affected bets
(§7.3).

## 3. Function classification

"T" means `onlyGov` with T as governance, so the call waits 72 hours and either canceller can stop it.

| Contract | Function | Who | Note |
| --- | --- | --- | --- |
| all `Governable` | `transferGovernance` | T | the new governance may `acceptGovernance` at any later time without the timelock, so the transfer is the critical operation; K0-4 alerts on `GovernanceTransferStarted`; release check `pendingGovernance == 0` |
| all `Governable` | `acceptGovernance` | pending governance | not used at launch (§9) |
| PoolRegistry, GameHub, Bank | `setSentinel` | T | |
| PoolRegistry | `registerPool` | T | requires `bank.governance() == governance` and `bank.pendingGovernance() == 0`, else `ForeignGovernance(bank)` |
| PoolRegistry | `setHubRegistered` | `false`: T or sentinel; `true`: T | `true` requires the same two conditions on the hub, else `ForeignGovernance(hub)` |
| PoolRegistry | `setPoolActive`, `setHubAllowedForPool` | `false`: T or sentinel; `true`: T | |
| GameHub | `setRefundTimeout`, `queueEdgeChange`, `createReferralConfig`, `setActiveReferralConfig`, `registerGame` | T | an edge change waits 72 h plus the existing 7 days |
| GameHub | `cancelEdgeChange` | T or sentinel | keeps the current edge |
| GameHub | `disableGame` (B6) | T or sentinel | irreversible (§6) |
| GameHub | `openVoidWindow` (B5) | T, sentinel or the pool Bank's guardian | §7.3 |
| GameHub | `voidBet` (B5) | anyone inside the eligibility rule | §7.2 |
| Bank | `setRiskInPaused(true)` | T, sentinel or guardian | |
| Bank | `setRiskInPaused(false)` | T | the guardian can cancel it (R-3) |
| Bank | `setMinBetAmount`, `setRiskReserveBps`, `setWithdrawalBufferBps`, `setHoldbackVestingSeconds`, `setMinPlayerTurnoverForUnlock`, `setGuardian`, `rescueToken`, `claimProtocolFees` | T | any direction |
| Bank | `setSettlementRouterOnce`, `setRandomnessConsumerOnce` | T | one-shot, in the wiring batch |
| ReferralRegistry | `setBinderOnce` | T | one-shot, in the wiring batch |
| T | `schedule`, `scheduleBatch` | Safe | |
| T | `cancel` | Safe or guardian | reliable only while an operation is waiting: once it is ready, anyone can execute it first (D5) |
| T | `execute`, `executeBatch` | anyone after the delay | |
| T | `updateDelay`, `grantRole`, `revokeRole` | T | a new delay applies only to operations scheduled afterwards (P6, D7) |
| T | `renounceRole` | the holder, immediately and irreversibly | the Safe renouncing `PROPOSER_ROLE` freezes governance (R-8) |

Structural entry points keep a fixed caller and no administrator: Router `openPosition` (registered and allowed hub),
`settlePosition`, `refundPosition`, `voidPosition` (owner hub); Bank `holdBet`, `settleBet`, `refundBet`, `voidBet`
(Router); Vault `lockLiquidity`, `applySettlement` (Bank); VRFHub `requestRandomWords`, `acknowledge`, `acknowledgeVoid`,
`cancel` (owning hub), `rawFulfillRandomWords` (wrapper); GameHub `onRandomWords` (VRFHub), `finalizeFromCallback` (self).
SettlementRouter, VRFHub and LiquidityVault keep no administrator.

The same-governance checks only catch honest misconfiguration, for example a real Bank still governed by its deployer
(review R4): any contract can return T from `governance()` (R5). The security boundary for admission is the 72-hour queue
plus the admission review of decision D4: every queued `registerPool` is checked for a Bank runtime (immutables included)
equal to the certified Bank, its Vault equal to the certified Vault and the certified asset (another asset leaves the
certificate domain); every `setHubRegistered(true)` for a certified hub runtime; every `registerGame` for a certified
module codehash with no proxy, `DELEGATECALL`, `CALLCODE` or `SELFDESTRUCT` and a `resolve` that makes no external call and
reads no storage. A11 runs these checks on each queued operation and alerts publicly within the 72 hours. There is no
on-chain bytecode scan.

## 4. Pause (B3)

A pause blocks only new positions (`holdBet`, `placeBet`) and new LP deposits. It does not block settlement, timeout
refunds, voids, `claimPlayerPayable`, the permissionless XP unlocks, XP and protocol-fee claims (decision D6), or LP
withdrawals.

- `Bank.lpAccounting` no longer looks at the pause. It returns `Busy`, then `InvalidAccounting` or `Unavailable`, then
  `UnbookedResult`, otherwise `Ready`. `LPStatus` becomes `Ready, Busy, UnbookedResult, InvalidAccounting, Unavailable,
  CoolingDown, NoLiquidity`; the values renumber, and the SDK, keeper and `LPUnavailable` decoding follow in work
  package D.
- `riskInPaused()` moves from `IBank` to `ILiquidityVaultBank`, which `IBank` inherits. `LiquidityVault._addDeposit`
  reverts `DepositsPaused()` while it is true, before the existing status check. `withdrawDeposit` and `depositState`
  are otherwise unchanged; the unbooked-result fence, accounting validity, reentrancy guard, 24-hour cooldown and `L - K`
  still apply.
- With D6 (a), `claimXPAccrued` and `claimProtocolFees` drop the pause check and keep `_checkOptionalOutflowDomain`;
  protocol-fee claims also stay behind T.
- `RiskInPausedSet` gains the caller: `RiskInPausedSet(bool paused, address indexed caller)`. Its topic changes, so K0-4
  and the indexer follow.
- Bank NatSpec states the rule above, closing F-04 as a behavior change.
- Emergency procedure: on a suspicious queued operation, the Safe or guardian cancels it and the sentinel deactivates the
  pool or disables the game; a pause is not needed to protect LPs.

## 5. Per-player capacity (B2)

- One slot per player replaces `_playerTurnover`: `struct PlayerAccount { uint248 turnover; uint8 openHolds; }` and
  `mapping(address => PlayerAccount) internal _players;`. `IBank` declares `MAX_OPEN_HOLDS_PER_PLAYER()` (2),
  `openHoldsOf(address) returns (uint256)`, `playerTurnover(address) returns (uint256)` and the error
  `PlayerOpenHoldLimit(address player)`.
- `holdBet` reverts `PlayerOpenHoldLimit(player)` when the player already has two open holds, after the Bank-wide check,
  and increments the count. `_applyHold`, shared by settle, refund and void, decrements it. `settleBet` adds the turnover
  in the same slot through `SafeCast`. A direct Router or Bank caller and a second hub share the same count (audit PoC
  F-05; review C1, C2).
- GameHub already reads this slot cold (`GameHub.sol:711`) and `settleBet` already writes it (`Bank.sol:551`). The slot
  is non-zero while the player holds a position, so a first settlement rewrites it instead of creating it. The review
  measured gross callback gas of −15,937 for a first-time player and +1,163 for a repeat player against the current code;
  a separate counter would have cost +5,701 (review B0-S1).
- K0-4 polls `openHolds()`, because a reverted bet emits no log, and alerts at 96 of 128.
- Residual R-4: 64 addresses fill a Bank.

## 6. Per-game disable (B6)

- `mapping(bytes32 => bool) public gameDisabled;` `disableGame(bytes32 gameId)` reverts `UnknownGame(gameId)` for an
  unregistered and `GameIsDisabled(gameId)` for a disabled game, sets the flag and emits
  `GameDisabled(bytes32 indexed gameId, address indexed caller)`.
- `placeBet` and `quoteVRFFee` revert `GameIsDisabled(gameId)`. Accepted bets keep `betModule[betId]` and settle,
  refund or void unchanged.
- There is no re-enable: `registerGame` already refuses a used `gameId`, so a restored game is a new `gameId` through T and
  a new certificate entry.
- The flag applies per `gameId`, not per module, so release verification asserts that each module is registered under
  exactly one `gameId`. `GameHub.riskInPaused(poolId)` reflects neither a disabled game nor a hub's registry status;
  clients also read `gameDisabled` and PoolRegistry.

## 7. Void of unbookable results (B5)

### 7.1 States

`Voided` is appended to each enum, so existing values keep their numbers:

- `BetState`: `None, Held, PendingVRF, RandomReady, Settled, Refunded, Voided`;
- `PositionState`: `None, Held, Settled, Refunded, Voided`;
- `IVRFHub.RequestState`: `None, Awaiting, Received, Terminal, Cancelled, Voided`.

A void applies only to a bet whose request is `Received`, that is a seed is stored and the result is unbooked. That
covers GameHub `RandomReady` and GameHub `PendingVRF` when delivery to GameHub failed entirely (M-5); `voidBet` records
the random first, exactly as `finalize` does. An undelivered request (`Awaiting`) keeps the existing timeout `refund`;
the two paths are disjoint.

### 7.2 Eligibility and the settlement attempt

`GameHub.voidBet(uint256 betId) returns (bool voided)`, `nonReentrant`:

1. The bet's bound request is `Received`; otherwise `BadState` or `InvalidRandomReceipt`.
2. Eligible when `now >= vrfRequestedAt + VOID_DELAY` and `vrfRequestedAt <= voidCohortEnd[bank]` (§7.3), or when
   `now >= vrfRequestedAt + PUBLIC_VOID_DELAY`; otherwise `VoidNotEligible(betId, now, eligibleAt)`. `vrfRequestedAt`
   is already stored at request time, so the callback writes nothing new.
3. If the bet is `PendingVRF`, record the random (`_recordRandom`).
4. Gas check. With `S = VOID_SETTLEMENT_GAS`, `R = VOID_RESERVE_GAS`, `o = VOID_CALL_OVERHEAD` and `g = gasleft()` at the
   check, require both `g >= S + R + o` and `g - g / 64 >= S + o`; otherwise `VoidGasTooLow(g, S + R + o)` and nothing
   changes. Without the second condition EIP-150 would hand the child less than `S` whenever `R < S / 63` (review F1).
   The only-self `finalizeFromCallback(betId, seed)` child then receives exactly `S`, so the outcome does not depend on
   the caller's gas limit, and a call with too little gas can never void.
5. If the child succeeds, the bet is settled normally (its usual events and accounting) and `voidBet` returns false.
6. If it fails, the void branch runs with the reserved gas and records the first 32 bytes of the revert data. It calls no
   module, no engine, no tree write and no token transfer.

### 7.3 One decision per Bank, executed per bet

One transaction cannot void every eligible bet: each needs its own 10M-gas settlement attempt, a Bank can hold 128 open
positions, and a transaction is capped at 16,777,216 gas. The decision is therefore made per Bank and executed per bet:

- `openVoidWindow(uint64 poolId)` (T, the GameHub sentinel, or the guardian of that pool's Bank; otherwise
  `Errors.Unauthorized()`) requires `ISettlementRouter(settlementRouter).unbookedResultCount(bank) > 0`, the count behind
  the LP fence (otherwise `NoUnbookedResult(bank)`). It sets `voidCohortEnd[bank] = block.timestamp` in
  `mapping(address => uint64) public voidCohortEnd` (never decreasing) and emits
  `VoidWindowOpened(uint64 indexed poolId, address indexed bank, uint64 cohortEnd, address indexed caller)`.
- From then on anyone may void any bet of that Bank requested at or before `cohortEnd`, once it is 24 hours old and its
  settlement still fails in the void transaction. Bets requested later need a new window or their own 7-day limit.
- What this guarantees: the opener cannot choose individual bets, and anyone, including a keeper or an affected player,
  can complete the set.
- What it does not guarantee (review B0-M2, V10, V11): the opener decides whether and when to open after the seeds are
  public, so a window over a single affected bet is a per-bet decision; during a transient failure the executor's order
  decides which bets are voided before the failure ends; and a Bank whose Vault is frozen keeps accepting bets that then
  cannot be booked.
- Operating rules (runbook and K0-4):
  1. An issuer freeze or pause of the asset is transient. While asset transfers fail, the sentinel deactivates the pool
     and no window is opened; bets settle normally once the asset recovers.
  2. A window is opened only for a failure that persists while the asset is operational, after the pool is deactivated
     or the affected game disabled.
  3. Once a window is open, the operator's keeper attempts every eligible bet of the cohort in `vrfRequestedAt` order in
     consecutive blocks and publishes the results.
  4. K0-4 alerts on every `VoidWindowOpened`; when an eligible cohort bet stays unattempted N blocks after opening; when a
     cohort bet settles after another bet of the same cohort was voided; and on any unbooked result older than one hour.
- On-chain hardening considered and not adopted (D2): a window that stays open until the Bank's count returns to zero
  needs a write on the callback path to track zero crossings; requiring a paused Bank before opening is cheap but forces
  a 72-hour unpause even for one broken game; both also compete for GameHub's size budget (§10).

### 7.4 Effects of a void

| Where | Change |
| --- | --- |
| GameHub | `state = Voided`, `resolvedAt = now`; terminal receipt `refundAmount = stake`, payouts and fee 0; `getBetTerminal` reports `Voided`; `getBetRandomWords` also returns the seed for `Voided`; `BetVoided(uint256 indexed positionId, address indexed caller, uint256 stake, bytes32 settlementErrorPrefix)` |
| SettlementRouter | `ISettlementRouter.voidPosition(uint256 positionId)`: owner hub only, `Held` only, `state = Voided`, `PositionVoided(uint256 indexed positionId, address indexed hub, uint64 indexed poolId, uint256 stake)` |
| Bank | `IBank.voidBet(uint256 betId)`, `onlySettlementRouter`, `nonReentrant`, open hold only, no pause check: `_applyHold(h, betId, h.stake)`, then `playerPayable[player] += stake` and `playerPayableTotal += stake` without a transfer, `PlayerPayableCreated(betId, player, stake)`, `totalBetsVoided += 1`, `totalVoided += stake`, `_requireAccounting()`, `BetVoided(uint256 indexed betId, address indexed player, uint256 stake)`; `IBank` adds `totalBetsVoided()` and `totalVoided()`, and `getPerformance` appends `betsVoided, voided` to its return values |
| LiquidityVault | unchanged: `applySettlement` with `cost == stake` only releases `released` from `lockedLiquidity` (`LiquidityVault.sol:179-196`) |
| VRFHub | `IVRFHub.acknowledgeVoid(uint256 requestId)`: owning hub only, `Received` only, position `Voided`, `state = Voided`, `--unbookedResultCount[bank]`, `ResultVoided(uint256 indexed requestId, address indexed bank)`; mutually exclusive with `acknowledge` |

Accounting: P −= stake and PP += stake (Bank cash unchanged), R −= reserved, K −= released; the tree, Vault cash,
turnover, house-edge allocation, XP and PF are unchanged (review V13). `openHolds()` becomes
`totalBetsHeld − totalBetsSettled − totalBetsRefunded − totalBetsVoided`. The player, or anyone on the player's behalf,
claims with `claimPlayerPayable`, which works while paused. The VRF native fee is not refunded. When the count reaches
zero the LP fence reopens with no known pending result, so a void opens no new informed-LP window.

### 7.5 Shared failure components and scope

The void branch still needs Bank and Vault accounting validity and USDC `balanceOf` (review P5c), consistent Router and
VRFHub state, and the two reentrancy guards. An issuer freeze of the Vault or the Bank is covered (P5a, P5b, V7), though
the payable can only be claimed after the freeze ends; an accounting-class failure is not covered, and then the LP fence
is `InvalidAccounting` anyway (V8).

## 8. Tree adapter cleanup (B4)

`_allocationLeaf` drops the unreachable `maxLoss == 0` test: `if (cutoff == last) return cutoff;`. `_allocate` remains
the only caller and returns before it when `maxLoss == 0`. Against the ADR-0034 invalidation clause: B4 changes no tree
write, and B5 adds a terminal path that writes no tree storage, books nothing into an empty root and writes no node after
`nextNode - 1`, so the k>0 preview skip and UNUSED_SUFFIX arguments are unaffected. The review ran the repository's 15
Vault, tree and NFT suites on a copy with only this change: 130 of 130 passed. Acceptance: tree-equivalence and
differential gates and `test_lossWithZeroReleasedCapitalIsRejected` unchanged.

## 9. Deployment model (decision D1)

Recommended, and supported by the review (R2): every governed contract is constructed with `governance = T`, so the
deployer holds no power at any time.

1. Deploy T first, then the contracts with `governance = T`.
2. Replay the wiring batch on a fork with the actual addresses, then the Safe schedules it on T and publishes the calldata
   for the 72-hour review: `setBinderOnce`, `setSettlementRouterOnce`, `setRandomnessConsumerOnce`, `setGuardian`,
   `setSentinel` ×3, `setWithdrawalBufferBps`, `registerPool`, `setHubRegistered`, `setHubAllowedForPool`, eight
   `registerGame`, then `setPoolActive(false)`.
3. Anyone executes it after 72 hours. Before that nothing can take risk: the Bank has no router and the registry has no
   pool. Afterwards LPs can deposit while the pool is inactive; activation is a second 72-hour operation.
4. Release verification replays `RoleGranted` from T's creation block. The pre-launch release state becomes "pool
   inactive, Bank unpaused", so `script/release/V16Snapshot.sol:109, 127` change with A11.

A batch that executes but is wrong consumes the one-shot setters and means a redeploy.

Alternative (plan §10 as written): the deployer wires the system, transfers governance and the Safe queues the four
`acceptGovernance` calls. The deployer key then remains governance for at least 72 hours and the release must prove from
events that it sent nothing in that window.

## 10. Parameters, size budget and verification

| Name | Value | Where |
| --- | --- | --- |
| `minDelay` | 259,200 s | T constructor; release check `getMinDelay()` and a single `MinDelayChange` |
| `VOID_DELAY` | 24 hours from `vrfRequestedAt` | GameHub constant |
| `PUBLIC_VOID_DELAY` | 7 days from `vrfRequestedAt` | GameHub constant |
| `VOID_SETTLEMENT_GAS` (S) | 10,000,000 (D3; plan range 5M–10M) | GameHub constant; above 4× the v4 consumer callback limit of 2,447,746 |
| `VOID_RESERVE_GAS` (R) | 600,000, unless twice the measured void branch exceeds it | GameHub constant; measured with cold state, real USDC on a fork and first writes of PP and the counters (the review's mock-token prototype needed 143,024 outside the child) |
| `VOID_CALL_OVERHEAD` (o) | at most 5,000 | GameHub constant: the work between the check and the call |
| `MAX_OPEN_HOLDS` / `MAX_OPEN_HOLDS_PER_PLAYER` | 128 / 2 | Bank constants |
| Per-transaction gas cap | 16,777,216 | network fact; the review's prototype needed a transaction gas limit of about 10.69M |

**Size budget.** GameHub with all B1, B5 and B6 code stays within 23,552 bytes (`ContractSizesTest`: EIP-170 minus
1,024), measured on the first work-package-B commit and every later one. Today it is 20,046; the review's lean prototype
reached 22,470. If it does not fit, cut in this order: remove `nextPositionIdHint`, `referrerOf` and `bindReferrer`
(clients call the Router and `ReferralRegistry.bind` directly); move `quoteVRFFee` to a stateless lens over public
getters; consolidate custom errors. A `DELEGATECALL` library is not an option (S-6).

**Release verification** (plan §10, A11) additionally checks: `sentinel == Safe` on PoolRegistry, GameHub and every Bank;
the guardian is an independent multisig (code hash and owner-set digest) and equals both `Bank.guardian` and the only
canceller besides the Safe; T's runtime is pinned in `coreRuntimes`; each module is registered under one `gameId`. It
replays `SentinelSet`, `GuardianSet`, `GovernanceTransferStarted`, `GovernanceTransferred`, `GameDisabled`,
`VoidWindowOpened`, `RiskInPausedSet` and T's `RoleGranted`, `RoleRevoked`, `CallScheduled`, `CallExecuted`, `Cancelled`
and `MinDelayChange`. K0-4 alerts on all of them.

**Gas accounting.** Certificate v5 and the B2 and B5 acceptance use gross gas: storage refunds settle at the end of the
transaction and never raise a frame's budget. Under `--isolate`, `vm.lastCallGas().gasTotalUsed` is net of refunds and
includes the 21,000 base cost, so tests calibrate it as the review's `LastCallGasCalibration` does. The 2^24 margin is
computed explicitly or checked on an anvil pinned to the Osaka rules (A7). The v5 matrix adds a per-player count going
from 1 to 0 with the first turnover write, one going from 2 to 1, and a game disabled after acceptance; v5 states that
`VOID_SETTLEMENT_GAS` is at least the certified settlement requirement.

**Acceptance tests** (plan §7.6 plus the review PoCs, all in `test/`):

- B1: F-03 PoC rejected; every `true`-direction admission waits 72 h; the sentinel's `false` directions are immediate;
  a mature NFT exits inside the window even while paused (P1); a rogue guardian cannot freeze LP or player funds (P2,
  P3); no operation is queued at handover (P6); `registerPool` and `setHubRegistered` refuse a target under another or a
  pending governance; ready operations are executable by anyone (R7, documenting D5).
- B2: the third open hold of one player is rejected at Bank level, also through a second hub; settle, refund and void
  each release one.
- B3: deposits revert while paused; a withdrawal succeeds while paused and still respects the fence, cooldown and
  `L - K`; with D6 (a), XP and protocol-fee claims work while paused within the outflow domain.
- B4: as §8.
- B5: a bookable bet settles inside `voidBet`; a call before 24 h, or between 24 h and 7 days outside a window, reverts;
  after 7 days anyone voids; `VoidGasTooLow` below the floor and the child receiving at least `S` at the boundary; the
  count drops by exactly one; `acknowledge` and `acknowledgeVoid` exclude each other; works while paused; Vault and Bank
  issuer freeze (P5a, P5b); accounting fault out of scope (P5c); `PendingVRF` with a `Received` request; a window
  cannot be opened without an unbooked result or by an unauthorized address; execution order during a transient failure
  and bets accepted during a freeze behave as §7.3 discloses (V10, V11); the void transaction fits under 16,777,216
  with at least 1,000,000 to spare, computed explicitly.
- B6: a disabled game rejects bets and quotes; its accepted bets still settle, refund and void.
- Size: `ContractSizesTest` covers `GovernanceTimelock` and the new limits.

## 11. Decisions for the Owner

- **D1 deployment model** (§9): construct with `governance = T` (recommended; the review agrees), or deployer handover as
  in plan §10.
- **D2 "all eligible bets, no selection"** (§7.3): a per-Bank window opened by the Safe or guardian, permissionless
  per-bet execution, the operating rules and K0-4 alerts of §7.3, no further on-chain hardening (recommended; the
  review agrees under these conditions).
- **D3 settlement-attempt floor:** 10,000,000 gas with the §7.2 formula (recommended; the review agrees).
- **D4 admission review** (§3): hub, module, Bank, Vault and asset checked against the certified artifacts at admission
  review and release verification, without an on-chain bytecode scan (recommended; the review agrees with this scope).
- **D5 stale timelock operations:** a ready operation can be executed by anyone, so a cancellation deadline after it is
  ready protects nothing (review B0-M7). Recommended: every operation is either executed promptly once ready or cancelled
  while still waiting, a deferred change is scheduled with a longer delay, and K0-4 alerts publicly when an operation is
  scheduled, some hours before it becomes ready and while it is ready but unexecuted. Alternative: a 14-day grace period
  in `GovernanceTimelock`, where an expired operation must read as `Unset`, never `Done` (which would satisfy a
  successor's predecessor check).
- **D6 pause and XP or protocol-fee claims** (review B0-M1): (a) recommended, matching "pause blocks only new bets and
  deposits": both claims keep their outflow-domain check but drop the pause check, so a pause freezes no player or
  referrer funds; (b) keep the pause check on XP and disclose that a rogue guardian or a compromised Safe can freeze XP
  indefinitely, which only a redeploy resolves.
- **D7 timelock delay floor** (review B0-S5): (a) recommended: no override; disclose that the delay itself can be
  changed by a 72-hour operation, which LPs still see 72 hours ahead; (b) override `updateDelay` to require at least
  259,200 (more custom code in the audit scope).

## 12. Residuals and disclosures

- R-1: LP ordering risk, unchanged (ADR-0034 "Pre-inclusion ordering").
- R-2: the 72-hour window protects a full LP exit only under the plan's §7.1 conditions; with continuous counterparty
  betting a large LP is not guaranteed a full exit.
- R-3: a rogue guardian can cancel any operation, including its own replacement and an unpause. With B3 and D6 (a) this
  stops new bets and deposits but freezes no LP, player or referrer funds.
- R-4: per-player capacity is Sybil-able (§5).
- R-5: a void refunds only the stake; the VRF native fee is not refunded. Openers (T, the Safe as sentinel, the guardian)
  choose when to open after the seeds are public, and during a transient failure the execution order decides which bets
  are voided first; §7.3 sets the operating rules.
- R-6: no emergency brake on LP withdrawals: after B3 a defect in the withdrawal path or the tree arithmetic cannot be
  stopped by a pause. The LP fence still closes on unbooked results and invalid accounting.
- R-7: in an incident exits are first come, first served. An early LP withdraws its full value while free capital lasts
  and the remaining LPs carry every open position; when a prefix shrinks, the H1 rule spreads a loss over the whole pool,
  including later deposits. This is an existing ADR-0034 property that a pause no longer stops.
- R-8: the Safe is the only proposer. Losing it, or the Safe renouncing `PROPOSER_ROLE`, freezes governance for good;
  the protocol can then only wind down: settlement, refunds, 7-day voids and LP withdrawals continue, and an existing
  pause stays.
- R-9: a player whose smart-contract wallet or bundler caps an operation below about 10.7M gas cannot execute a void
  personally; any EOA or the operator's keeper can.
- Disclosure (C4, C5): the void rule replaces "an unknown error cannot turn a winner into a refund" with "after a
  settlement attempt fails in the void transaction, at least 24 hours after the request, the stake is refunded as a
  player payable"; anyone may push that payable to the player, also while paused. Terms and LP materials also state the
  timelock and the exit formula, that pause never blocks withdrawals, the per-player cap, the sentinel and guardian
  powers, who can open a void window, the D1 launch order (LP deposits before activation) and R-1 to R-9.
