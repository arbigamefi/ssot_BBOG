# VRF and refund credit

Use the verified release to identify GameHub, VRFHub, adapter and coordinator. Record chain, bet ID,
request ID and relevant transaction hashes. Read `VRFHub.getRequest` and `GameHub.getBet` together.

The VRF fee quote depends on callback gas, confirmations and word count. `VRFFeeCharged` records the
paid amount, charged amount, excess refund and whether that refund succeeded. Failed excess ETH
refunds accrue to `refundCreditOf(payer)`; the payer calls `claimRefund()` to receive that credit.
This is separate from a Bank's asset-denominated `playerPayable`.

VRFHub may legitimately hold ETH backing refund credits. Do not treat every nonzero ETH balance as
stranded profit or attempt to spend it without reconciling liabilities.

For delayed randomness, check the provider request and funding, coordinator/adapter binding and
callback gas. An unauthorized, missing or inactive callback is ignored; duplicate `Ignored` events
cannot be subtracted from request counts to derive a reliable pending balance.

VRFHub marks a request inactive before calling the Hub. A failed Hub callback emits `HubCallbackFailed`;
there is no general replay-callback method. Inspect the Hub's actual state. A still-PendingVRF bet can
use its current timeout refund; a RandomReady bet must finalize. See
[casino finalization](game-finalization-diffs.md) for those predicates.

Only the owning Hub may detach a request. Refund detachment and late callbacks must not create a
second terminal transition or reintroduce reserve. Do not impersonate the coordinator, manually
replace randomness or refund a known result to clear a backlog.

Recovery is complete only when affected bets have reconciled terminal states and payment evidence,
and request/credit accounting matches the receipts. Keeper health alone is insufficient.
