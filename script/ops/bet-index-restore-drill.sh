#!/usr/bin/env bash
# Restore drill: load the newest bet-index dump into a throwaway Postgres and compare it with production.
#
# The drill container has no network and keeps its data in tmpfs; it is removed when the drill ends.
# Production is only read. The drill passes when every live table was restored, no restored table has
# more rows than the live one (tables only grow between the dump and the drill), and at least one
# restored table has rows. Exits 1 otherwise.
set -uo pipefail
umask 077

CONTAINER="${BACKUP_PG_CONTAINER:-arbigamefi-postgres-1}"
DIR="${BACKUP_DIR:-/var/backups/arbigamefi/bet-index}"
DUMP="${1:-$(ls -1 "$DIR"/bet-index-*.dump 2>/dev/null | sort | tail -1)}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "no dump found in $DIR" >&2; exit 1; }

image=$(docker inspect -f '{{.Config.Image}}' "$CONTAINER") || exit 1
drill="arbigamefi-restore-drill-$$"
trap 'docker rm -f "$drill" >/dev/null 2>&1' EXIT
docker run -d --rm --name "$drill" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=drill "$image" >/dev/null || exit 1
# The image first runs a socket-only server to create the database, then restarts. Only the final
# server listens on TCP, so readiness on 127.0.0.1 means the database exists and will stay up.
ready() { docker exec "$drill" pg_isready -h 127.0.0.1 -U postgres -d drill >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "drill database did not start" >&2; exit 1; }
docker exec -i "$drill" pg_restore -U postgres -d drill --no-owner --no-privileges <"$DUMP" ||
  { echo "pg_restore failed for $DUMP" >&2; exit 1; }

count() { # container user db table
  docker exec "$1" psql -U "$2" -d "$3" -At -c "select count(*) from \"$4\""
}
live_user=$(docker exec "$CONTAINER" sh -c 'printf %s "$POSTGRES_USER"')
live_db=$(docker exec "$CONTAINER" sh -c 'printf %s "$POSTGRES_DB"')
list_tables() { # container user db
  docker exec "$1" psql -U "$2" -d "$3" -At -c \
    "select tablename from pg_tables where schemaname = current_schema() order by 1"
}
tables=$(list_tables "$drill" postgres drill)
live_tables=$(list_tables "$CONTAINER" "$live_user" "$live_db")

echo "drill of $(basename "$DUMP") in $image"
status=0
for table in $live_tables; do
  printf '%s\n' "$tables" | grep -qx "$table" || { echo "$table missing from the restore"; status=1; }
done
for table in $tables; do
  restored=$(count "$drill" postgres drill "$table")
  live=$(count "$CONTAINER" "$live_user" "$live_db" "$table")
  verdict=ok
  [ "$restored" -le "$live" ] || verdict="MORE THAN LIVE"
  echo "$table restored=$restored live=$live $verdict"
  [ "$verdict" = ok ] || status=1
done
# Empty tables are listed but cannot prove the data path; at least one table must carry rows.
[ "$(for t in $tables; do count "$drill" postgres drill "$t"; done | awk '$1 > 0' | wc -l)" -gt 0 ] ||
  { echo "restored database has no rows" >&2; status=1; }
[ "$status" = 0 ] && echo "restore drill passed" || echo "restore drill FAILED" >&2
exit "$status"
