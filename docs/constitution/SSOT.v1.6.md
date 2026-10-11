# Protocol Constitution — Accepted NFT liquidity target

**Development status:** the project is not launched. NFT liquidity, fixed 24-hour withdrawal timing,
dual custody, callback settlement and the launch candidate's authority, pause, capacity and void rules
([ADR-0037](../adr/0037-launch-candidate-authority-pause-capacity-void.md)) are implemented and locally
verified in the current candidate; **release qualification remains pending**. See [ADR-0034](../adr/0034-nft-liquidity-deposits.md) and the
[implementation plan](../design/lp-accounting-and-callback-implementation.md), including pinned Azuro
source identity. The rules below are not a claim about current deployed behavior. MUST, MUST NOT,
SHOULD and MAY have their RFC 2119 meanings.

## Custody and authority

- Each PoolRegistry pool binds one immutable asset, Bank and domain. Bank deploys its immutable
  LiquidityVault in its constructor. The Vault owns LP cash, the pinned LiquidityTree and ERC721
  deposit NFTs; Bank owns player stakes and PF/XP/player debts. Assets and liabilities stay isolated
  by pool. Neither contract has a proxy upgrade path or a mutable Vault administrator.
- Only SettlementRouter may open, settle, refund or void Bank positions. It records owner Hub, pool, Bank,
  player, stake, gross reserve and snapshot hash; only the owner Hub may terminate a position.
  GameHub owns the casino lifecycle and is the only hub of this release. Modules are pure functions;
  registry and Router MUST NOT custody assets.
- Only Bank may change Vault risk locks or apply terminal PnL. Public NFT deposit/withdrawal cash
  operations belong to Vault and MUST read Bank's canonical-result, accounting and busy status; deposits
  also read its pause.
  Bank settlement uses its onlyBank Vault entry without applying that LP gate, so accounting can clear
  the condition that blocked LP cash operations. Asset-mutating calls require reentrancy protection.
- From construction, governance of PoolRegistry, GameHub, every Bank and ReferralRegistry is the
  `GovernanceTimelock` (ADR-0037): every governance call waits at least 72 hours, a delay that can be
  raised but never set below 259,200 seconds. The Safe proposes and cancels, the guardian cancels,
  anyone executes a ready operation, and role or delay changes are themselves timelock operations; the
  deployer holds no role. The sentinel (the Safe) may at once deactivate a pool, deregister or disallow
  a hub, disable a game, cancel an edge change, pause a Bank and open a void window. A Bank's guardian,
  an independent multisig whose signers are not Safe signers, may at once pause that Bank and open a
  void window for its pool. Neither may admit, loosen a parameter or move funds.
- Governance, the sentinel or the guardian may pause; only governance may unpause, so unpausing waits for
  the timelock. A pause blocks new positions and new LP deposits only. Settlement, authorized missing-seed
  refunds, voids, player-payable claims, XP unlocks, XP and protocol-fee claims and LP withdrawals MUST
  remain possible subject to their own payment/atomicity checks.

## Accounting and capital admission

- B_B/B_V denote actual Bank/Vault cash; PF, XP and PP denote Bank protocol, external and player
  debts. P is original stakes of all open positions; R is their gross reserves. L is the tree root,
  Vault `getReserve()` and SSOT NAV. `K=Vault.lockedLiquidity=R-P`; `G=L+P=riskAssets`.
- Valid accounting requires `B_B>=P+PF+XP+PP`, `B_V>=L`, `R>=P` and `L>=K`; equivalently `G>=R`.
  Define unallocated surpluses `D_B=B_B-(P+PF+XP+PP)` and `D_V=B_V-L`. They MUST NOT enter L, G,
  wager capacity or the first depositor's position. They are diagnostic balances with no new sweep or
  allocation entry point. Combined cash equals `L+P+PF+XP+PP+D_B+D_V`.
- A coverage deficit, unavailable authoritative read or lock mismatch MUST fail LP capital changes,
  new risk and optional outflows closed and be exposed as an explicit fault, not healthy zero NAV.
  No ERC4626 view contract applies. Do not blanket-block otherwise valid terminalization/player debt
  handling with a new governance state.
- Only exact-transfer, non-rebasing assets whose failed transfers leave balances unchanged are
  admitted; the first pool is USDC. Funding that creates a deposit, player stake or tree credit MUST
  verify actual arrival. A failed custody transfer cannot create a fictional tree credit.
