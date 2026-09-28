# Alerts and delivery

Configure alerts against the [monitoring inventory](metrics.md) and test them before enabling the
application. These rules describe operating requirements; they do not claim a deployed monitoring
service exists.

| Condition                                                                                              | Response                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Active NAV below active reserve, or historical backing below its remaining reserve and unpaid recovery | Stop new risk through the authorized pause path; reconcile the [Bank](runbooks/bank-solvency.md) immediately           |
| Unexplained governance, guardian, module, signer or pool binding change                                | Review the receipt and approved configuration using [pause/configuration rules](runbooks/pause-config-drift.md)        |
| Historical epoch age > 600 chain seconds with unfinished holds                                         | Keeper marks `pocket` degraded; identify remaining old positions and pause state, preserving actual activation time    |
| Lifecycle reconciliation stalled for five minutes                                                      | Keeper marks stalled health; repair coverage/RPC/persistence before trusting the live queue                            |
| Finalization, refund or batch-activation read/write failure                                            | Investigate the specific error; retain state-aware retries and preserve valid player outcomes                          |
| VRF delay or failed Hub callback                                                                       | Follow the [VRF runbook](runbooks/vrf-refundcredit.md); check actual bet state and refund eligibility                  |
| Stale/missing health snapshot, RPC failure, signer gas shortage or stuck nonce                         | Restore the affected service path, then reconcile pending receipts and historical work                                 |
| Database outage, stopped replay or backup failure                                                      | Follow [index recovery](runbooks/bet-index-production.md); do not mark an unpersisted range complete                   |
| Sports result dispute, missing report or stalled ticket pages                                          | Assign the authorized reporter/arbitrator/governance action and follow [Sports operations](runbooks/sportsbook-ops.md) |

The ten-minute historical-age threshold is not a promised recovery deadline. Incomplete historical
discovery is reported as `pocket-recovery` degradation; it must not block later activation. Emergency
pause blocks activation and LP claims. An old obligation delays only its own historical recovery,
while adequately funded betting and later exits remain independent of that obligation.

## Implemented health notifier

[healthz-alert.sh](../../script/ops/healthz-alert.sh) invokes the local
[probe helper](../../script/ops/healthz-probe.py), writes a redacted latest observation next to its
state file and logs to the journal. Configure `HEALTHZ_URL` for the intended chain's endpoint and
`HEALTHZ_LOCAL_URL` for origin diagnostics. Configure scheduling on the target host; repository
presence does not install a timer.

Secrets and options belong in `ALERT_CONFIG_FILE` (default `/opt/arbigamefi/ops/alert.env`):

- `ALERT_STATE_FILE` selects the persistent six-field state file; use a separate file per monitor.
- `ALERT_AFTER_FAILURES` defaults to three consecutive failed probes.
- `ALERT_REMIND_SECONDS` defaults to 21,600 seconds while the same failure remains open.
- `ALERT_WEBHOOK_URL`, or `TELEGRAM_BOT_TOKEN` plus `TELEGRAM_CHAT_ID`, configure delivery.

Alert timestamps and recovery state advance only after at least one configured channel accepts the
message. Webhook acceptance requires 2xx; redirects are not followed. Failed alert or recovery
delivery remains retryable on the next probe. With no channel configured, the journal is the sink;
that mode does not provide remote notification. A channel accepting a message also does not prove a
human saw it.

Before launch, test failure, repeated failure, recovery and delivery-failure retry using a local
receiver or test channel. Keep credentials out of logs and incident records. During an incident,
verify the affected obligations and recovery coverage in addition to the latest health result.
