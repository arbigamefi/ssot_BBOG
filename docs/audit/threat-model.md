# Threat model

**Status: Core implemented and locally verified; full product qualification pending (2026-10-04).** This model
describes NFT liquidity deposits with fixed 24-hour cooldown, a LiquidityTree and callback settlement.
It is not acceptance of the current runtime, deployment or previous tests. The
[implementation plan](../design/lp-accounting-and-callback-implementation.md) governs feasibility
checks, implementation order and release evidence.

## Assets and accounting boundaries

1. ERC20 LP cash held by each LiquidityVault and deposit ownership represented by ERC721 NFTs.
2. The tree's per-deposit capital and prefix eligibility for subsequent result allocation.
3. Pending player principal P held in Bank and total gross reserve R.
4. Bank protocol/referral liabilities PF/XP and fixed player payables PP.
5. Native-token VRF fees and excess-payment credits.
6. Immutable module/input snapshots, opening deposit cutoff and authenticated random words.

The required equations are:

```text
L = LiquidityTree root (LP capital)
K = R - P                 (Vault locked LP capital)
G = L + P                 (gross backing for bet admission)
R >= P and L >= K          (therefore G >= R)
```

The Vault's tree must be cash-backed, and Bank must back P plus PF/XP/PP. Raw token balances are not
interchangeable with tree capital; unsolicited tokens need explicit attribution. New player stakes
increase Bank cash/P without increasing L. Gross R already includes possible refunds of P; do not
lock R in Vault and thereby count player principal twice.

Successful withdrawal immediately ends participation for the withdrawn capital. The original V3
tree's prefix rule and the whole-pool domain determine who bears later PnL. These rules, NFT transfer and
cooldown are not proof of fair-value pricing or absence of timing advantage. No fungible LP shares,
daily exit batch or personal post-exit recovery right is part of this target.

## Trust assumptions

- The admitted Chainlink wrapper/coordinator authenticate randomness. Their availability and gas
  configuration require network-specific qualification.
- First deployment admits exact-transfer, non-rebasing USDC-like assets. Failed transfers must leave
  balances unchanged. Issuer blacklisting, proxy behavior and refusal to transfer remain possible.
- Pure game modules and referral logic must be qualified for accepted inputs and execution bounds.
  Pinning the opening module prevents registry replacement from changing a bet, but does not prove
  the module cannot fail.
- Router authenticates hubs and position ownership. Bank reserve checks and fee caps do not establish
  an admitted hub's honesty about its game's result.
- Governance controls future admission and policy. Multisig configuration does not remove malicious
  admission risk; guardian custody and admission controls require explicit external-LP review.
- Keeper, UI, RPC and indexes are untrusted for settlement correctness and may lag or fail. Chain state
  and confirmed receipts remain authoritative.
- ERC721 recipients and asset/native recipients may reject transfers. A failed LP operation may revert
  its own transaction; a valid player debt must remain recorded.

## Adversaries and failure modes

- A player also acting as an LP chooses accepted wager inputs, NFT transfers, deposits/withdrawals,
  donations and transaction order.
- A mature LP or informed sequencer/builder can attempt to act before a visible fulfillment is included.
- A caller tries to forge the hub/Bank binding, replace a random word, acknowledge another position,
  withdraw through ERC721 approval alone or evade cooldown by transfer.
- A receiver or token proxy causes reentrancy, out-of-gas, malformed return data, refusal or expensive
  revert-data copying during cross-contract asset movement.
- Many deposits, empty old prefixes and lazy tree updates create costly settlement paths.
- Governance compromise, provider failure, RPC censorship, keeper outages and index/reorg errors affect
  availability and operational evidence.

## Required controls

### Capital and tree allocation

Preserve the selected post-stake gross-backing check:

```text
R_after + floor(G_after * riskReserveBps / 10000) <= G_after
```

New positions require L>0 and a valid opening lastDepositId. For stake s and gross reserve r, lock
r-s in Vault. LP withdrawal is capped by the NFT's balance and L-K after cooldown; do not retain an
additional proportional LP withdrawal buffer. Pending player principal is never an NFT deposit.

