"""Exercise outage classification and diagnostic redaction independently of curl."""
import importlib.util
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("healthz_probe", ROOT / "script/ops/healthz-probe.py")
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)


class HealthProbeTests(unittest.TestCase):
    def test_http_failure_cannot_be_hidden_by_success_body(self):
        result = PROBE.summarize(0, '{"http_code":522}', "CF-Ray: abc123-FRA\r\n", '{"status":"ok"}')
        self.assertEqual(result["status"], "http_error")
        self.assertEqual(result["cfRay"], "abc123-FRA")

    def test_partial_body_on_timeout_is_not_success(self):
        result = PROBE.summarize(28, '{"http_code":200,"time_total":20}', "", '{"status":"ok"}')
        self.assertEqual(result["status"], "unreachable")
        self.assertEqual(result["time_total"], 20)

    def test_proxy_html_and_unexpected_json_are_not_success(self):
        for body in ("<html>proxy error</html>", "[]", "null", '{"status": {}}'):
            with self.subTest(body=body):
                self.assertEqual(PROBE.summarize(0, '{"http_code":200}', "", body)["status"], "unparseable")

    def test_metadata_and_payload_secrets_are_not_logged(self):
        meta = {"http_code":200, "url_effective":"https://user:secret@example.com/?key=secret",
                "remote_ip":"104.21.31.55", "time_total":0.12, "certificate":"secret"}
        result = PROBE.summarize(0, json.dumps(meta), "Set-Cookie: secret\r\nAuthorization: secret\r\n",
                                 '{"status":"ok","databaseUrl":"secret"}')
        self.assertNotIn("secret", json.dumps(result))
        self.assertEqual(result["remoteIp"], "104.21.31.55")

    def test_check_states_keep_only_allowlisted_names_and_status_words(self):
        body = json.dumps({"status": "degraded", "checks": {
            "release": {"status": "ok", "warnings": ["secret"]},
            "keeper": {"status": "degraded", "detail": "secret"},
            "bad name!": {"status": "ok"},
            "weird": {"status": "<script>secret</script>"},
            "nested": "secret",
        }})
        result = PROBE.summarize(0, '{"http_code":200}', "", body)
        self.assertEqual(result["status"], "degraded")
        self.assertEqual(result["checks"], {"release": "ok", "keeper": "degraded"})
        self.assertNotIn("secret", json.dumps(result))

    def test_local_success_never_recovers_public_failure(self):
        with patch.object(PROBE, "probe", side_effect=[{"status":"unreachable"}, {"status":"ok"}]) as call:
            result = PROBE.collect("https://example.com/api/healthz", "http://127.0.0.1:3400/api/healthz")
        self.assertEqual(result["status"], "unreachable")
        self.assertEqual(result["interpretation"], "public_failure_local_app_ok")
        self.assertEqual(call.call_count, 2)

    def test_success_does_not_add_diagnostic_traffic(self):
        with patch.object(PROBE, "probe", return_value={"status":"ok"}) as call:
            result = PROBE.collect("https://example.com", "http://127.0.0.1:3400/api/healthz")
        self.assertEqual(call.call_count, 1)
        self.assertNotIn("localApp", result)

    def test_fallback_cannot_probe_arbitrary_remote_addresses(self):
        with patch.object(PROBE, "probe", return_value={"status":"unreachable"}) as call:
            result = PROBE.collect("https://example.com", "http://169.254.169.254/")
        self.assertEqual(call.call_count, 1)
        self.assertEqual(result["localApp"]["status"], "invalid_local_url")

    def test_real_curl_alert_dedup_recovery_and_private_diagnostic_file(self):
        class Handler(BaseHTTPRequestHandler):
            failing = True

            def do_GET(self):
                self.send_response(522 if self.failing and self.path == "/public" else 200)
                self.send_header("CF-Ray", "abc123-FRA")
                self.send_header("Set-Cookie", "secret-cookie")
                self.end_headers()
                self.wfile.write(b'{"status":"ok","internal":"secret-body"}')

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                state = root / "state"
                config = root / "alert.env"
                config.write_text(f"ALERT_STATE_FILE='{state}'\nALERT_WEBHOOK_URL=''\nALERT_AFTER_FAILURES='1'\n")
                logger = root / "logger"
                logger.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOG_CAPTURE"\n')
                logger.chmod(0o700)
                base = f"http://127.0.0.1:{server.server_port}"
                env = {**os.environ, "PATH":str(root) + os.pathsep + os.environ["PATH"],
                       "ALERT_CONFIG_FILE":str(config), "HEALTHZ_URL":base + "/public",
                       "HEALTHZ_LOCAL_URL":base + "/local", "LOG_CAPTURE":str(root / "journal")}
                def run():
                    return subprocess.run(["bash", str(ROOT / "script/ops/healthz-alert.sh")],
                                          env=env, text=True, capture_output=True, check=True, timeout=10)
                first = run()
                self.assertIn("[ALERT]", first.stdout)
                diagnostic = root / "state.probe.json"
                detail = json.loads(diagnostic.read_text())
                self.assertEqual(detail["status"], "http_error")
                self.assertEqual(detail["localApp"]["status"], "ok")
                self.assertEqual(detail["public"]["cfRay"], "abc123-FRA")
                self.assertEqual(diagnostic.stat().st_mode & 0o777, 0o600)
                self.assertNotIn("[ALERT]", run().stdout)
                Handler.failing = False
                self.assertIn("[RECOVERED]", run().stdout)
                self.assertTrue(state.read_text().startswith("ok "))
                self.assertNotIn("secret", (root / "journal").read_text())
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
