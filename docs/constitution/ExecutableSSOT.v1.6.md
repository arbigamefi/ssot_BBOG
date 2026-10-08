# Executable SSOT v1.6 — NFT liquidity, settlement and allocation

Proof obligations for [SSOT v1.6](SSOT.v1.6.md),
[ADR-0034](../adr/0034-nft-liquidity-deposits.md) and the
[implementation plan](../design/lp-accounting-and-callback-implementation.md).
[ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md) governs allocation.

**Status: accepted target; NFT custody/callback code is implemented locally. The current three-level
referral simplification and its fresh qualification remain in progress.** Earlier tests for other
ownership, custody, callback or referral models are not evidence for the changed source. Bind every acceptance
run to current source/ABI and the pinned tree identity with its documented RANGE_SUM and UNUSED_SUFFIX patches. Independent review, audit and network
acceptance remain separate.

## Notation

`Pos[i]` is a Router position, `U[i]=stake-refundAmount`, and edge/Snap are its accepted edge/configuration.
`E[i]=floor(U[i]*edge[i]/10000)` and `O[i]=floor(E[i]*(10000-LP_SHARE_BPS)/10000)`.
B_B/B_V are Bank/Vault cash; PF/XP/PP are Bank liabilities; P/R are open stakes/gross reserves;
L is the tree root; `K=R-P` is the Vault lock; `G=L+P` is gross riskAssets; `M_cap=2^108-1` is the tree input
capital bound. A deposit NFT ID is its permanently allocated tree leaf, not a fungible share amount.

## A — Allocation

### A1. Conservation

For every settled casino position `i`: `lpRetained[i] + PF_new[i] + XP_new[i] = E[i]`, with
`lpRetained[i] = E[i] − O[i]` under the reference hub.

### A2. LP floor at the settlement boundary

For every settled position `i`, enforced by the Router from its own record:
`PF_new[i] + XP_new[i] ≤ O[i]`. A settlement that would exceed it MUST revert.

### A3. Referral cap

For every settled casino position: `R0 + R1 + R2 ≤ floor(E × MAX_REFERRAL_BPS / 10000)`.

### A4. Payee existence

`R0 > 0` only if the player had a bound referrer at acceptance. `R1 > 0` only if the L1 payee in `Snap[i]` is
non-zero. `R2 > 0` only if the L2 payee in `Snap[i]` is non-zero. Nothing is paid beyond L2.

### A5. Unclaimed share goes to protocol

`PF_new[i] = O[i] − R0 − R1 − R2` exactly. No missing-payee or rounding amount increases any other
payee or `lpRetained[i]`.

### A6. Refunds allocate nothing

For every authorized pure refund, including an eligible timeout with no canonical seed received:
`PF_new = XP_new = 0`. An invalid result tuple, arbitrary revert or resource failure is not an
independent refund authorization; its saved result must remain retryable.

### A7. Non-retroactivity

The allocation of `i` depends only on `U[i]` and `Snap[i]`. Governance changes to the house edge or referral schedule after acceptance MUST NOT change award amounts.
Bank eligibility and the duration of newly started holdback schedules remain live configuration.

### A8. Edge bound

For every opened position: `edge[i] ≤ MAX_HOUSE_EDGE_BPS`. Each casino position has one accepted
`houseEdgeBps`; referral bindings cannot alter that price. At most three nonempty awards are emitted.

### A9. Sports positions

For every settled sports position: `PF_new = XP_new = 0` and `edge[i] = 0`.

## B — Dual custody accounting

### B1. Coverage and conservation

In a valid snapshot:

```text
P = sum(open original stakes)
R = sum(open original gross reserves) = totalReserved
K = Vault.lockedLiquidity = R-P
L = Vault.getReserve() = tree root = SSOT NAV
G = L+P = riskAssets
B_B >= P+PF+XP+PP
B_V >= L
G >= R >= P; L >= K >= 0
```

