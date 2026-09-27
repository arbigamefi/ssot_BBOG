#!/usr/bin/env bash
# Daily logical backup of the bet-index Postgres that runs in Docker on the production host.
#
# The bet index is a read model of chain events, so a dump buys a restore in seconds instead of a
# backfill; it is not the only copy of anything. After losing the host, rebuild with the keeper
# backfill from the release block (docs/ops/runbooks/bet-index-backup.zh-CN.md).
#
# Each dump is written under a temporary name and renamed only after pg_restore can read back table
# data for every table in the live database, so a file named *.dump is always complete. The newest
# BACKUP_KEEP dumps are kept. A failure is logged and, when alert.env configures Telegram, pushed.
set -uo pipefail
umask 077

CONF="${ALERT_CONFIG_FILE:-/opt/arbigamefi-v15/ops/alert.env}"
[ -f "$CONF" ] && . "$CONF"

CONTAINER="${BACKUP_PG_CONTAINER:-arbigamefi-v15-postgres-1}"
DIR="${BACKUP_DIR:-/var/backups/arbigamefi/bet-index}"
KEEP="${BACKUP_KEEP:-7}"
NOTIFY="$(cd -- "$(dirname -- "$0")" && pwd)/alert-notify.py"

errors=$(mktemp)
partial=""
cleanup() { rm -f "$errors"; [ -n "$partial" ] && rm -f "$partial"; }
trap cleanup EXIT

fail() {
  local reason="$1"
  logger -t arbigamefi-db-backup "[FAILED] $reason"
  echo "[FAILED] $reason" >&2
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    # The token reaches the helper through its environment, never argv (world-readable in /proc).
    printf '%s' "$reason" | TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" \
      TELEGRAM_API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}" \
      python3 "$NOTIFY" --subject "[BACKUP FAILED] arbigamefi bet-index" >/dev/null 2>&1 ||
      logger -t arbigamefi-db-backup "telegram delivery failed"
  fi
  exit 1
}

case "$KEEP" in '' | *[!0-9]* | 0) fail "BACKUP_KEEP must be a positive integer, got '$KEEP'" ;; esac
mkdir -p "$DIR" && chmod 700 "$DIR" || fail "cannot create $DIR"
# A partial file is never a backup; one left by a killed run is removed.
rm -f "$DIR"/bet-index-*.dump.partial

# Credentials stay inside the container: pg_dump and psql read them from its environment.
tables=$(docker exec "$CONTAINER" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select tablename from pg_tables where schemaname = current_schema() order by 1"' \
  2>"$errors") || fail "cannot list tables in $CONTAINER: $(tail -c 300 "$errors")"
[ -n "$tables" ] || fail "no tables found in $CONTAINER"

final="$DIR/bet-index-$(date -u +%Y%m%dT%H%M%SZ).dump"
partial="$final.partial"
docker exec "$CONTAINER" sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  >"$partial" 2>"$errors" || fail "pg_dump failed: $(tail -c 300 "$errors")"

toc=$(docker exec -i "$CONTAINER" pg_restore --list <"$partial" 2>"$errors") ||
  fail "pg_restore cannot read the dump: $(tail -c 300 "$errors")"
missing=""
for table in $tables; do
  printf '%s\n' "$toc" | grep -qE " TABLE DATA [^ ]+ ${table}( |\$)" || missing="$missing $table"
done
[ -z "$missing" ] || fail "dump has no table data for:$missing"

mv -f -- "$partial" "$final" || fail "cannot rename $partial"
partial=""

# File names sort by their UTC timestamp; keep the newest $KEEP.
ls -1 "$DIR"/bet-index-*.dump 2>/dev/null | sort -r | awk -v keep="$KEEP" 'NR > keep' |
  while IFS= read -r old; do rm -f -- "$old"; done
kept=$(ls -1 "$DIR"/bet-index-*.dump 2>/dev/null | wc -l | tr -d ' ')
table_count=$(printf '%s\n' "$tables" | wc -l | tr -d ' ')
message="[OK] $(basename "$final") $(wc -c <"$final" | tr -d ' ') bytes, $table_count tables, $kept kept"
logger -t arbigamefi-db-backup "$message"
echo "$message"