For complete terminal cost C, allocate d=s-C using the same range-selection rule for both signs:
the cutoff prefix if its current capital covers the original k=r-s, otherwise the whole-pool domain
(all used leaves). Apply the pinned tree push and lazy update within that range. For k>0 the limit
operation's internal sufficiency preview (its vendor preview fallback) cannot trigger under tree invariant I
and is skipped (ADR-0034 amendment 2026-10-07); at k=0 keep \_addLimit with its vendor preview fallback.
A new path that books value into an empty root, writes tree storage directly or writes a node after `nextNode-1`
would void that argument. Move exact cash and remove s/r/k once. This closes uninformed thin-prefix upside/downside
asymmetry, not pre-receipt information or transaction-ordering advantages. Both expected returns and
risk change with allocation; earlier terminalizations may change a later position's selected range.

If L=0 and an existing position produces profit, keep it in Bank as separately identified protocol
capital PF with independent evidence. Do not add it to an empty root where a new depositor could
capture it. New bets at L=0 are rejected, preventing a no-deposit sentinel from becoming an invalid
future tree cutoff. Donations, zero-value leaves, dust and integer rounding require ownership tests.

Only immutable Bank may lock/unlock or settle against Vault. Only Router may call Bank bet-funds
APIs, and only the position owner hub may terminalize through Router. Player approval belongs to the
wagering hub; LP asset approval belongs to Vault. No rescue or mutable admin link may confiscate
deposit rights or bypass underlying-asset obligations.

### NFT lifecycle and receiver isolation

Use the locked OpenZeppelin ERC721 implementation. Each deposit creates one leaf/NFT with a fixed
24-hour deadline. Partial withdrawal restarts that deposit's clock; ownership transfer preserves the
leaf, current balance and deadline. Only the actual owner may withdraw and cash goes to that owner.
Operator approvals allow standard NFT transfers, not direct withdrawal or an arbitrary cash receiver.

Receive and validate exact cash, create the leaf and set the deadline before a safe-mint receiver
callback. The Vault guard protects the whole operation; receiver rejection rolls everything back.
Specify zero/no-op withdrawal behavior and protect ownership/deadline updates through partial and
full withdrawals. Never invoke NFT receiver hooks during bet settlement: tree PnL updates must not
depend on any LP recipient accepting a callback.

Bank's constructor creates its Vault with immutable reciprocal references. The child constructor
does not query the still-constructing Bank. There is no public initializer or replacement-admin
facility. Verify runtime sizes and combined initcode limits as well as reciprocal deployment fields;
embedding child creation code is not exempt from size or deployment-gas limits.

### Durable receipt and one terminal path

VRFHub directly inherits the pinned Chainlink wrapper consumer base. There is one canonical result
store and one production provider path. Requests derive ownership, Bank and position identity from
Router held positions; a position and provider request ID cannot be reused.

First authenticated receipt writes the word and per-Bank unbooked count before any GameHub attempt.
Zero is valid. Entire GameHub callback failure leaves the canonical seed and count available.
Permissionless retry supplies only an identifier and uses original seed/module/Bank/owner bindings.

GameHub snapshots its accepted module, parameters, cutoff-related position identity and fee/referral
terms. Callback and retry share one finalization implementation. Bounded child-call gas and bounded
error handling reserve gas for preserving and reporting failure; nested guards must not deadlock
ordinary finalization.

Bank/Vault cash, tree update, net-lock release, P/R counters, player debt, fees and terminal
acknowledgment all commit in one reverting child call. Only the bound owner hub acknowledges after
complete Router/Bank/Vault accounting. Failure of acknowledgment rolls all settlement effects back
while keeping the outer receipt; duplicates cannot pay, release or decrement twice.

Unknown module revert, out-of-gas, invalid results and accounting errors are not refunds. Timeout
refund requires the recorded deadline and no received canonical seed. A still-PendingVRF GameHub
after delivery failure does not make a received result cancellable. Valid unused-round refunds remain
part of the resolved outcome.

### Public capital gate and cross-contract reentrancy

The public check follows `Vault -> immutable Bank -> Router -> canonical VRFHub`. Bank combines its
own mutation-busy state with authenticated received-but-unbooked status. Vault public deposit and
withdrawal fail closed for a positive count, busy Bank, malformed response or unavailable authority.
Executable-capacity views cannot advertise funds through a failed status read. NFT transfer preserves
deposit rights without changing tree capital.

The check includes results received only by transport and protects intermediate Bank/Vault cash and
counter states. A fake request cannot lock another pool. Vault's internal only-Bank lock/terminal
methods deliberately do not apply the LP gate, otherwise receipt of randomness would block its own
settlement. They remain authorized and reentrancy-protected through the legitimate Bank path.