- Opening s/r requires `r>=s` and positive L. Bank MUST snapshot Vault's last deposit ID at this
  moment and retain it immutably. This casino boundary is a project choice, not a verified claim
  about Azuro's unavailable V3 Core implementation. Every accepted cutoff must be a valid leaf ID.
- New risk, after receiving s, requires
  `R_after+floor(G_after*riskReserveBps/10000)<=G_after`, with `G_after=L+P_before+s`.
  Bank adds s/r to P/R, locks r-s in Vault and records one open position atomically. The selected risk
  equation is unchanged; the official fresh-deployment risk default is `6000` bps (60% of G retained).
  Consumers MUST use the actual configured percentage and G, not L alone.
- LP deposits and new stakes MUST enforce `G<=MAX_TREE_CAPITAL=2^108-1`. This also bounds all pending
  stakes becoming profit. Keep checked uint128 casts and separately verify uint48 leaf and uint64
  update limits. The original tree's extra 1e12 intermediate multiplication and lazy-node bounds
  require the numerical proof/property tests specified by ADR-0034.
- Preserve the capacity of 128 open positions per Bank and allow each player at most 2 open positions
  per Bank, counted across every hub and caller; every open position keeps its slots until it is
  settled, refunded or voided.
  Tree traversal is bounded by its 40-level depth; no operation may scan holders or all past positions.

## NFT deposits and withdrawals

- Every positive exact deposit creates a new leaf and ERC721 NFT, with
  `withdrawAfter[id]=now+24 hours`. The period is a fixed constant with no setter. Each new deposit,
  including a gift, has its own NFT and does not alter any existing NFT's deadline. There is no top-up
  to an old NFT, pooled ERC20 share token, virtual offset, request queue or later recovery entitlement.
- NFT transfers carry that leaf's balance, range eligibility and existing deadline. Approval can
  authorize NFT transfer, which conveys its economic rights; it does not directly authorize cash
  withdrawal. The application MUST NOT ask users to approve keeper custody of their NFTs.
- Only the current NFT owner may call withdraw, and assets go only to that owner. Require maturity,
  valid LP status and `0<percent<=1e12`. Reject zero-percent and partial withdrawals paying zero assets.
  A mature full withdrawal of a zero-balance NFT may burn it without cash. Deposit/NFT mint MUST reject
  zero, Bank and Vault itself as the requested owner. These mint checks MUST NOT introduce special
  recipient restrictions for ordinary ERC721 transfers.
- Use original tree percentage rounding and require `withdrawn<=L_before-K`. No LP percentage
  withdrawal buffer is added. A successful partial withdrawal restarts a 24-hour deadline for that
  NFT's remainder; full withdrawal burns it. Transfer failure or unavailable free funds rolls back
  the tree, deadline, burn and payment together.
- K>0 prevents the pool from being emptied. At K=0 all NFTs may exit even with old zero-net-risk
  positions open. Do not retain a last-share/last-NFT guard or a post-exit economic-right ledger.
  Ordinary NFT Transfer history remains available. A zero balance NFT can be burned after maturity
  and its leaf ID is never reused.
- LP operations do not initiate a betting pause. Cooling, reserve coverage, position capacity and
  emergency/accounting faults remain real limits. A mature LP can still choose to exit before losses
  are recorded; the cooldown is not a complete transaction-ordering defense.

## Terminal settlement, allocation ranges and debt

- Define `C=payoutNet+refund+PF_new+XP_new`, `k=r-s`, and retain Router's house-edge cap plus Bank
  checks `payoutNet<=payoutGross`, `payoutGross+refund<=r`, `refund<=s` and `C<=r`.
- One onlyBank Vault entry MUST atomically release k, apply the tree result and move funds. For C>s,
  remove C-s using the recorded range and transfer it from Vault to Bank. For C<s with a positive
  pre-settlement root, transfer s-C from Bank to Vault and add it to that range. If C=s, no PnL transfer
  is necessary. Full refunds leave L unchanged. Token movement and all terminal bookkeeping either
  complete together or revert; arbitrary failures MUST NOT become a refund inside settlement. The only
  way a received result ends without settlement is the void below.
- In the normal tree branch, `P_after=P-s`, `R_after=R-r`, `K_after=K-k`,
  `L_after=L+s-C`, `G_after=G-C`. Since `C-s<=r-s`, any loss remains covered after releasing this lock.
  Removing a terminal position's full original stake includes partial unused-round refunds.
