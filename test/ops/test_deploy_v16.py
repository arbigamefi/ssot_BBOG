"""The deployment gates: prepare_deploy_copy.sh and broadcast_v16.sh on a pseudo-terminal, with cast and forge stubbed.

The stubs stand in for the chain and the compiler: cast answers the chain id, the deployer's code and nonces and the
keystore unlock; forge writes a simulation equal to the preflight plan (or a different one) and records a broadcast.
Every refusal of plan A5 is exercised (EIP-7702 delegation, nonce, plan, .env, confirmation) and the one success.
"""
import hashlib
import json
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
BASH = '/bin/bash' if Path('/bin/bash').exists() else shutil.which('bash')
DEPLOYER = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
PASSWORD = 'deployer password'
CONFIRM = 'Type BROADCAST'
PROMPT = 'Keystore password for'
LIBS = (('FORGE_STD', 'forge-std', 'src'), ('OPENZEPPELIN_CONTRACTS', 'openzeppelin-contracts', 'contracts'),
        ('CHAINLINK_BROWNIE_CONTRACTS', 'chainlink-brownie-contracts', 'contracts'))

CAST = r'''#!/usr/bin/env bash
echo "cast $*" >> "$STUB_LOG"
case "$1" in
  chain-id) echo "${STUB_CHAIN:-84532}" ;;
  code) echo "${STUB_CODE:-0x}" ;;
  nonce) if [[ "$*" == *pending* ]]; then echo "${STUB_PENDING:-7}"; else echo "${STUB_NONCE:-7}"; fi ;;
  wallet)
    while [[ $# -gt 0 && $1 != --password-file ]]; do shift; done
    [[ "$(cat "$2")" == "$STUB_PASSWORD" ]] && { echo "${STUB_KEYSTORE_ADDRESS:-0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed}"; exit 0; }
    echo 'Error: Failed to decrypt keystore "deployer"' >&2
    exit 1 ;;
esac
'''

FORGE = r'''#!/usr/bin/env bash
echo "forge $* in $PWD" >> "$STUB_LOG"
mkdir -p "$FOUNDRY_BROADCAST/DeployV16.s.sol/84532/dry-run" cache/DeployV16.s.sol/84532/dry-run
# Like forge, keep each transaction's RPC in the project's cache for --resume.
sensitive=cache/DeployV16.s.sol/84532/dry-run/run-latest.json
[[ "$*" == *--broadcast* ]] && sensitive=cache/DeployV16.s.sol/84532/run-latest.json
printf '{"transactions": [{"rpc": "%s"}]}' "$RPC_URL" > "$sensitive"
if [[ "$*" == *--broadcast* ]]; then
  while [[ $# -gt 0 && $1 != --password-file ]]; do shift; done
  python3 -c 'import os, sys; print("password file", oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$2" >> "$STUB_LOG"
  cp "$STUB_PLAN" "$FOUNDRY_BROADCAST/DeployV16.s.sol/84532/run-latest.json"
  mkdir -p deployments && echo '{"deployed": true}' > deployments/latest-v16.json
  echo "broadcast against $RPC_URL"
  exit 0
fi
if [[ -n "${STUB_SIMULATION_DIFFERS:-}" ]]; then
  python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); d["transactions"][1]["transaction"]["input"] += "00"; json.dump(d, open(sys.argv[2], "w"))' \
    "$STUB_PLAN" "$FOUNDRY_BROADCAST/DeployV16.s.sol/84532/dry-run/run-latest.json"
else
  cp "$STUB_PLAN" "$FOUNDRY_BROADCAST/DeployV16.s.sol/84532/dry-run/run-latest.json"
fi
echo "simulated against $RPC_URL"
'''


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def tree_digest(directory):
    files = sorted(p.relative_to(directory).as_posix() for p in Path(directory).rglob('*') if p.is_file())
    listing = ''.join(f'{sha(Path(directory) / name)}  ./{name}\n' for name in sorted(files, key=lambda n: ('./' + n).encode()))
    return hashlib.sha256(listing.encode()).hexdigest()


def git(repo, *args):
    subprocess.run(['git', '-c', 'user.name=Local test', '-c', 'user.email=test@invalid', *args], cwd=repo, check=True,
                   capture_output=True)


class DeployGateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(self.directory.name).resolve()
        self.repo = self.base / 'repo'
        (self.repo / 'script/release').mkdir(parents=True)
        for name in ('prepare_deploy_copy.sh', 'broadcast_v16.sh', 'operator-functions.sh'):
            shutil.copy(ROOT / 'script/release' / name, self.repo / 'script/release' / name)
        lock = []
        for key, repo_dir, subtree in LIBS:
            (self.repo / 'lib' / repo_dir / subtree).mkdir(parents=True)
            (self.repo / 'lib' / repo_dir / subtree / 'Source.sol').write_text(f'// {repo_dir}\n')
            lock += [f'{key}_SUBTREE={subtree}', f'{key}_SHA256={tree_digest(self.repo / "lib" / repo_dir / subtree)}']
        (self.repo / 'deps.lock').write_text('\n'.join(lock) + '\n')
        (self.repo / '.gitignore').write_text('/lib/\n/dist/\n')
        git(self.repo, 'init', '-q')
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'deployment source')
        self.commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.repo, text=True).strip()
        self.pre = self.repo / 'dist/preflight'
        (self.pre / 'chain').mkdir(parents=True)
        (self.pre / 'chain/deploy-params.env').write_text(f'CHAIN_ID=84532\nDEPLOYER={DEPLOYER}\n')
        plan = self.pre / 'plan/DeployV16.s.sol/84532/dry-run/run-latest.json'
        plan.parent.mkdir(parents=True)
        plan.write_text(json.dumps({'transactions': [
            {'contractName': name, 'contractAddress': '0x' + format(i + 1, '040x'),
             'transaction': {'input': '0x6080' + format(i, '02x'), 'nonce': hex(7 + i), 'to': None}}
            for i, name in enumerate(('GovernanceTimelock', 'PoolRegistry'))]}))
        self.plan = plan
        (self.pre / 'PREFLIGHT.txt').write_text(
            f'result=PASS\ncommit={self.commit}\nchainId=84532\ndeployer={DEPLOYER}\nfirstNonce=7\ntransactions=2\n'
            f'governanceTimelock=0x{1:040x}\nparams_sha256={sha(self.pre / "chain/deploy-params.env")}\n'
            f'plan_sha256={sha(plan)}\ndomain=script/release/first-callback-domain-84532.json\ndomainOverride=no\n')
        stubs = self.base / 'stubs'
        stubs.mkdir()
        for name, body in (('cast', CAST), ('forge', FORGE)):
            (stubs / name).write_text(body)
            (stubs / name).chmod(0o755)
        (self.base / 'tmp').mkdir()
        self.calls = self.base / 'calls.log'
        self.copy = self.base / 'outside/copy'
        self.env = {'PATH': f'{stubs}{os.pathsep}{os.environ["PATH"]}', 'HOME': str(self.base),
                    'TMPDIR': str(self.base / 'tmp'), 'STUB_LOG': str(self.calls), 'STUB_PASSWORD': PASSWORD,
                    'STUB_PLAN': str(plan), 'RPC_URL': 'https://base-sepolia.invalid/v3/0123456789abcdef0123',
                    'DEPLOY_KEYSTORE': str(self.base / 'deployer.json')}

    def tearDown(self):
        self.directory.cleanup()

    def prepare(self, copy=None, env=None):
        return subprocess.run([BASH, 'script/release/prepare_deploy_copy.sh', str(self.pre), str(copy or self.copy)],
                              cwd=self.repo, env={**self.env, **(env or {})}, capture_output=True, text=True, timeout=60)

    def broadcast(self, *answers, env=None):
        """Run on a new terminal, answering the confirmation and password prompts in turn."""
        output = self.base / 'output.txt'
        environment = {**self.env, **(env or {})}
        pid, terminal = pty.fork()
        if pid == 0:
            try:
                os.chdir(self.repo)
                sink = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                os.dup2(sink, 1)
                os.dup2(sink, 2)
                argv = [BASH, 'script/release/broadcast_v16.sh', str(self.pre)]
                os.execve(argv[0], argv, environment)
            finally:
                os._exit(127)
        seen, pending, prompts, status = b'', list(answers), 0, None
        deadline = time.monotonic() + 60
        while status is None and time.monotonic() < deadline:
            if select.select([terminal], [], [], 0.1)[0]:
                try:
                    chunk = os.read(terminal, 4096)
                except OSError:
                    chunk = b''
                seen += chunk
                asked = seen.count(CONFIRM.encode()) + seen.count(PROMPT.encode())
                if asked > prompts:
                    prompts += 1
                    os.write(terminal, (pending.pop(0) if pending else '').encode() + b'\n')
                if chunk:
                    continue
            finished, code = os.waitpid(pid, os.WNOHANG)
            if finished:
                status = code
        if status is None:
            os.kill(pid, signal.SIGKILL)
            os.waitpid(pid, 0)
            self.fail('broadcast_v16.sh did not finish within 60 s')
        os.close(terminal)
        return os.waitstatus_to_exitcode(status), output.read_text(), seen.decode(errors='replace')

    def log(self):
        return self.calls.read_text() if self.calls.exists() else ''

    def broadcasts(self):
        return sum('--broadcast' in line for line in self.log().splitlines() if line.startswith('forge '))

    # ---- the deploy copy ----

    def test_the_copy_is_the_preflight_commit_with_checked_libraries_and_its_parameters(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        record = (self.pre / 'deploy-copy.txt').read_text()
        self.assertIn(f'copy={self.copy}\n', record)
        self.assertIn(f'commit={self.commit}\n', record)
        self.assertEqual((self.copy / 'deploy-params.env').read_text(), (self.pre / 'chain/deploy-params.env').read_text())
        self.assertTrue((self.copy / 'lib/forge-std/src/Source.sol').is_file())
        self.assertTrue((self.copy / 'script/release/broadcast_v16.sh').is_file())
        # Never twice for one preflight.
        again = self.prepare(copy=self.base / 'outside/second')
        self.assertNotEqual(again.returncode, 0)
        self.assertIn('deploy-copy.txt exists', again.stderr)

    def test_the_copy_refuses_a_failed_preflight_a_copy_in_the_repository_and_an_existing_copy(self):
        preflight = (self.pre / 'PREFLIGHT.txt').read_text()
        (self.pre / 'PREFLIGHT.txt').write_text(preflight.replace('result=PASS', 'result=FAIL'))
        self.assertIn('no passed preflight', self.prepare().stderr)
        (self.pre / 'PREFLIGHT.txt').write_text(preflight)
        self.assertIn('outside the repository', self.prepare(copy=self.repo / 'dist/copy').stderr)
        self.copy.mkdir(parents=True)
        self.assertIn('exists; a copy is never reused', self.prepare().stderr)
        self.assertFalse((self.pre / 'deploy-copy.txt').exists())

    def test_the_copy_refuses_a_visible_env_file_and_a_changed_library(self):
        (self.base / 'outside').mkdir()
        (self.base / 'outside/.env').write_text('KEY=never read\n')
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('.env exists at or above', result.stderr)
        (self.base / 'outside/.env').unlink()
        (self.repo / 'lib/openzeppelin-contracts/contracts/Source.sol').write_text('// changed\n')
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('dependency digest differs: openzeppelin-contracts/contracts', result.stderr)
        self.assertFalse((self.pre / 'deploy-copy.txt').exists())

    # ---- the broadcast ----

    def ready(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_a_confirmed_broadcast_with_the_right_password_runs_once(self):
        self.ready()
        code, output, terminal = self.broadcast('BROADCAST', 'wrong guess', PASSWORD)
        self.assertEqual(code, 0, output)
        self.assertEqual(terminal.count(PROMPT), 2)
        self.assertIn('broadcast: wrong password for', output)
        self.assertIn('the simulation equals the preflight plan: 2 creations', output)
        self.assertEqual(self.broadcasts(), 1)
        self.assertIn(f'--keystore {self.base / "deployer.json"} --password-file', self.log())
        self.assertIn('password file 0o600', self.log())
        self.assertIn(f'in {self.copy}', self.log())
        self.assertTrue((self.pre / 'broadcast/DeployV16.s.sol/84532/run-latest.json').is_file())
        self.assertEqual(json.loads((self.pre / 'deployments/latest-v16.json').read_text()), {'deployed': True})
        self.assertEqual(list((self.base / 'tmp').iterdir()), [])
        # The key never reaches the logs, nor stays in the RPC forge records in the copy; the preflight is used up.
        self.assertNotIn('0123456789abcdef0123', (self.pre / 'broadcast.log').read_text())
        self.assertIn('<rpc-url>', (self.pre / 'broadcast.log').read_text())
        self.assert_no_key_in_the_copy(2)
        self.assertIn('make -C ' + str(self.copy) + ' timelock-batches-v16', output)
        code, output, _ = self.broadcast('BROADCAST', PASSWORD)
        self.assertNotEqual(code, 0)
        self.assertIn('was broadcast already', output)
        self.assertEqual(self.broadcasts(), 1)

    def assert_no_key_in_the_copy(self, files):
        recorded = [path for path in (self.copy / 'cache').rglob('*.json')]
        self.assertEqual(len(recorded), files)
        for path in recorded:
            self.assertEqual(json.loads(path.read_text()), {'transactions': [{'rpc': '<rpc-url>'}]})

    def assert_refused(self, reason, env=None, answers=('BROADCAST', PASSWORD)):
        code, output, terminal = self.broadcast(*answers, env=env)
        self.assertNotEqual(code, 0, output)
        self.assertIn(reason, output)
        self.assertEqual(self.broadcasts(), 0)
        return terminal

    def test_refused_without_a_prepared_copy_or_with_changed_parameters(self):
        self.assert_refused('no deploy copy: run prepare_deploy_copy.sh first')
        self.ready()
        (self.copy / 'deploy-params.env').write_text(f'CHAIN_ID=84532\nDEPLOYER={DEPLOYER}\nEXTRA=1\n')
        self.assert_refused("deploy-params.env in the copy differs from the preflight's")

    def test_refused_when_a_env_file_is_visible_from_the_copy(self):
        self.ready()
        (self.copy / '.env').write_text('KEY=never read\n')
        self.assert_refused('a .env is visible from the deploy copy')
        (self.copy / '.env').unlink()
        (self.base / '.env').write_text('KEY=never read\n')
        self.assert_refused('a .env is visible from the deploy copy')

    def test_refused_on_a_delegated_deployer_a_wrong_nonce_or_a_pending_transaction(self):
        self.ready()
        terminal = self.assert_refused('the deployer has code (an EIP-7702 delegation?)',
                                       env={'STUB_CODE': '0xef0100' + '11' * 20})
        self.assertNotIn(CONFIRM, terminal)
        self.assert_refused("the deployer's nonce is not 7; run the preflight again", env={'STUB_NONCE': '8', 'STUB_PENDING': '8'})
        self.assert_refused('the deployer has a pending transaction', env={'STUB_PENDING': '8'})
        self.assert_refused('the RPC is not on chain 84532', env={'STUB_CHAIN': '8453'})

    def test_refused_when_the_simulation_differs_from_the_plan(self):
        self.ready()
        terminal = self.assert_refused('the simulation differs from the preflight plan; nothing was broadcast',
                                       env={'STUB_SIMULATION_DIFFERS': '1'})
        self.assertNotIn(CONFIRM, terminal)
        self.assert_no_key_in_the_copy(1)

    def test_refused_without_the_typed_confirmation_or_the_right_password(self):
        self.ready()
        terminal = self.assert_refused('not confirmed; nothing was broadcast', answers=('yes',))
        self.assertNotIn(PROMPT, terminal)
        self.assert_refused('broadcast: nothing was broadcast', answers=('BROADCAST', 'one', 'two', 'three'))
        self.assert_refused(f'the keystore holds 0x{"ab" * 20}, not DEPLOYER',
                            env={'STUB_KEYSTORE_ADDRESS': '0x' + 'ab' * 20})
        self.assertEqual(list((self.base / 'tmp').iterdir()), [])

    def test_refused_after_a_preflight_with_a_test_domain_file(self):
        self.ready()
        preflight = (self.pre / 'PREFLIGHT.txt').read_text()
        (self.pre / 'PREFLIGHT.txt').write_text(preflight.replace('domainOverride=no', 'domainOverride=yes'))
        self.assert_refused('the preflight used a test domain file (CALLBACK_DOMAIN_PATH)')
        (self.pre / 'PREFLIGHT.txt').write_text(preflight.replace('domainOverride=no\n', ''))
        self.assert_refused('the preflight used a test domain file (CALLBACK_DOMAIN_PATH)')
        (self.pre / 'PREFLIGHT.txt').write_text(preflight.replace('domainOverride=no', 'domainOverride=yes'))
        code, output, _ = self.broadcast('BROADCAST', PASSWORD, env={'BROADCAST_TEST_DOMAIN_OVERRIDE': '1'})
        self.assertEqual(code, 0, output)

    def test_refused_when_the_plan_changed_after_the_preflight(self):
        self.ready()
        self.plan.write_text(self.plan.read_text().replace('0x6080', '0x6081'))
        self.assert_refused('the preflight plan changed')


if __name__ == '__main__':
    unittest.main()
