#!/usr/bin/env python3
"""Bounded health probes; emit only allowlisted diagnostics, never response bodies."""
import argparse
from datetime import datetime, timezone
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlsplit


TIMINGS = ("time_namelookup", "time_connect", "time_appconnect", "time_starttransfer", "time_total")


def summarize(returncode, metadata, headers, body):
    try:
        meta = json.loads(metadata)
        if not isinstance(meta, dict):
            meta = {}
    except (ValueError, TypeError):
        meta = {}
    code = meta.get("http_code", 0)
    code = code if isinstance(code, int) else 0
    try:
        payload = json.loads(body)
        app_status = payload.get("status") if isinstance(payload, dict) else None
    except (ValueError, TypeError):
        app_status = None
    if returncode:
        status = "unreachable"
    elif not 200 <= code < 300:
        status = "http_error"
    elif app_status == "ok":
        status = "ok"
    elif app_status in ("degraded", "unhealthy", "error"):
        status = app_status
    else:
        status = "unparseable"
    result = {"status": status, "httpCode": code, "curlExitCode": returncode}
    for name in TIMINGS:
        value = meta.get(name)
        if isinstance(value, (float, int)) and 0 <= value < 3600:
            result[name] = value
    try:
        result["remoteIp"] = str(ipaddress.ip_address(meta.get("remote_ip", "")))
    except ValueError:
        pass
    # Never retain cookies, authorization, URLs/query strings, or arbitrary headers.
    rays = re.findall(r"^cf-ray:\s*([a-zA-Z0-9-]{1,100})\s*$", headers, re.I | re.M)
    if rays:
        result["cfRay"] = rays[-1]
    return result


def probe(url, timeout):
    with tempfile.TemporaryDirectory(prefix="arbigamefi-healthz-") as directory:
        body, headers = Path(directory) / "body", Path(directory) / "headers"
        command = ["curl", "--disable", "--silent", "--show-error", "--connect-timeout", "5",
                   "--max-time", str(timeout), "--max-filesize", "65536", "--proto", "=http,https",
                   "--output", str(body), "--dump-header", str(headers), "--write-out", "%{json}",
                   "--url", url]
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 2)
        except subprocess.TimeoutExpired:
            return {"status": "unreachable", "httpCode": 0, "curlExitCode": 28, "probeProcessTimeout": True}
        except OSError:
            return {"status": "probe_error", "httpCode": 0, "curlExitCode": None}
        return summarize(completed.returncode, completed.stdout,
                         headers.read_text(errors="replace") if headers.exists() else "",
                         body.read_text(errors="replace") if body.exists() else "")


def collect(url, local_url):
    public = probe(url, 20)
    result = {"observedAtUtc": datetime.now(timezone.utc).isoformat(), "status": public["status"],
              "public": public}
    if public["status"] != "ok":
        parsed = urlsplit(local_url)
        if parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost", "::1") and not parsed.username:
            result["localApp"] = probe(local_url, 5)
        else:
            result["localApp"] = {"status": "invalid_local_url"}
        # Local success never clears a public outage, nor proves the proxy route works.
        result["interpretation"] = ("public_failure_local_app_ok" if result["localApp"]["status"] == "ok"
                                    else "public_failure_local_app_not_confirmed")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--local-url", default="http://127.0.0.1:3400/api/healthz")
    args = parser.parse_args()
    print(json.dumps(collect(args.url, args.local_url), separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    main()
