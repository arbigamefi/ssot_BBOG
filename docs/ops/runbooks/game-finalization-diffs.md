# Casino finalization

Identify each bet by chain, GameHub and bet ID. Read `getBet` and `getBetTerminal` at confirmed blocks;
compare the relevant Router and Bank state rather than trusting a cached UI or missing event.

| Hub state | Valid next action |
| --- | --- |
| `PendingVRF` | Wait for callback, or call public `refund` once chain time reaches `placedAt + current refundTimeoutSeconds` |
| `RandomReady` | Call public `finalize` with the admitted execution budget |
| Terminal | Reconcile the terminal proof and payment evidence; do not submit another settlement |

The current refund timeout is mutable but capped at one day. Thus a PendingVRF bet placed before a
batch cutoff is contract-eligible for refund no later than cutoff plus one day, if it remains
PendingVRF. That eligibility bound does not guarantee RPC access, successful execution or pricing.
A callback that changes it to RandomReady requires correct finalization, not a timeout refund.

The keeper simulates and sends `finalize` with 3,050,000 transaction gas, covering the qualified
3,000,000 execution budget and intrinsic allowance. Qualification applies to the admitted modules,
assets and referral configuration. Additional configurations require their own full-path checks.
An outer out-of-gas failure must roll back the entire operation and remain retryable.

A module revert or invalid result tuple follows GameHub's defined refund fallback. Referral
allocation failures and Router cap failures are not blanket refund conditions: investigate the
actual error and preserve valid winner obligations. Never remove a cap to force progress. GameHub
resolves through the currently registered module, so any governance change must account for existing
bets and their original parameters.

For a stalled bet:

1. Read the current state, request, asset, reserve and player, then find its callback/finalization
   receipts. Check RPC errors, transaction nonce/replacement and available signer gas.
2. Allow the keeper's state-aware retry and independent history recovery to reconcile it. Database
   failures must leave the recovery range retryable; do not fast-forward cursors.
3. When a valid terminal call succeeds, verify a single Router/Bank terminal transition, reserve
   release, the relevant counters and `openHolds`. A later callback or duplicate transaction must
   not settle the same position again.
4. Inspect the payment proof. `transferred` means the terminal receipt proves that asset transfer;
   `payable` means it recorded debt at that historical moment; `none` means no payment was due;
   `unknown` means evidence is incomplete. An aggregate current `playerPayable` cannot establish
   which historical bet was later paid.
5. Reconcile the due redemption batch using the [Bank runbook](bank-solvency.md).

Settlement/refund and fixed-player debt claims remain callable while the Bank is paused. Token
restrictions can still prevent cash transfer; contract finality alone is not proof of receipt.