- If L is zero immediately before a positive result, skip `_addLimit`, retain s-C in Bank and add
  exactly that value to separately identified PF protocol capital. Then L stays zero and `G_after=G-s`.
  Do not create a positive root with no funded leaf or a protocol risk pocket. Exclude this credit
  from gameplay fees; it is distinct from unallocated external token donations.
- Select the same range for either sign using the original k=r-s: when current cutoff-prefix capital
  is at least k, target that prefix; otherwise target all currently used leaves. Equality retains the
  prefix. Use the pinned tree's integer allocation inside that range. The threshold MUST NOT depend
  on realized profit/loss. For k=0 retain the cutoff and the original empty-prefix fallback. The zero-root
  protocol-capital rule remains separate. Later deposits may share both earlier profit and loss.
  Range selection occurs at each settlement; earlier settlements may change the next range. Expected
  return and risk both follow allocation, so neither fairness nor settlement-order independence is promised.
- Failed player payout/refund creates PP and can complete valid terminalization. A later claim pays
  only that player, decreases B_B/PP equally, and MUST NOT charge L or release K again. Anyone can
  trigger payment during pause. If complete terminalization cannot finish, preserve state and seed.
- External PF/XP claims reduce B_B and their debts equally; they do not debit the tree. Preserve the
  existing optional-outflow policy `G_after>=R+floor(G_before*withdrawalBufferBps/10000)`. That parameter
  has an independent official deployment default of `1000` bps and is a PF/XP collection restriction,
  not an added LP withdrawal buffer. Paying to Bank itself is a
  separately identified surplus/donation, not automatic LP profit.

## Casino randomness and recovery

- Casino bets use the canonical request/seed lifecycle. Normal callback saves accepted randomness
  and completes the same finalization implementation used by public retry. Failure retains the seed;
  a retry cannot replace it. Stake, payout cap, pricing, module, payees and fees are fixed at acceptance.
- Bank's LP permission reads its immutable Router and canonical VRFHub's per-Bank durably-received,
  unbooked count. Protection starts with the first saved seed, including failure before GameHub receives
  it. Only the matching terminal acknowledgment clears its count; unrelated results remain fenced.
- A nonzero count, failed authoritative read, accounting fault or busy Bank rejects LP deposits and
  withdrawals; a pause rejects deposits only. Ordinary NFT transfer does not alter total capital. New
  betting remains subject to capital/capacity/pause; valid settlement and player debt-out do not apply
  the LP gate.
- If a received result cannot terminalize, the LP gate persists until it is booked or voided.
  Permissionless same-seed retry is not a liveness guarantee. The void (ADR-0037 §7) is the only exit:
  anyone may void a received result 24 hours after its request if a void window that governance, the
  sentinel or the Bank's guardian opened for that Bank covers it, and 7 days after its request without
  one. Each void first attempts the normal settlement with a fixed gas allowance, and a bet that settles
  is settled. Otherwise the stake becomes a player payable; no module, tree write or token transfer runs,
  the VRF fee is not refunded and the Bank's unbooked count falls by one. A void erases no debt and
  replaces no booked outcome. Player and LP materials MUST disclose it.
- Callback gas admission MUST measure the full direct wrapper -> VRFHub -> GameHub -> Router -> Bank
  -> Vault/tree path, both custody transfers, token failure, XP and acknowledgment. Include tree depth
  and the H-1 whole-pool domain (all used leaves), and do not treat a standalone finalize budget as full
  callback evidence.
- The one-hour default missing-randomness refund deadline is snapshotted and at most one day. A timeout
  refund requires that canonical VRFHub received no seed, even if GameHub still displays PendingVRF.
  Unknown resolve revert, OOG or invalid tuple MUST NOT refund a stored result or reroll it; only a void
  returns its stake, and nothing ever draws a new outcome.
- The project Owner retained cash exit and accepted pre-receipt ordering risk on 2026-10-04, then
  authorized the result-independent range-selection correction for H-1. Before canonical result receipt,
  mature free capital MAY exit subject to
  the other checks; withdrawn capital participates in no subsequently booked outcome. Remaining LPs
  bear the allocation, and empty/insufficient prefixes can let later deposits receive old profits or
  bear old losses. The 24-hour cooldown and Received gate do not eliminate this conditional ordering
  advantage. This is risk acceptance, not a fix or proof that real VRF can be predicted. External LP
  materials MUST disclose this boundary and MUST NOT promise capital-ordering fairness. Full gas
  qualification, independent/external audit and fresh network acceptance remain separate conditions.
