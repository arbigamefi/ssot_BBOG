"""bet-index-backup.sh against a fake docker: only complete, readable dumps are kept, failures are pushed."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "script/ops/bet-index-backup.sh"
TOKEN = "123456:SECRET-token_value"
TABLES = "bets gamehub_events indexer_cursors"

# Stands in for `docker exec` into the Postgres container: psql lists tables, pg_dump writes an archive,
# and pg_restore --list reads one from stdin. Every call is recorded.
FAKE_DOCKER = r"""#!/usr/bin/env bash
echo "$*" >> "$DOCKER_CALLS"
case "$*" in
  *pg_dump*)
    [ "${FAKE_DUMP_FAIL:-}" = 1 ] && { echo "pg_dump: error: connection to server failed" >&2; exit 1; }
    [ "${FAKE_DUMP_GARBAGE:-}" = 1 ] && { echo "not an archive"; exit 0; }
    printf 'PGDMP fake archive\n' ;;
  *pg_restore*)
    head -c 5 | grep -q PGDMP || { echo "pg_restore: error: input file does not appear to be a valid archive" >&2; exit 1; }
    for t in ${FAKE_TOC_TABLES-$FAKE_TABLES}; do echo "3367; 0 16390 TABLE DATA public $t arbigamefi"; done ;;
  *psql*)
    for t in $FAKE_TABLES; do echo "$t"; done ;;
  *) echo "unexpected docker call: $*" >&2; exit 2 ;;
esac
"""


class Telegram(BaseHTTPRequestHandler):
    received = []

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        Telegram.received.append((self.path, json.loads(self.rfile.read(length))))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *args):
        pass


class BetIndexBackupTests(unittest.TestCase):
    def setUp(self):
        Telegram.received = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Telegram)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.backups = self.root / "backups"
        for name, body in (("docker", FAKE_DOCKER), ("logger", '#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOG_CAPTURE"\n')):
            shim = self.root / name
            shim.write_text(body)
            shim.chmod(0o700)
        (self.root / "alert.env").write_text(
            f"TELEGRAM_BOT_TOKEN='{TOKEN}'\nTELEGRAM_CHAT_ID='555'\n"
            f"TELEGRAM_API_BASE='http://127.0.0.1:{self.server.server_port}'\n")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.directory.cleanup()

    def run_backup(self, **extra):
        env = {**os.environ, "PATH": str(self.root) + os.pathsep + os.environ["PATH"],
               "ALERT_CONFIG_FILE": str(self.root / "alert.env"), "BACKUP_DIR": str(self.backups),
               "LOG_CAPTURE": str(self.root / "journal"), "DOCKER_CALLS": str(self.root / "calls"),
               "FAKE_TABLES": TABLES, **extra}
        return subprocess.run(["bash", str(SCRIPT)], env=env, text=True, capture_output=True, timeout=30)

    def dumps(self):
        return sorted(path.name for path in self.backups.glob("bet-index-*.dump"))

    def journal(self):
        path = self.root / "journal"
        return path.read_text() if path.exists() else ""

    def seed_old_dumps(self, count):
        self.backups.mkdir(mode=0o700, parents=True)
        names = [f"bet-index-202609{day:02d}T033000Z.dump" for day in range(1, count + 1)]
        for name in names:
            (self.backups / name).write_text("PGDMP old")
        return names

    def test_keeps_a_verified_dump_and_only_the_newest_seven(self):
        old = self.seed_old_dumps(8)
        (self.backups / "bet-index-20260920T033000Z.dump.partial").write_text("killed run")

        result = self.run_backup()

        self.assertEqual(result.returncode, 0, result.stderr)
        dumps = self.dumps()
        self.assertEqual(len(dumps), 7)
        self.assertEqual(dumps[:6], old[2:])  # the two oldest were rotated out
        new = self.backups / dumps[-1]
        self.assertRegex(new.name, r"^bet-index-\d{8}T\d{6}Z\.dump$")
        self.assertEqual(new.read_text(), "PGDMP fake archive\n")
        self.assertEqual(new.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.backups.stat().st_mode & 0o777, 0o700)
        self.assertEqual(list(self.backups.glob("*.partial")), [])
        self.assertIn(f"[OK] {new.name} 19 bytes, 3 tables, 7 kept", self.journal())
        self.assertEqual(Telegram.received, [])

    def test_failed_dump_keeps_old_backups_and_pushes_an_alert(self):
        old = self.seed_old_dumps(2)

        result = self.run_backup(FAKE_DUMP_FAIL="1")

        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.dumps(), old)
        self.assertEqual(list(self.backups.glob("*.partial")), [])
        self.assertIn("[FAILED] pg_dump failed: pg_dump: error: connection to server failed", self.journal())
        self.assertEqual(len(Telegram.received), 1)
        path, payload = Telegram.received[0]
        self.assertEqual(path, f"/bot{TOKEN}/sendMessage")
        self.assertIn("[BACKUP FAILED] arbigamefi bet-index", payload["text"])
        self.assertIn("connection to server failed", payload["text"])
        self.assertNotIn(TOKEN, self.journal() + result.stdout + result.stderr)

    def test_dump_without_data_for_a_live_table_is_not_kept(self):
        result = self.run_backup(FAKE_TOC_TABLES="bets gamehub_events")

        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.dumps(), [])
        self.assertEqual(list(self.backups.glob("*.partial")), [])
        self.assertIn("dump has no table data for: indexer_cursors", self.journal())

    def test_unreadable_dump_is_not_kept(self):
        result = self.run_backup(FAKE_DUMP_GARBAGE="1")

        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.dumps(), [])
        self.assertIn("pg_restore cannot read the dump", self.journal())

    def test_invalid_retention_touches_nothing(self):
        old = self.seed_old_dumps(3)

        result = self.run_backup(BACKUP_KEEP="0")

        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.dumps(), old)
        self.assertFalse((self.root / "calls").exists())
        self.assertIn("BACKUP_KEEP must be a positive integer", self.journal())


if __name__ == "__main__":
    unittest.main()
