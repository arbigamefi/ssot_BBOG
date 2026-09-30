# ADR-0035: Exit-only recovery rights and continuous underwriting

- **Status:** Accepted economic rule; implemented locally with contract, model and consumer validation. Final candidate freeze and release acceptance remain pending. This revision incorporates the owner's decisions that later exits must remain possible, staying capital must recover in the settlement transaction, and only exiting rights are frozen. Earlier all-holder validation does not validate this revision. See [current review](../audit/current-review.md).
- **Scope:** the single prelaunch Bank, SDK, keeper and application. No compatibility mode, migration ledger or replacement deployment is introduced here.
- **Required outcomes:** LP requests and activation never impose a betting pause; an unresolved position does not gate subsequent batches; exiting LPs retain their share of that position's risk and eventual recovery. Staying shares continue underwriting and carry the remaining risk through transfers and deposits.

## Capital and ownership

Deposits remain synchronous at the active NAV's virtual-offset book price, including pending stakes. New LPs buy the remaining active risk, including older unresolved bets. They never acquire already segregated exit rights. This is an economic exposure, not a guarantee that book NAV is immediately realizable cash.

A request remains cancellable until activation. At activation, only its controller receives a fixed liquid entitlement and separate rights to the request's share of unresolved reserves. Burn the requested shares once. Remaining wallet shares receive no separate historical claim: their capital stays active, and settlement releases their unused reserve in the same transaction, without keeper action, claims or redeposits.

The Bank uses the pinned OpenZeppelin `EnumerableSet.UintSet` to track holds with active risk. Each hold's risk unit is one base unit of its original reserve. That denominator never changes. There are no historical wallet checkpoints or holder loops.

## Activation arithmetic

Use integer floors throughout. Let `N` be active NAV, `S` real supply, `Q` requested shares and `R` active reserve. Require `N >= R`. The virtual offset `V` is one thousandth of a token (one base unit below three asset decimals).

```text
G = min(floor(S * (N + V) / (S + V)), N)
E = floor(Q * G / S)                           // batch equity ceiling
liquid = floor(E * (N - R) / N)
u[i] = floor(activeUnits[i] * E / N)            // exiting reserve units
```

At zero NAV the liquid and risk allocations are zero. Allocate the batch liquid total among its controllers using their requested shares divided by `Q`. Each nonzero `u[i]` is stored for this batch; reduce that hold's active units and active reserve, and increase historical backing by the same amount. Pricing has no token transfer.

For partial exits, allocation floors stay with active capital. On a full real-share exit, all remaining active units become protocol units backed outside active NAV, and `N - R - liquid` becomes protocol capital. No ownerless old value can pass to later depositors. Every original reserve unit belongs to active capital, an exiting batch, or the protocol exactly once.

## Settlement and refunds

For a hold with original reserve `T`, terminal cost `C`, active units `a`, protocol units `p`, and exiting units `x=T-a-p`:

```text
D = T - C
aggregate exit recovery = floor(x * D / T)
protocol recovery = floor((T-a) * D / T) - floor(x * D / T)
batch recovery for this hold = floor(u[i] * D / T)
```

Cost includes player net payout, refund, protocol fees and every XP bucket, including debt created after a refused transfer. Require `C <= T`; paying booked debt later does not charge risk again.

Terminalization removes `a` from active reserve immediately. Active NAV bears `floor(a*C/T)` of this cost; released staying capital is immediately available for new risk, subject to ordinary solvency limits. The transaction updates one hold and global totals only, regardless of the number of historical exit batches. Holds with no active units never alter later depositors' NAV.

A batch's recovered amount is the sum of its completed-hold allocations. Its controller owns `floor(requestShares * recovered / Q)` minus prior claims. Completed holds release recoverable cash even if another hold never settles. Remaining reserves are an upper bound on future recovery, not cash available now.

