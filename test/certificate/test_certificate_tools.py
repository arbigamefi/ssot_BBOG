"""script/certificate on this checkout's build: each stage fails closed when its inputs, anchors or bindings drift.

Needs this checkout's build in out/ (forge build src) and the solc pinned in deps.lock; CI runs it after the unit
tests have built the project. The module stage itself is too slow for a test; its job function is exercised on the
two cheapest modules.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CERT = ROOT / 'script/certificate'
sys.path.insert(0, str(CERT / 'protocol'))
import frame_bound as F  # noqa: E402
import frames  # noqa: E402

TMP = None
OUT = None


def setUpModule():
    """One certificate directory without the module stage, shared by every test (about 30 seconds)."""
    global TMP, OUT
    TMP = tempfile.TemporaryDirectory()
    OUT = Path(TMP.name) / 'certificate'
    run([str(CERT / 'certify.py'), str(OUT), '--stages', 'build,frames,tree,ledger,bindings'])


def tearDownModule():
    TMP.cleanup()


def run(argv, cwd=None, check=True):
    env = {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1', 'HOME': str(Path.home()),
           'CERTIFICATE_ROOT': str(ROOT)}
    if 'XDG_DATA_HOME' in os.environ:          # where script/ci/install_solc.sh put the pinned solc on Linux
        env['XDG_DATA_HOME'] = os.environ['XDG_DATA_HOME']
    proc = subprocess.run([sys.executable, *argv], cwd=cwd, capture_output=True, text=True, env=env)
    if check and proc.returncode:
        raise AssertionError(f'{argv} failed:\n{proc.stdout}\n{proc.stderr}')
    return proc


def copy_stage(name):
    work = Path(TMP.name) / f'{name}-{len(list(Path(TMP.name).iterdir()))}'
    shutil.copytree(OUT / name, work)
    return work


def gamehub():
    return frames.Contract(OUT / 'build', 'GameHub')


class GameHubFrames(unittest.TestCase):
    def child(self, c, returns, params_length=64):
        calls, params = frames.gamehub_child_anchors(c)
        return c.frame('finalizeFromCallback(uint256,uint256)', [F.U, F.U],
                       {calls[k]: v for k, v in returns.items()}, sloads={params: 2 * params_length + 1})

    def test_child_anchors_are_the_six_calls_in_program_order(self):
        c = gamehub()
        calls, params = frames.gamehub_child_anchors(c)
        self.assertEqual(list(calls), ['module.resolve', 'Bank.minPlayerTurnoverForUnlock', 'Bank.playerTurnover',
                                       'engine.allocate', 'Router.settlePosition', 'VRFHub.acknowledge'])
        self.assertEqual(sorted(calls.values()), list(calls.values()))
        self.assertEqual(c.ops[params][0], frames.SLOAD)

    def test_a_call_without_a_model_aborts(self):
        returns = frames.gamehub_child_returns(3)
        del returns['engine.allocate']
        with self.assertRaisesRegex(RuntimeError, 'unmodelled call'):
            self.child(gamehub(), returns)

    def test_child_bound_grows_with_every_award(self):
        c = gamehub()
        totals = [self.child(c, frames.gamehub_child_returns(n)).total() for n in range(4)]
        self.assertEqual(totals, sorted(set(totals)))
        recorded = json.loads((OUT / 'protocol/frame-bounds.json').read_text())['GameHub']['finalizeFromCallback']
        self.assertEqual(recorded['total'], max(totals))

    def test_a_short_return_cannot_be_copied_past_its_end(self):
        returns = frames.gamehub_child_returns(3)
        returns['engine.allocate'] = [F.U] * 6 + [0xe0, 3] + [F.U] * 6   # claims three awards, returns one
        self.assertEqual(self.child(gamehub(), returns).total(), float('-inf'))

    def test_outer_frame_has_one_snapshot_before_its_only_self_call(self):
        outer = json.loads((OUT / 'protocol/frame-bounds.json').read_text())['GameHub']['onRandomWords']
        c = gamehub()
        self.assertEqual(c.ops[outer['gasSnapshotPc']][0], frames.GAS)
        self.assertEqual(c.ops[outer['selfCallPc']][0], frames.CALL)
        self.assertLess(outer['gasSnapshotPc'], outer['selfCallPc'])

    def test_immutables_are_unknown_and_the_token_marker_is_counted(self):
        bounds = json.loads((OUT / 'protocol/frame-bounds.json').read_text())
        self.assertEqual(bounds['Bank']['settleBetTokenCalls']['balanceOf'], 6)
        self.assertEqual(bounds['LiquidityVault']['applySettlementTokenCalls']['balanceOfWith_transferFrom'], 3)
        c = frames.Contract(OUT / 'build', 'Bank')
        self.assertTrue(c.immutables() and all(v == F.U for v in c.immutables().values()))


class TreeAnchors(unittest.TestCase):
    def mutate(self, script, old, new):
        work = copy_stage('tree')
        text = (work / script).read_text()
        self.assertIn(old, text)
        (work / script).write_text(text.replace(old, new, 1))
        return run([script], cwd=work, check=False)

    def test_reference_run_passes(self):
        work = copy_stage('tree')
        for script in ['analyze_prefix_segments.py', 'analyze_query_segments.py', 'suffix-skip-joint-dp.py']:
            run([script], cwd=work)
        self.assertEqual(json.loads((work / 'suffix-skip-tree-component.json').read_text()),
                         json.loads((OUT / 'tree/suffix-skip-tree-component.json').read_text()))

    def test_a_moved_branch_anchor_fails(self):
        proc = self.mutate('analyze_query_segments.py', "Q(36,'jump')", "Q(37,'jump')")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('AssertionError', proc.stderr)

    def test_a_moved_loop_head_fails(self):
        proc = self.mutate('analyze_prefix_segments.py', "head('fun_prefixCovers',54)", "head('fun_prefixCovers',55)")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('AssertionError', proc.stderr)

    def test_another_runtime_fails(self):
        work = copy_stage('tree')
        identity = json.loads((work / 'compiler-identity.json').read_text())
        identity['runtimeSha256'] = '0' * 64
        (work / 'compiler-identity.json').write_text(json.dumps(identity))
        proc = run(['analyze_query_segments.py'], cwd=work, check=False)
        self.assertNotEqual(proc.returncode, 0)


class Ledger(unittest.TestCase):
    def test_split_matches_the_components(self):
        ledger = json.loads((OUT / 'ledger/ledger.json').read_text())
        self.assertEqual(ledger['frameSplit']['bankStorage'], ledger['storage']['Bank']['envelope'])
        self.assertEqual(ledger['frameSplitTotal'], sum(ledger['frameSplit'].values()))

    def test_a_player_account_over_two_slots_fails(self):
        build = Path(TMP.name) / 'build-two-slots'
        shutil.copytree(OUT / 'build', build)
        path = build / 'Bank-solc-output.json'
        o = json.loads(path.read_text())
        layout = o['contracts']['src/core/Bank.sol']['Bank']['storageLayout']
        struct = next(t for name, t in layout['types'].items() if 'PlayerAccount' in name and 'members' in t)
        struct['members'][1].update(slot='1', offset=0)
        struct['numberOfBytes'] = '64'
        path.write_text(json.dumps(o))
        proc = run([str(CERT / 'ledger/ledger.py'), str(build), str(Path(TMP.name) / 'ledger.json')], check=False)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('AssertionError', proc.stderr)


class Bindings(unittest.TestCase):
    def bind(self, reused, domain):
        work = Path(tempfile.mkdtemp(dir=TMP.name))
        (work / 'reused.json').write_text(json.dumps(reused))
        (work / 'domain.json').write_text(json.dumps(domain))
        return run([str(CERT / 'bindings/bindings.py'), str(OUT / 'build'), str(work / 'domain.json'),
                    str(work / 'reused.json'), str(work / 'bindings.json')], check=False)

    def inputs(self):
        return (json.loads((CERT / 'reused.json').read_text()),
                json.loads((ROOT / 'script/release/first-callback-domain-84532.json').read_text()))

    def test_current_inputs_bind(self):
        self.assertEqual(self.bind(*self.inputs()).returncode, 0)

    def test_a_changed_module_voids_its_static_bound(self):
        reused, domain = self.inputs()
        reused['staticModuleBounds']['executableSha256']['KenoModule'] = '0' * 64
        proc = self.bind(reused, domain)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('no longer matches', proc.stderr)

    def test_another_token_voids_the_token_bodies(self):
        reused, domain = self.inputs()
        domain['token']['implementationRuntimeSha256'] = '0' * 64
        self.assertNotEqual(self.bind(reused, domain).returncode, 0)


class Composition(unittest.TestCase):
    def certificate(self, rounds_ok=True, bindings_ok=True):
        work = Path(tempfile.mkdtemp(dir=TMP.name))
        for name in ['protocol', 'tree', 'ledger', 'bindings']:
            shutil.copytree(OUT / name, work / name)
        shutil.copy2(OUT / 'reused.json', work / 'reused.json')
        (work / 'modules').mkdir()
        bounds = {'CoinTossModule': 24857, 'KenoModule': 206201}
        (work / 'modules/module-bounds.json').write_text(json.dumps({m: {'bound': b} for m, b in bounds.items()}))
        (work / 'modules/module-rounds.json').write_text(json.dumps(
            {m: {'nonDecreasing': rounds_ok, 'maximumAt25': True} for m in bounds}))
        if not bindings_ok:
            b = json.loads((work / 'bindings/component-bindings.json').read_text())
            b['allBindingsHold'] = False
            (work / 'bindings/component-bindings.json').write_text(json.dumps(b))
        return run([str(CERT / 'composition.py'), str(work)], check=False), work

    def test_closes_with_the_floor(self):
        proc, work = self.certificate()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        out = json.loads((work / 'composition.json').read_text())
        self.assertEqual(out['status'], 'CLOSES_PENDING_INDEPENDENT_REVIEW')
        self.assertGreaterEqual(out['measures'][0]['margin'], out['marginFloor'])

    def test_a_decreasing_module_bound_refuses(self):
        proc, _ = self.certificate(rounds_ok=False)
        self.assertIn('M7 fails', proc.stderr)

    def test_broken_bindings_refuse(self):
        proc, _ = self.certificate(bindings_ok=False)
        self.assertIn('bindings do not hold', proc.stderr)


class Certify(unittest.TestCase):
    def test_an_existing_directory_is_never_overwritten(self):
        proc = run([str(CERT / 'certify.py'), str(OUT)], check=False)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('exists', proc.stderr)

    def test_module_jobs_reproduce_the_v4_bounds(self):
        work = Path(tempfile.mkdtemp(dir=TMP.name))
        shutil.copy2(CERT / 'modules/pure_module_bound.py', work)
        shutil.copy2(CERT / 'modules/module_bounds.py', work)
        merged = {'contracts': {}}
        for name in ['CoinTossModule', 'DiceModule']:
            o = json.loads((OUT / f'build/{name}-solc-output.json').read_text())
            for src, cs in o['contracts'].items():
                if name in cs:
                    merged['contracts'].setdefault(src, {})[name] = cs[name]
        (work / 'modules-solc-output.json').write_text(json.dumps(merged))
        for name, plen, bound in [('CoinTossModule', 32, 24857), ('DiceModule', 64, 36007)]:
            proc = run(['module_bounds.py', 'job', name, '25', str(plen)], cwd=work)
            self.assertEqual(json.loads(proc.stdout)['bound'], bound)


if __name__ == '__main__':
    unittest.main()
