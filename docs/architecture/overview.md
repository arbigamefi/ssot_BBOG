# Architecture Overview

**Status: Core and application interfaces implemented; local integration verified, release qualification pending (2026-10-04).** The selected prelaunch architecture
uses NFT deposits with a 24-hour cooldown and a LiquidityTree, plus normal settlement inside the VRF
callback. Local implementation evidence does not qualify an already deployed runtime or a fresh network release.
The [implementation plan](../design/lp-accounting-and-callback-implementation.md) controls sequencing
and release evidence.

## Goals

- Separate LP assets from player stakes and fixed debts.
- Use the selected Azuro-style deposit-tree allocation and synchronous withdrawals.
- Preserve the current gross-backing bet risk formula.
- Settle casino outcomes in their normal callback and retain the original result after a failure.
- Keep immutable component bindings and one implementation without migration or compatibility paths.

## Components and custody

### LiquidityVault: LP deposits, cash and NFTs

Each Bank has one immutable LiquidityVault holding LP cash. The Vault uses the reviewed 40-level
LiquidityTree for deposit balances and prefix-limited profit/loss allocation. Each deposit creates
one ERC721 NFT; it does not mint fungible ERC20 shares or expose an ERC-4626 vault.

The NFT identifies a leaf and its withdrawal deadline. This project's cooldown is a fixed
`24 hours` constant. Deposit starts the clock, and successful partial withdrawal restarts it for
the remaining deposit. Transferring the NFT preserves both the leaf and deadline. Only its current
owner may withdraw, and cash is paid to that owner. Standard ERC721 approvals permit NFT transfers;
they do not independently authorize withdrawal.

A deposit receives and verifies exact cash, creates the leaf and assigns all metadata/deadlines
before calling `_safeMint`. Rejection by a contract recipient reverts that deposit. The Vault's guard
prevents receiver callbacks from interleaving its capital mutations. Profits and losses only update
tree balances; settling a bet does not mint or transfer NFTs or call LP receiver hooks.

The Vault exposes immediate deposit and, after cooldown, synchronous withdrawal subject to available
unlocked liquidity. There is no accepted withdrawal request, daily batch, personal exited-risk ledger
or later recovery claim. Successful withdrawal immediately reduces LP capital and ends participation
for the withdrawn amount. Pending bets do not require a scheduled pause or full-pool drain.

### Bank: player principal, fixed liabilities and bet accounting

Bank holds pending player stakes and cash backing protocol fees, XP and fixed player payables.
It is the only caller allowed to change Vault underwriting locks or apply a settled game result.
SettlementRouter remains the only Bank bet-funds authority.

The accounting quantities are:

```text
L = LiquidityTree root balance: LP capital held in Vault
P = original principal of all open player positions, held in Bank
R = total maximum-payment reserve for those positions
K = R - P: aggregate LP capital locked in Vault
G = L + P: gross backing used by the unchanged bet risk formula
```

Valid state requires `R >= P` and `L >= K`, equivalently `G >= R`. A player's new stake increases
Bank cash and P, not L. Vault cash backs the tree; unsolicited transfers are not silently attributed
to depositors or turned into extra bet capacity. Bank cash backs P and PF/XP/PP, not the LP tree.
Neither contract's raw token balance alone is the gross-backing metric.

New betting requires positive L and a valid latest-deposit ID. For stake s and reserve r, Bank records
the opening deposit cutoff and locks `r-s` in Vault. Admission preserves:

```text
R_after + floor(G_after * riskReserveBps / 10_000) <= G_after
```

The official fresh-deployment risk default is `6000` bps, retaining 60% of G for new-risk admission.
The formula is unchanged. PF/XP collection has an independent `withdrawalBufferBps=1000` deployment
default. LP withdrawal capacity is `L-K`, capped by the NFT's balance and other status conditions;
it has no additional proportional withdrawal buffer.

