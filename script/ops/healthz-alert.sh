#!/usr/bin/env bash
# Poll the app health endpoint and alert when it stops reporting "ok".
#
# Always logs to the journal, so it is useful even before a channel is set.
# Set ALERT_WEBHOOK_URL, or TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, in
# /opt/arbigamefi-v15/ops/alert.env to get pushed alerts. A status is pushed only
# after ALERT_AFTER_FAILURES consecutive probes, so one-off timeouts stay in the journal.
set -uo pipefail
umask 077

CONF="${ALERT_CONFIG_FILE:-/opt/arbigamefi-v15/ops/alert.env}"
[ -f "$CONF" ] && . "$CONF"

URL="${HEALTHZ_URL:-https://arbigamefi.com/api/healthz}"
STATE="${ALERT_STATE_FILE:-/var/lib/arbigamefi/healthz-alert.state}"
REMIND_SECONDS="${ALERT_REMIND_SECONDS:-21600}"   # re-alert every 6h while still bad
AFTER="${ALERT_AFTER_FAILURES:-3}"                  # consecutive failed probes (timer: 2 min) before a push
mkdir -p "$(dirname "$STATE")"

# Keep the existing alert transitions/webhook while preserving failure evidence.
# The helper never logs bodies, URLs, cookies or credentials.
PROBE="$(cd -- "$(dirname -- "$0")" && pwd)/healthz-probe.py"
NOTIFY="$(cd -- "$(dirname -- "$0")" && pwd)/alert-notify.py"
if ! probe_json=$(python3 "$PROBE" "$URL" --local-url "${HEALTHZ_LOCAL_URL:-http://127.0.0.1:3400/api/healthz}" 2>/dev/null); then
  probe_json='{"status":"probe_error","error":"health probe process failed"}'
fi
status=$(printf '%s' "$probe_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')
: "${status:=probe_error}"
detail="$probe_json"
# Atomic, bounded latest observation; failures also survive in the rotated journal.
probe_file=$(mktemp "${STATE}.probe.XXXXXX")
if [ -n "$probe_file" ]; then
  printf '%s\n' "$probe_json" > "$probe_file"
  mv -f -- "$probe_file" "${STATE}.probe.json"
fi
if [ "$status" != "ok" ]; then
  logger -t arbigamefi-healthz "[DIAGNOSTIC] $probe_json"
  printf '[DIAGNOSTIC] %s\n' "$probe_json"
fi

# State: status alert_ts fails same alerted since. fails counts consecutive failed probes, same counts
# consecutive probes with this exact status, alerted is the status last pushed in the current failure
# episode ("-" when none), and since is when the episode began.
prev_status=""; alert_ts=""; fails=""; same=""; alerted=""; since=""
[ -f "$STATE" ] && read -r prev_status alert_ts fails same alerted since < "$STATE"
if [ -z "$fails" ] && [ -n "$prev_status" ] && [ "$prev_status" != "ok" ]; then
  # The previous version stored only "status timestamp" and pushed every failure at once.
  fails=$AFTER; same=$AFTER; alerted=$prev_status; since=$alert_ts
fi
num() { case "$1" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }
alert_ts=$(num "$alert_ts"); fails=$(num "$fails"); same=$(num "$same"); since=$(num "$since")
[ -n "$alerted" ] || alerted="-"
now=$(date +%s)
utc() { python3 -c 'import sys,time;print(time.strftime("%Y-%m-%d %H:%M UTC",time.gmtime(int(sys.argv[1]))))' "$1"; }
elapsed() {
  local m=$(( ($1 + 59) / 60 ))
  [ "$m" -gt 0 ] || m=1
  if [ "$m" -ge 120 ]; then echo "$(( m / 60 ))h $(( m % 60 ))m"; else echo "$m min"; fi
}

notify() {
  local subject="$1" text="$2"
  logger -t arbigamefi-healthz "$subject | $text"
  echo "$subject | $text"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    payload=$(printf '{"text":%s,"content":%s}' \
      "$(printf '%s' "$subject $text" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
      "$(printf '%s' "$subject $text" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')")
    curl -s --max-time 15 -X POST -H 'content-type: application/json' -d "$payload" "$ALERT_WEBHOOK_URL" >/dev/null || \
      logger -t arbigamefi-healthz "webhook delivery failed"
  fi
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    # The token reaches the helper through its environment, never argv (world-readable in /proc).
    local err
    if ! err=$(printf '%s' "$text" | TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" \
        TELEGRAM_API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}" \
        python3 "$NOTIFY" --subject "$subject" 2>&1 >/dev/null); then
      logger -t arbigamefi-healthz "${err:-telegram delivery failed}"
    fi
  fi
}

if [ "$status" = "ok" ]; then
  # Recovery is pushed only for an episode that was pushed; a suppressed blip ends silently.
  if [ "$alerted" != "-" ]; then
    notify "[RECOVERED] arbigamefi healthz" "status is ok again after $(elapsed $(( now - since ))) (was $alerted)"
  fi
  fails=0; same=0; alerted="-"; since=0
else
  [ "$fails" -gt 0 ] || since=$now
  fails=$(( fails + 1 ))
  if [ "$status" = "$prev_status" ]; then same=$(( same + 1 )); else same=1; fi
  if { [ "$alerted" = "-" ] && [ "$fails" -ge "$AFTER" ]; } ||
     { [ "$alerted" != "-" ] && [ "$status" != "$alerted" ] && [ "$same" -ge "$AFTER" ]; } ||
     { [ "$status" = "$alerted" ] && [ $(( now - alert_ts )) -ge "$REMIND_SECONDS" ]; }; then
    notify "[ALERT] arbigamefi healthz = $status (since $(utc "$since"))" "$detail"
    alerted=$status; alert_ts=$now
  fi
fi

echo "$status $alert_ts $fails $same $alerted $since" > "$STATE"
