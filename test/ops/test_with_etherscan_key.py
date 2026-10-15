import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'script/tools/with-etherscan-key.sh'


class WithEtherscanKeyTest(unittest.TestCase):
    """with-etherscan-key.sh hands the command the Etherscan key alone and redacts it from every output line."""

    def setUp(self):
        handle, path = tempfile.mkstemp()
        os.close(handle)
        self.env_file = Path(path)
        self.addCleanup(self.env_file.unlink)
        self.env_file.write_text('INFURA_API_KEY_OPS="infuraOpsTestKey123"\n'
                                 'ETHERSCAN_V2_API_KEY="etherscanTestKey4567890"\n'
                                 'ALCHEMY_API_KEY_PROD_KEEPER=prodKeeperTestKey000\n')

    def run_wrapper(self, *args):
        env = {'PATH': os.environ['PATH'], 'HOME': os.environ.get('HOME', '/tmp'), 'OPS_ENV_FILE': str(self.env_file)}
        return subprocess.run(['bash', str(SCRIPT), *args], capture_output=True, text=True, env=env, check=False)

    def test_key_is_redacted_on_stdout_and_stderr(self):
        result = self.run_wrapper('bash', '-c', 'echo "apikey=$ETHERSCAN_V2_API_KEY"; echo "$ETHERSCAN_V2_API_KEY" >&2')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.splitlines(), ['apikey=<etherscan-key>', '<etherscan-key>'])
        self.assertNotIn('etherscanTestKey4567890', result.stdout + result.stderr)

    def test_the_command_gets_the_etherscan_key_and_no_other(self):
        result = self.run_wrapper('bash', '-c', 'env | grep -c etherscanTestKey4567890; '
                                                'env | grep -c -e infuraOpsTestKey123 -e prodKeeperTestKey000')
        self.assertEqual(result.stdout.split(), ['1', '0'])
        code = [line for line in SCRIPT.read_text().splitlines() if not line.lstrip().startswith('#')]
        self.assertNotIn('INFURA', '\n'.join(code))
        self.assertNotIn('ALCHEMY', '\n'.join(code))

    def test_a_file_the_command_writes_is_not_redacted(self):
        # The header says so: the wrapper sees output lines only.
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'out.txt'
            self.run_wrapper('bash', '-c', f'echo "$ETHERSCAN_V2_API_KEY" > {out}')
            self.assertEqual(out.read_text().strip(), 'etherscanTestKey4567890')

    def test_usage_missing_key_and_exit_status(self):
        self.assertEqual(self.run_wrapper().returncode, 64)
        self.assertEqual(self.run_wrapper('bash', '-c', 'exit 3').returncode, 3)
        self.env_file.write_text('ETHERSCAN_V2_API_KEY=\n')
        self.assertEqual(self.run_wrapper('true').returncode, 65)
        self.env_file.write_text('INFURA_API_KEY_OPS=x\n')
        self.assertEqual(self.run_wrapper('true').returncode, 65)

    def test_the_script_is_executable(self):
        self.assertTrue(SCRIPT.stat().st_mode & stat.S_IXUSR)


if __name__ == '__main__':
    unittest.main()
