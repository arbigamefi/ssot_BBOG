"""test/fixtures/deploy-rehearsal.sh and drive_terminal.py: the deploy manual's steps on a public Base Sepolia fork
(plan A5).

A real run needs anvil and the public RPC (about two minutes a path), so these checks stop short of that. Statically:
the script drives the repository's own scripts without any key, and the preflight line its failure injection rewrites
is still where the injection expects it. Executably, with every tool and release script a stub: inherited endpoints,
wallets and Foundry settings never reach a step, every step that reads an endpoint gets the local fork under both
names, Foundry runs outside the repository, an output inside the repository is refused, and a fork that ignores TERM
is still stopped. The terminal driver: prompts, exit codes, the timeout under continuous output and the cleanup of the
command's process group.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASH = '/bin/bash' if Path('/bin/bash').exists() else shutil.which('bash')
REHEARSAL = ROOT / 'test/fixtures/deploy-rehearsal.sh'
DRIVER = ROOT / 'test/fixtures/drive_terminal.py'
ANCHOR = '\n  for _ in $(seq 120); do\n'


class DeployRehearsalTests(unittest.TestCase):
    def test_the_rehearsal_drives_the_repository_scripts_without_keys(self):
        script = REHEARSAL.read_text()
        self.assertTrue(os.access(REHEARSAL, os.X_OK))
        for step in ('preflight=script/release/run_preflight.sh', 'script/release/prepare_deploy_copy.sh',
                     'script/release/broadcast_v16.sh', 'make -C "$C" timelock-batches-v16',
                     'script/release/verify_governance.py', '--fork-url https://sepolia.base.org'):
            self.assertIn(step, script)
        code = '\n'.join(line for line in script.splitlines() if not line.lstrip().startswith('#'))
        for absent in ('with-ops-rpc', 'API_KEY', 'PROD_KEEPER', '.env'):
            self.assertNotIn(absent, code)

    def test_an_output_inside_the_repository_is_refused_before_anything_starts(self):
        # prepare_deploy_copy.sh would refuse the copy only after the preflight; without Foundry on the PATH a
        # rehearsal that went on could not start a fork either.
        inside = ROOT / 'deployments' / f'rehearsal-refusal-{os.getpid()}'
        path = os.pathsep.join((str(Path(sys.executable).parent), '/usr/bin', '/bin'))
        result = subprocess.run([BASH, str(REHEARSAL), str(inside)], capture_output=True, text=True, timeout=60,
                                env={**os.environ, 'PATH': path})
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('the output must be outside the repository', result.stderr)
        self.assertFalse(inside.exists())

    def test_the_failure_injection_lands_after_the_fork_starts_and_before_the_deployment(self):
        self.assertIn(repr(ANCHOR).replace("'", '"'), REHEARSAL.read_text())
        preflight = (ROOT / 'script/release/run_preflight.sh').read_text()
        self.assertEqual(preflight.count(ANCHOR), 1)
        start = preflight.index('\nrehearse() {')
        self.assertLess(start, preflight.index(ANCHOR))
        self.assertLess(preflight.index(ANCHOR), preflight.index('forge script script/DeployV16.s.sol:DeployV16', start))


RECORDER = """import json, os, sys
from pathlib import Path
KEYS = ('RPC_URL', 'OPS_RPC_URL', 'ETH_RPC_URL', 'FOUNDRY_ETH_RPC_URL', 'FOUNDRY_PROFILE', 'DEPLOY_ACCOUNT',
        'DEPLOY_KEYSTORE', 'CALLBACK_DOMAIN_PATH', 'BROADCAST_TEST_DOMAIN_OVERRIDE', 'SNAPSHOT_PATH', 'STUB_CANARY')
def record(base, tool, args):
    with open(Path(base) / 'calls.jsonl', 'a') as log:
        log.write(json.dumps({'tool': tool, 'args': args, 'cwd': os.getcwd(),
                              'env': {key: os.environ.get(key) for key in KEYS}}) + '\\n')
if __name__ == '__main__':
    record(Path(__file__).resolve().parent, sys.argv[1], sys.argv[2:])
