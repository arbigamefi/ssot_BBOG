"""Run deployment entrypoints in an isolated host fixture; Docker calls are recorded."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'frontend/deploy/docker', self.root / 'deploy/docker', ignore=shutil.ignore_patterns('*.env'))
        shutil.copy(ROOT / 'frontend/compose.production.yml', self.root)
        self.env_dir = self.root / 'deploy/docker/env'
        values = {
            'postgres.env': 'POSTGRES_DB=arbigamefi\n',
            'web.production.env': 'NEXT_PUBLIC_CHAIN_ID=84532\nBET_INDEX_DATABASE_URL=postgres://user:password@postgres:5432/arbigamefi\n',
            'keeper.primary.env': 'KEEPER_CHAIN_ID=84532\nKEEPER_RELEASE_PATH=/app/frontend/packages/ssot/src/release/embedded/chain-84532.json\nBET_INDEX_DATABASE_URL=postgres://user:password@postgres:5432/arbigamefi\n',
            'proxy.env': 'ARBGAMEFI_DOMAIN=arbigamefi.com\n',
        }
        for name, value in values.items():
            (self.env_dir / name).write_text(value)
        (self.root / 'bin').mkdir()
        docker = self.root / 'bin/docker'
        docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_LOG"\n')
        docker.chmod(0o700)
        self.env = {**os.environ, 'PATH': str(self.root / 'bin') + os.pathsep + os.environ['PATH'],
                    'DOCKER_LOG': str(self.root / 'docker.log'), 'DEPLOY_CHAIN_ID': '84532',
                    'EXPECTED_REVISION': 'a' * 40, 'EXPECTED_RELEASE_DIGEST': '0x' + '1' * 64,
                    'WEB_IMAGE': 'ghcr.io/arbigamefi/ssot-bbog-web@sha256:' + 'b' * 64,
                    'KEEPER_IMAGE': 'ghcr.io/arbigamefi/ssot-bbog-keeper@sha256:' + 'c' * 64}

    def run_script(self, name):
        return subprocess.run(['bash', 'deploy/docker/' + name], cwd=self.root, env=self.env, capture_output=True, text=True)

    def test_only_selected_keeper_env_required(self):
        result = self.run_script('check-production-env.sh')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_wrong_chain_release_path_and_health_override_rejected_before_docker(self):
        for name, line in [('web.production.env', 'NEXT_PUBLIC_CHAIN_ID=8453'),
                           ('keeper.primary.env', 'KEEPER_CHAIN_ID=8453'),
                           ('keeper.primary.env', 'KEEPER_RELEASE_PATH=/wrong.json'),
                           ('web.production.env', 'KEEPER_HEALTH_PATH_84532=/old.json')]:
            with self.subTest(line=line):
                path = self.env_dir / name
                original = path.read_text()
                path.write_text(original + line + '\n')
                result = self.run_script('deploy-images.sh')
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.root / 'docker.log').exists())
                path.write_text(original)

    def test_image_rejection_precedes_service_changes(self):
        # Stand-in for the separately tested image probe; exercise the shell boundary.
        (self.root / 'deploy/docker/check-release-images.py').write_text('raise SystemExit(1)\n')
        result = self.run_script('deploy-images.sh')
        self.assertNotEqual(result.returncode, 0)
        calls = (self.root / 'docker.log').read_text()
        self.assertIn('pull postgres caddy web keeper-primary', calls)
        self.assertNotIn(' up ', calls)
        self.assertNotIn('keeper-testnet', calls)

    def test_success_starts_one_keeper(self):
        (self.root / 'deploy/docker/check-release-images.py').write_text('pass\n')
        result = self.run_script('deploy-images.sh')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = (self.root / 'docker.log').read_text()
        self.assertIn('up -d --no-build --pull never postgres web keeper-primary caddy', calls)
        self.assertNotIn('keeper-testnet', calls)


if __name__ == '__main__':
    unittest.main()