`D_B=B_B-(P+PF+XP+PP)` and `D_V=B_V-L` are unallocated surpluses, excluded from capital/earnings/risk.
Combined cash equals `L+P+PF+XP+PP+D_B+D_V`. Direct donations must not change the tree or first-deposit
entitlement; no sweep/allocation API is added. Deficit, unreadable state or inconsistent K is an explicit
fault and fails LP cash changes/new risk/optional outflows closed; no zero sentinel is presented as a
healthy value. Token admission requires exact non-rebasing transfers with no failed-transfer side effects.

### B2. Hold and risk continuity

A hold of s/r requires positive L, exact Bank receipt of s and r>=s. Snapshot the last Vault deposit ID
at opening; never accept an out-of-range cutoff or allow the Hub to pick an arbitrary old/new range.
Increment P/R and Vault K by s/r/(r-s) atomically. L does not change on receiving player stake.
Enforce `R_after+floor(G_after*riskReserveBps/10000)<=G_after` and G_after<=M_cap. Official fresh deployments
default to `riskReserveBps=6000`; prove SDK/UI integer admission agrees for identical G/R/configured-rate inputs.
The separate PF/XP `withdrawalBufferBps` deployment default remains `1000`; neither percentage is an
additional NFT withdrawal limit.

For casino admission, `s=amountPerRoll*betCount`, `amountPerRoll>=Bank.minBetAmount()` and
`1<=betCount<=gameMaxBetCount<=25`. The USDC minimum is 10,000 raw units per round. No extra
position-total minimum applies. Assert 0.01×1 and 0.01×25 pass when capital is sufficient,
0.009999×25 fails despite its total exceeding 0.01, and 26 rounds fail before funding/VRF.

### B3. Normal terminal conservation

For `C=payoutNet+refund+PF_new+XP_new<=r`, release k=r-s and remove s/r once. If C>s, the tree bears C-s
and Vault funds Bank by that amount; if C<s with positive pre-root, Bank funds the tree by s-C. C=s
needs no PnL transfer. For these branches, `L_after=L+s-C`, `G_after=G-C`, `K_after=K-k`.
`C-s<=k` proves the remaining locks are covered after a loss. Full refund preserves L; partial unused
stake still removes the full terminal stake. Entire custody movement, tree changes and acknowledgment
must roll back together on failure.

### B4. Empty-root profit and depleted NFTs

If the root immediately before a positive result is zero, skip the tree addition. Book s-C in Bank PF
as separate protocol capital; L stays zero and `G_after=G-s`. Exclude the credit from gameplay metrics.
This is not a protocol risk pocket or a donation sweep. K=0 allows all NFTs to exit despite open zero-net-
risk positions; a later positive result must not create ownerless root value. New LPs entering before
that result make the root positive and inherit the original tree's whole-pool allocation, not an invented historic right.
Zero-balance NFTs can be burned by a mature full withdrawal; no burned leaf is reused.

### B5. Debt and fees

Successful player payment and PP creation have the same terminal cost. Later PP payment reduces
Bank cash and PP equally, changing no tree balance or lock. PF/XP external claims likewise debit Bank
cash/liabilities only. Bucket moves change no aggregate debt. Preserve the PF/XP optional-outflow check
using pre-G and withdrawalBufferBps; do not apply it to LP NFT withdrawal or player debt payment.
A Bank/Vault transfer failure cannot be replaced by PP to invent funded LP capital. Pure refunds accrue
no game fees. Separate explicit self-payments/donations from actual external cash receipts.

## L — Deposit NFTs and original tree

### L1. New deposit and gifts

Every deposit creates a new funded leaf/NFT with deadline now+24h. Timing is a constant with no setter.
Another deposit never tops up or relocks an existing NFT. Both own and third-party funded deposits obey
exact arrival, positive amount, capacity/numerical and Bank LP-status checks. LP approvals target Vault.
Deposit/NFT mint must reject zero, Bank and Vault itself as the requested owner. These mint validations
do not add special recipient restrictions to ordinary ERC721 transfers. Use one public LP funding path,
not a Bank facade plus a parallel Vault implementation.

### L2. Owner, transfer and cooldown

