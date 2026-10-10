# ADR-0006: Durable VRF receipt and callback settlement

- **Status:** Accepted; the qualification section was amended on 2026-10-08 with the first-callback certificate policy and the Owner's risk acceptance. Core and application interfaces implemented; local integration verified, release qualification pending. See the [current evidence](../audit/nft-core-integration-review.md).
- **Date:** 2026-10-04, amended 2026-10-08

## Context

Casino results should normally settle in the transaction that receives randomness. A separate
routine finalization transaction delays players and leaves a confirmed result outside LP accounting.
Downstream failure must not discard randomness: Chainlink does not automatically repeat a failed
consumer callback. This decision defines receipt and settlement; [ADR-0021](0021-chainlink-vrf-wrapper-consumer.md)
defines the single wrapper-consumer integration.

## Decision

### One durable result per position

VRFHub is the canonical receipt store. At request time it reads the position from SettlementRouter,
requires the caller to own a held position, derives the Bank from that position, and confirms it is
that Bank's configured randomness consumer. Each position has at most one request; request IDs cannot
be reused. Caller-supplied hub or Bank metadata cannot authorize a request.

Requests ask for one word. The authenticated first callback stores that word and marks the request
received before attempting downstream work. Zero is a valid word. Request state distinguishes
awaiting randomness, received but not terminal, and terminal/cancelled; an active flag alone is
insufficient. A duplicate, unknown, cancelled or malformed response cannot replace the accepted word.
Removing a hub's admission for new bets does not erase its existing request bindings.

GameHub does not persist a second copy of the word. Its result getter and settlement read the
canonical request, checking the hub, position, Bank and payer binding. The getter returns the
received word even when delivery to GameHub failed, and keeps it available after terminal
accounting; awaiting or cancelled requests have no word. Finalization requires the received,
not-yet-terminal state. GameHub keeps the result hash and state/event needed by its bet interface.

The normal transition is:

```text
PendingVRF -> durable receipt -> GameHub RandomReady -> Bank/Vault accounting -> Settled
```

All steps normally occur in the callback transaction. VRFHub retains explicit gas for its own
completion and bounds the downstream attempt. A delivery or settlement failure leaves the canonical
word available, emits a bounded diagnostic, and permits anyone to retry that same request. Retry
accepts an identifier, not replacement randomness or alternative recipients. No timeout or operator
can request another draw for a received result.

### One finalization implementation

GameHub snapshots the accepted module address with the bet. Callback and public retry use that address
and one internal finalization implementation, including the original pricing/referral snapshots.
Each game registration is one-time and declares its maximum count and callback gas explicitly; it has
no replacement or in-place parameter-update route. Quote and placement enforce that same envelope.
The registration checks configuration bounds, not measured runtime suitability: release qualification
must establish that every admitted combination actually fits.

The callback entry holds GameHub's reentrancy guard. It attempts settlement through an external
`onlySelf` entry with bounded gas; this child entry does not acquire the same guard again. Public
`finalize` acquires the guard and calls the same internal implementation. The callback can therefore
catch a failed child call while preserving its receipt state. Error data copied or emitted is bounded.

Unknown module errors, out-of-gas, invalid result tuples, referral failures and Router/accounting
failures preserve the original result and preparation for retry. They are not refund instructions.
In particular, remove the blanket resolver `catch => refund` behavior. Valid unused-round refunds
remain part of a successfully resolved result.

Bank continues to turn an unsuccessful player transfer into an obligation to that same player.
Successful debt booking completes settlement; its cost is included once in the net result allocated
to LiquidityVault. Bank retains the cash backing the obligation. If the
transaction cannot finish booking the debt, the entire settlement child call rolls back. It never
rewrites a winner as a refunded bet. A later payable claim does not charge LP capital twice.

### Known results cannot trade at an unbooked price

