# VRF and refund credit

Target runbook for the [direct wrapper consumer](../../adr/0021-chainlink-vrf-wrapper-consumer.md);
core implementation is locally verified; new network validation is pending. Identify GameHub, Router, VRFHub and the wrapper
from one authenticated release, then record chain, bet, request and receipts.

The native quote depends on the admitted full callback budget, gas price and provider configuration.
Charge using the wrapper's actual quote in the request transaction. Overpayment is returned best-effort;
failed return creates payer-owned refund credit, separate from the Bank's asset-denominated player payable.
A refused credit claim reverts without losing the debt. Forced ETH may create surplus; it cannot justify
spending payer credits. See [native credit invariants](../../adr/0022-vrf-native-fee-credit-invariants.md).

For missing randomness, inspect the request, callback gas and wrapper binding. The inherited base rejects
unauthorized callback callers. First authenticated receipt stores the seed and increases the canonical
Bank result count before attempting Hub delivery; duplicates do not overwrite it. A failed delivery can
leave GameHub PendingVRF while the canonical seed already exists.

Retry through the permissionless saved-result path. Do not refund a received result, even after its old
deadline. Only truly missing randomness becomes eligible for timeout refund at the fixed deadline; a later
callback cannot reopen that terminal position. Terminal acknowledgment and accounting are atomic and clear
the result count exactly once. Never spoof a provider, replace randomness or clear a counter to unblock LPs.

Reconcile player payment, request status, LP gate and native credit receipts. Keeper health or a callback
event alone is not evidence of completed settlement. See [casino finalization](game-finalization-diffs.md).
