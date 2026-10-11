# Pause and configuration drift

Rules implemented and locally verified under the [current plan](../../design/lp-accounting-and-callback-implementation.md);
final source binding and network qualification remain pending. At one fixed block authenticate Bank, Vault, asset, pool, governance, guardian, pause state
and release digest. Do not infer Bank identity from an arbitrary NFT collection.

## Pause and independent gates

| Operation                                                                | While risk-in pause is set                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| New holds; Vault addDeposit/addDepositFor                                | Rejected (`RiskInPaused`; the Vault's `DepositsPaused`)                           |
| Vault withdrawDeposit                                                    | Allowed under its own checks (maturity, L−K, LP status)                           |
| Standard NFT transfer/approval                                           | Preserves ownership rules and existing deadline; does not withdraw assets         |
| Callback persistence, original-seed replay, valid settlement/refund/void | Allowed under their state predicates                                              |
| Player-payable claim                                                     | Allowed; fixed player destination                                                 |
| XP and protocol-fee claims                                               | Allowed under the PF/XP outflow policy; protocol fees remain a timelock operation |
| XP unlock/holdback bookkeeping                                           | Allowed when eligible                                                             |

The sentinel (the Safe) or the guardian may pause at once, and governance through the timelock; only
governance may unpause, so an unpause waits 72 hours in the timelock, and the guardian can cancel it
(ADR-0037 §3, §4). Guardian
has no NFT, payout or allocation authority. On a suspicious queued operation, the Safe or the guardian
cancels it and the sentinel deactivates the pool or disables the game; a pause is not needed to protect
LPs. LP availability separately depends on current ownership, 24-hour maturity,
L−K, accounting validity, Bank busy state and canonical received results awaiting accounting.
These conditions are not the pause bit. The fixed timer and immutable Bank/Vault bindings have no
governance replacement setter.

LP withdrawals never set a betting pause. They reduce free capital and may make a large new bet
inadmissible. Frontend switches and inactive pools are separate controls.

## Incident handling

1. Read the exact rejection reason, NFT deadline/owner if relevant, L/K/G/P/R, both cash balances
   and canonical result records at the same block.
2. If stopping new risk is required, use the authorized pause path and verify its receipt. Keep
   valid settlement, timeout checks, original-result retries, voids, player-debt payment and LP
   withdrawals available.
3. Compare risk and PF/XP outflow buffers, Bank/Vault/asset/Router/wrapper identity, snapshotted
   modules, referrals and deadlines with the signed release. There is no extra LP percentage buffer.
4. Reconcile both custodians, tree P&L and result acknowledgment, then have the Safe schedule the
   unpause; it takes effect 72 hours later at the earliest.
   Verify a valid deposit, an eligible NFT withdrawal and bet admission separately. Do not erase a
   received result, bypass NFT maturity or release a live position's reserve to force progress.

A pause does not block LP withdrawals; a received result awaiting accounting does, until it is booked or
voided (ADR-0037 §7). Neither is a guaranteed-exit mechanism.
See [Bank/Vault solvency](bank-solvency.md).
