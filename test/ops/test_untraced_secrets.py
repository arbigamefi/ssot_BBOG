"""Operator scripts that hold a key, a password or a bot token turn bash tracing and input echo off before anything
else. An inherited SHELLOPTS (xtrace, verbose), bash -x or bash -v would otherwise print the secret on the script's own
stderr, which no redacting pipe covers (pre-deployment tooling review D1)."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ('script/tools/with-etherscan-key.sh', 'script/tools/with-ops-rpc.sh', 'script/release/broadcast_v16.sh',
           'script/release/release_v16.sh', 'script/ops/send-keeper-rpc.sh', 'script/ops/swap-keeper-key.sh',
           'script/ops/config-drift-alert.sh', 'script/ops/healthz-alert.sh')
TOKEN = 'canary-bot-token-for-trace-tests'


class SecretScriptsAreUntracedTest(unittest.TestCase):
    def test_each_turns_tracing_and_echo_off_before_its_first_other_command(self):
        for path in SCRIPTS:
            lines = (ROOT / path).read_text().splitlines()
            commands = [line for line in lines[1:] if line.strip() and not line.lstrip().startswith('#')]
            self.assertEqual(commands[0].split('#')[0].strip(), 'set +xv', path)

    def test_the_drift_monitor_wrapper_never_shows_the_bot_token(self):
        # config-drift-alert.sh sources the alert configuration: a trace prints its assignments, echo prints its lines.
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            shutil.copy(ROOT / 'script/ops/config-drift-alert.sh', base / 'config-drift-alert.sh')
            (base / 'config-drift-monitor.py').write_text('print("monitor ran")\n')
            (base / 'bin').mkdir()
            (base / 'bin/logger').write_text('#!/bin/sh\ncat >&2\n')
            (base / 'bin/logger').chmod(0o755)
            (base / 'alert.env').write_text(f"TELEGRAM_BOT_TOKEN='{TOKEN}'\nTELEGRAM_CHAT_ID='555'\n")
            env = {'PATH': f"{base / 'bin'}{os.pathsep}{os.environ['PATH']}", 'HOME': directory,
                   'ALERT_CONFIG_FILE': str(base / 'alert.env')}
            script = str(base / 'config-drift-alert.sh')
            runs = {'inherited xtrace': (['bash', script], {'SHELLOPTS': 'xtrace'}),
                    'inherited verbose': (['bash', script], {'SHELLOPTS': 'verbose'}),
                    'bash -x': (['bash', '-x', script], {}), 'bash -v': (['bash', '-v', script], {})}
            for name, (argv, extra) in runs.items():
                result = subprocess.run(argv, capture_output=True, text=True, env={**env, **extra}, timeout=20)
                self.assertEqual(result.returncode, 0, (name, result.stderr))
                self.assertIn('monitor ran', result.stderr, name)
                self.assertIn('set +xv', result.stderr, name)   # the option was on until the script turned it off
                self.assertNotIn(TOKEN, result.stdout + result.stderr, name)


if __name__ == '__main__':
    unittest.main()