Only ownerOf(id) may withdraw cash; pay only that owner. NFT approve/operator approval can transfer the
NFT and therefore conveys its economic rights, but is not direct cash-withdraw authority. NFT transfers
preserve the deadline and range. Test mature transfer, immature transfer and gift deposits; none resets
another position's timing. Keeper receives no NFT custody approval.

### L3. Withdrawal and relocking

Use original percentage precision 1e12, require 0<percent<=1e12, maturity, Bank LP permission and
`withdrawn<=L_before-K`. Reject zero-cash partial withdrawal; allow mature 100% zero-balance NFT burn.
Successful partial withdrawal resets only that NFT to now+24h. Full withdrawal burns it. Failed token
payment or free-liquidity check rolls back deadline, burn and every tree update. No LP percentage buffer,
last-holder guard, queued request or historical claim exists.

Custom executable quotes must respect the percent step. With V=current NFT balance, F=L-K and
ONE=1e12: for V>0 and F<V, `pmax=floor(((F+1)*ONE-1)/V)`; for F>=V, pmax=ONE.
The actual maximum cash is `floor(V*pmax/ONE)`. If pmax or that cash is zero, no positive-cash partial
withdrawal is executable. V=0 uses a separate matured full-close action. Maturity, owner and Bank LP
status remain execution preconditions. Prove pmax executes and the next percent unit exceeds F when
liquidity binds; `min(V,F)` is an upper bound that percentage granularity need not attain.

### L4. Range allocation and the whole-pool domain

For either PnL sign select the Bank-recorded cutoff only when its current prefix capital >= original
k=reserved-stake. Otherwise select the last used leaf, which is the whole-pool domain. Equality stays in
the prefix. Verify tiny, empty and burned prefixes, prefix k-1/k/k+1, and actual loss/profit < prefix < k.
For k=0 retain the cutoff and the pinned operation with its vendor preview fallback.

Reuse the pinned traversal and rounding. For k>0, run `_push` and `_pushLazy` without the limit
operation's preview, and prove the tree equals `_addLimit`/`_removeLimit` on the same range. k=0 keeps
`_addLimit`. Also prove that the read-only prefix replay equals the pushed cover sum and the leaf
balances, including lazy and deep states and the admitted capital bound.

The skip rests on the theorem in ADR-0034 (amendment 2026-10-07) and its premises:

- P1: `L>=K>=k>=loss`.
- P2, invariant I: every positive internal node has a positive child, so every root unit is held by a used
  leaf. It holds because zero-root profit is protocol capital, never tree value.
- P3: nodes wholly after the last used leaf hold zero. The vendor UNUSED_SUFFIX patch also rests on P3. It is exact
  for every nonempty lazy range. Its one exception, vendor `_remove` on a never-used tree, is unreachable from the
  Vault.
- P4: `_prefixCovers` replays `_push`'s integer split exactly.
- P5: the certificate-domain lemma. Every casino position has k>0 because every module pays more than 1x
  and the minimum bet is at least 99 raw units.

Any new path that books value into an empty root, writes tree storage directly or writes after
`nextNode-1` voids the skip and the patch.

Guard these in CI:

- the settlement differential and the chained Vault differential (I, root = sum of used leaves, P3,
  prefix shaping);
- the UNUSED_SUFFIX differential with its off-by-one negative control;
- the Bank-level invariants root = sum of live NFT balances and "no value after the last deposit";
- the vendor hash pin.

These run at 256 fuzz runs on pull requests, except the 40-level chained configuration, which runs 32 there. They
run at 4,096 at the release gate (`make tree-equivalence-release`). `BankInvariants` runs under the nightly profile in
the release workflow. Negative controls prove that each differential has detection power. A burned NFT has no later claim. Test real Router PF/XP/refund costs,
multiple cutoffs and both settlement orders; do not assert order-independent NFT balances. Differential
tests compare the actual tree, not a hand-written proportional approximation.

### L5. Numerical bound

