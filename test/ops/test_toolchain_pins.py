import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'v1.8.5'
COMMIT = '51a52c59cffd940f76eddd0b4bb1791aa4b5ac7f'


class ToolchainPinTest(unittest.TestCase):
    """check_toolchain.py accepts only the Foundry release in deps.lock, in workflows and on PATH."""

    def setUp(self):
        self.tree = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tree)
        (self.tree / 'script/ci').mkdir(parents=True)
        shutil.copy(ROOT / 'script/ci/check_toolchain.py', self.tree / 'script/ci/check_toolchain.py')
        (self.tree / 'deps.lock').write_text(f'FOUNDRY_VERSION={VERSION}\nFOUNDRY_COMMIT={COMMIT}\n')
        (self.tree / '.github/workflows').mkdir(parents=True)
        self.bin = self.tree / 'bin'
        self.bin.mkdir()

    def workflow(self, version):
        (self.tree / '.github/workflows/ci.yml').write_text(
            'jobs:\n  test:\n    steps:\n      - name: Install Foundry\n'
            '        uses: foundry-rs/foundry-toolchain@v1\n        with:\n'
            f'          version: {version} # pinned\n      - name: Build\n        run: forge build\n')

    def tools(self, version):
        for tool in ('forge', 'cast', 'anvil'):
            path = self.bin / tool
            path.write_text(f'#!/bin/sh\necho "{tool} Version: {version}"\necho "Commit SHA: {COMMIT}"\n')
            path.chmod(0o755)

    def check(self):
        env = {**os.environ, 'PATH': f'{self.bin}{os.pathsep}/usr/bin{os.pathsep}/bin'}
        return subprocess.run([sys.executable, str(self.tree / 'script/ci/check_toolchain.py')],
                              capture_output=True, text=True, env=env, check=False)

    def test_matching_pins_and_tools_pass(self):
        self.workflow(VERSION)
        self.tools(VERSION.lstrip('v'))
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_other_workflow_pin_is_refused(self):
        self.workflow('v1.5.1')
        self.tools(VERSION.lstrip('v'))
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn('.github/workflows/ci.yml:5 pins Foundry v1.5.1', result.stderr)

    def test_other_installed_release_is_refused(self):
        self.workflow(VERSION)
        self.tools('1.8.4')
        result = self.check()
        self.assertEqual(result.returncode, 1)
        for tool in ('forge', 'cast', 'anvil'):
            self.assertIn(f"{tool} reports '{tool} Version: 1.8.4'", result.stderr)

    def test_unpinned_step_is_refused(self):
        (self.tree / '.github/workflows/ci.yml').write_text(
            'jobs:\n  test:\n    steps:\n      - uses: foundry-rs/foundry-toolchain@v1\n      - run: forge build\n')
        self.tools(VERSION.lstrip('v'))
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn('pins Foundry None', result.stderr)

    def test_repository_pins_match_deps_lock(self):
        lock = dict(line.split('=', 1) for line in (ROOT / 'deps.lock').read_text().splitlines()
                    if '=' in line and not line.startswith('#'))
        self.assertEqual(lock['FOUNDRY_VERSION'], VERSION)
        self.assertEqual(lock['FOUNDRY_COMMIT'], COMMIT)
        self.assertIn('--enable-tx-gas-limit', lock['ANVIL_ARGS'].split())


if __name__ == '__main__':
    unittest.main()