"""
# Foundry stubs; the rehearsal keeps only PATH, HOME, USER, LOGNAME, TMPDIR and LANG, so they find their base by path.
TOOL = """#!/usr/bin/env python3
import json, os, signal, sys, time
from pathlib import Path
base = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base))
from record import record
tool, args = Path(sys.argv[0]).name, sys.argv[1:]
record(base, tool, args)
if tool == 'anvil':
    (base / 'anvil.pid').write_text(str(os.getpid()))
    if (base / 'anvil-ignores-term').exists():
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    time.sleep(120)
elif tool == 'forge':
    print(json.dumps({'deployedTo': '0x' + ('11' if args[-1] == '11' else '21') * 20}))
elif args[:1] == ['chain-id']:
    print(84532)
elif args[:2] == ['wallet', 'address']:
    print('0x' + '01' * 20)
elif args[:2] == ['wallet', 'new']:
    (Path(args[2]) / 'stub-keystore').write_text('{}')
else:
    print('true')
"""
PREFLIGHT = """#!/usr/bin/env bash
base=$(cd "$(dirname "$0")/../../.." && pwd)
python3 "$base/record.py" preflight "$@" || exit 9
[ ! -e "$base/preflight-fails" ] || exit 1
mkdir -p "$3" && printf 'rehearsal\\t0\\t1s\\n' > "$3/STAGES.tsv"
"""
COPY = """#!/usr/bin/env bash
base=$(cd "$(dirname "$0")/../../.." && pwd)
python3 "$base/record.py" copy "$@" || exit 9
copy=$2
mkdir -p "$copy/cache" "$copy/deployments" "$copy/script/release"
echo '{"rpc": "<rpc-url>"}' > "$copy/cache/run-latest.json"
printf 'timelock-batches-v16:\\n\\t@python3 %s make-timelock-batches-v16\\n' "$base/record.py" > "$copy/Makefile"
echo '{"governanceTimelock": "0x00000000000000000000000000000000000000aa"}' > "$copy/deployments/latest-v16.json"
echo '{"transactions": [{"data": "0x01"}]}' > "$copy/deployments/safe-schedule-wiring-v16.json"
echo '{"operations": [{"name": "wiring", "executeCalldata": "0x02"}]}' > "$copy/deployments/timelock-operations-v16.json"
printf 'import subprocess, sys\\nsubprocess.run([sys.executable, "%s", "verify-governance"], check=True)\\n' "$base/record.py" \\
  > "$copy/script/release/verify_governance.py"
