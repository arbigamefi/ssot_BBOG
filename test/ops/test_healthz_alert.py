"""Alert policy of healthz-alert.sh: one-off failures stay in the journal, sustained ones are pushed once."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "script/ops/healthz-alert.sh"


class Handler(BaseHTTPRequestHandler):
    mode = "ok"

    def do_GET(self):
        mode = Handler.mode if self.path == "/public" else "ok"
        self.send_response(522 if mode == "http_error" else 200)
        self.end_headers()
        if mode == "degraded":
            self.wfile.write(b'{"status":"degraded","checks":{"keeper":{"status":"degraded"}}}')
        else:
            self.wfile.write(b'{"status":"ok"}')

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

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.directory.cleanup()

    def configure(self, **settings):
        lines = [f"ALERT_STATE_FILE='{self.state}'", "ALERT_WEBHOOK_URL=''"]
        lines += [f"{key}='{value}'" for key, value in settings.items()]
        (self.root / "alert.env").write_text("\n".join(lines) + "\n")

    def run_probe(self, mode):
        Handler.mode = mode
        base = f"http://127.0.0.1:{self.server.server_port}"
        env = {**os.environ, "PATH": str(self.root) + os.pathsep + os.environ["PATH"],
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


if __name__ == "__main__":
    unittest.main()