VRFHub keeps a per-Bank count of authenticated received results whose accounting has not completed.
It increments the count before downstream execution. This includes a result that GameHub has not yet
received because delivery failed, as well as GameHub's `RandomReady` state.

LiquidityVault consults its immutable Bank before public deposit or withdrawal. Bank combines its
own in-progress mutation state with a SettlementRouter view of the received-result count. Router
reads the once-bound canonical consumer for the Bank. Missing required casino wiring, malformed
responses or failed reads fail closed; user metadata cannot select another Bank or consumer. Bank
does not import VRFHub or GameHub.

While a result is unbooked or Bank accounting is in progress, public Vault capital operations reject
execution and executable withdrawal quotes report no available capacity. Ordinary ERC721 transfers
preserve the deposit identity and its cooldown. The fixed 24-hour cooldown and NFT rules are defined
in [ADR-0034](0034-nft-liquidity-deposits.md); there is no daily exit batch or scheduled betting pause.
If a received result can never terminalize, the pool's LP gate remains closed. Public retry does not
guarantee liveness; this implementation has no forced refund, debt-erasure or LP bypass for that
case. Replacing a valid received outcome to unlock capital would violate the result-binding rule.
Internal only-Bank Vault lock/settlement operations do not apply this LP guard: they must be able to
complete the very result that activated it. Pause does not block callback/retry, settlement, eligible
refunds or fixed player debt claims.

After Router has returned from complete Bank and Vault terminal accounting, the owning GameHub
acknowledges the result to VRFHub. Acknowledgment checks stored ownership and Router terminal state. It is part
of the same reverting settlement child call: an acknowledgment failure rolls back settlement, while
the outer canonical receipt and count remain available for retry. Duplicate acknowledgment cannot
decrement twice. During player payment or Bank/Vault cash movement, the Bank busy state, Vault guard and still-positive
count prevent reentrant capital operations before completed accounting. The authenticated Bank may
release the position's net lock and update its original tree prefix only as part of this atomic path.
Tree settlement itself neither mints/transfers an NFT nor invokes an LP receiver callback.

### Refund eligibility

The existing one-hour default means a pending bet becomes eligible for timeout refund after its
stored deadline. Refund additionally requires that canonical transport has not received a word.
GameHub still appearing `PendingVRF` after a failed delivery is not enough. Cancellation and terminal
refund accounting are atomic. A refund committed before receipt ignores later randomness; a receipt
committed first prevents timeout refund. Ordinary pause does not block this debt-out path.

## Qualification and limits

Amended 2026-10-08 with the first-callback certificate policy (architecture decision DECISION-2 §5.3; Owner
decisions D1–D4 of 2026-10-08). This section replaces the earlier sampled-evidence text.

### Requirement

The user reaffirmed on 2026-10-04 that every admitted state must finish settlement in its first authenticated
callback, including the allowed LiquidityTree lifetime histories. A known extreme history that needs a separate
retry does not meet this requirement. Same-seed recovery stays for fault containment; it is never counted as
qualification. The user's later decisions fix a hard cap of 25 rounds and a 0.01-USDC per-round minimum.
[ADR-0021](0021-chainlink-vrf-wrapper-consumer.md) records the provider gas boundary that must be rechecked.

### What counts as proof

- A certificate is a per-frame upper bound derived from the frozen bytecode, composed through the EIP-150
  nested rule (`need(U; O, R, Q) = max(U + R, O + inv(U), O + U + Q, R + 1)`, `inv(U) = U + ⌊(U − 1)/63⌋`) with
  the provider reserves, an EIP-2200 sentry check for every frame that writes storage, and a single inequality
  against the consumer gas. Every component bound must be independently reviewed.
- Successful samples, more fuzz rounds, observed maxima plus an empirical margin, and "the crude sum is only a
  little over" are not proof. A sample that fails is a counterexample; a sample that passes proves nothing.
