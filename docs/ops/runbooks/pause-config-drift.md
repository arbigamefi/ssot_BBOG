# Pause and configuration drift

Rules implemented and locally verified under the [current plan](../../design/lp-accounting-and-callback-implementation.md);
final source binding and network qualification remain pending. At one fixed block authenticate Bank, Vault, asset, pool, governance, guardian, pause state
and release digest. Do not infer Bank identity from an arbitrary NFT collection.

## Pause and independent gates

| Operation                                                           | While risk-in pause is set                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| New holds; Vault addDeposit/addDepositFor/withdrawDeposit           | Rejected                                                                  |
| Standard NFT transfer/approval                                      | Preserves ownership rules and existing deadline; does not withdraw assets |
| Callback persistence, original-seed replay, valid settlement/refund | Allowed under their state predicates                                      |
| Player-payable claim                                                | Allowed; fixed player destination                                         |
| PF/XP asset claims                                                  | Rejected                                                                  |
| XP unlock/holdback bookkeeping                                      | Allowed when eligible                                                     |

Governance and guardian may pause; only governance may unpause. Guardian has no NFT, payout or
allocation authority. LP availability separately depends on current ownership, 24-hour maturity,
L−K, accounting validity, Bank busy state and canonical received results awaiting accounting.
These conditions are not the pause bit. The fixed timer and immutable Bank/Vault bindings have no
governance replacement setter.

LP withdrawals never set a betting pause. They reduce free capital and may make a large new bet
inadmissible. Frontend switches and inactive pools are separate controls.

## Incident handling

1. Read the exact rejection reason, NFT deadline/owner if relevant, L/K/G/P/R, both cash balances
   and canonical result records at the same block.
2. If stopping new risk is required, use the authorized pause path and verify its receipt. Keep
   valid settlement, timeout checks, original-result retries and player-debt payment available.
3. Compare risk and PF/XP outflow buffers, Bank/Vault/asset/Router/wrapper identity, snapshotted
   modules, referrals and deadlines with the signed release. There is no extra LP percentage buffer.
4. Reconcile both custodians, tree P&L and result acknowledgment, then have governance unpause.
   Verify a valid deposit, an eligible NFT withdrawal and bet admission separately. Do not erase a
   received result, bypass NFT maturity or release a live position's reserve to force progress.

Pause blocks LP payments until governance clears it. It is not a guaranteed-exit mechanism.
See [Bank/Vault solvency](bank-solvency.md).