Enforce G<=M_cap=2^108-1 on deposits and new stakes, including pending principal's possible future profit.
With multiplication operands<=M_cap, `amount*nodeAmount*1e12 < 2^216*2^40 = 2^256`. Normal terminalization
reduces G by C; the empty-profit branch reduces G by s; withdrawal decreases G. Preserve checked uint128
casts. Stored lazy nodes can exceed current G, so prove their fixed-M_cap operand bound across propagation,
loss/deposit cycles and whole-pool allocation rather than checking only the current root. Exercise uint48 leaf limit,
uint64 update limit, percent boundaries, 40-level traversal and extreme accepted capital separately.

### L6. Gate and cross-contract reentrancy

Vault's public LP cash entries read Bank's pause, authoritative received/unbooked count, accounting
condition and busy state. Failed reads reject. Bank-only lock/terminal entries bypass the LP gate so
settlement can clear it. Both custody contracts protect asset-mutating calls. Test ERC721 receiver
callbacks, deposit/withdraw reentrancy and Bank settlement attempting to reenter the LP path; no partial
cash/tree state may become usable capital.

### L7. Consumers

Earn lists NFT ID, live balance, 24h deadline, the executable pmax/actualCash pair from L3 and the
partial-relock consequence. Quote and submit the same percentage at the same snapshot; never label
min(V,F) as executable cash without checking percentage rounding. Zero-value full close is a separate
action, and blocked/unmatured NFTs cannot advertise a presently executable withdrawal.
Indexer follows ownership transfers and real deposit/withdraw cash exactly once, with gift/donation
attribution and reorg rollback. Wager cap uses G/R; tree cash/locked/free amounts are distinct. Remove
fungible-share and batch/recovery UI/API paths. No ERC4626/7540 compatibility or keeper NFT authority.

## C — Callback settlement

### C1. Durable seed and identity

Canonical VRFHub stores the first accepted seed and increments the Bank's received/unbooked count
before downstream work. Requests bind to authenticated Router position/ownerHub/Bank. Repeated IDs,
callbacks or replay cannot overwrite a seed or count it twice. Failure before GameHub delivery still
fences Vault deposit and withdrawal.

### C2. Atomic acknowledgment and refunds

Normal callback and public replay use the same finalizer and original seed. Bank/Vault tree and custody,
Router/Hub terminal state and matching VRF acknowledgment must share a rollback boundary. A failed
attempt preserves seed/count. A received seed forbids timeout refund even if GameHub is still PendingVRF.
A genuine missing-seed timeout keeps the one-hour default/snapshotted deadline. Unknown module revert,
OOG or invalid tuple does not authorize refund or reroll; used/unused rounds settle from valid results.

### C3. Full callback gas

Measure direct wrapper -> VRFHub -> GameHub -> Router -> Bank -> Vault/tree, including both signs of
PnL, worst domain selection and allocation traversal (k>0 has no vendor preview fallback), exact custody transfers, max permitted rolls/referrals,
player transfer failure, failure reporting, retry and acknowledgment. Tree depth is 40; prior ERC20 or
finalize-only budgets do not prove feasibility. Admit inputs only within the actual provider gas limit.

### C4. Timing boundary

The gate protects LP cash changes after the seed is durably known, not all information visible before
inclusion. A mature NFT can still exit before a known loss if ordered earlier and free capital permits.
A 24h entry/partial-withdrawal cooldown is not a proof against this behavior. Preserve the local economic
counterexample and the same-result profit-entry witness. The user explicitly accepted the existing
synchronous-exit/whole-pool ordering risk; public disclosures MUST preserve that boundary and MUST NOT
promise capital-ordering fairness. Gas, external audit and network admission remain independent gates.
Sports results need their own boundary; no unconditional bounded-exit or nonstop-betting guarantee follows.

## G — Governance

### G1. Constants

`LP_SHARE_BPS = 5000`, `MAX_REFERRAL_BPS = 3500`, `MAX_HOUSE_EDGE_BPS = 500`,
`EDGE_CHANGE_DELAY = 7 days` and `MAX_REFUND_TIMEOUT_SECONDS = 1 day` have no setter. The NFT's 24-hour
withdrawal period and `MAX_TREE_CAPITAL=2^108-1` are also constants with no setter.