- The current certificate is [first-callback-gas-certificate-2026-10-07.md](../audit/first-callback-gas-certificate-2026-10-07.md).
  It covers the whole settlement path: VRFHub → GameHub (outer and child frames) → SettlementRouter → Bank →
  LiquidityVault → the 40-level tree including the H-1 whole-pool domain → USDC.

### Certified domain and machine verification

The certificate covers k = reserved − stake > 0 only. Lemma P5 keeps k = 0 outside the casino domain: every
module pays more than 1x and the minimum bet is at least 99 raw units (official 10,000). Release verification
enforces the domain against `script/release/first-callback-domain-<chainId>.json`:

- offline (`VerifyCallbackDomainV16.verify`): certificate status `CERTIFIED`; every game at the certified callback
  gas and at most the certified round count; every module at its certified codehash; every casino pool at or
  above the minimum-bet floor, at the Owner's policy values (`ownerPolicy`: 10,000 minimum bet, `riskReserveBps`
  6000, `withdrawalBufferBps` 1000) and on the certified token; the certified VRF wrapper;
- live on a fork of the release chain (`VerifyCallbackDomainV16.run` with `RPC_URL`, repeated by the fork release
  gate at the governance block): every core contract on the callback path (VRFHub, GameHub, SettlementRouter,
  PoolRegistry, ReferralRegistry, DefaultReferralEngine, each Bank and Vault) has the certified runtime
  (`coreRuntimes`: each immutable slot is checked against the release value, then zeroed, then keccak256 is
  compared with the certified artifact) and the certified constructor wiring. Added after the independent audit of
  2026-10-10 (F-01), which found that only the module runtimes were machine-pinned;
- live at one frozen block (`verify_governance.py`, `verify_callback_provider.py`): the registered game set is
  exactly the certified eight; the USDC implementation and code and the VRF coordinator and its gas parameters
  are the certified ones.

The Release Gate workflow takes the audited source tree hash as an input and refuses any `release_tag` whose tree
differs. The seal digests the domain file cites are copied into `script/release/certificates/` and checked by a
unit test. Dependencies are installed at the commits recorded in `deps.lock` and refused unless their compiled
subtrees have the recorded content digests. After the fix review of 2026-10-10 the gate also requires the
`audited_source_tree` input to equal the repository variable `V16_AUDITED_TREE`, and the fork gate runs the domain
script with `CALLBACK_REQUIRE_FORK=1`, so a missing RPC fails instead of skipping the runtime comparison.

