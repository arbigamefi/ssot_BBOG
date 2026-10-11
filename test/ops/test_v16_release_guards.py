"""Exercise v1.6 release boundaries with real entrypoints and synthetic artifacts."""
import importlib.util
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
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


def verify_snapshot():
    """A v1.6 snapshot with five contracts to verify; the zero-address ones are skipped by the helper."""
    row = {"chainId": 84532, "architectureVersion": "v1.6-nft-liquidity", "numPools": 1}
    for key in ("governanceTimelock", "vrfHub", "poolRegistry", "settlementRouter", "refRegistry", "refEngine",
                "gameHub", "poolBank_0", "poolVault_0", "moduleDice", "moduleCoinToss",
                "moduleRoulette", "moduleKeno", "modulePlinko", "moduleSicBo", "moduleSlots", "moduleBaccarat"):
        row[key] = "0x" + "0" * 40
    for i, (key, ctor_key) in enumerate((("vrfHub", "ctorArgs_vrfHub"), ("gameHub", "ctorArgs_gameHub"),
                                        ("poolBank_0", "ctorArgs_bank_0"), ("poolVault_0", "ctorArgs_vault_0"), ("moduleDice", "ctorArgs_moduleDice")), 1):
        row[key] = "0x" + str(i) * 40
        row[ctor_key] = "0x" if key == "moduleDice" else "0x" + str(i) * 64
    return row


