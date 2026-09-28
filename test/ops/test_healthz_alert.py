"""Alert policy of healthz-alert.sh: one-off failures stay in the journal, sustained ones are pushed once."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "script/ops/healthz-alert.sh"


class Handler(BaseHTTPRequestHandler):
    mode = "ok"
    refused = set()  # channels ("telegram", "webhook") whose deliveries fail
    deliveries = []  # (channel, accepted, text) for every delivery attempt

    def do_GET(self):
        mode = Handler.mode if self.path == "/public" else "ok"
        self.send_response(522 if mode == "http_error" else 200)
        self.end_headers()
        if mode == "degraded":
            self.wfile.write(b'{"status":"degraded","checks":{"keeper":{"status":"degraded"}}}')
        else:
            self.wfile.write(b'{"status":"ok"}')

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        channel = "telegram" if self.path.startswith("/telegram/") else "webhook"
        accepted = channel not in Handler.refused
        Handler.deliveries.append((channel, accepted, body.get("text", "")))
        self.send_response(200 if accepted else 502)
        self.end_headers()
        self.wfile.write(b'{"ok":true}' if accepted else b'{"ok":false}')

    def log_message(self, *args):
        pass


class HealthzAlertPolicyTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.state = self.root / "state"
        logger = self.root / "logger"
        logger.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOG_CAPTURE"\n')
        logger.chmod(0o700)
        self.configure()
        Handler.mode = "ok"
        Handler.refused = set()
        Handler.deliveries = []

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.directory.cleanup()

    def configure(self, **settings):
        lines = [f"ALERT_STATE_FILE='{self.state}'", "ALERT_WEBHOOK_URL=''"]
        lines += [f"{key}='{value}'" for key, value in settings.items()]
        (self.root / "alert.env").write_text("\n".join(lines) + "\n")

    def configure_telegram(self, **settings):
        base = f"http://127.0.0.1:{self.server.server_port}"
        self.configure(TELEGRAM_BOT_TOKEN="test-token", TELEGRAM_CHAT_ID="1",
                       TELEGRAM_API_BASE=base + "/telegram", **settings)

    def state_fields(self):
        return self.state.read_text().split()

    def run_probe(self, mode):
        Handler.mode = mode
        base = f"http://127.0.0.1:{self.server.server_port}"
        # A developer's own alert channel must never receive test alerts.
        inherited = {k: v for k, v in os.environ.items() if not k.startswith(("TELEGRAM_", "ALERT_"))}
        env = {**inherited, "PATH": str(self.root) + os.pathsep + os.environ["PATH"],
               "ALERT_CONFIG_FILE": str(self.root / "alert.env"), "HEALTHZ_URL": base + "/public",
               "HEALTHZ_LOCAL_URL": base + "/local", "LOG_CAPTURE": str(self.root / "journal")}
        result = subprocess.run(["bash", str(WRAPPER)], env=env, text=True, capture_output=True,
                                check=True, timeout=20)
        return [line for line in result.stdout.splitlines() if not line.startswith("[DIAGNOSTIC]")]

    def test_one_off_failure_stays_in_the_journal(self):
        self.assertEqual(self.run_probe("http_error"), [])
        self.assertEqual(self.run_probe("http_error"), [])
        self.assertEqual(self.run_probe("ok"), [])
        journal = (self.root / "journal").read_text()
        self.assertEqual(journal.count("[DIAGNOSTIC]"), 2)
        self.assertNotIn("[ALERT]", journal)
        self.assertTrue(self.state.read_text().startswith("ok "))

    def test_sustained_failure_is_pushed_once_and_recovery_names_it(self):
        self.assertEqual(self.run_probe("degraded"), [])
        self.assertEqual(self.run_probe("degraded"), [])
        alert = self.run_probe("degraded")
        self.assertEqual(len(alert), 1)
        self.assertRegex(alert[0], r"^\[ALERT\] arbigamefi healthz = degraded \(since \d{4}-\d\d-\d\d \d\d:\d\d UTC\) \| ")
        self.assertEqual(self.run_probe("degraded"), [])
        self.assertEqual(self.run_probe("ok"), ["[RECOVERED] arbigamefi healthz | status is ok again after 1 min (was degraded)"])  # rounded up
        self.assertEqual(self.run_probe("ok"), [])

    def test_a_new_status_must_persist_before_it_is_pushed(self):
        for _ in range(3):
            self.run_probe("degraded")
        self.assertEqual(self.run_probe("http_error"), [])
        self.assertEqual(self.run_probe("degraded"), [])
        self.assertEqual(self.run_probe("http_error"), [])
        self.assertEqual(self.run_probe("http_error"), [])
        alert = self.run_probe("http_error")
        self.assertEqual(len(alert), 1)
        self.assertTrue(alert[0].startswith("[ALERT] arbigamefi healthz = http_error"))
        self.assertIn("(was http_error)", self.run_probe("ok")[0])

    def test_reminder_repeats_only_the_pushed_status(self):
        self.configure(ALERT_AFTER_FAILURES=2, ALERT_REMIND_SECONDS=0)
        self.assertEqual(self.run_probe("degraded"), [])
        self.assertEqual(len(self.run_probe("degraded")), 1)
        self.assertEqual(len(self.run_probe("degraded")), 1)
        self.assertEqual(self.run_probe("http_error"), [])  # reminder skips a status that was never pushed
        self.assertEqual(len(self.run_probe("degraded")), 1)

    def test_state_from_the_previous_version_keeps_its_open_alert(self):
        self.state.write_text("degraded 1000\n")
        recovered = self.run_probe("ok")
        self.assertEqual(len(recovered), 1)
        self.assertRegex(recovered[0], r"^\[RECOVERED\] .* after \d+h \d+m \(was degraded\)$")
        self.state.write_text("ok 1000\n")
        self.assertEqual(self.run_probe("degraded"), [])

    def test_an_undelivered_alert_is_retried_on_the_next_probe(self):
        self.configure_telegram()
        Handler.refused = {"telegram"}
        for _ in range(3):
            self.run_probe("degraded")
        self.assertEqual(self.state_fields()[4], "-")
        self.run_probe("degraded")  # retried now, not after the reminder period
        Handler.refused = set()
        self.run_probe("degraded")
        self.assertEqual([accepted for _, accepted, _ in Handler.deliveries], [False, False, True])
        self.assertEqual(self.state_fields()[4], "degraded")
        self.run_probe("degraded")
        self.assertEqual(len(Handler.deliveries), 3)
        self.assertEqual((self.root / "journal").read_text().count("alert not delivered"), 2)

    def test_an_undelivered_recovery_is_retried_with_its_first_duration(self):
        self.configure_telegram()
        now = int(time.time())
        self.state.write_text(f"degraded {now - 900} 7 7 degraded {now - 900} 0\n")
        Handler.refused = {"telegram"}
        self.run_probe("ok")
        status, _, fails, _, alerted, since, recovered = self.state_fields()
        self.assertEqual((status, fails, alerted, since), ("ok", "0", "degraded", str(now - 900)))
        self.assertGreaterEqual(int(recovered), now)
        # Five minutes later the channel works again: the episode lasted 15 minutes, not 20.
        self.state.write_text(f"ok {now - 1200} 0 0 degraded {now - 1200} {now - 300}\n")
        Handler.refused = set()
        self.assertEqual(self.run_probe("ok"),
                         ["[RECOVERED] arbigamefi healthz | status is ok again after 15 min (was degraded)"])
        self.assertEqual(self.state_fields()[4:], ["-", "0", "0"])
        self.assertEqual(self.run_probe("ok"), [])
        self.assertEqual([accepted for _, accepted, _ in Handler.deliveries], [False, True])

    def test_a_failure_before_the_recovery_notice_continues_the_episode(self):
        self.configure_telegram()
        now = int(time.time())
        self.state.write_text(f"ok {now - 60} 0 0 degraded {now - 900} {now - 30}\n")
        self.assertEqual(self.run_probe("degraded"), [])  # the user was never told it recovered
        self.assertEqual(self.state_fields()[4:], ["degraded", str(now - 900), "0"])
        self.assertEqual(Handler.deliveries, [])

    def test_any_accepting_channel_delivers_and_http_errors_do_not(self):
        base = f"http://127.0.0.1:{self.server.server_port}"
        self.configure_telegram(ALERT_WEBHOOK_URL=base + "/webhook", ALERT_AFTER_FAILURES=1)
        Handler.refused = {"webhook", "telegram"}
        self.run_probe("degraded")
        self.assertEqual(self.state_fields()[4], "-")
        Handler.refused = {"webhook"}
        self.run_probe("degraded")
        self.assertEqual(self.state_fields()[4], "degraded")
        self.assertEqual([(channel, accepted) for channel, accepted, _ in Handler.deliveries],
                         [("webhook", False), ("telegram", False), ("webhook", False), ("telegram", True)])


if __name__ == "__main__":
    unittest.main()