### G2. Delayed changes

Every change to `defaultHouseEdgeBps` cannot take effect before its queued time plus `EDGE_CHANGE_DELAY`.
The single pending change has no parameter selector; only governance queues/cancels and anyone may activate.

### G3. Schedule validity

No referral schedule with `l0 + l1 + l2 > MAX_REFERRAL_BPS` can be created or activated.

### G4. Guardian scope

The guardian can pause and cannot change any allocation parameter.

### G5. Refund timeout bound

Timeouts must lie within `MIN_REFUND_TIMEOUT_SECONDS` and `MAX_REFUND_TIMEOUT_SECONDS`, at deployment and in governance updates; the default remains 3600 seconds. Each accepted bet snapshots `refundDeadline = placedAt + refundTimeoutSeconds`. Later parameter changes cannot shorten or extend that deadline. A bet still PendingVRF becomes refund-eligible no later than one day after placement only if canonical VRFHub has received no seed; a seed received before failed GameHub delivery forbids this timeout refund; transaction inclusion and payment are separate availability constraints.

## Test mapping and execution evidence

Every row below is an obligation; actual core execution and remaining product qualification are
recorded in the [core review](../audit/nft-core-integration-review.md). The old share/queue tests have
been removed. Bind each run to exact source, pinned tree, ABI, commands and complete logs.

| Obligation | Work to implement or rerun                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1–A5      | Rerun `HouseEdgeAllocationV16`, Router caps/invariants and independent allocation recomputation through NFT custody settlement.                                                                      |
| A6–A9      | Check authorized pure/partial refunds, immutable snapshots, edge bounds and zero-edge sports; callback failures must not become refunds.                                                             |
| B1/B2      | Stateful dual-custody model: stakes, NFT deposits/transfers/withdrawals, locks, donations, coverage faults, exact receipts, wager cap and G bound.                                                   |
| B3/B5      | Wins/losses/full and partial refunds with PF/XP/PP; custody transfer refusal rolls everything back; player refusal creates debt once.                                                                |
| B4         | Last NFT full exit at K0 with old positions open; zero-root profit goes to separate PF capital; later first deposit cannot acquire orphan root; positive-root old-range allocation (whole-pool domain, or the vendor preview fallback at k=0) remains unchanged.  |
| L1–L3      | 24h boundary, separate deposits/gifts, matured/immature NFT transfer, owner versus approved spender, partial relock, zero percent, zero-cash partial, full zero burn and token-failure rollback.     |
| L4/L5      | Original-tree differential and small-number rounding tests; covered/insufficient/empty ranges, long loss/deposit sequences, fixed-M_cap stored-node bounds and extreme uint128/uint48/uint64 inputs. k>0 settlement equivalence (single and chained), UNUSED_SUFFIX equivalence, invariant I and P3 at Vault and Bank level. |
| L6/C1/C2   | Bank busy gate, ERC721 receiver reentrancy, durable seed before failed consumer delivery, exact atomic ack, replay/timeout races and multiple outstanding results.                                   |
| L7         | Real Anvil NFT SDK and connected-wallet UI; ownership/gift/cash/reorg indexing; no ERC20-share assumptions or keeper approval.                                                                       |
| C3         | Actual wrapper envelope with 40-level tree, all admitted module maxima, both PnL signs, transfer failure, saved-seed retry and measured fees.                                                        |
| C4         | Preserve mature exit/transfer and old-profit entry witnesses; verify public disclosure of the user's accepted ordering risk. Risk acceptance is not removal or release qualification.                |
| G1–G5      | Rerun unchanged constants, delayed edge changes, referral versions/cap, guardian and one-hour/default one-day/maximum snapshotted timeout.                                                           |

Original-source reuse does not waive new integration review. Final runtime and constructor initcode size,
asset/provider compatibility, keeper/PostgreSQL/browser runs, mutation tests, independent review, external
audit and fresh deployment/network acceptance remain required. Any reduced round limit must be enforced
before accepting the bet and reflected in both SDK and UI.
