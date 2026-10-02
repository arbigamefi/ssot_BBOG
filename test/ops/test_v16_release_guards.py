"""Exercise v1.6 release boundaries with real entrypoints and synthetic artifacts."""
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


LINES = {8453: "SSOT_RELEASE_DIGEST_V16", 84532: "SSOT_RELEASE_DIGEST_V16"}


def manifest(chain):
    return {"chainId": chain, "releaseDigest": DIGEST,
            "meta": {"releaseLock": {"schema": LINES[chain], "chainId": chain, "digest": DIGEST}},
            "contracts": {"gameHub": "0x" + "2" * 40}, "assets": [{"bank": "0x" + "3" * 40}]}


class ImageGuardTests(unittest.TestCase):
    def setUp(self):
        self.manifests = {str(chain): manifest(chain) for chain in (84532,)}
        self.image_revision = REVISION
        self.probe_calls = 0
        self.image_chain = "84532"

    def docker(self, args, **kwargs):
        if args[:3] == ["docker", "image", "inspect"]:
            return json.dumps([{"Config": {"Labels": {"org.opencontainers.image.revision": self.image_revision, "io.arbigamefi.chain-id": self.image_chain}}}]).encode()
        self.assertEqual(args[:8], ["docker", "run", "--rm", "--read-only", "--network", "none", "--entrypoint", "node"])
        self.probe_calls += 1
        # Execute the actual image probe against a virtual public manifest filesystem.
        prelude = "const data=" + json.dumps(self.manifests) + ";require('node:fs').readFileSync=(p)=>JSON.stringify(data[p.match(/chain-(\\d+)/)[1]]);\n"
        prelude += "require('node:fs').readdirSync=()=>Object.keys(data).map(c=>'chain-'+c+'.json');\n"
        return REAL_CHECK_OUTPUT(["node", "-e", prelude + args[-1]], stderr=subprocess.DEVNULL)

    def test_selected_sepolia_image_needs_no_mainnet_release(self):
        with patch.object(GUARD.subprocess, "check_output", self.docker):
            rows = GUARD.check("image", REVISION, 84532, DIGEST)
        self.assertEqual([row["chainId"] for row in rows], [84532])

    def test_wrong_revision_rejected_before_running_container(self):
        self.image_revision = "b" * 40
        with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(ValueError):
            GUARD.check("image", REVISION, 84532, DIGEST)
        self.assertEqual(self.probe_calls, 0)

    def test_unknown_schema_or_digest_mismatch_rejected_by_actual_probe(self):
        for field, value in [("schema", "SSOT_RELEASE_DIGEST_OTHER"), ("digest", "0x" + "4" * 64)]:
            with self.subTest(field=field):
                self.manifests = {str(c): manifest(c) for c in (84532,)}
                self.manifests["84532"]["meta"]["releaseLock"][field] = value
                with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(subprocess.CalledProcessError):
                    GUARD.check("image", REVISION, 84532, DIGEST)

    def test_wrong_baked_chain_rejected_before_running_container(self):
        self.image_chain = "8453"
        with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(ValueError):
            GUARD.check("image", REVISION, 84532, DIGEST)
        self.assertEqual(self.probe_calls, 0)

    def test_stale_release_placeholder_missing_and_extra_chain_rejected(self):
        for failure in ("stale", "placeholder", "missing", "extra"):
            with self.subTest(failure=failure):
                self.manifests = {"84532": manifest(84532)}
                if failure == "stale":
                    self.manifests["84532"]["releaseDigest"] = "0x" + "4" * 64
                    self.manifests["84532"]["meta"]["releaseLock"]["digest"] = "0x" + "4" * 64
                if failure == "placeholder":
                    self.manifests["84532"]["isPlaceholder"] = True
                if failure == "missing":
                    self.manifests = {}
                if failure == "extra":
                    self.manifests["8453"] = manifest(8453)
                with patch.object(GUARD.subprocess, "check_output", self.docker), self.assertRaises(subprocess.CalledProcessError):
                    GUARD.check("image", REVISION, 84532, DIGEST)

    def test_different_application_releases_rejected(self):
        env = {"DEPLOY_CHAIN_ID": "84532", "EXPECTED_RELEASE_DIGEST": DIGEST, "EXPECTED_REVISION": REVISION, "WEB_IMAGE": "ghcr.io/arbigamefi/ssot-bbog-web@sha256:" + "a" * 64,
               "KEEPER_IMAGE": "ghcr.io/arbigamefi/ssot-bbog-keeper@sha256:" + "b" * 64}
        with patch.dict(os.environ, env), patch.object(GUARD, "check", side_effect=[[{"digest": "one"}], [{"digest": "two"}]]), self.assertRaisesRegex(ValueError, "releases differ"):
            GUARD.main()


class SyncGuardTests(unittest.TestCase):
    def test_rejected_bundles_leave_active_files_untouched(self):
        for failure in ("unknown-schema", "wrong-chain", "no-trust-anchor"):
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
                common = {"chainId": 8453, "blockNumber": 100, "architectureVersion": "v1.6-house-edge-allocation"}
                rows = {"frontend-manifest-latest-v16.json": dict(common), "latest-v16.json": dict(common),
                        "golden-vectors-latest-v16.json": dict(common),
                        "release-latest-v16.json": {**common, "schema": "SSOT_RELEASE_DIGEST_V16"}}
                if failure == "unknown-schema":
                    rows["release-latest-v16.json"]["schema"] = "SSOT_RELEASE_DIGEST_OTHER"
                if failure == "wrong-chain":
                    rows["golden-vectors-latest-v16.json"]["chainId"] = 84532
                for name, row in rows.items():
                    (bundle / "deployments" / name).write_text(json.dumps(row))
                (bundle / "abis/index.json").write_text(json.dumps(common))
                env = {k: v for k, v in os.environ.items() if k not in ("RELEASE_SIGNER", "RPC_URL")}
                result = subprocess.run(["node", str(ROOT / "frontend/scripts/ssot-sync.mjs"), "--from", str(bundle)], cwd=frontend, env=env, capture_output=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                expected = {"unknown-schema": b"Only a v1.6", "wrong-chain": b"Mixed chain or deployment block", "no-trust-anchor": b"trusted RELEASE_SIGNER"}[failure]
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
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "-c", "user.name=Local test", "-c", "user.email=test@invalid",
                            "commit", "-qm", "source fixture"], cwd=root, check=True)
            result = subprocess.run(["bash", str(ROOT / "script/release/package_release.sh")], cwd=root, env=env, capture_output=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("VerifyGovernanceV16", (root / "forge-call.txt").read_text())
            self.assertFalse((root / "dist").exists())


class VerifyHelperGuardTests(unittest.TestCase):
    def test_other_snapshots_cannot_generate_executable_helpers(self):
        for version in ("", "unknown-architecture"):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot = root / "snapshot.json"
                snapshot.write_text(json.dumps({"chainId": 8453, "blockNumber": 1,
                                                "architectureVersion": version}))
                result = subprocess.run(["python3", str(ROOT / "script/tools/gen_verify_helpers.py"),
                                         str(snapshot)], cwd=root, capture_output=True, timeout=10)
                self.assertEqual(result.returncode, 2)
                self.assertIn(b"expected a v1.6 snapshot", result.stderr)
                self.assertFalse((root / "deployments").exists())


if __name__ == "__main__":
    unittest.main()
