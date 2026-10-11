#!/usr/bin/env bash
# K0-4 configuration drift monitor (config-drift-monitor.py) with the shared alert configuration.
#
# Sources ALERT_CONFIG_FILE (default /opt/arbigamefi/ops/alert.env) and exports every variable it sets. The monitor
# reads (defaults in parentheses; config-drift-monitor.py describes each):
#   SNAPSHOT_PATH                   release snapshot, latest-v16.json of the release bundle (required)
#   RPC_URL or OPS_RPC_URL          HTTP RPC of the chain (required). On the operator's machine run this script through
#                                   script/tools/with-ops-rpc.sh, which passes OPS_RPC_URL; it takes precedence over a
#                                   configured RPC_URL. On a server set RPC_URL in the alert configuration.
#   RELEASE_PATH                    signed release record, release-latest-v16.json; set with GOVERNANCE_CHECKPOINT_PATH
#   GOVERNANCE_CHECKPOINT_PATH      the record's checkpoint, governance-checkpoint-latest-v16.json
#   CALLBACK_DOMAIN_PATH            certified domain file (first-callback-domain-<chainId>.json beside the verifiers)
#   RELEASE_TOOLS_DIR               directory of verify_governance.py and verify_callback_provider.py (this directory)
#   DRIFT_STATE_FILE                (/var/lib/arbigamefi/config-drift.state.json)
#   DRIFT_CONFIRMATIONS (12), DRIFT_MAX_BLOCKS_PER_RUN (5000), DRIFT_DOMAIN_CHECK_SECONDS (3600),
#   DRIFT_GOVERNANCE_CHECK_SECONDS (3600), DRIFT_READY_WARNING_SECONDS (43200), DRIFT_OPEN_HOLDS_ALERT (96),
#   DRIFT_UNBOOKED_ALERT_SECONDS (3600), DRIFT_PUBLIC_VOID_WARNING_SECONDS (43200), DRIFT_VOID_ATTEMPT_BLOCKS (300),
#   DRIFT_RESULT_READS_PER_RUN (32), DRIFT_ALERT_AFTER_FAILURES (3), ALERT_REMIND_SECONDS (21600)
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALERT_WEBHOOK_URL   ops channel, shared with the health notifier
#   TELEGRAM_PUBLIC_CHAT_ID, ALERT_PUBLIC_WEBHOOK_URL         public channel for timelock operations, reviews and voids
#   TELEGRAM_API_BASE, GOVERNANCE_LOG_PAGE_BLOCKS (200), RPC_MAX_ATTEMPTS (6), RPC_BACKOFF_SECONDS (1)
# Arguments pass through: --dry-run prints what would be sent and changes no state; --from-block N arms a new state
# file at block N. Output goes to the system log under the tag arbigamefi-config-drift and to stderr. Nothing printed
# contains the RPC URL, a webhook URL or the bot token.
set -uo pipefail
umask 077

CONF="${ALERT_CONFIG_FILE:-/opt/arbigamefi/ops/alert.env}"
if [ -f "$CONF" ]; then
  set -a
  . "$CONF"
  set +a
fi
if [ -n "${OPS_RPC_URL:-}" ]; then
  export RPC_URL="$OPS_RPC_URL"
fi
export RPC_URL="${RPC_URL:-}"

MONITOR="$(cd -- "$(dirname -- "$0")" && pwd)/config-drift-monitor.py"
python3 "$MONITOR" "$@" 2>&1 | logger -s -t arbigamefi-config-drift
exit "${PIPESTATUS[0]}"