- `amountPerRoll*betCount` is total stake. Stops refund unused stake, and edge applies only to used
  turnover. Canonical RNG expansion exists once in `src/libs/RNG.sol`. Modules use current typed
  encodings; roulette uses `(uint8 kind,uint40 payload)`, with casino payloads at most 64 bytes.
- GameHub MUST enforce `amountPerRoll >= Bank.minBetAmount()` before collecting funds or requesting
  randomness. The global hard maximum is 25 rounds; each game may admit fewer. USDC's selected minimum
  is 10,000 raw units (0.01): one round requires 0.01 USDC, 25 rounds require 0.25 USDC. There is no
  additional 1-USDC position minimum. Bank also checks the same minimum on a hub's total stake;
  casino per-round validation belongs to GameHub, which owns the round specification. SDK/UI read
  the on-chain minimum and game count, and cannot authorize a bet below either bound.
- Native wrapper charges, credits and refunds MUST conserve value. Keepers retry the original saved
  result, handle true missing-seed refunds and player debt, use WS with polling/reorg recovery, and
  receive no NFT custody authority. No LP batch job remains.

## Referral liabilities

First-touch binding, bounded anti-cycle checks and no rebinding remain. Each casino bet snapshots one
`houseEdgeBps`, its referral schedule and L1/L2 payees. Award amounts use that accepted configuration.
Bank's unlock threshold remains live, and a new holdback schedule uses the then-current vesting duration.
Moving XP between buckets does not change total liabilities.

## 1. Definitions

Amounts are in the pool asset's smallest unit. Rates are basis points. NFT withdrawal percentages use
`ONE = 1e12`; `floor` means integer division.

| Symbol       | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| `S`          | Position stake                                                     |
| `Q`          | Unused stake refunded at settlement, `0 ≤ Q ≤ S`                   |
| `U`          | Used turnover, `S − Q`                                             |
| `h`          | One house edge snapshotted at acceptance                           |
| `E`          | Turnover edge, `floor(U × h / 10000)`                              |
| `O`          | Operator share, `floor(E × (10000 − LP_SHARE_BPS) / 10000)`        |
| `R0, R1, R2` | Amounts accrued to player, direct referrer and indirect referrer   |
| `PF_new`     | Gameplay protocol fees accrued at settlement                       |
| `XP_new`     | `R0 + R1 + R2`, split between accrued, locked and holdback buckets |

Release constants are `LP_SHARE_BPS = 5000`, `MAX_REFERRAL_BPS = 3500`,
`MAX_HOUSE_EDGE_BPS = 500` and `EDGE_CHANGE_DELAY = 7 days`.

## 2. Allocation at settlement

For a casino settlement the reference hub MUST compute:

1. `E = floor(U × h / 10000)` and `O = floor(E / 2)`.
2. `R0 = floor(E × l0 / 10000)` if the player had a bound referrer, otherwise zero.
3. `R1 = floor(E × l1 / 10000)` if the accepted L1 exists, otherwise zero.
4. `R2 = floor(E × l2 / 10000)` if the accepted L2 exists, otherwise zero.
5. `PF_new = O − R0 − R1 − R2`.

Because the rates sum to at most 3500, `R0 + R1 + R2 ≤ floor(E × 3500 / 10000) ≤ O`.
Missing payees and independent rounding remainders accrue to PF. LPs retain `E − O`; it MUST NOT be
accrued again as gameplay PF or XP. Payout fee `payoutGross − payoutNet` is already part of the position's
net result applied to the tree; it is not a second allocation base.

NFT ownership, historical deposit cutoffs, the whole-pool domain and empty-root protocol capital follow
[ADR-0034](../adr/0034-nft-liquidity-deposits.md). Empty-root capital MUST NOT inflate gameplay fee counters.
A pure refund, including an eligible VRF timeout refund, has `E = PF_new = XP_new = 0`.

## 3. Referral rules

- Only L0, L1 and L2 MAY be paid. The engine returns at most three nonempty awards.
- `l0 + l1 + l2 ≤ MAX_REFERRAL_BPS` MUST be checked when a schedule is created.
- The first-touch affiliate argument only attempts binding. It cannot change the house edge or earn a
  separate reward. Failed binding gives no new referral entitlement.
- Accepted L1/L2 and the schedule version MUST be fixed for the bet; later bindings cannot rewrite them.
- L0 accrues immediately to the player only when L1 existed at acceptance. L1/L2 follow ADR-0005's
  turnover eligibility, holdback and non-extending aggregate vesting rules.
- The registry MUST reject self-binding, rebinding, a discovered cycle, and a traversal that reaches its
  bound before establishing an empty root. This is a bounded proof rule, not a global two-level graph cap.