The module premise M4 (an admitted bet's `resolve` never fails for a non-gas reason) is proved in
[m4-resolve-census-2026-10-08.md](../audit/m4-resolve-census-2026-10-08.md) and guarded by `CallbackDomainM4Test`.

### Validity and recertification

A certificate is per network: Base mainnet has its own USDC, wrapper and coordinator and needs its own
certificate. Any of the following voids it and requires recertification before release or before the governance
action:

- any change to certified bytecode, or a new module;
- a USDC implementation upgrade; a wrapper or coordinator parameter change; a hard fork that reprices gas;
- lowering a casino pool's minimum bet below 99 raw units; any `registerGame`; registering, allowing or
  reactivating a casino pool; changing referral or edge parameters (until the certificate review confirms that
  values inside the checked ranges cannot move the bound).

The governance runbook lists these triggers. Configuration-drift alerts (K0-4) are required before any network
that carries real funds.

### Margin policy (Owner decision D2, 2026-10-08)

A certificate used to switch a domain file to `CERTIFIED` must leave at least 50,000 gas of margin under the
consumer gas on its main measure, on every network including Base Sepolia. The main measure is the one the
certificate designates as such: every one of its component bounds has been independently confirmed, and every
call boundary below the Router is charged explicitly rather than folded into the caller. Secondary measures,
such as an older or looser bound kept for comparison, are recorded in the certificate but do not gate the
switch. The margin covers model risk in the bounds, not gas repricing, which voids the certificate instead.

### Evidence

Every certificate version is sealed in its own directory with a SHA-256 manifest and never overwritten; a
`CERTIFIED` switch cites the manifest hash it relies on. Reproduction runs in scratch copies, never inside a
sealed directory.

### Limits

Callback settlement closes the ordinary confirmed-chain gap between result availability and PnL booking. It does
not hide a pending fulfillment from a sequencer, builder or observer able to order an LP transaction before it.
The user accepted the existing synchronous-exit/whole-pool ordering risk, with matching public disclosure; this
is not a fix or proof of capital-ordering fairness. Strict gas, external audit and network gates remain
independent. A permanent known-result accounting defect can still stop capital operations in the affected Vault;
this decision makes no unconditional liveness or MEV claim.

### Owner risk acceptance (F6, submitted 2026-10-08)

The Owner confirmed the plan behind this section on 2026-10-08 and, later the same day, confirmed the text
below verbatim, after the margin policy above had been reworded to gate on the main measure. The Owner also
chose to handle the independent review's wording findings through the certificate erratum rather than a
re-seal. The Base Sepolia domain file was switched to `CERTIFIED` on that basis on 2026-10-08, citing
certificate v4 (`CERTIFICATE-v4.sha256`, SHA-256 `d67a7083…`), its erratum and the review manifest (`d6c1619c…`).

| # | Accepted | Residual risk and its containment |
| --- | --- | --- |
| 1 | R1: the k>0 allocation skips the vendor preview on the strength of tree invariant I | I has two independent proofs and resident tests. The residual is a future code path that violates the invalidation clause of ADR-0034; such a path must be re-argued before it ships |
| 2 | R6: external changes void the certificate after release | USDC upgrade, provider parameter change, hard fork. Release verification checks once; afterwards the runbook and, before any value network, K0-4 alerts and a `CallbackSettlementFailed` alert. A failed first callback keeps the seed, fences LP cash and remains publicly retryable |
| 3 | The certificate covers k>0 only | k = 0 stays outside the domain by lemma P5 and the governance triggers above (minimum bet, game registration, pool admission). Entering k = 0 requires recertification, or the `_prefixCovers(cutoff, 1)` variant by a separate decision |
| 4 | Emergency order | If a certificate fails to close: A (tighten proofs) → B3 (vendor patch, already applied) → C → D, as pre-approved in the architecture decision |
| 5 | Network scope | The current certificate applies to Base Sepolia 84532 only. Mainnet needs its own certificate, with M4 and the margin policy met there |

No exception is accepted for M4 or for the margin: M4 is proved, and the margin policy above applies to the
certificate that switches the domain file.

## Required acceptance evidence

- One terminal transition and one reserve release despite duplicates, late callbacks or retries.
- Durable zero/nonzero seeds after both entire GameHub delivery failure and isolated settlement failure.
- No resolver error or gas-starved call converts a valid result into a timeout or blanket refund.
- Original module, Bank, player, pricing and referral terms survive registry changes and public retries.
- Received-result counts remain correct through acknowledgment failure, duplicate acknowledgment,
  multiple pending results, token reentrancy and spoofed requests for another Bank.
- A failed delivery blocks stale Vault entry/exit and timeout refund while allowing same-seed recovery.
- Vault public operations observe Bank busy state; only-Bank settlement does not deadlock on the LP guard.
- Bank/Vault cash, tree, lock, player debt and acknowledgment all commit or all roll back; no LP receiver
  is called by a settlement tree update.
- Successful ordinary callbacks finish accounting without a keeper finalization transaction.
- Full-path gas, actual wrapper integration and pre-inclusion ordering cases are independently reviewed.

These are required tests, not reported passes. See the [implementation plan](../design/lp-accounting-and-callback-implementation.md).

## Source

[Chainlink VRF security considerations](https://docs.chain.link/vrf/v2-5/security) explain callback
failure and fixed-input requirements. Valid authenticated callbacks must fit the qualified gas
envelope; neither this decision nor the inherited access check promises that every possible external
call can never revert.