"""
BROADCAST = """#!/usr/bin/env bash
base=$(cd "$(dirname "$0")/../../.." && pwd)
python3 "$base/record.py" broadcast "$@" || exit 9
printf 'Type BROADCAST to continue: '; read -r answer; [ "$answer" = BROADCAST ] || exit 3
printf 'Keystore password for the deployer: '; read -r password; [ -n "$password" ] || exit 4
"""
CANARIES = {'OPS_RPC_URL': 'https://ops.invalid/STUB_CANARY', 'RPC_URL': 'https://inherited.invalid/STUB_CANARY',
            'ETH_RPC_URL': 'https://eth.invalid/STUB_CANARY', 'FOUNDRY_ETH_RPC_URL': 'https://foundry.invalid/STUB_CANARY',
            'FOUNDRY_PROFILE': 'STUB_CANARY_profile', 'DEPLOY_ACCOUNT': 'STUB_CANARY_account',
            'DEPLOY_KEYSTORE': '/STUB_CANARY/keystore', 'STUB_CANARY': 'STUB_CANARY'}


class RehearsalIsolationTests(unittest.TestCase):
    """The real rehearsal script in a scratch repository whose release scripts and Foundry tools are stubs."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(self.directory.name)
        self.repo, self.out = self.base / 'repo', self.base / 'out'
        files = {'test/fixtures/deploy-rehearsal.sh': REHEARSAL.read_text(), 'test/fixtures/drive_terminal.py':
                 DRIVER.read_text(), 'deps.lock': (ROOT / 'deps.lock').read_text(),
                 'script/release/first-callback-domain-84532.json':
                     (ROOT / 'script/release/first-callback-domain-84532.json').read_text(),
                 'script/release/run_preflight.sh': PREFLIGHT, 'script/release/prepare_deploy_copy.sh': COPY,
                 'script/release/broadcast_v16.sh': BROADCAST,
                 # A Foundry tool run inside the repository would see this file.
                 '.env': 'ETH_RPC_URL=https://dotenv.invalid/STUB_CANARY\n'}
        for name, text in files.items():
            (self.repo / name).parent.mkdir(parents=True, exist_ok=True)
            (self.repo / name).write_text(text)
            (self.repo / name).chmod(0o755)
        (self.base / 'record.py').write_text(RECORDER)
        (self.base / 'bin').mkdir()
        for tool in ('anvil', 'cast', 'forge'):
            (self.base / 'bin' / tool).write_text(TOOL)
            (self.base / 'bin' / tool).chmod(0o755)

    def tearDown(self):
        pid = self.base / 'anvil.pid'
        if pid.exists():
            try:
                os.kill(int(pid.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.directory.cleanup()

    def rehearse(self):
        env = {**os.environ, **CANARIES, 'PATH': f"{self.base / 'bin'}{os.pathsep}{os.environ['PATH']}"}
        result = subprocess.run([BASH, str(self.repo / 'test/fixtures/deploy-rehearsal.sh'), str(self.out)], env=env,
                                capture_output=True, text=True, timeout=120)
        calls = [json.loads(line) for line in (self.base / 'calls.jsonl').read_text().splitlines()]
        return result, calls

    def assert_anvil_stopped(self):
        pid = int((self.base / 'anvil.pid').read_text())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_inherited_endpoints_wallets_and_settings_never_reach_a_step(self):
        result, calls = self.rehearse()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(result.stdout.rstrip().endswith('E2E PASS'))
        recorded = [[c['cwd'], *c['args'], *c['env'].values()] for c in calls]
        self.assertNotIn('STUB_CANARY', json.dumps(recorded))
        out = str(self.out.resolve())
        rpc = {c['env']['RPC_URL'] for c in calls if c['tool'] in ('preflight', 'broadcast', 'make-timelock-batches-v16',
                                                                     'verify-governance')}
        self.assertEqual(len(rpc), 1)
        local = rpc.pop()
        self.assertRegex(local, r'^http://127\.0\.0\.1:\d+$')
        steps = {}
        for call in calls:
            if call['tool'] in ('preflight', 'broadcast', 'make-timelock-batches-v16', 'verify-governance'):
                steps[call['tool']] = call
                self.assertEqual((call['env']['RPC_URL'], call['env']['OPS_RPC_URL']), (local, local), call['tool'])
        self.assertEqual(sorted(steps), ['broadcast', 'make-timelock-batches-v16', 'preflight', 'verify-governance'])
        self.assertTrue(os.path.realpath(steps['broadcast']['env']['DEPLOY_KEYSTORE']).startswith(out + '/keys/'))
        foundry = [c for c in calls if c['tool'] in ('anvil', 'cast', 'forge')]
        self.assertTrue(any(c['tool'] == 'forge' for c in foundry) and any(c['tool'] == 'anvil' for c in foundry))
        for call in foundry:
            # Run from the output directory, where the scratch repository's .env is not visible.
            self.assertEqual(call['cwd'], out, call)
            args = call['args']
            for i, arg in enumerate(args):
                if arg == '--rpc-url':
                    self.assertEqual(args[i + 1], local, call)
            if call['tool'] == 'forge':
                self.assertEqual(os.path.realpath(args[args.index('--root') + 1]), str(self.repo.resolve()))
            if call['tool'] == 'anvil':
                self.assertEqual(args[args.index('--fork-url') + 1], 'https://sepolia.base.org')
        self.assert_anvil_stopped()

    def test_a_fork_that_ignores_term_is_still_stopped(self):
        (self.base / 'anvil-ignores-term').touch()
        (self.base / 'preflight-fails').touch()
        result, _ = self.rehearse()
        self.assertEqual(result.returncode, 1)
        self.assertIn('PREFLIGHT FAILED', result.stdout)
        self.assert_anvil_stopped()


class DriveTerminalTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(self.directory.name)
        self.answers = self.base / 'answers.json'
        self.answers.write_text(json.dumps([['Type BROADCAST', 'BROADCAST'], ['Keystore password', 'secret']]))
        self.processes = []

    def tearDown(self):
        # A failing driver may leave itself or its command running: stop both before the directory goes.
        for process in self.processes:
            if process.poll() is None:
                process.kill()
                process.communicate()
        pid_file = self.base / 'child.pid'
        if pid_file.exists() and pid_file.read_text():
            try:
                os.kill(int(pid_file.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.directory.cleanup()

    def drive(self, code, timeout=None, grace=None):
        env = dict(os.environ)
        if timeout is not None:
            env['DRIVE_TERMINAL_TIMEOUT_SECONDS'] = str(timeout)
        if grace is not None:
            env['DRIVE_TERMINAL_GRACE_SECONDS'] = str(grace)
        process = subprocess.Popen([sys.executable, '-I', str(DRIVER), str(self.answers), sys.executable, '-c', code],
                                   env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.processes.append(process)
        return process

    def child_gone(self, pid_file):
        pid = int(pid_file.read_text())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_fragmented_prompts_are_answered_and_the_exit_code_is_kept(self):
        process = self.drive("import sys, time\nprint('Type BRO', end='', flush=True); time.sleep(0.05)\n"
                             "print('ADCAST', flush=True); assert input() == 'BROADCAST'\n"
                             "print('Keystore password', flush=True); assert input() == 'secret'\nsys.exit(7)")
        process.communicate(timeout=30)
        self.assertEqual(process.returncode, 7)

    def test_a_command_that_exits_0_without_asking_fails(self):
        process = self.drive('pass')
        _, err = process.communicate(timeout=30)
        self.assertEqual(process.returncode, 1)
        self.assertIn('without asking', err)

    def test_a_command_ended_by_a_signal_exits_128_plus_the_signal(self):
        process = self.drive('import os, signal; os.kill(os.getpid(), signal.SIGTERM)')
        process.communicate(timeout=30)
        self.assertEqual(process.returncode, 128 + signal.SIGTERM)

    def test_the_timeout_holds_while_output_keeps_coming_and_stops_the_command(self):
        pid_file = self.base / 'child.pid'
        start = time.monotonic()
        process = self.drive(f"import os, time\nopen({str(pid_file)!r}, 'w').write(str(os.getpid()))\n"
                             "while True:\n    print('x', flush=True); time.sleep(0.01)", timeout=1)
        _, err = process.communicate(timeout=30)
        self.assertEqual(process.returncode, 124)
        self.assertIn('timeout', err)
        self.assertLess(time.monotonic() - start, 10)
        self.child_gone(pid_file)

    def test_a_command_that_ignores_hup_and_term_is_killed(self):
        pid_file = self.base / 'child.pid'
        process = self.drive("import os, signal, time\nfor s in (signal.SIGHUP, signal.SIGTERM): signal.signal(s, signal.SIG_IGN)\n"
                             f"open({str(pid_file)!r}, 'w').write(str(os.getpid()))\ntime.sleep(60)", timeout=1, grace=0.5)
        process.communicate(timeout=30)
        self.assertEqual(process.returncode, 124)
        self.child_gone(pid_file)

    def test_a_term_to_the_driver_stops_the_command(self):
        pid_file = self.base / 'child.pid'
        process = self.drive(f"import os, time\nopen({str(pid_file)!r}, 'w').write(str(os.getpid()))\ntime.sleep(60)")
        for _ in range(100):
            if pid_file.exists() and pid_file.read_text():
                break
            time.sleep(0.05)
        process.send_signal(signal.SIGTERM)
        process.communicate(timeout=30)
        self.assertEqual(process.returncode, 128 + signal.SIGTERM)
        self.child_gone(pid_file)


if __name__ == '__main__':
    unittest.main()