- Multi-wallet self-referral cannot be prevented on chain; the reward cap limits its effect.

## 4. One price and player consent

Every casino bet snapshots the active `defaultHouseEdgeBps` as `houseEdgeBps`, with
`0 < houseEdgeBps ≤ MAX_HOUSE_EDGE_BPS`. The player's normalized `maxHouseEdgeBps` MUST bound this value
before funding. Referral bindings never select a different price. No separate agent-price setting,
price-chain traversal or extra referral budget is part of the protocol.

## 5. Settlement-boundary enforcement

`openPosition(poolId, player, stake, reserved, snapshotHash, edgeBps)` records the position's `edgeBps`.
GameHub passes `h`. Router MUST reject an edge above `MAX_HOUSE_EDGE_BPS`, and on
settlement independently require:

```text
protocolFeeAccrual + Σ(accrued + locked + holdback) ≤ floor(floor((stake − refundAmount) × edgeBps / 10000) / 2)
```

A Hub may allocate less than this cap; the remainder stays in the LP result. Bank MUST independently
check `payoutNet + refundAmount + protocolFeeAccrual + all XP ≤ reserved` and custody backing.
Router's `allocationCap(positionId, refundAmount)` exposes the same bound. These checks do not authenticate
the game outcome; fixed module admission, randomness and Hub authorization remain necessary.

## 6. Parameters and governance

| Parameter                                     | Authority | Rule                                                                  |
| --------------------------------------------- | --------- | --------------------------------------------------------------------- |
| LP share, referral cap, edge cap, delay       | None      | Release constants                                                     |
| `defaultHouseEdgeBps`                         | Timelock  | Queue every change; activate only after seven days; new bets only     |
| Referral rates and holdbackBps                | Timelock  | New immutable configuration version; accepted bets keep their version |
| Bank XP unlock threshold and vesting duration | Timelock  | Live eligibility; a new vesting schedule uses current duration        |
| Refund timeout                                | Timelock  | One minute to one day; each accepted bet fixes its deadline           |

"Timelock" means a `GovernanceTimelock` operation the Safe schedules: it waits at least 72 hours, and the
Safe or the guardian may cancel it while it waits. An edge change therefore takes at least 72 hours plus
seven days. The single-price governance methods are `pendingEdgeChange()`, `queueEdgeChange(uint16)`,
`activateEdgeChange()` and `cancelEdgeChange()`. Only governance queues; governance or the sentinel
cancels; anyone may activate when due. Governance emits old/new values and activation time. Guardian
cannot change allocation parameters.

## 7. Events and auditability

`BetPlaced` MUST expose the accepted `referrerL1`, `referrerL2`, `houseEdgeBps` and configuration ID.
These event payees are acceptance snapshots, not a query of today's referral registry.
`HouseEdgeAllocated` carries `positionId, U, houseEdgeBps, E, O, lpRetained, PF_new, R0, R1, R2`.
`lpRetained + PF_new + XP_new = E` MUST be independently recomputable. No extra allocation field is retained.

## 8. Out of scope

- Any pool domain other than Casino. This release has one domain; another needs its own ADR, contracts,
  audit and release.
- Values of the adjustable parameters. Initial proposals are in ADR-0032 and require calibration before
  deployment.

## 9. Worked example

`S = 100 USDC`, no refund, `h = 200`, schedule `(1000, 2000, 500)`:
`E = 2.00`, `O = 1.00`, LPs retain `1.00`.

| Case        |   R0 |   R1 |   R2 | PF_new | LP retains |
| ----------- | ---: | ---: | ---: | -----: | ---------: |
| No referrer |    0 |    0 |    0 |   1.00 |       1.00 |
| L1 only     | 0.20 | 0.40 |    0 |   0.40 |       1.00 |
| L1 and L2   | 0.20 | 0.40 | 0.10 |   0.30 |       1.00 |

The Router cap is `floor(2.00 × 5000 / 10000) = 1.00`. Each row accrues exactly `1.00` in total and passes.

## 10. Amendment record

| Date | Change | Approval |
| --- | --- | --- |
| 2026-10-12 | Launch candidate (ADR-0037, Owner decisions D1–D7; work packages B1–B6 and B9): governance through the `GovernanceTimelock` from construction, the sentinel's and guardian's immediate risk-reducing actions, a pause that blocks only new positions and new deposits, two open positions per player, the void of unbookable results, one hub and one pool domain | pending the Owner's explicit approval |
