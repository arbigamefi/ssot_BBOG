# ADR-0034: NFT liquidity deposits and settlement allocation

- **Status:** Accepted, 2026-10-04; amended 2026-10-07 (see [Amendment 2026-10-07](#amendment-2026-10-07-k0-allocation-without-the-vendor-preview)). Core and application interfaces implemented and locally verified; external review and network acceptance are **PENDING**. Current status: [release notes](../release/README.md).
- **Scope:** the single current prelaunch casino liquidity implementation, its Bank, LiquidityVault, SDK, keeper, indexer and application.
- **Implementation and source identity:** [LP accounting and callback implementation plan](../design/lp-accounting-and-callback-implementation.md). That plan pins the verified Azuro V3 source files and hashes to reuse.

## Decision

Use a deposit NFT and the pinned Azuro `LiquidityTree` allocation algorithm. Every deposit creates a separate ERC721 position. Its capital is effective immediately, but withdrawal starts 24 hours after deposit. A successful partial withdrawal locks the remainder for another 24 hours. NFT transfer carries the same deposit ID, balance, eligibility range and existing deadline; it does not restart or waive the deadline.

The vendored tree has two documented implementation optimizations, each a separate reversible patch:

- **RANGE_SUM**: the raw-node range sum uses the standard iterative segment-tree query. It reads the same canonical node cover, including stale lazy values, with checked uint128 addition.
- **UNUSED_SUFFIX** (2026-10-07): `_pushLazy` skips its suffix query when the range ends at or after the last used leaf, where that query is provably 0.

Within the vendor file, allocation, rounding, the limit operations' own preview fallback, storage layout and external interfaces remain unchanged. This is not a byte-for-byte upstream tree. The source deltas and the upstream → RANGE_SUM → UNUSED_SUFFIX hash chain are pinned in `src/vendor/azuro-v3/`, and each patch is tested against the code it replaces.

The 24-hour period is a constant with no setter. This is a deliberate project adaptation: the inspected Azuro LP exposes an owner-settable timeout. There is no daily request queue, pooled share-price conversion, ERC4626/ERC7540 interface, exited-risk pocket or later recovery claim. A successful withdrawal transfers assets and reduces the tree in the same transaction. The withdrawn portion participates in no subsequent profit or loss.

For each terminalization, Vault selects one allocation range without using the realized outcome: the snapshotted deposit-ID prefix if its current capital covers the position's original maximum LP loss `k=reserved-stake`, otherwise all currently used leaves (the whole-pool domain). Both profit and loss use that range. The Owner authorized this H-1 correction on 2026-10-04; it replaces the asymmetric rule that let a nonempty thin prefix keep all profit while spreading an uncovered loss to later deposits. The tree's internal integer allocation is unchanged. The original cutoff remains immutable, but the selected range is evaluated at settlement, not fixed at opening.

Before canonical result receipt, mature free capital may still exit when other checks permit it. Exited capital participates in no subsequently booked outcome. Later deposits may share both old profit and old loss; expected return as well as risk follows the selected allocation. Earlier settlements can change the next position's range, so settlement order can change individual NFT balances. The previously accepted pre-receipt conditional ordering risk remains: neither the 24-hour cooldown nor the Received gate proves capital-ordering fairness or prevents advance-information advantage. Local witnesses do not prove that real VRF can be predicted. Acceptance of that risk did not exempt the uninformed H-1 strategy from correction.

## Two custody contracts and authority

Bank deploys its immutable LiquidityVault in its constructor. LiquidityVault has the same immutable asset and recognizes that Bank alone for risk locks and terminal PnL updates. It is not an independently upgradeable or administrator-reassignable vault. Constructor initcode size is part of deployment acceptance.

- LiquidityVault holds LP capital, maintains the original tree, issues deposit NFTs and records their withdrawal deadlines.
- Bank holds open player stakes, protocol and referral payables, and unpaid player debt. Router remains the only authority for Bank position creation/terminalization.
- The LP's asset approval and deposit/withdraw entry points belong to LiquidityVault. Its LP cash operations read Bank's accounting, canonical-result and busy status before proceeding, and a deposit also reads its pause (ADR-0037 §4). The direct deposit path transfers user assets to Vault once.
- Only Bank may call the Vault's lock and atomic settlement entry points. Those entries do not apply the LP gate: otherwise a received result or Bank's active settlement lock would prevent the very settlement required to clear it.
- Both contracts guard cash-mutating entry points against reentrancy. Bank's busy status prevents a callback during Bank bookkeeping from initiating an LP capital change. NFT receiver hooks must not expose partially booked deposits or settlement.

## Accounting identities

Amounts are asset base units:

| Symbol           | Meaning                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `B_B` / `B_V`    | Actual Bank / Vault token balances                                       |
| `PF`, `XP`, `PP` | Bank protocol, all referral, and player payables                         |
| `P`              | Sum of original stakes of open positions                                 |
| `R`              | Sum of original gross reserves of open positions; Bank `totalReserved`   |
| `L`              | LiquidityTree root amount; LP capital, Vault `getReserve()` and SSOT NAV |
| `K`              | Vault `lockedLiquidity`, equal to `R-P`                                  |
| `G`              | Gross solvency capital `L+P`, exposed as `riskAssets`                    |
| `D_B`, `D_V`     | Unallocated balance surpluses `B_B-(P+PF+XP+PP)` and `B_V-L`             |

In a valid state, `B_B >= P+PF+XP+PP`, `B_V >= L`, `R>=P` and `L>=K=R-P`; equivalently `G>=R`. Thus:

```text
B_B + B_V = L + P + PF + XP + PP + D_B + D_V
```

Surpluses are diagnostics, not LP capital, player principal, protocol income or extra risk capacity. A direct token donation to either contract must not change the tree or enrich a subsequent first depositor. Do not add a sweep or donation-allocation entry point in this scope. Negative coverage or inconsistent locks is an explicit accounting fault; LP capital changes, new risk and optional outflows fail closed. No ERC4626 non-reverting-view promise or zero-valued healthy-NAV sentinel remains. Valid terminalization and player debt payment retain their own atomic authorization and payment checks.

Only exact-transfer, non-rebasing tokens whose failed transfers leave balances unchanged are admitted; the first pool is USDC. Every custody transfer verifies actual arrival where it establishes booked funding. A token-side failure must not manufacture a funded tree entry or erase a booked player debt.

## Deposit NFT and withdrawal

`addDeposit(amount)` or `addDepositFor(owner, amount)` receives a positive exact amount into Vault, creates a new tree leaf/NFT and records `withdrawAfter[id]=block.timestamp+24 hours`. There is no top-up of an existing NFT; another deposit creates another position. Gifts therefore cannot extend another NFT's deadline. Deposit/NFT mint rejects zero, Bank and Vault itself as the requested owner. These mint checks add no special recipient restriction to ordinary ERC721 transfers. Deposit admission also enforces the numerical capital bound below.

`withdrawDeposit(id, percent)` follows these rules:

1. Caller must be the current NFT owner. An NFT-approved address may transfer the NFT but may not directly withdraw cash as an operator.
2. The NFT's deadline must have passed and Bank's LP status must permit the operation.
3. Percent uses Azuro's `1e12 = 100%` precision and must satisfy `0 < percent <= 1e12`. Partial withdrawal yielding zero assets is rejected. A mature 100% withdrawal may burn an already zero-balance NFT without a token payment.
4. Compute the current leaf entitlement with the original tree and reduce it using `_nodeWithdrawPercent`. Require `withdrawnAmount <= L_before-K`.
5. Pay only the NFT owner. The owner cannot choose another cash receiver; only an actual NFT transfer changes who may withdraw. The deposit-time owner validation is distinct from standard NFT transfer rules.
6. Full withdrawal burns the NFT. Successful partial withdrawal sets the remaining position's deadline to `now+24 hours`. Failed transfer or insufficient free capital reverts the tree update, deadline change and burn atomically.

The custom executable withdrawal quote must respect percentage granularity. Let V be this NFT's current leaf balance, F=L-K and ONE=1e12. Subject to maturity and the same Bank/ownership constraints as execution:

```text
if V>0 and F<V: pmax = floor(((F+1)*ONE-1)/V)
if V>0 and F>=V: pmax = ONE
actualCash = floor(V*pmax/ONE)
```

For the first branch, `floor(V*p/ONE)<=F` is equivalent to `V*p<=(F+1)*ONE-1`, giving the exact largest valid percentage. If pmax or actualCash is zero, no positive-cash partial withdrawal is executable. A zero-balance matured NFT instead has a full-close operation, not a positive cash quote. Apply all other LP blocking reasons before advertising an executable action. `min(V,F)` is only an asset upper bound: percentage granularity can make it unattainable. SDK/UI must show the executable percentage and its actualCash from the same snapshot, not invent a transaction paying the upper bound.

Do not add an LP percentage withdrawal buffer on top of `L-K`. The existing PF/XP optional-outflow policy is separate. No final-share or final-NFT guard is needed: positive K itself prevents withdrawing all L. At K=0, all LPs may exit even if old zero-net-risk positions are still open. The zero-tree profit rule below prevents unowned value from being carried into a later first deposit.

NFT approval is still powerful because an approved spender can transfer the asset to itself and then withdraw after maturity. The application must not request keeper approval over deposit NFTs. Native ERC721 transfer has no new cooldown and does not increase capital.

## Opening a casino position

Bank authenticates the funding Hub through Router and requires `L>0`, `reserve r >= stake s`, and exact receipt of s. It records `lastDepositId` from Vault at this opening and keeps it immutable with the hold. Choosing opening time as the casino range boundary is our explicit rule; it is not a claim that the unverified Azuro V3 Core was proved to choose the same instant.

After funding, enforce the selected risk equation. The official fresh-deployment risk default is
`riskReserveBps=6000` (60% of G retained); consumers use the actual configured value. The separate
PF/XP collection buffer defaults to `1000` bps and adds no percentage limit to NFT withdrawals:

```text
P_after = P_before+s
R_after = R_before+r
G_after = L+P_after
R_after + floor(G_after*riskReserveBps/10000) <= G_after
K_after = K_before+(r-s) = R_after-P_after <= L
```

Also enforce the numerical bound below. Store the valid deposit boundary, add exactly one open-position slot and lock r-s in Vault in the same transaction. Do not accept new positions with L=0, including a never-used tree whose last ID would be outside the leaf range. Capacity remains 128 open positions; terminalization releases its slot.

## Atomic terminal PnL and custody movement

Let `C=payoutNet+refundAmount+PF_new+XP_new` and `k=r-s`. Keep the Router edge cap, refund/payout bounds and Bank `C<=r`. An unused-round refund still removes the full original stake s when the position terminalizes.

The onlyBank Vault terminal entry atomically releases k, applies the pinned tree PnL operation and moves the necessary cash. It must not expose separately callable arbitrary lock-release or PnL operations to LPs. The entire Bank/Router/Hub/Vault/VRF acknowledgment succeeds together or reverts.

- **Loss, C>s:** Vault subtracts C-s over the allocation range with the pinned push and lazy update (below) and sends exactly C-s to Bank to complete player/fee funding. Because `C-s<=r-s=k`, after release the Vault still covers all other locks.
- **Profit, C<s and L_before>0:** Bank supplies exactly s-C to Vault, which adds it over the allocation range the same way (k=0 keeps `_addLimit`). This increases the selected NFT balances without resetting their deadlines.
- **Zero PnL:** no tree amount update or inter-contract transfer is needed; release k and terminalize the position.
- **Profit with L_before=0:** do not call `_addLimit` on the empty tree. Keep s-C in Bank and credit separately identified protocol capital in PF. Emit a distinct event and exclude it from gameplay fee/performance counters. This is the only zero-tree residual rule; it creates no protocol risk pocket.

Then account for the exact successful player payment or its PP replacement, PF/XP accrual and the one-time P/R removal. For the normal tree branch:

```text
P_after=P_before-s; R_after=R_before-r; K_after=K_before-k
L_after=L_before+s-C
G_after=G_before-C
```

For the empty-tree positive-profit branch, `L_after=0`, additional `PF_capital=s-C`, and `G_after=G_before-s`. Do not apply the normal LP-profit identity to that special branch. Bank and Vault unallocated surpluses stay unchanged by ordinary protocol operations.

A failed player payment records the full PP and can complete terminalization. A failed Bank/Vault funding transfer cannot be converted into player debt to pretend the tree was funded; the transaction reverts and the saved randomness remains retryable. Later payment of PP reduces Bank cash and PP equally, independent of pause and LP withdrawal restrictions, and never charges the tree twice. Pay only the original player.

## Original range algorithm and empty positions

Reuse the pinned tree's push, lazy propagation, proportional integer allocation and rounding. For k>0 the selected range holds effective capital of at least k, and every loss is at most k. Under tree invariant I (amendment below), the limit operation's sufficiency preview can then only answer "no fallback". Vault therefore runs the same `_push` and `_pushLazy` that `_addLimit`/`_removeLimit` would run and skips that O(depth^2) preview, which a full 40-level history otherwise drives past the first-callback budget ([first-callback certificate](../audit/first-callback-gas-certificate-2026-10-07.md)). Differential tests require the resulting tree to equal the limit operation on the same range. k=0 admits only profit and keeps `_addLimit` with its vendor preview fallback. Vault supplies `allocationLeaf`: use the recorded cutoff when its current prefix capital is at least the original `k=r-s`; otherwise use `nextNode-1` for both signs. Equality stays in the prefix. Never replace k with actual PnL, payout or remaining-round stake. Prefix capital is a read-only replay of `_getPushView` integer splits, equal to pushing the cutoff and summing its covered nodes; it does not write or change tree allocation. A latest-leaf cutoff already covers the pool. For k=0, keep the recorded cutoff and the tree's empty-prefix fallback; negative PnL is impossible under C<=r. A zero-root profit still takes the separate protocol-capital branch. Newer NFTs are not promised immunity from older outcomes.

A full loss can leave existing NFTs with zero current value. Owners may burn such mature NFTs with a full withdrawal; no zero-value cleanup is required before a fresh deposit. Never reuse burned leaf IDs. If new capital arrives before an old result is booked, the original positive-root allocation still applies: the whole-pool domain when the prefix does not cover k, and the vendor preview fallback for k=0. The zero-tree protocol branch is based on the root immediately before that result, not an invented historical owner snapshot.

## Numerical and gas admission

Keep the pinned tree, FixedMath and interface. The authorized range-selection rule belongs only to the Vault adapter. Apply a wrapper bound `MAX_TREE_CAPITAL = 2^108-1` to `G=L+P` for LP deposits and new positions. Since pending stakes can later become LP profit, bounding L alone is insufficient. Terminal costs, PnL deltas and effective tree capital cannot exceed the admitted gross capital; checked uint128 casts remain mandatory.

The original tree contains intermediates of the form `(amount*nodeAmount)*1e12`. If each operand is at most M_cap=`2^108-1`, this is strictly below `2^216*2^40=2^256`, so those products fit uint256. Loss cannot grow the root; profit is at most the released stake, so normal terminalization cannot increase G. The empty-tree protocol branch decreases G. This preserves the capital bound without an unexpected settlement-time overflow when all pending stakes become profit.

Lazy nodes can retain older amounts above the current root. The storage-operand bound is therefore the fixed M_cap, not the current G. Validate propagation/addition paths preserve that bound, including repeated losses, withdrawals and subsequent deposits; do not substitute a root-only assertion for that property. Check uint48 leaf exhaustion, uint64 update IDs, percentage multiplication, root uint128 casts and aggregate additions independently.

Tree traversal can be 40 levels. Full callback gas admission must include the selected-domain predicate, tree profit/loss propagation, locks, custody transfer, fees/XP, token refusal and terminal acknowledgment. The k=0 vendor preview fallback is outside the certified casino domain (P5 below): reaching it requires a governance change that also voids the certificate. Existing single-contract or ERC20-share gas results do not prove this callback budget. The one-hour missing-randomness deadline and canonical callback/retry safety requirements remain unchanged.

## Result fence, consumers and pending evidence

Vault obtains LP permission through Bank's canonical Router/VRFHub result count, accounting condition and busy status; a deposit also checks the emergency pause. A seed stored before failed consumer delivery still fences both deposit and withdrawal. Only matching terminal accounting clears the fence. Normal callback settlement and exact-seed retry use the same implementation; a known result must not become a timeout refund, invalid-result fallback or reroll.

Earn lists each NFT's balance, deadline and currently withdrawable percentage/amount, explains partial-withdrawal relocking, and follows ownership through transfers. Index actual cash once, separate gifted NFTs, and preserve reorg correctness. Wager limits continue to use G and R. Keeper cannot withdraw LP NFTs and has no batch job; its callback retry, real missing-seed refunds, player-debt delivery, WS events and polling recovery remain.

The [Executable SSOT](../constitution/ExecutableSSOT.v1.6.md) and implementation plan enumerate pending tests. Required evidence includes custody conservation, original-tree differential and numerical properties, NFT permissions/timing, empty-root handling, all-surplus exclusion, real wrapper callbacks, SDK/browser/indexer/keeper integration, independent review, external audit and fresh network acceptance. No old passed test count certifies this new design.

## Pre-inclusion ordering (Owner decision, 2026-10-04)

Before a result is booked, a mature NFT can exit in full while free capital allows, and the remaining LPs then bear a later loss. An empty or insufficient prefix falls back to the whole-pool domain, so capital that arrives before booking can share an earlier profit or loss. Local witnesses on the production contracts showed both. An LP who exited before a loss was booked kept 50 USDC that the remaining LPs then bore. In the profit case, a 50 USDC deposit made just before settlement ended with 83 instead of 50, and the earlier LP with 166 instead of 199. The witnesses chose the result; they do not show that real VRF output is predictable.

The Owner decided: "保留既定规则，明确接受并披露排序风险" (keep the existing rules; explicitly accept and disclose the ordering risk). The disposition accepts the existing cash-exit and whole-pool domain rules; it does not remove their ordering risk.

- Synchronous exits against free capital, the prefix and fallback rules, and transfers that keep maturity stay unchanged. Withdrawn capital takes no later PnL.
- No pending-position cash gate, exit queue or historical entitlement is added. Disclosure is not a fix and promises no ordering fairness.
- The whitepaper, SSOT, this ADR and the Earn deposit copy disclose the conditional transfer and the real limit of the 24-hour lock. External LP materials must disclose the retained risk.
- Blocking LP deposits and withdrawals while any position is open was not chosen: mature NFTs would wait too, and continuous betting could block exits. Longer cooldowns, faster keepers, larger buffers and private RPC do not remove the advantage either.
- Full allowed-state callback gas qualification, final-source integration, independent and external audit and fresh network acceptance remain separate release conditions. The risk acceptance does not replace them.

## Amendment 2026-10-07: k>0 allocation without the vendor preview

**Status.**

- The preview skip below is ACCEPT_WITH_CONDITIONS (FINAL) in the architecture decision. That decision is recorded in the evidence bundle `architecture-decision-preview-skip-2026-10-07/DECISION.md`, archived since 2026-10-11 ([launch candidate](../release/launch-candidate.zh-CN.md) §14). It was issued after an independent security review that found no Critical, High, Medium or Low issue.
- The vendor UNUSED_SUFFIX patch is ACCEPT_WITH_CONDITIONS. Its independent landing review accepted it with conditions, which the landing fixes address.
- The [first-callback certificate](../audit/first-callback-gas-certificate-2026-10-07.md) has an independent review with conditions. On 2026-10-08 the Owner decided D1–D4: M4 is proved by a per-module revert census instead of being accepted as residual risk; the margin standard is at least 50,000 on every network, reached through the reviewed module interpreter bound (certificate v4); the certificate policy lives in ADR-0006; one written risk acceptance covers the design-inherent residuals. The release remains REWORK until the freeze run.
- The economic rules are unchanged, including the H-1 same-domain rule.

**Theorem.** Take a reachable Vault state, a position with k>0, and `leaf = allocationLeaf(cutoff, k)`. For a loss A≤k, or any profit A≥1, `_push(1, …, leaf)` is followed by `_isNeedUpdateWholeLeaves(…, leaf, A, isSub) == false`, and every `_changeAmount` inside `_pushLazy` applies in full. `_allocate` therefore leaves exactly the storage of `_removeLimit(A, leaf)` / `_addLimit(A, leaf)`, `updateId` included.

**Premises.**

| | Premise | Maintained by |
| --- | --- | --- |
| P1 | `L ≥ K ≥ k ≥ A` on a loss | `lockLiquidity` rejects `K>L`; settlement re-checks `L ≥ K`; withdrawals are limited to `L-K`; `cost ≤ stake + released` |
| P2 (invariant I) | Every positive internal node has a positive child, so every root unit is held by a used leaf | A profit on an empty root is booked as protocol capital, never into the tree. `_push` splits proportionally and keeps the sum. `_updateUp` changes a whole path by the same amount. The theorem's own exact lazy write closes the induction |
| P3 | A non-root node whose whole range lies after the last used leaf holds zero | `_push` writes only children that are already positive; `_pushLazy` changes only positive nodes or the root; `_updateUp` writes only paths from used leaves |
| P4 | `_prefixCovers` replays `_push`'s integer split level by level | Prefix replay tests |
| P5 (certificate domain, not a premise of the theorem) | Every casino position has k>0 | Every module pays more than 1x (the tightest is Dice at 100/99), so k>0 whenever the stake is at least 99 raw units; the official minimum bet is 10,000 |

**Invalidation clause.** Any new path that books value into an empty root, writes tree storage directly, or writes a node after `nextNode-1` voids this optimization and the UNUSED_SUFFIX patch. Such a path must be re-argued before it ships.

**Re-argued for B4 (2026-10-11).** The launch candidate's B4 removes the `maxLoss == 0` test from `_allocationLeaf`. `_allocate` is its only caller and settles k = 0 through the pinned `_addLimit` before reaching it, so every k>0 call selects the same leaf as before and no tree write changes. B4 adds no path of the three kinds above; P1–P4, invariant I, the theorem and UNUSED_SUFFIX stand ([ADR-0037](0037-launch-candidate-authority-pause-capacity-void.md) §8).

**Re-argued for B5 (2026-10-11).** A void reaches the Vault only through `applySettlement` with `cost == stake`, where neither the loss nor the profit branch runs: it lowers `lockedLiquidity` by the position's released capital and calls no `_allocate`, writes no tree storage, books nothing into an empty root and writes no node after `nextNode-1`. B5 adds no path of the three kinds either, so the optimization and UNUSED_SUFFIX stand.

**UNUSED_SUFFIX.** The skipped query is exactly 0 by P3 once the lazy range [LIQUIDITYNODES, r] is nonempty, which holds as soon as one leaf has been used. In that case it covers only non-root nodes that lie after the last used leaf.

- This holds for the vendor tree in general, even with value booked into an empty root, so the patch does not depend on P2.
- One known exception: on a never-used tree with value in the root, vendor `_remove` used to underflow and now succeeds. The Vault cannot reach this, because it never calls `_remove` and settles only at a used cutoff. The case is pinned in a test.
- `_isNeedUpdateWholeLeaves` keeps its query on purpose, because only the k=0 path still evaluates it.

**Guards.** Each guard is listed with the premise it protects:

- `testFuzz_settlementMatchesPinnedLimitOperation` covers the theorem.
- `LiquidityVaultChainedDifferential` runs chained production histories against the pinned limit operation and checks I, root = Σ used-leaf balances, P3, and prefix shaping to k-1, k, k+1 and 0.
- `AzuroUnusedSuffixEquivalence` covers the patch against the pre-patch `_pushLazy`, checks P3 at every step, and includes an off-by-one negative control.
- `BankInvariants` checks root = Σ live NFT balances and that no value lies after the last deposit.
- `AzuroTreeProperties` pins the vendor hash.

Fuzz runs per suite:

- Pull requests: 256, except the 40-level chained configuration, which runs 32 there.
- Release gate (`make tree-equivalence-release`): 4,096.
- `BankInvariants`: runs under the nightly profile in the release workflow.

Only `AzuroUnusedSuffixEquivalence` and the hash pin can detect an error inside the patched function itself. The other suites run the same patched code on both sides of their comparison. Negative controls in `AzuroUnusedSuffixEquivalence` and `LiquidityVaultChainedDifferential` show each differential can tell its mutants apart.

**Gas.**

- Preview skip alone: for k>0 the new execution is the old one minus the preview, so it costs strictly less in every reachable state.
- k=0: the tree operation costs 37–130 gas more because of code generation.
- UNUSED_SUFFIX: each prefix-domain fork pays about 229 gas more for the added comparison. Some prefix-domain states can therefore cost more than on the pre-fix Vault.

So no monotonicity argument guarantees first-callback success any more; only the certificate does. Do not claim that every path got cheaper.

**Certificate domain.** The first-callback certificate covers k>0 only. Release verification fails unless all of the following hold.

Offline (`script/release/VerifyCallbackDomainV16.s.sol`):

- the chain's certificate is accepted;
- every game uses the certified consumer gas and at most 25 rounds;
- every module runs its certified runtime;
- every casino pool's minimum bet is at least 99 raw units and its asset is the certified token;
- the VRF wrapper is the certified one.

Live at one frozen block:

- `script/release/verify_governance.py`: the registered game set is exactly the certified eight.
- `script/release/verify_callback_provider.py`, run before signing by `make release-domain-check`: the USDC implementation and code, the VRF coordinator and its gas parameters are the certified ones.

Lowering a minimum bet below 99, any `registerGame`, or registering, allowing or reactivating a casino pool requires recertification first (see the governance runbook). Public material may only say that the first callback completes under the certified configuration.

