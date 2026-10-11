# Alerts and delivery

Configure alerts against the [monitoring inventory](metrics.md) and test them before enabling the
application. These rules describe operating requirements; they do not claim a deployed monitoring
service exists.

The LP/callback signals below are target requirements; their implementation is pending with the
[current plan](../design/lp-accounting-and-callback-implementation.md).

| Condition                                                            | Response                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Vault cash < L, Bank cash < P+PF+XP+PP, G < R, R < P or K ≠ R−P      | Use authorized pause if needed; reconcile both custodians, tree root and asset state immediately |
| Canonical received result cannot terminalize                         | Retry the same seed, inspect errors/gas; retain LP pricing gate and winner obligations           |
| Missing VRF past the fixed deadline                                  | Confirm canonical seed is absent before eligible refund                                          |
| Unexpected governance, module or Bank/Vault/asset/VRF binding change | Compare receipt with authenticated release and approved configuration                            |
| Lifecycle scanning stalled or incomplete                             | Restore coverage/RPC/persistence before trusting an empty queue                                  |
| Finalize, refund or payable delivery failure                         | Preserve state-aware retries; do not replace valid outcomes with refunds                         |
| Stale health, RPC failure, signer gas or nonce issue                 | Restore the affected path and reconcile pending receipts                                         |
| Database/reorg/replay failure                                        | Do not advance unpersisted cursors; verify canonical history and cash evidence                   |

Tree-inclusive callback gas saturation, failure overhead and unsupported game/round settings also require
alerts. Monitor surplus changes separately from deficits; surplus is not spendable LP headroom.

Failed-result age is an incident signal, not a promised withdrawal deadline. Thresholds require measured
network behavior; no old LP epoch monitor remains. Emergency pause blocks LP payments, but must leave
valid callback/retry/settlement/refund/player-debt paths available. Complete result receipt and bookkeeping
are distinct from successful cash delivery.

## Implemented configuration drift monitor (K0-4)

[config-drift-alert.sh](../../script/ops/config-drift-alert.sh) runs
[config-drift-monitor.py](../../script/ops/config-drift-monitor.py) every 5 minutes, on the operator's machine under
launchd or on a host under systemd. It announces each governance timelock operation when it is scheduled, 12 hours
before it becomes ready and while it is ready but unexecuted, and reviews every scheduled call against the certified
Bank, Vault, asset, hub and modules (ADR-0037 decisions D4 and D5). It also pushes recertification triggers, settlement
anomalies (callback failures, k = 0 settlements, voids, issuer freezes), the unbooked-result and void alerts of
ADR-0037 §7.3 rule 4, governance changes, failures of the live release verification, deviations from the certified
first-callback domain, and Banks near their open-position limit. It uses the health notifier's channels, but its state
advances only after every configured channel accepts the message. Timelock operations, admission reviews, void windows
and bets settled after a void on the same path also go to a public channel. See the
[runbook](runbooks/config-drift-alerts.md).

## Implemented health notifier

[healthz-alert.sh](../../script/ops/healthz-alert.sh) invokes the local
[probe helper](../../script/ops/healthz-probe.py), writes a redacted latest observation next to its
state file and logs to the journal. Configure `HEALTHZ_URL` for the intended chain's endpoint and
`HEALTHZ_LOCAL_URL` for origin diagnostics. Once installed and enabled on the host,
`script/ops/systemd/arbigamefi-healthz.{service,timer}` run it every two minutes; repository presence does not
install a timer.

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
