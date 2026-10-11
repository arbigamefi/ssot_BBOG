"""Exercise the keeper RPC replacement with synthetic endpoints only."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROGRAM = ROOT / 'script/ops/set_keeper_rpc_env.py'
SHELL = ROOT / 'script/ops/set-keeper-rpc.sh'
OLD_HTTP = 'https://base-sepolia.infura.io/v3/' + 'a' * 32
OLD_WS = 'wss://base-sepolia.g.alchemy.com/v2/' + 'b' * 32
NEW_HTTP = 'https://base-sepolia.infura.io/v3/' + 'c' * 32
NEW_WS = 'wss://base-sepolia.g.alchemy.com/v2/' + 'd' * 32
SECRETS = [value.rsplit('/', 1)[1] for value in (OLD_HTTP, OLD_WS, NEW_HTTP, NEW_WS)]


class SetKeeperRpcTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.path = self.directory / 'keeper.primary.env'
        self.original = (f'# keeper\nKEEPER_CHAIN_ID=84532\nKEEPER_RPC_HTTP={OLD_HTTP}\n'
                         f'KEEPER_RPC_WS={OLD_WS}\nKEEPER_PRIVATE_KEY=0x{"1" * 64}\n').encode()
        self.path.write_bytes(self.original)
        self.path.chmod(0o600)

    def run_program(self, payload=None, network='base-sepolia'):
        payload = {'KEEPER_RPC_HTTP': NEW_HTTP, 'KEEPER_RPC_WS': NEW_WS} if payload is None else payload
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        return subprocess.run([sys.executable, str(PROGRAM), str(self.path), network], input=data,
                              capture_output=True, timeout=10)

    def assert_quiet(self, result):
        for secret in SECRETS:
            self.assertNotIn(secret.encode(), result.stdout + result.stderr)

    def assert_rejected(self, **kwargs):
        before = self.path.read_bytes()
        result = self.run_program(**kwargs)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.path.read_bytes(), before)
        self.assert_quiet(result)
        self.assertFalse(list(self.directory.glob('.*.rpc-*')))

    def test_success_replaces_both_lines_only(self):
        result = self.run_program()
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = self.original.replace(OLD_HTTP.encode(), NEW_HTTP.encode()).replace(OLD_WS.encode(), NEW_WS.encode())
        self.assertEqual(self.path.read_bytes(), expected)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        for file in self.directory.iterdir():
            self.assertNotIn(OLD_HTTP.encode(), file.read_bytes())
        self.assert_quiet(result)

    def test_crlf_and_no_final_newline_preserved(self):
        self.path.write_bytes(f'KEEPER_RPC_HTTP={OLD_HTTP}\r\nKEEPER_RPC_WS={OLD_WS}'.encode())
        self.assertEqual(self.run_program().returncode, 0)
        self.assertEqual(self.path.read_bytes(), f'KEEPER_RPC_HTTP={NEW_HTTP}\r\nKEEPER_RPC_WS={NEW_WS}'.encode())

    def test_ambiguous_files_are_left_unchanged(self):
        cases = {
            'missing ws': f'KEEPER_RPC_HTTP={OLD_HTTP}\n',
            'duplicate http': f'KEEPER_RPC_HTTP={OLD_HTTP}\nKEEPER_RPC_HTTP={OLD_HTTP}\nKEEPER_RPC_WS={OLD_WS}\n',
            'export form': f'export KEEPER_RPC_HTTP={OLD_HTTP}\nKEEPER_RPC_WS={OLD_WS}\n',
            'spaced form': f'KEEPER_RPC_HTTP={OLD_HTTP}\n KEEPER_RPC_WS = {OLD_WS}\n',
        }
        for name, content in cases.items():
            with self.subTest(name):
                self.path.write_text(content)
                self.assert_rejected()

    def test_wrong_endpoints_are_refused(self):
        payloads = {
            'mainnet endpoint for sepolia': {'KEEPER_RPC_HTTP': NEW_HTTP.replace('base-sepolia', 'base-mainnet'),
                                             'KEEPER_RPC_WS': NEW_WS},
            'providers swapped': {'KEEPER_RPC_HTTP': NEW_WS.replace('wss://', 'https://'), 'KEEPER_RPC_WS': NEW_WS},
            'path characters in key': {'KEEPER_RPC_HTTP': NEW_HTTP + '/x', 'KEEPER_RPC_WS': NEW_WS},
            'extra name': {'KEEPER_RPC_HTTP': NEW_HTTP, 'KEEPER_RPC_WS': NEW_WS, 'KEEPER_PRIVATE_KEY': '0x1'},
        }
        for name, payload in payloads.items():
            with self.subTest(name):
                self.assert_rejected(payload=payload)
        self.assert_rejected(payload=b'not json')
        self.assert_rejected(network='base')

    def test_runs_as_the_shell_entry_point_sends_it(self):
        # set-keeper-rpc.sh ships the program base64-encoded in `python3 -c`, so sys.argv starts with "-c".
        import base64
        encoded = base64.b64encode(PROGRAM.read_bytes()).decode()
        payload = json.dumps({'KEEPER_RPC_HTTP': NEW_HTTP, 'KEEPER_RPC_WS': NEW_WS}).encode()
        result = subprocess.run([sys.executable, '-c', f"import base64; exec(base64.b64decode('{encoded}'))",
                                 str(self.path), 'base-sepolia'], input=payload, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(NEW_WS.encode(), self.path.read_bytes())
        self.assert_quiet(result)

    def test_shell_entry_point_needs_a_terminal(self):
        result = subprocess.run(['bash', str(SHELL), 'base-sepolia'], stdin=subprocess.DEVNULL,
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertIn('run this in your own terminal', result.stderr)


if __name__ == '__main__':
    unittest.main()
