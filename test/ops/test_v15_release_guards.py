"""Exercise v1.5 release boundaries with real entrypoints and synthetic artifacts."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("image_guard", ROOT / "frontend/deploy/docker/check-release-images.py")
GUARD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GUARD)
REVISION = "a" * 40
DIGEST = "0x" + "1" * 64
REAL_CHECK_OUTPUT = subprocess.check_output


def manifest(chain):
    return {"chainId": chain, "releaseDigest": DIGEST,
            "meta": {"releaseLock": {"schema": "SSOT_RELEASE_DIGEST_V15", "chainId": chain, "digest": DIGEST}},
            "contracts": {"gameHub": "0x" + "2" * 40}, "assets": [{"bank": "0x" + "3" * 40}]}


class ImageGuardTests(unittest.TestCase):
    def setUp(self):
        self.manifests = {str(chain): manifest(chain) for chain in (8453, 84532)}
        self.image_revision = REVISION
        self.probe_calls = 0

    def docker(self, args, **kwargs):
        if args[:3] == ["docker", "image", "inspect"]:
            return json.dumps([{"Config": {"Labels": {"org.opencontainers.image.revision": self.image_revision}}}]).encode()
        self.assertEqual(args[:8], ["docker", "run", "--rm", "--read-only", "--network", "none", "--entrypoint", "node"])
        self.probe_calls += 1
        # Execute the actual image probe against a virtual public manifest filesystem.
        prelude = "const data=" + json.dumps(self.manifests) + ";require('node:fs').readFileSync=(p)=>JSON.stringify(data[p.match(/chain-(\\d+)/)[1]]);\n"
        return REAL_CHECK_OUTPUT(["node", "-e", prelude + args[-1]], stderr=subprocess.DEVNULL)

    def test_valid_images_agree_on_both_chains(self):
        with patch.object(GUARD.subprocess, "check_output", self.docker):
            rows = GUARD.check("image", REVISION)
        self.assertEqual([row["chainId"] for row in rows], [8453, 84532])

    def test_wrong_revision_rejected_before_running_container(self):
        self.image_revision = "b" * 40
        with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(ValueError):
            GUARD.check("image", REVISION)
        self.assertEqual(self.probe_calls, 0)

    def test_old_schema_or_digest_mismatch_rejected_by_actual_probe(self):
        for field, value in [("schema", "SSOT_RELEASE_DIGEST_V14"), ("digest", "0x" + "4" * 64)]:
            with self.subTest(field=field):
                self.manifests = {str(c): manifest(c) for c in (8453, 84532)}
                self.manifests["8453"]["meta"]["releaseLock"][field] = value
                with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(subprocess.CalledProcessError):
                    GUARD.check("image", REVISION)

    def test_different_application_releases_rejected(self):
        env = {"EXPECTED_REVISION": REVISION, "WEB_IMAGE": "ghcr.io/arbigamefi/ssot-bbog-web@sha256:" + "a" * 64,
               "KEEPER_IMAGE": "ghcr.io/arbigamefi/ssot-bbog-keeper@sha256:" + "b" * 64}
        with patch.dict(os.environ, env), patch.object(GUARD, "check", side_effect=[[{"digest": "one"}], [{"digest": "two"}]]), self.assertRaisesRegex(ValueError, "releases differ"):
            GUARD.main()


class SyncGuardTests(unittest.TestCase):
    def test_rejected_bundles_leave_active_files_untouched(self):
        for failure in ("old-schema", "wrong-chain", "no-trust-anchor"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                frontend = root / "frontend"
                embedded = frontend / "packages/ssot/src/release/embedded"
                embedded.mkdir(parents=True)
                sentinel = embedded / "chain-8453.json"
                sentinel.write_bytes(b"existing active release")
                bundle = root / "bundle"
                (bundle / "deployments").mkdir(parents=True)
                (bundle / "abis").mkdir()
                common = {"chainId": 8453, "blockNumber": 100, "architectureVersion": "v1.5-safe-governance"}
                rows = {"frontend-manifest-latest-v15.json": dict(common), "latest-v15.json": dict(common),
                        "golden-vectors-latest-v15.json": dict(common),
                        "release-latest-v15.json": {**common, "schema": "SSOT_RELEASE_DIGEST_V15"}}
                if failure == "old-schema":
                    rows["release-latest-v15.json"]["schema"] = "SSOT_RELEASE_DIGEST_V14"
                if failure == "wrong-chain":
                    rows["golden-vectors-latest-v15.json"]["chainId"] = 84532
                for name, row in rows.items():
                    (bundle / "deployments" / name).write_text(json.dumps(row))
                (bundle / "abis/index.json").write_text(json.dumps(common))
                env = {k: v for k, v in os.environ.items() if k not in ("RELEASE_SIGNER", "RPC_URL")}
                result = subprocess.run(["node", str(ROOT / "frontend/scripts/ssot-sync.mjs"), "--from", str(bundle)], cwd=frontend, env=env, capture_output=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                expected = {"old-schema": b"Only a v1.5", "wrong-chain": b"Mixed chain or deployment block", "no-trust-anchor": b"trusted RELEASE_SIGNER"}[failure]
                self.assertIn(expected, result.stderr)
                self.assertEqual(sentinel.read_bytes(), b"existing active release")
                self.assertEqual(len(list(frontend.rglob("*.json"))), 1)


class PackageGuardTests(unittest.TestCase):
    def test_direct_packager_cannot_emit_archive_when_live_governance_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "script/release").mkdir(parents=True)
            (root / "bin").mkdir()
            # Static artifact validation succeeds; only the live governance boundary fails.
            (root / "script/release/check_release.sh").write_text("#!/usr/bin/env bash\nexit 0\n")
            forge = root / "bin/forge"
            forge.write_text("#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" > forge-call.txt\nexit 1\n")
            forge.chmod(0o700)
            artifact = root / "artifact.json"
            artifact.write_text('{}')
            env = {**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"],
                   "RPC_URL": "http://unused.invalid", "RELEASE_SIGNER": "0x" + "2" * 40,
                   **{key: str(artifact) for key in ["RELEASE_PATH", "SNAPSHOT_PATH", "NOTES_PATH", "FRONTEND_MANIFEST_PATH", "GOLDEN_VECTORS_PATH", "ABIS_INDEX_PATH"]}}
            result = subprocess.run(["bash", str(ROOT / "script/release/package_release.sh")], cwd=root, env=env, capture_output=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("VerifyGovernanceV15", (root / "forge-call.txt").read_text())
            self.assertFalse((root / "dist").exists())


if __name__ == "__main__":
    unittest.main()