For complete terminal cost C (net player payout, refund, new protocol fees and new XP), the net LP
result is `d=s-C`. Positive d moves Bank cash to Vault and adds d over the selected range. For either
sign, the range is the opening prefix only if its current capital covers the original k=r-s; otherwise
the whole-pool domain (all current leaves). Negative d removes tree capital over that same range and moves
that cash from Vault to Bank. Both signs use the original tree push and lazy update; for k>0 the limit
operation's internal sufficiency preview cannot request its second push under tree invariant I and is
skipped (ADR-0034 amendment 2026-10-07). At k=0 only profit is possible and the original `_addLimit`,
with its vendor preview fallback, still applies. Remove the original s/r counters and release `r-s` from K exactly once.

The maximum-loss threshold applies to both signs; a thin nonempty prefix cannot keep all profit
while shedding its uncovered loss. The tree's integer allocation remains pinned. Earlier settlements
may change the next position's range; both expected return and risk follow that allocation. These
rules do not guarantee that deposit or settlement ordering never changes individual balances.

If L is zero when an old position produces positive d, Bank keeps that result as separately identified
protocol capital payable, with its own event/statistic. It is not gameplay fee and is not injected
into an empty tree for a later depositor to capture. New positions cannot open at L=0, avoiding an
invalid no-deposit cutoff; already-open positions retain their valid cutoff and may settle.

Failed player transfers remain fixed player payables PP in Bank. Their cost is included once in C;
later payment reduces Bank cash and PP together and does not charge the tree again. Unknown errors
are not refunds. Failure to complete required accounting reverts the entire terminal operation.

### PoolRegistry and SettlementRouter

PoolRegistry binds pool ID, asset, Bank and domain and authorizes hubs. Router records the position's
owner hub, Bank, player, stake, reserve and pricing constraints and enforces terminal authority and
allocation caps. Router does not custody assets.

Router also exposes the received-result guard for each Bank by reading its once-bound canonical
VRFHub. Missing required casino wiring, malformed responses or failed reads must not silently report
safe capital-operation status. Existing position bindings survive changes to future admission.

### GameHub and pure modules

GameHub fixes the accepted module address, parameters, stakes, deadline and price/referral snapshots.
It opens the Router position and requests one random word. Callback and permissionless retry use
one guarded finalization implementation with the original module.

Modules are deterministic validate/maxPayout/resolve code with no custody. A registry change does
not replace the module for an already accepted bet. Resolver errors, out-of-gas, invalid results,
referral errors or accounting failures preserve the original result for investigation/retry;
they do not authorize a blanket refund.

### VRFHub: single wrapper consumer and result store

VRFHub directly inherits the locked Chainlink wrapper consumer base. It charges the wrapper's actual
native fee, returns excess budget or records payer credit, and authenticates callbacks through the
inherited entry. There is no independent adapter or synthetic production provider mode; tests use
a MockWrapper through the same interface.

Each request derives owner and Bank identity from a held Router position. The first accepted word
and per-Bank unbooked count are durable before any fallible GameHub call. A duplicate cannot overwrite
the word. Public retry uses the stored seed and original binding. Bank/Vault accounting and terminal
acknowledgment succeed in the same reverting child call.

### Referrals

The referral registry tracks relationships; the engine calculates allocations. Bank owns fixed XP
liabilities and their claim/vesting state. LP tree allocation does not give recipients control over
settlement or insert their callbacks into the tree update.

## Immutable wiring and dependency direction

Bank's constructor creates `LiquidityVault(asset, address(this))` and stores its address immutably.
Vault stores immutable asset and Bank references. Its constructor does not query the Bank whose code
is still being created. There is no public initializer or administrator-controlled replacement link.

Deployment checks reciprocal identities and verifies both runtime code sizes, Bank initcode size
including embedded child creation code, constructor gas and explorer verification. Router and canonical
VRFHub must be correctly bound before pool activation, without an unauthenticated initialization window.

- Vault public capital operations read status only from their immutable Bank.
- Bank consults Router for authoritative result status; it does not depend on GameHub or VRFHub.
- Router owns position authorization and the canonical consumer view.
- Hubs call Router for position funding and settlement, never Vault settlement methods directly.
- VRFHub reads Router bindings and invokes the owner hub; pure modules do not depend on these components.

## Mutation ordering and data flows

### Public deposit or withdrawal

