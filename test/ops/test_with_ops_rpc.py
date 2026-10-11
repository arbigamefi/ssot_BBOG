import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'script/tools/with-ops-rpc.sh'


class WithOpsRpcTest(unittest.TestCase):
    """with-ops-rpc.sh builds an operator endpoint, redacts its key and refuses every other key."""

    def setUp(self):
        handle, path = tempfile.mkstemp()
        os.close(handle)
        self.env_file = Path(path)
        self.addCleanup(self.env_file.unlink)
        self.env_file.write_text('INFURA_API_KEY_OPS="infuraOpsTestKey123"\n'
                                 'ALCHEMY_API_KEY_OPS=alchemyOpsTestKey456\n'
                                 'INFURA_API_KEY_PROD_KEEPER=prodKeeperTestKey789\n'
                                 'ALCHEMY_API_KEY_PROD_KEEPER=prodKeeperTestKey000\n')

    def run_wrapper(self, *args):
        return subprocess.run(['bash', str(SCRIPT), *args], capture_output=True, text=True,
                              env={**os.environ, 'OPS_ENV_FILE': str(self.env_file)}, check=False)

    def test_endpoint_is_redacted_on_stdout_and_stderr(self):
        result = self.run_wrapper('infura', 'base-sepolia', 'bash', '-c', 'echo "$OPS_RPC_URL"; echo "$OPS_RPC_URL" >&2')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.splitlines(), ['https://base-sepolia.infura.io/v3/<infura-ops-key>'] * 2)
        self.assertNotIn('infuraOpsTestKey123', result.stdout + result.stderr)

    def test_endpoints_per_provider_and_network(self):
        cases = {('infura', 'base'): 'https://base-mainnet.infura.io/v3/<infura-ops-key>',
                 ('alchemy', 'base-sepolia'): 'https://base-sepolia.g.alchemy.com/v2/<alchemy-ops-key>',
                 ('alchemy', 'base'): 'https://base-mainnet.g.alchemy.com/v2/<alchemy-ops-key>'}
        for (provider, network), endpoint in cases.items():
            result = self.run_wrapper(provider, network, 'bash', '-c', 'echo "$OPS_RPC_URL"')
            self.assertEqual(result.stdout.strip(), endpoint)

    def test_key_reaches_the_command_only_inside_the_endpoint(self):
        result = self.run_wrapper('alchemy', 'base', 'bash', '-c', 'env | grep -c alchemyOpsTestKey456')
        self.assertEqual(result.stdout.strip(), '1')

    def test_production_keeper_keys_cannot_be_selected(self):
        for provider in ('prod', 'keeper', 'INFURA_API_KEY_PROD_KEEPER', 'ALCHEMY_API_KEY_PROD_KEEPER'):
            self.assertEqual(self.run_wrapper(provider, 'base-sepolia', 'true').returncode, 64)
        code = [line for line in SCRIPT.read_text().splitlines() if not line.lstrip().startswith('#')]
        self.assertNotIn('PROD_KEEPER', '\n'.join(code))

    def test_usage_missing_key_and_exit_status(self):
        self.assertEqual(self.run_wrapper('infura', 'mainnet', 'true').returncode, 64)
        self.assertEqual(self.run_wrapper('infura', 'base').returncode, 64)
        self.assertEqual(self.run_wrapper('infura', 'base', 'bash', '-c', 'exit 3').returncode, 3)
        self.env_file.write_text('INFURA_API_KEY_OPS=\n')
        self.assertEqual(self.run_wrapper('infura', 'base', 'true').returncode, 65)


if __name__ == '__main__':
    unittest.main()
