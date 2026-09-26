#!/usr/bin/env python3
"""Deliver an ops alert to Telegram without exposing the bot token.

The token and chat id come from the environment (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID), never from argv:
/proc/<pid>/cmdline is world-readable on the host. The alert body is read from stdin. A health-probe JSON
body is rendered as a short summary; anything else is sent as plain text. Errors never print the request
URL, which contains the token.

Setup: message the bot once from the account or group that should receive alerts, then run
`alert-notify.py --list-chats` to find its chat id.
"""
import argparse
import json
import os
import socket
import sys
import urllib.error
import urllib.request

DEFAULT_API_BASE = "https://api.telegram.org"
MAX_TEXT = 4000  # Telegram rejects messages longer than 4096 characters


def describe(probe):
    """Summarize a healthz-probe result: status, failing checks, public and local reachability."""
    lines = [f"status: {probe.get('status')}"]
    public = probe.get("public")
    if isinstance(public, dict):
        lines.append(f"public: {public.get('status')} (HTTP {public.get('httpCode')})")
        checks = public.get("checks")
        if isinstance(checks, dict) and checks:
            lines.append("checks: " + ", ".join(f"{name}={state}" for name, state in checks.items()))
    local = probe.get("localApp")
    if isinstance(local, dict):
        lines.append(f"local app: {local.get('status')}")
    for key in ("interpretation", "error"):
        if probe.get(key):
            lines.append(f"{key}: {probe[key]}")
    return "\n".join(lines)


def render(subject, body, host):
    text = body.strip()
    try:
        probe = json.loads(text)
    except ValueError:
        probe = None
    if isinstance(probe, dict) and "status" in probe:
        text = describe(probe)
    return "\n".join(part for part in (subject, text, f"host: {host}") if part)[:MAX_TEXT]


def call(api_base, token, method, payload, opener, timeout=15):
    request = urllib.request.Request(
        f"{api_base}/bot{token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with opener(request, timeout=timeout) as response:
        return json.load(response)


def list_chats(api_base, token, opener):
    """Chats that have messaged the bot, as {chat_id: label}."""
    chats = {}
    for update in call(api_base, token, "getUpdates", {"timeout": 0}, opener).get("result", []):
        for key in ("message", "channel_post", "my_chat_member", "edited_message"):
            chat = (update.get(key) or {}).get("chat") or {}
            if "id" in chat:
                chats[chat["id"]] = chat.get("title") or chat.get("username") or chat.get("first_name") or ""
    return chats


def main(argv=None, env=None, stdin=None, stdout=None, stderr=None, opener=urllib.request.urlopen):
    env = os.environ if env is None else env
    stdin, stdout, stderr = stdin or sys.stdin, stdout or sys.stdout, stderr or sys.stderr
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--subject", default="", help="first line of the message")
    parser.add_argument("--list-chats", action="store_true", help="print chat ids that have messaged the bot")
    args = parser.parse_args(argv)

    token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN is not set", file=stderr)
        return 2
    api_base = env.get("TELEGRAM_API_BASE", DEFAULT_API_BASE).rstrip("/")
    try:
        if args.list_chats:
            for chat_id, label in list_chats(api_base, token, opener).items():
                print(f"{chat_id}\t{label}", file=stdout)
            return 0
        chat_id = env.get("TELEGRAM_CHAT_ID", "").strip()
        if not chat_id:
            print("TELEGRAM_CHAT_ID is not set", file=stderr)
            return 2
        text = render(args.subject, stdin.read(), socket.gethostname())
        body = call(api_base, token, "sendMessage", {"chat_id": chat_id, "text": text}, opener)
        if not body.get("ok"):
            print("telegram delivery failed: not ok", file=stderr)
            return 1
        return 0
    except urllib.error.HTTPError as exc:
        print(f"telegram delivery failed: HTTP {exc.code}", file=stderr)
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"telegram delivery failed: {type(exc).__name__}", file=stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
