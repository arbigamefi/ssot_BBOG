# Pause and configuration drift

Read the affected Bank at a fixed block using the current generated ABI. Record its address, pool
mapping, governance, guardian, pause state and release digest before deciding which action is needed.
A frontend flag, inactive pool or insufficient active capital can reject new bets independently of the
Bank's explicit pause bit. Redemption eligibility and historical recovery never independently close betting.

## Bank pause rules

| Operation                                                          | While `riskInPaused`                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| New holds and LP deposits                                          | Rejected                                                              |
| Casino/Sports settlement and refunds                               | Allowed when their state predicates hold                              |
| `claimPlayerPayable(player)`                                       | Allowed; destination is the fixed player                              |
| `requestRedeem`                                                    | Allowed                                                               |
| `cancelRedeemRequest`                                              | Allowed until actual activation, by controller or authorized operator |
| `syncRedeem(controller)` / `syncRecovery(epoch, controller)`       | Allowed; bookkeeping only                                             |
| `activateBatch`                                                    | Rejected                                                              |
| Priced LP `withdraw` / `redeem`, `claimRecovery`, PF and XP claims | Rejected                                                              |
| XP unlock / holdback release                                       | Allowed when eligible; no asset transfer                              |

Governance and the configured guardian may call `setRiskInPaused(true)`. Only governance can unpause.
A zero guardian disables that role. The guardian cannot change configuration or claim user funds.

## Incident handling

1. Identify the affected pool and the real rejection reason. Read `getSSOT`, `openHolds`,
   `currentEpoch`, active reserve and due batch cutoff; do not infer pause solely from a disabled UI.
2. If new risk must stop, the authorized guardian or governance pauses the Bank. Verify the event
   and the resulting state. Keep the keeper running so valid settlement/refund debt-out can drain.
3. Compare risk settings, withdrawal buffer, pool/Hub binding, referral configuration, modules, VRF
   adapter and timeout with the verified release and approved configuration. Investigate unexplained
   drift before signing a corrective transaction.
4. Resolve the incident, reconcile outstanding obligations and verify the intended configuration.
   Governance then unpauses and checks active-capital admission, batch advancement and claims.
   Old recovery epochs must not gate later activation or adequately funded betting.

Pause is not a bounded-exit mechanism. It blocks activation and LP payments for as long as it remains set,
while historical recovery age continues from actual activation. See [Bank solvency](bank-solvency.md).
