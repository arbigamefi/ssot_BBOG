"""Exercise script/release/release_v16.sh on a terminal, with make, forge and cast stubbed.

The stubs stand in for the release steps: each call is logged, a step can be made to fail with a transport or a genuine
error, and the stub keystore unlocks only with its password. The script runs on a pseudo-terminal, so its password
prompt and /dev/tty reads are the real ones; its stdout and stderr go to a file, so the terminal shows only what the
script writes to /dev/tty.
"""
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'script/release/release_v16.sh'
WRAPPER = ROOT / 'script/tools/with-ops-rpc.sh'
# macOS ships bash 3.2 as /bin/bash; the script must run there as well as on CI's bash 5.
BASH = '/bin/bash' if Path('/bin/bash').exists() else shutil.which('bash')
SIGNER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
PASSWORD = 'correct horse battery'
KEY = '0123456789abcdef0123456789abcdef'
RPC = 'https://base-sepolia.infura.io/v3/' + KEY
PROMPT = 'Keystore password for release-signer'
STEPS = ['release-governance-check', 'release-domain-check', 'release-notes', 'release-frontend-manifest',
         'release-golden-vectors', 'release-abis', 'release-verify', 'release-package']

MAKE = r'''#!/usr/bin/env bash
target=$1
echo "make $target via $RPC_URL" >> "$STUB_LOG"
echo "$target against $RPC_URL, key ${RPC_URL##*/}"
if [[ -f "$STUB_DIR/transport.$target" ]]; then
  left=$(cat "$STUB_DIR/transport.$target")
  if ((left > 0)); then
    echo $((left - 1)) > "$STUB_DIR/transport.$target"
    echo "Error: error sending request for url ($RPC_URL)"
    exit 1
  fi
fi
if [[ -f "$STUB_DIR/fail.$target" ]]; then
  rm "$STUB_DIR/fail.$target"
  echo "Error: $target found a mismatch"
  exit 2
fi
if [[ $target == release-package ]]; then
  mkdir -p dist
  echo "archive of $GIT_SHA" > dist/ssot-release-test.tar.gz
  echo "wrote: dist/ssot-release-test.tar.gz"
fi
'''

FORGE = r'''#!/usr/bin/env bash
echo "forge $*" >> "$STUB_LOG"
case "$*" in
  *VerifyReleaseV16*)
    [[ "$(cat "$RELEASE_PATH")" == "signed $(cat "$SNAPSHOT_PATH") by $RELEASE_SIGNER" ]] && exit 0
    echo "Error: script failed: digest mismatch"
    exit 1 ;;
  *ReleaseDigestV16*)
    while [[ $# -gt 0 && $1 != --password-file ]]; do shift; done
    echo "$2" > "$STUB_DIR/password-file"
    python3 -c 'import os, sys; print("password file", oct(os.stat(sys.argv[1]).st_mode & 0o777),
                                      "directory", oct(os.stat(os.path.dirname(sys.argv[1])).st_mode & 0o777))' \
      "$2" >> "$STUB_LOG"
    [[ "$(cat "$2")" == "$STUB_PASSWORD" ]] || { echo "Error: script failed: vm.sign: no wallets available"; exit 1; }
    echo "signed $(cat "$SNAPSHOT_PATH") by $RELEASE_SIGNER" > "$RELEASE_OUTPUT_PATH"
    echo "  digest: 0x1234"
    echo "  wrote: $RELEASE_OUTPUT_PATH" ;;
esac
'''

CAST = r'''#!/usr/bin/env bash
echo "cast $*" >> "$STUB_LOG"
[[ -z "${STUB_CAST_ERROR:-}" ]] || { echo "$STUB_CAST_ERROR" >&2; exit 1; }
while [[ $# -gt 0 && $1 != --password-file ]]; do shift; done
[[ "$(cat "$2")" == "$STUB_PASSWORD" ]] && { echo "$STUB_KEYSTORE_ADDRESS"; exit 0; }
echo 'Error: Failed to decrypt keystore "release-signer"' >&2
exit 1
'''


def git(repo, *args):
    subprocess.run(['git', '-c', 'user.name=Local test', '-c', 'user.email=test@invalid', *args], cwd=repo, check=True,
                   capture_output=True)


class ReleaseScriptTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(self.directory.name)
        self.repo = self.base / 'repo'
        (self.repo / 'script/release').mkdir(parents=True)
        shutil.copy(SCRIPT, self.repo / 'script/release/release_v16.sh')
        (self.repo / '.gitignore').write_text('/deployments/\n/dist/\n')
        (self.repo / 'deployments').mkdir()
        (self.repo / 'deployments/latest-v16.json').write_text('{"chainId": 84532}')
        git(self.repo, 'init', '-q')
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'release source')
        stubs = self.base / 'stubs'
        stubs.mkdir()
        for name, body in (('make', MAKE), ('forge', FORGE), ('cast', CAST)):
            (stubs / name).write_text(body)
            (stubs / name).chmod(0o755)
        (self.base / 'tmp').mkdir()
        self.calls = self.base / 'calls.log'
        self.env = {'PATH': f'{stubs}{os.pathsep}{os.environ["PATH"]}', 'HOME': str(self.base),
                    'TMPDIR': str(self.base / 'tmp'), 'STUB_LOG': str(self.calls), 'STUB_DIR': str(self.base),
                    'STUB_PASSWORD': PASSWORD, 'STUB_KEYSTORE_ADDRESS': SIGNER,
                    'SNAPSHOT_PATH': 'deployments/latest-v16.json', 'RELEASE_SIGNER': SIGNER.lower(),
                    'RELEASE_ACCOUNT': 'release-signer', 'RPC_URL': RPC, 'RELEASE_RETRY_SECONDS': '0'}
        self.runs = 0

    def tearDown(self):
        self.directory.cleanup()

    def release(self, *answers, env=None, command=None, interrupt=False):
        """Run on a new terminal, answering each password prompt in turn; return (exit code, output, terminal)."""
        self.runs += 1
        output = self.base / f'output-{self.runs}.txt'
        environment = {**self.env, 'RELEASE_LOG_DIR': f'dist/run-{self.runs}', **(env or {})}
        argv = command or [BASH, 'script/release/release_v16.sh']
        pid, terminal = pty.fork()
        if pid == 0:
            try:
                os.chdir(self.repo)
                sink = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                os.dup2(sink, 1)
                os.dup2(sink, 2)
                os.execve(argv[0], argv, environment)
            finally:
                os._exit(127)
        seen, pending, answered, status = b'', list(answers), 0, None
        deadline = time.monotonic() + 60
        while status is None and time.monotonic() < deadline:
            if select.select([terminal], [], [], 0.1)[0]:
                try:
                    chunk = os.read(terminal, 4096)
                except OSError:  # Linux reports EIO once the child is gone
                    chunk = b''
                seen += chunk
                if seen.count(PROMPT.encode()) > answered:
                    answered += 1
                    if interrupt:
                        os.write(terminal, b'\x03')
                    else:
                        os.write(terminal, (pending.pop(0) if pending else '').encode() + b'\n')
                if chunk:
                    continue
            finished, code = os.waitpid(pid, os.WNOHANG)
            if finished:
                status = code
        if status is None:
            os.kill(pid, signal.SIGKILL)
            os.waitpid(pid, 0)
            self.fail('release_v16.sh did not finish within 60 s')
        os.close(terminal)
        return os.waitstatus_to_exitcode(status), output.read_text(), seen.decode(errors='replace')

    def log(self):
        return self.calls.read_text() if self.calls.exists() else ''

    def made(self):
        return [line.split()[1] for line in self.log().splitlines() if line.startswith('make ')]

    def assert_no_password_left(self):
        self.assertEqual(list((self.base / 'tmp').iterdir()), [])

    def test_wrong_passwords_end_the_run_with_nothing_signed(self):
        code, output, terminal = self.release('guess one', 'guess two', 'guess three')
        self.assertEqual(code, 1, output)
        self.assertEqual(terminal.count(PROMPT), 3)
        self.assertEqual(output.count('signing: wrong password for release-signer'), 3)
        self.assertIn('signing: nothing was signed', output)
        self.assertEqual(self.log().count('cast wallet address --account release-signer --password-file'), 3)
        self.assertNotIn('ReleaseDigestV16', self.log())
        self.assertEqual(self.made(), STEPS[:2])
        self.assertFalse((self.repo / 'deployments/release-latest-v16.json').exists())
        self.assert_no_password_left()

    def test_prompt_goes_to_the_terminal_and_the_release_is_signed_once(self):
        code, output, terminal = self.release('guess one', PASSWORD)
        self.assertEqual(code, 0, output)
        self.assertEqual(terminal.count(PROMPT), 2)
        self.assertNotIn(PROMPT, output)
        self.assertNotIn(PASSWORD, output)
        self.assertIn('signing: the keystore unlocks', output)
        self.assertIn('signing: digest: 0x1234', output)
        self.assertEqual(self.log().count('ReleaseDigestV16.s.sol'), 1)
        self.assertIn('--account release-signer --password-file', self.log())
        self.assertIn('password file 0o600 directory 0o700', self.log())
        self.assertFalse(Path((self.base / 'password-file').read_text().strip()).exists())
        self.assert_no_password_left()
        self.assertEqual(self.made(), STEPS)
        self.assertRegex(output, r'release-v16 complete: dist/ssot-release-test\.tar\.gz sha256 [0-9a-f]{64}\n')

    def test_rerun_after_a_later_failure_keeps_the_signature(self):
        (self.base / 'fail.release-package').touch()
        code, output, _ = self.release(PASSWORD)
        self.assertEqual(code, 1, output)
        self.assertIn('release-package: FAILED', output)
        code, output, terminal = self.release()
        self.assertEqual(code, 0, output)
        self.assertNotIn(PROMPT, terminal)
        self.assertIn('already holds', output)
        self.assertIn('not signing again', output)
        self.assertEqual(self.log().count('ReleaseDigestV16.s.sol'), 1)
        self.assertEqual(self.log().count('cast wallet address'), 1)
        self.assertEqual(self.made(), STEPS + STEPS)

    def test_record_that_does_not_verify_is_never_overwritten(self):
        record = self.repo / 'deployments/release-latest-v16.json'
        record.write_text('record of another deployment')
        code, output, terminal = self.release(PASSWORD)
        self.assertEqual(code, 1, output)
        self.assertIn('does not verify against this snapshot and signer; it is never overwritten', output)
        self.assertIn('digest mismatch', output)
        self.assertNotIn(PROMPT, terminal)
        self.assertEqual(record.read_text(), 'record of another deployment')
        self.assertNotIn('cast', self.log())
        self.assertNotIn('ReleaseDigestV16', self.log())

    def test_keystore_of_another_address_is_refused_without_more_prompts(self):
        other = '0x' + 'ab' * 20
        code, output, terminal = self.release(PASSWORD, env={'STUB_KEYSTORE_ADDRESS': other})
        self.assertEqual(code, 1, output)
        self.assertIn(f'the keystore holds {other}, not RELEASE_SIGNER', output)
        self.assertEqual(terminal.count(PROMPT), 1)
        self.assertNotIn('ReleaseDigestV16', self.log())
        self.assert_no_password_left()

    def test_keystore_that_cast_cannot_open_is_reported_as_such(self):
        error = 'Error: Keystore file `"/home/owner/.foundry/keystores/release-signer"` does not exist'
        code, output, terminal = self.release(PASSWORD, env={'STUB_CAST_ERROR': error})
        self.assertEqual(code, 1, output)
        self.assertIn('signing: cast cannot open the keystore; nothing was signed', output)
        self.assertIn(error, output)
        self.assertEqual(terminal.count(PROMPT), 1)
        self.assertNotIn('ReleaseDigestV16', self.log())

    def test_only_transport_failures_are_retried(self):
        (self.base / 'transport.release-domain-check').write_text('2')
        code, output, _ = self.release(PASSWORD)
        self.assertEqual(code, 0, output)
        self.assertIn('release-domain-check: transport failure on attempt 1 of 8', output)
        self.assertIn('release-domain-check: pass (attempt 3)', output)
        self.assertEqual(self.made().count('release-domain-check'), 3)

        self.calls.unlink()
        (self.base / 'fail.release-governance-check').touch()
        code, output, terminal = self.release(PASSWORD)
        self.assertEqual(code, 1, output)
        self.assertIn('release-governance-check: FAILED', output)
        self.assertIn('found a mismatch', output)
        self.assertEqual(self.made(), ['release-governance-check'])
        self.assertNotIn(PROMPT, terminal)

    def test_transport_retries_are_bounded(self):
        (self.base / 'transport.release-verify').write_text('5')
        code, output, _ = self.release(PASSWORD, env={'RELEASE_STEP_ATTEMPTS': '2'})
        self.assertEqual(code, 1, output)
        self.assertIn('release-verify: transport failure on attempt 2 of 2', output)
        self.assertIn('release-verify: FAILED', output)
        self.assertEqual(self.made().count('release-verify'), 2)
        self.assertNotIn('release-package', self.made())

    def test_logs_and_output_never_show_the_rpc_key(self):
        (self.base / 'transport.release-governance-check').write_text('1')
        (self.base / 'fail.release-verify').touch()
        code, output, _ = self.release(PASSWORD)
        self.assertEqual(code, 1, output)
        logs = sorted((self.repo / 'dist/run-1').iterdir())
        self.assertIn(self.repo / 'dist/run-1/release-governance-check.2.log', logs)
        text = ''.join(path.read_text() for path in logs)
        self.assertIn('against <rpc-url>, key <rpc-key>', text)
        self.assertNotIn(KEY, text)
        self.assertNotIn(KEY, output)

    def test_refusals_before_any_step(self):
        (self.repo / 'dist/kept').mkdir(parents=True)
        (self.repo / 'dist/kept/old.log').write_text('earlier run')
        cases = {
            'GIT_SHA': ({'GIT_SHA': '0' * 40}, 'is not HEAD'),
            'no RPC': ({'RPC_URL': ''}, 'no RPC'),
            'signer': ({'RELEASE_SIGNER': '0x1234'}, 'set RELEASE_SIGNER'),
            'two wallets': ({'RELEASE_KEYSTORE': '/keys/release'}, 'exactly one of RELEASE_ACCOUNT'),
            'no wallet': ({'RELEASE_ACCOUNT': ''}, 'exactly one of RELEASE_ACCOUNT'),
            'snapshot': ({'SNAPSHOT_PATH': 'deployments/missing.json'}, 'set SNAPSHOT_PATH'),
            'used logs': ({'RELEASE_LOG_DIR': 'dist/kept'}, 'dist/kept is not empty; logs are never overwritten'),
            'tracked logs': ({'RELEASE_LOG_DIR': 'logs'}, 'logs is inside the repository and not ignored'),
        }
        for name, (env, message) in cases.items():
            with self.subTest(name):
                code, output, _ = self.release(env=env)
                self.assertEqual(code, 1, output)
                self.assertIn(message, output)
                self.assertEqual(self.made(), [])
        shutil.rmtree(self.repo / 'logs')
        (self.repo / 'notes.txt').write_text('uncommitted')
        code, output, _ = self.release()
        self.assertEqual(code, 1, output)
        self.assertIn('the working tree is not clean', output)
        self.assertEqual(self.made(), [])

    def test_without_a_terminal_nothing_is_signed(self):
        result = subprocess.run([BASH, 'script/release/release_v16.sh'], cwd=self.repo, stdin=subprocess.DEVNULL,
                                capture_output=True, text=True, timeout=60, start_new_session=True,
                                env={**self.env, 'RELEASE_LOG_DIR': 'dist/no-terminal'})
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('no terminal to read the keystore password from; nothing was signed', result.stdout)
        self.assertNotIn('cast', self.log())

    def test_interrupt_at_the_prompt_leaves_no_password_file(self):
        code, output, terminal = self.release(interrupt=True)
        self.assertEqual(code, 130, output)
        self.assertEqual(terminal.count(PROMPT), 1)
        self.assertNotIn('cast', self.log())
        self.assert_no_password_left()

    def test_through_the_ops_wrapper(self):
        env_file = self.base / 'ops.env'
        env_file.write_text(f'INFURA_API_KEY_OPS={KEY}\n')
        command = [BASH, str(WRAPPER), 'infura', 'base-sepolia', BASH, 'script/release/release_v16.sh']
        code, output, terminal = self.release('guess', PASSWORD, command=command,
                                              env={'OPS_ENV_FILE': str(env_file), 'RPC_URL': 'https://other.invalid'})
        self.assertEqual(code, 0, output)
        # The wrapper's pipe holds output back until a line ends; the prompt goes around it.
        self.assertEqual(terminal.count(PROMPT), 2)
        self.assertIn('signing: wrong password for release-signer (attempt 1 of 3)', output)
        self.assertIn('release-v16 complete', output)
        # OPS_RPC_URL wins over RPC_URL, and the key shows nowhere but in what the stubs record.
        self.assertTrue(all(line.endswith(RPC) for line in self.log().splitlines() if line.startswith('make ')))
        self.assertNotIn(KEY, output)
        self.assertNotIn(KEY, ''.join(path.read_text() for path in (self.repo / 'dist/run-1').iterdir()))


if __name__ == '__main__':
    unittest.main()
