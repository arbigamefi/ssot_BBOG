"""Telegram alert delivery: message rendering, chat discovery and token hygiene, without network access."""
import importlib.util
import io
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess
import tempfile
import threading
import unittest
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("alert_notify", ROOT / "script/ops/alert-notify.py")
NOTIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NOTIFY)

TOKEN = "123456:SECRET-token_value"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class Recorder:
    """Stands in for urllib.request.urlopen and records requests."""

    def __init__(self, reply=None, error=None):
        self.reply, self.error, self.requests = reply or {"ok": True, "result": []}, error, []

    def __call__(self, request, timeout):
        self.requests.append((request.full_url, json.loads(request.data)))
        if self.error:
            raise self.error
        return FakeResponse(json.dumps(self.reply).encode())


def run(argv, env, stdin="", opener=None):
    out, err = io.StringIO(), io.StringIO()
    code = NOTIFY.main(argv, env=env, stdin=io.StringIO(stdin), stdout=out, stderr=err, opener=opener or Recorder())
    return code, out.getvalue(), err.getvalue()


class AlertNotifyTests(unittest.TestCase):
    def test_probe_json_is_summarized_with_failing_checks(self):
        probe = {"status": "degraded", "public": {"status": "degraded", "httpCode": 200,
                                                  "checks": {"release": "ok", "keeper": "degraded"}},
                 "localApp": {"status": "ok"}, "interpretation": "public_failure_local_app_ok"}
        opener = Recorder()
        code, _, _ = run(["--subject", "[ALERT] arbigamefi healthz = degraded"],
                         {"TELEGRAM_BOT_TOKEN": TOKEN, "TELEGRAM_CHAT_ID": "42"}, json.dumps(probe), opener)
        self.assertEqual(code, 0)
        url, payload = opener.requests[0]
        self.assertTrue(url.endswith("/sendMessage"))
        self.assertEqual(payload["chat_id"], "42")
        self.assertIn("[ALERT] arbigamefi healthz = degraded", payload["text"])
        self.assertIn("checks: release=ok, keeper=degraded", payload["text"])
        self.assertIn("public: degraded (HTTP 200)", payload["text"])
        self.assertIn("host: ", payload["text"])

    def test_plain_text_is_sent_as_is_and_bounded(self):
        opener = Recorder()
        run(["--subject", "[RECOVERED] arbigamefi healthz"], {"TELEGRAM_BOT_TOKEN": TOKEN, "TELEGRAM_CHAT_ID": "7"},
            "status is ok again (was degraded)" + "x" * 5000, opener)
        text = opener.requests[0][1]["text"]
        self.assertIn("status is ok again (was degraded)", text)
        self.assertLessEqual(len(text), NOTIFY.MAX_TEXT)

    def test_list_chats_prints_ids_that_messaged_the_bot(self):
        reply = {"ok": True, "result": [
            {"message": {"chat": {"id": 1001, "first_name": "Kevin"}}},
            {"my_chat_member": {"chat": {"id": -2002, "title": "Ops"}}},
        ]}
        code, out, _ = run(["--list-chats"], {"TELEGRAM_BOT_TOKEN": TOKEN}, opener=Recorder(reply))
        self.assertEqual(code, 0)
        self.assertIn("1001\tKevin", out)
        self.assertIn("-2002\tOps", out)

    def test_missing_configuration_fails_without_network(self):
        opener = Recorder()
        self.assertEqual(run([], {}, "x", opener)[0], 2)
        self.assertEqual(run([], {"TELEGRAM_BOT_TOKEN": TOKEN}, "x", opener)[0], 2)
        self.assertEqual(opener.requests, [])

    def test_errors_never_print_the_token(self):
        failures = [
            urllib.error.HTTPError(f"https://api.telegram.org/bot{TOKEN}/sendMessage", 401, "Unauthorized", {}, None),
            urllib.error.URLError(f"cannot reach https://api.telegram.org/bot{TOKEN}"),
            OSError(f"socket error for bot{TOKEN}"),
        ]
        for error in failures:
            with self.subTest(error=type(error).__name__):
                code, out, err = run([], {"TELEGRAM_BOT_TOKEN": TOKEN, "TELEGRAM_CHAT_ID": "1"}, "x", Recorder(error=error))
                self.assertEqual(code, 1)
                self.assertNotIn(TOKEN, out + err)
                self.assertIn("telegram delivery failed", err)

    def test_not_ok_reply_is_a_failure(self):
        code, _, err = run([], {"TELEGRAM_BOT_TOKEN": TOKEN, "TELEGRAM_CHAT_ID": "1"}, "x", Recorder({"ok": False}))
        self.assertEqual(code, 1)
        self.assertIn("not ok", err)


class AlertWrapperTelegramTests(unittest.TestCase):
    def test_wrapper_delivers_alerts_to_telegram_without_argv_or_log_leaks(self):
        received = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status":"degraded","checks":{"keeper":{"status":"degraded","detail":"secret"}}}')

            def do_POST(self):
                length = int(self.headers.get("content-length", 0))
                received.append((self.path, json.loads(self.rfile.read(length))))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"ok":true}')

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                base = f"http://127.0.0.1:{server.server_port}"
                config = root / "alert.env"
                config.write_text(
                    f"ALERT_STATE_FILE='{root / 'state'}'\nTELEGRAM_BOT_TOKEN='{TOKEN}'\n"
                    f"TELEGRAM_CHAT_ID='555'\nTELEGRAM_API_BASE='{base}'\nALERT_AFTER_FAILURES='1'\n")
                logger = root / "logger"
                logger.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOG_CAPTURE"\n')
                logger.chmod(0o700)
                env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"],
                       "ALERT_CONFIG_FILE": str(config), "HEALTHZ_URL": base + "/public",
                       "HEALTHZ_LOCAL_URL": base + "/local", "LOG_CAPTURE": str(root / "journal")}
                result = subprocess.run(["bash", str(ROOT / "script/ops/healthz-alert.sh")], env=env, text=True,
                                        capture_output=True, check=True, timeout=20)
                self.assertIn("[ALERT]", result.stdout)
                self.assertEqual(len(received), 1)
                path, payload = received[0]
                self.assertEqual(path, f"/bot{TOKEN}/sendMessage")
                self.assertEqual(payload["chat_id"], "555")
                self.assertIn("checks: keeper=degraded", payload["text"])
                self.assertNotIn("secret", payload["text"])
                journal = (root / "journal").read_text()
                self.assertNotIn(TOKEN, journal + result.stdout + result.stderr)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