The LP approves Vault for asset deposits. Vault first checks its own reentrancy guard and Bank's
capital-operation status. Bank combines pause, its in-progress mutation state and Router's received
but unbooked count. A failure or malformed query rejects the action; executable quotes cannot advertise
capacity through an unavailable authority.

Deposit verifies actual arrival and completes leaf/deadline state before safe mint. Withdrawal
requires the current owner and elapsed cooldown, updates/burns the leaf NFT, maintains `L >= K`,
and pays that owner atomically. A failed payment rolls back the whole operation. Successful partial
withdrawal resets the fixed deadline. NFT transfers preserve the leaf's current rights and clock.

### Place bet

1. UI/SDK obtains a wrapper fee quote and risk inputs from consistent chain state.
2. GameHub validates the module/input/round envelope, collects stake from the player and opens Router's
   position. Players approve GameHub for wagers and Vault for LP deposits.
3. Router authenticates the hub/pool. Bank verifies exact stake arrival, positive tree capital and
   a valid latest-deposit cutoff; it records P/R, checks the unchanged G-based risk formula and locks
   the corresponding K in Vault.
4. GameHub fixes bet semantics and requests randomness. VRFHub verifies owner-held position identity
   and pays the actual wrapper charge. Failed acceptance rolls back funding, locks and the request.
5. Excess native budget returns to the payer or becomes credit.

### Receive result and settle

1. Wrapper authenticates into VRFHub, which stores the seed and increments the Bank's unbooked count.
2. GameHub attempts the common finalization body in an isolated bounded child call.
3. Router calls Bank. While Bank is busy, only its internal Vault settlement interface can move locked
   capital or update tree allocation; those methods do not apply the public LP gate.
4. Tree update, Bank/Vault cash transfer, lock release, P/R release, PF/XP/PP booking and player payment
   or payable creation occur as one atomic operation. Token callbacks cannot enter public LP actions
   through an intermediate state.
5. After Router returns from completed accounting, the owning hub acknowledges terminal completion.
   Acknowledgment failure rolls the child operation back while preserving the outer seed/count.
6. Keeper retries exceptions using that same seed. A normal successful callback requires no second
   finalization transaction and must not be submitted again after observing its Ready event.

### Timeout refunds and fixed claims

The one-hour default is the earliest timeout-refund eligibility, not an expiration of the right.
Canonical receipt of a word prevents timeout refund even if GameHub never received the callback.
A committed refund prevents a later response from reopening the position.

Pause does not block callback/retry, valid terminal settlement/refund, player PP claims or native
credit claims. A receiver can still prevent immediate transfer; the entitlement remains recorded.

## Qualification boundaries

Stage 0 first tests minimal economic ordering cases and the new full wrapper/callback path before
broad consumer changes. The source 40-level tree fixture has measured updates costing hundreds of
thousands of gas; it is not target integration qualification. Base Sepolia's coordinator reported a
2.5m cap at block 47,638,466, with additional wrapper/EIP-150 overhead constraining consumer gas.

Measure the target compiler settings, cold tree paths, fragmented and whole-pool-domain states, each game,
maximum accepted rounds, referral allocation, token behavior, net-lock release and acknowledgment.
There is no promise to retain a 100-round workload that cannot fit. Restrict admission before taking
a bet rather than make ordinary callback failure the expected path.

A 24-hour deposit clock does not stop an already-mature LP from acting on a result before fulfillment
is included. Tree prefix rules and same-transaction finalization do not prove all information-based
ordering gains absent. The user accepted the existing synchronous-exit/whole-pool ordering risk;
public disclosure is required and does not remove the advantage. See the
[recorded decision](../adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04).
Strict gas qualification, external audit and network acceptance remain open. A permanent
known-result failure may block that Vault's capital operations; no unconditional liveness is claimed.

See [ADR-0034](../adr/0034-nft-liquidity-deposits.md),
[ADR-0006](../adr/0006-vrf-callback-settlement.md),
[ADR-0021](../adr/0021-chainlink-vrf-wrapper-consumer.md),
[ADR-0022](../adr/0022-vrf-native-fee-credit-invariants.md) and the
[implementation plan](../design/lp-accounting-and-callback-implementation.md).