Ordinary LP transactions do not start a global betting pause. Unknown pending bets only consume
reserve/capacity; they do not trigger the received-result gate. An LP that cannot receive an NFT or
its own withdrawal can fail that operation without preventing unrelated tree settlements.

### Player debts and native credits

A refused player transfer creates PP for its full amount in Bank, including its cost once in C.
Anyone may later trigger payment to that same player; no redirect or repeated tree charge is allowed.
If debt recording cannot finish, terminal settlement rolls back. Pause does not block valid callback,
retry, settlement, eligible refund or fixed player debt claims.

Use the wrapper's actual native-price function for VRF charges. Excess budget is refunded or credited
to the original payer; failed claims preserve credit, and reentrancy cannot claim twice. Forced
native transfers can make native balance exceed total credits but create neither LP capital nor
earned fees. No privileged sweep may consume player credits.

### Gas and consumer evidence

Measure the entire wrapper -> durable receipt -> GameHub -> Router -> Bank/Vault/tree -> token/debt
-> acknowledgment path. Base Sepolia's coordinator reported a 2.5m cap at block 47,638,466; wrapper
and EIP-150 overhead further reduce available consumer budget.

Existing source-tree fixture measurements cover only their small tree states and compiler settings.
They do not qualify the new integration. Test target compiler settings, cold paths, whole-pool domain selection,
fragmented/lazy state, each game/accepted round count, maximum referrals, transfer rejection and
recovery margin. No 100-round compatibility promise is made; optimize or restrict acceptance before
taking workloads that cannot normally settle in the callback.

Keeper handles exceptional same-seed retries, missing-result refunds, player claims and history
recovery. Ready and Finalized in one receipt must not cause another settlement. Index actual Vault
cash movement and NFT ownership through replay/reorgs. A snapshot health check or WS connection is
not evidence that every position reached an economically correct terminal state.

## Unresolved risks and release gates

**Pre-inclusion economic ordering is an accepted residual risk.** Atomic callback settlement closes the ordinary
confirmed-chain receipt-to-bookkeeping gap. It does not conceal a pending fulfillment from an informed
actor. A 24-hour deposit clock does not prevent an already-mature LP from exiting before a known loss;
prefix restrictions fall back to the whole-pool domain. This is value-allocation risk, not only UX.
The user explicitly retained this model with public disclosure after the local exit and profit-entry
witnesses. See the [recorded decision](../adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04).
Acceptance does not eliminate the advantage or close gas, external-audit and network release gates.

A permanent known-result defect may fence that Vault's capital operations. Pinning the original module
means selecting a new module for future bets does not repair its existing positions. Permissionless
entry does not prove bounded terminalization under arbitrary contract or oracle failures. Unknown
stuck positions consume reserve/capacity and may restrict withdrawals.

Governance powers, token behavior, workload capacity and real callback fees retain their
independent acceptance requirements.

## Evidence sequence

Follow stage 0 of the [implementation plan](../design/lp-accounting-and-callback-implementation.md)
before broad SDK, UI, indexer and deployment-tool changes:

1. Build minimal NFT/tree ordering cases with deposit/cooldown, mature withdrawal before fulfillment,
   empty-prefix whole-pool allocation and no-temporary-LP controls. Distinguish ordinary observers from actors able
   to order transactions; lack of visibility through one RPC is not proof that nobody knows a result.
   Preserve value-transfer witnesses and decide their treatment before expanding the implementation.
2. Exercise the full direct-wrapper callback with the actual tree and dual-custody accounting, including
   failures that must preserve the outer seed. Establish feasibility before assuming round limits.
3. After feasibility review, implement one candidate and run fresh accounting, NFT/receiver, authorization,
   gas, reentrancy, retry, SDK, keeper, PostgreSQL, browser and release checks.
4. Independently review the candidate and ordering treatment before external-LP admission. Historical
   passes, skipped integrations or a callback happy path do not establish security acceptance.

All controls are target requirements awaiting implementation and new evidence. This document does
not mark the native security scan complete or declare the proposed system safe.

## References

- [NFT liquidity accounting](../adr/0034-nft-liquidity-deposits.md).
- [Callback state and settlement](../adr/0006-vrf-callback-settlement.md).
- [Direct wrapper consumer](../adr/0021-chainlink-vrf-wrapper-consumer.md).
- [Native fee and credit invariants](../adr/0022-vrf-native-fee-credit-invariants.md).
- [Chainlink callback security](https://docs.chain.link/vrf/v2-5/security).
- [Chainlink network limits](https://docs.chain.link/vrf/v2-5/supported-networks).