The split cannot pay more than the original equity ceiling. Integer rounding can make the direct individual terminal-price bound differ from the older double-floor aggregate bound by one base unit. Tests use the direct capped bound and explicitly test this rounding difference; they do not claim exact economic equivalence at every dust value or prove all trading strategies safe.

## Backing and dust

```text
active NAV = cash - PF - XP - exitPayable - playerPayables - recoveryBacking
active reserve = sum(active units of open holds)
global reserve = sum(original reserves of open holds)
```

Historical backing includes open exiting/protocol reserve, released but unpaid exiting claims, and not-yet-assigned rounding dust. It cannot underwrite new bets or optional outflows.

There are two recovery rounding boundaries. First, the aggregate recovery of a hold can exceed the sum of its batch floors. Each fully terminal batch lazily assigns its allocations once; only when all exiting units of that hold are assigned is that exact remainder moved to protocol capital. Second, a batch's total can exceed the sum of controller floors. Only after every requested share has its final entitlement assigned is that remainder moved to protocol capital. Unclaimed assigned assets remain backed; rights do not expire. Permissionless synchronization does not transfer tokens or change beneficiaries.

Ordinary liquid claim dust follows ADR-0034: return a partial-exit remainder to active NAV, and a full-exit remainder to protocol capital, even after new deposits. All protocol residuals are separate from gameplay fee metrics.

## Bounded work and capacity

`MAX_ACTIVE_HOLDS = 128` bounds each batch's allocation list and the active set. Activation and single-batch recovery views/synchronization scan at most 128 holds. Settlement is constant work with respect to historical batches. No operation scans all historical epochs or LPs. The SDK pages batch IDs at a fixed block for historical discovery.

This is a **concurrent-position capacity limit per pool**, independent of capital: a new hold is refused at 128 active-risk positions until a settlement or full exit frees a slot. A partially exited stuck hold occupies one slot; an entirely segregated hold occupies none. There is no cap on historical batches. This bounds gas but does not promise unlimited betting throughput. Capacity/gas must be included in admission and fresh network acceptance; local gas measurements alone do not certify network limits.

Neither a stuck hold nor eligibility of an LP queue introduces a scheduled betting pause. Available capital, the active-position cap, emergency pause, transaction inclusion and issuer-wide token freezes remain actual constraints. If every asset backs unresolved liabilities, an exit may receive zero immediate cash while retaining its recovery rights.

## Claims and consumers

The ERC-7540 request and ordinary liquid claim remain pull-based. Recovery is a separate per-batch extension, payable to controller/operator-selected receivers. Keepers get no user operator authorization. Share transfers carry only active risk; old exited rights stay with their recorded controllers, including through same-block transfers and zero active supply.

Pause stops deposits, new bets, activation and LP claims, but not valid settlement, refunds, player-payable claims or bookkeeping-only synchronization. A failed LP transfer reverts the claim atomically. Player transfer failure records a debt payable only to that player; it does not erase any liability.

Solidity supplies liquid/risk quotes; the SDK must not replicate pricing for the application. Earn shows queued shares, priced cash and exited historical rights separately, preserves uncertainty and incomplete discovery, and does not label gifted shares as investment profit. Index recovery cash to the controller, independent of operator/receiver; handle reorg rollback and explicit donations. Staying holders do not need a recovery claim or keeper reinvestment.

## Validation

`test/model/recovery_pocket_model.py` independently models reserve units and explicit batch ownership; Bank unit/invariant tests cover atomic capital recovery, overlapping exits, permanent old risk, full exits/new deposits, controller permissions, dust, token refusal and zero values. The real Anvil SDK suite uses the current compiled Bank and generated ABI. These checks must pass for this revision; earlier all-holder/checkpoint test counts are obsolete.

Release requires meaningful mutation coverage, current consumer and connected-wallet tests, bounded gas and runtime size checks, then a fresh source/ABI freeze, external audit and network acceptance. No local result is native Codex Security scan completion or release approval.