def manifest(chain):
    return {"chainId": chain, "releaseDigest": DIGEST,
            "meta": {"architectureVersion": "v1.6-nft-liquidity", "releaseLock": {"schema": LINES[chain], "chainId": chain, "digest": DIGEST}},
            "contracts": {"gameHub": "0x" + "2" * 40}, "assets": [{"bank": "0x" + "3" * 40}],
            "pools": [{"bank": "0x" + "3" * 40, "vault": "0x" + "4" * 40}]}


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

    def test_old_architecture_and_missing_or_zero_vault_are_rejected(self):
        for failure in ("old-architecture", "missing-vault", "zero-vault"):
            with self.subTest(failure=failure):
                self.manifests = {"84532": manifest(84532)}
                row = self.manifests["84532"]
                if failure == "old-architecture": row["meta"]["architectureVersion"] = "v1.6-house-edge-allocation"
                elif failure == "missing-vault": del row["pools"][0]["vault"]
                else: row["pools"][0]["vault"] = "0x" + "0" * 40
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
        for failure in ("unknown-schema", "old-architecture", "wrong-chain", "no-trust-anchor"):
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
                common = {"chainId": 8453, "blockNumber": 100, "architectureVersion": "v1.6-nft-liquidity"}
                rows = {"frontend-manifest-latest-v16.json": dict(common), "latest-v16.json": dict(common),
                        "golden-vectors-latest-v16.json": dict(common), "governance-checkpoint-latest-v16.json": {},
                        "release-latest-v16.json": {**common, "schema": "SSOT_RELEASE_DIGEST_V16"}}
                if failure == "unknown-schema":
                    rows["release-latest-v16.json"]["schema"] = "SSOT_RELEASE_DIGEST_OTHER"
                if failure == "old-architecture":
                    rows["latest-v16.json"]["architectureVersion"] = "v1.6-house-edge-allocation"
                if failure == "wrong-chain":
                    rows["golden-vectors-latest-v16.json"]["chainId"] = 84532
                for name, row in rows.items():
                    (bundle / "deployments" / name).write_text(json.dumps(row))
                (bundle / "deployments/release-notes-latest-v16.md").write_text("release notes\n")
                (bundle / "abis/index.json").write_text(json.dumps(common))
                env = {k: v for k, v in os.environ.items() if k not in ("RELEASE_SIGNER", "RPC_URL")}
                result = subprocess.run(["node", str(ROOT / "frontend/scripts/ssot-sync.mjs"), "--from", str(bundle)], cwd=frontend, env=env, capture_output=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                expected = {"unknown-schema": b"Only a v1.6", "old-architecture": b"Only a v1.6", "wrong-chain": b"Mixed chain or deployment block", "no-trust-anchor": b"trusted RELEASE_SIGNER"}[failure]
                self.assertIn(expected, result.stderr)
                self.assertEqual(sentinel.read_bytes(), b"existing active release")
                self.assertEqual(len(list(frontend.rglob("*.json"))), 1)


class EmbeddedSchemaGuardTests(unittest.TestCase):
    def test_nft_pool_and_game_admission_fields_required_by_actual_checker(self):
        address = lambda n: '0x' + format(n, '040x')
        release = {"chainId": 84532, "isPlaceholder": False,
                   "meta": {"schemaVersion": 2, "architectureVersion": "v1.6-nft-liquidity",
                            "releaseLock": {"schema": "SSOT_RELEASE_DIGEST_V16"}},
                   "contracts": {key: address(i + 1) for i, key in enumerate(("governanceTimelock", "gameHub", "settlementRouter",
                                  "poolRegistry", "vrfHub", "refRegistry", "refEngine"))},
                   "assets": [{"symbol": "USDC", "decimals": 6}], "games": {"fixture": address(20)},
                   "gamesMeta": [{"maxBetCount": 25, "callbackGasLimit": 2_447_746}],
                   "pools": [{"symbol": "USDC", "decimals": 6, "asset": address(30),
                              "bank": address(31), "vault": address(32)}]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            embedded = root / 'packages/ssot/src/release/embedded'
            embedded.mkdir(parents=True)
            def run(data):
                (embedded / 'chain-84532.json').write_text(json.dumps(data))
                return subprocess.run(['node', str(ROOT / 'frontend/scripts/check-release.mjs')], cwd=root,
                                      env={**os.environ, 'STRICT_RELEASE': '1'}, capture_output=True, text=True)
            control = run(release)
            self.assertEqual(control.returncode, 0, control.stderr)
            cases = []
            changed = copy.deepcopy(release); del changed['pools'][0]['vault']; cases.append(changed)
            changed = copy.deepcopy(release); changed['pools'][0]['vault'] = address(31); cases.append(changed)
            changed = copy.deepcopy(release); changed['meta']['architectureVersion'] = 'v1.6-house-edge-allocation'; cases.append(changed)
            changed = copy.deepcopy(release); changed['contracts']['adapter'] = address(40); cases.append(changed)
            changed = copy.deepcopy(release); del changed['contracts']['governanceTimelock']; cases.append(changed)
            for field in ('maxBetCount', 'callbackGasLimit'):
                changed = copy.deepcopy(release); del changed['gamesMeta'][0][field]; cases.append(changed)
            for changed in cases:
                with self.subTest(changed=changed):
                    self.assertNotEqual(run(changed).returncode, 0)


class PackageGuardTests(unittest.TestCase):
    def source(self, root, governance=""):
        """A committed source tree with every release input; static checks pass, `governance` is the live check."""
        (root / "script/release").mkdir(parents=True)
        (root / "script/tools").mkdir(parents=True)
        shutil.copy(ROOT / "script/tools/gen_verify_helpers.py", root / "script/tools/gen_verify_helpers.py")
        (root / "script/release/check_release.sh").write_text("#!/usr/bin/env bash\nexit 0\n")
        (root / "script/release/verify_governance.py").write_text(governance)
        (root / "abis").mkdir()
        (root / "abis/GameHub.abi.json").write_text("[]")
        (root / "abis/index.json").write_text("{}")
        (root / "snapshot.json").write_text(json.dumps(verify_snapshot()))
        (root / "release.json").write_text(json.dumps({"chainId": 84532, "blockNumber": 7, "digest": "0x" + "ab" * 32,
                                                       "checkpointSha256": "0x" + "cd" * 32}))
        (root / "artifact.json").write_text("{}")
        (root / ".gitignore").write_text("/deployments/\n/dist/\n")
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        subprocess.run(["git", "add", "."], cwd=root, check=True)
        subprocess.run(["git", "-c", "user.name=Local test", "-c", "user.email=test@invalid",
                        "commit", "-qm", "source fixture"], cwd=root, check=True)
        return {**os.environ, "PYTHON": sys.executable, "TAG_NAME": "v1", "RPC_URL": "http://unused.invalid",
                "RELEASE_SIGNER": "0x" + "2" * 40, "RELEASE_PATH": str(root / "release.json"),
                "SNAPSHOT_PATH": str(root / "snapshot.json"), "ABIS_DIR": str(root / "abis"),
                "ABIS_INDEX_PATH": str(root / "abis/index.json"),
                **{key: str(root / "artifact.json") for key in ["NOTES_PATH", "FRONTEND_MANIFEST_PATH", "GOLDEN_VECTORS_PATH",
                                                                "GOVERNANCE_CHECKPOINT_PATH"]}}

    def package(self, root, env):
        return subprocess.run(["bash", str(ROOT / "script/release/package_release.sh")], cwd=root, env=env,
                              capture_output=True, text=True, timeout=30)

    def helper(self, row):
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "snapshot.json"
            snapshot.write_text(json.dumps(row))
            subprocess.run([sys.executable, str(ROOT / "script/tools/gen_verify_helpers.py"), str(snapshot),
                            "--out", f"{directory}/helper.sh"], check=True, capture_output=True)
            return (Path(directory) / "helper.sh").read_bytes()

    def test_direct_packager_cannot_emit_archive_when_live_governance_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # Static artifact validation succeeds; only the live governance boundary fails.
            env = self.source(root, "from pathlib import Path\n"
                                    "Path('governance-call.txt').write_text('complete permission boundary')\n"
                                    "raise SystemExit(1)\n")
            result = self.package(root, env)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("complete permission boundary", (root / "governance-call.txt").read_text())
            self.assertFalse((root / "dist").exists())

    def test_the_package_replays_from_the_signed_checkpoint_and_ships_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = self.source(root, "import json, os\nfrom pathlib import Path\n"
                                    "Path('governance-env.json').write_text(json.dumps({k: os.environ.get(k) for k in "
                                    "('GOVERNANCE_VERIFY_MODE', 'GOVERNANCE_CHECKPOINT', 'GOVERNANCE_CHECKPOINT_SHA256')}))\n")
            result = self.package(root, env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads((root / "governance-env.json").read_text()),
                             {"GOVERNANCE_VERIFY_MODE": "release", "GOVERNANCE_CHECKPOINT": str(root / "artifact.json"),
                              "GOVERNANCE_CHECKPOINT_SHA256": "0x" + "cd" * 32})
            with tarfile.open(root / "dist/ssot-release-v1-0xabababab.tar.gz") as archive:
                self.assertEqual(archive.extractfile("./deployments/governance-checkpoint-latest-v16.json").read(), b"{}")

    def test_existing_archive_is_never_rewritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = self.source(root)
            first = self.package(root, env)
            self.assertEqual(first.returncode, 0, first.stderr)
            archive = root / "dist/ssot-release-v1-0xabababab.tar.gz"
            self.assertIn(f"wrote: {archive.relative_to(root)}", first.stdout)
            packaged = archive.read_bytes()
            # A rerun would produce a different archive of the same name (new timestamps), so it must refuse.
            second = self.package(root, env)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn("already exists; a release archive is never rewritten", second.stderr)
            self.assertEqual(archive.read_bytes(), packaged)
            self.assertEqual(sorted(path.name for path in (root / "dist").iterdir()), [archive.name])

    def test_packaged_verify_helper_is_generated_from_the_snapshot(self):
        for local in (False, True):
            with self.subTest(local_helper=local), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                env = self.source(root)
                expected = self.helper(verify_snapshot())
                if local:
                    (root / "deployments").mkdir()
                    (root / "deployments/verify-latest-v16.sh").write_bytes(expected)
                result = self.package(root, env)
                self.assertEqual(result.returncode, 0, result.stderr)
                with tarfile.open(root / "dist/ssot-release-v1-0xabababab.tar.gz") as archive:
                    self.assertEqual(archive.extractfile("./deployments/verify-latest-v16.sh").read(), expected)
                    manifest = archive.extractfile("./MANIFEST.sha256").read().decode()
                self.assertIn(f"{hashlib.sha256(expected).hexdigest()}  deployments/verify-latest-v16.sh", manifest)

    def test_stale_verify_helper_stops_the_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = self.source(root, "from pathlib import Path\nPath('governance-call.txt').write_text('called')\n")
            other = verify_snapshot()
            other["vrfHub"] = "0x" + "9" * 40
            (root / "deployments").mkdir()
            (root / "deployments/verify-latest-v16.sh").write_bytes(self.helper(other))
            result = self.package(root, env)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("deployments/verify-latest-v16.sh does not match", result.stderr)
            self.assertFalse((root / "dist").exists())
            # Refused before any chain access.
            self.assertFalse((root / "governance-call.txt").exists())


class VerifyHelperGuardTests(unittest.TestCase):
    def snapshot(self):
        return verify_snapshot()

    def generate(self, root, row):
        snapshot = root / "snapshot.json"
        snapshot.write_text(json.dumps(row))
        return subprocess.run(["python3", str(ROOT / "script/tools/gen_verify_helpers.py"), str(snapshot)],
                              cwd=root, capture_output=True, timeout=10)

    def test_current_snapshot_executes_exact_constructor_and_chain_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = self.snapshot()
            self.assertEqual(self.generate(root, row).returncode, 0)
            helper = root / "deployments/verify-latest-v16.sh"
            subprocess.run(["bash", "-n", str(helper)], check=True)
            (root / "bin").mkdir()
            fake_forge = root / "bin/forge"
            fake_forge.write_text("#!/usr/bin/env python3\nimport json, sys\nfrom pathlib import Path\n"
                                  "with Path('calls.jsonl').open('a') as log: log.write(json.dumps(sys.argv[1:])+'\\n')\n")
            fake_forge.chmod(0o755)
            env = {**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"],
                   "ETHERSCAN_V2_API_KEY": "local-test", "FOUNDRY_PROFILE": "nightly"}
            env.pop("VERIFIER_URL", None)
            subprocess.run(["bash", str(helper)], cwd=root, env=env, check=True, capture_output=True, timeout=10)
            calls = [json.loads(line) for line in (root / "calls.jsonl").read_text().splitlines()]
            self.assertEqual(len(calls), 5)
            for call, key, ctor_key in zip(calls, ("vrfHub", "gameHub", "poolBank_0", "poolVault_0", "moduleDice"),
                                          ("ctorArgs_vrfHub", "ctorArgs_gameHub", "ctorArgs_bank_0", "ctorArgs_vault_0", "ctorArgs_moduleDice")):
                self.assertEqual(call[:2], ["verify-contract", row[key]])
                self.assertEqual(call[call.index("--chain") + 1], "84532")
                self.assertEqual(call[call.index("--compilation-profile") + 1], "default")
                self.assertEqual(call[call.index("--verifier-url") + 1], "https://api.etherscan.io/v2/api?chainid=84532")
                self.assertEqual(call[call.index("--etherscan-api-key") + 1], "local-test")
                if key == "moduleDice":
                    self.assertNotIn("--constructor-args", call)
                else:
                    self.assertEqual(call[call.index("--constructor-args") + 1], row[ctor_key])

    def test_missing_key_stops_before_verifier_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(self.generate(root, self.snapshot()).returncode, 0)
            env = dict(os.environ)
            env.pop("ETHERSCAN_V2_API_KEY", None)
            result = subprocess.run(["bash", str(root / "deployments/verify-latest-v16.sh")],
                                    cwd=root, env=env, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 1)
            self.assertIn(b"set ETHERSCAN_V2_API_KEY", result.stderr)

    def test_missing_or_nonhex_constructor_cannot_emit_helper(self):
        for key in ("ctorArgs_vrfHub", "ctorArgs_vault_0"):
            for value in (None, "", "0x123; touch injected"):
                with self.subTest(key=key, value=value), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    row = self.snapshot()
                    if value is None:
                        del row[key]
                    else:
                        row[key] = value
                    self.assertNotEqual(self.generate(root, row).returncode, 0)
                    self.assertFalse((root / "deployments/verify-latest-v16.sh").exists())
                    self.assertFalse((root / "injected").exists())

    def test_missing_vault_or_pool_count_cannot_emit_partial_helper(self):
        for key in ("poolVault_0", "numPools"):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                row = self.snapshot()
                del row[key]
                self.assertNotEqual(self.generate(root, row).returncode, 0)
                self.assertFalse((root / "deployments/verify-latest-v16.sh").exists())

    def test_other_snapshots_cannot_generate_executable_helpers(self):
        for version in ("", "unknown-architecture", "v1.6-house-edge-allocation"):
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
