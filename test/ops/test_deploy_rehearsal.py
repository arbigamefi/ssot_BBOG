"""test/fixtures/deploy-rehearsal.sh, the deployment path end to end on a public Base Sepolia fork (plan A5).

Running it needs anvil and the public RPC, so these checks are static: it drives the repository's own scripts without
any key, and the preflight line its failure injection rewrites is still where the injection expects it.
"""
import os
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
REHEARSAL = ROOT / 'test/fixtures/deploy-rehearsal.sh'
ANCHOR = '\n  for _ in $(seq 120); do\n'


class DeployRehearsalTests(unittest.TestCase):
    def test_the_rehearsal_drives_the_repository_scripts_without_keys(self):
        script = REHEARSAL.read_text()
        self.assertTrue(os.access(REHEARSAL, os.X_OK))
        for step in ('preflight=script/release/run_preflight.sh', 'script/release/prepare_deploy_copy.sh',
                     'script/release/broadcast_v16.sh', 'make -C "$C" timelock-batches-v16',
                     'script/release/verify_governance.py', '--fork-url https://sepolia.base.org'):
            self.assertIn(step, script)
        for absent in ('with-ops-rpc', 'API_KEY', 'PROD_KEEPER', '.env'):
            self.assertNotIn(absent, script)

    def test_the_failure_injection_lands_after_the_fork_starts_and_before_the_deployment(self):
        self.assertIn(repr(ANCHOR).replace("'", '"'), REHEARSAL.read_text())
        preflight = (ROOT / 'script/release/run_preflight.sh').read_text()
        self.assertEqual(preflight.count(ANCHOR), 1)
        start = preflight.index('\nrehearse() {')
        self.assertLess(start, preflight.index(ANCHOR))
        self.assertLess(preflight.index(ANCHOR), preflight.index('forge script script/DeployV16.s.sol:DeployV16', start))


if __name__ == '__main__':
    unittest.main()
