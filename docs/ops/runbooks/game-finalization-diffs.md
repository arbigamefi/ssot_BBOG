# Casino finalization

Target runbook; the [callback core](../../adr/0006-vrf-callback-settlement.md) is implemented and locally
verified together with corresponding local application integration. Final candidate binding and fresh network validation remain pending. Identify each bet by chain, GameHub and bet ID; read Hub, Router and canonical
VRFHub together. Normal fulfillment saves the seed and terminalizes in one transaction.

| State                                                          | Valid next action                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PendingVRF and canonical seed absent                           | Wait; after the bet's fixed refundDeadline, submit eligible refund                   |
| Canonical seed received, even if GameHub still says PendingVRF | Replay the saved seed through the authenticated path; never timeout-refund           |
| RandomReady with original seed                                 | Retry the common finalize path using the admitted gas budget                         |
| Terminal                                                       | Reconcile one terminal record, acknowledgment and payment proof; do not settle twice |

The default one-hour timeout means refunds become eligible after one hour, not that the right expires
then. Governance updates cannot alter an accepted deadline. Missing randomness and failed delivery of
already received randomness are different conditions. Late callbacks cannot reopen a refunded position.

Use budgets measured for the complete wrapper callback, including seed persistence, failure handling,
Router/Bank/Vault, complete 40-level tree allocation and acknowledgment. A standalone finalize gas result is insufficient. The callback uses a
bounded attempt; failure preserves the seed outside the reverting subcall. Acknowledgment failure rolls
back terminalization too, so the original result remains retryable.

Unknown module reverts, invalid results, OOG and allocation failures do not become refunds. Use the
module snapshotted at acceptance. Preserve the winner's entitlement; do not remove a cap or rerequest
randomness to force progress. A genuine invalid implementation requires diagnosis, not an economic rewrite.

For a stall, verify request ownership, original seed, Bank gate/count, reserve, fixed deadline and
receipts, original deposit cutoff, L/K/G and both custody balances. Check nonce/replacement, RPC coverage, callback budget and keeper gas. Reconcile persisted
history before moving cursors. After success verify exactly one reserve/principal release, one terminal
counter change and one canonical acknowledgment. Tree P&L, cash movement, liabilities and K release
must share the terminal subcall's rollback boundary. The onlyBank Vault path does not apply the LP
received-result gate. Confirm any empty-root positive P&L was assigned once to protocol capital. A Bank pause does not prevent these debt-out paths.

Payment proof distinguishes transferred, payable, none and unknown. A terminal event alone does not
prove cash arrived; a current aggregate payable does not attribute a later payment to a historical bet.
Reconcile LP availability using the [Bank runbook](bank-solvency.md).
