#!/usr/bin/env python3

"""Deterministic validation of frontend artifacts for release gating.

Goals:
  - No heuristics, no grep, no "best effort".
  - In STRICT=1, fail fast with actionable messages.
  - Ensure frontend artifacts are zero-inference and tied to the release identity.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from export_frontend_abis import REQUIRED_CONTRACTS, _find_artifact, _load_abi_from_artifact, pool_instances
from verify_governance import VerificationError, load_checkpoint


ROOT = Path(__file__).resolve().parents[2]
# Pool IDs reach the frontend as JavaScript numbers; PoolRegistry rejects 0.
MAX_SAFE_POOL_ID = 2**53 - 1


def _unique_keys(pairs):
    # A repeated key would let two readers of one file see different values.
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key {key!r}")
        result[key] = value
    return result


def _reject_constant(name):
    raise ValueError(f"{name} is not JSON")


def _load_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f, object_pairs_hook=_unique_keys, parse_constant=_reject_constant)
    except FileNotFoundError:
        raise SystemExit(f"missing json: {path}")
    except ValueError as e:
        raise SystemExit(f"invalid json: {path}: {e}")


def _as_int(v: Any, *, field: str, path: Path) -> int:
    if type(v) is int:
        return v
    if isinstance(v, str):
        s = v.strip()
        if s.startswith("0x"):
            return int(s, 16)
        if s.isdigit():
            return int(s)
    raise SystemExit(f"{path}: field '{field}' must be int (or numeric string), got: {v!r}")


def _require_keys(obj: Dict[str, Any], *, keys: Tuple[str, ...], path: Path) -> None:
    missing = [k for k in keys if k not in obj]
    if missing:
        raise SystemExit(f"{path}: missing required key(s): {', '.join(missing)}")


def _as_str(v: Any, *, field: str, path: Path) -> str:
    if isinstance(v, str):
        return v
    raise SystemExit(f"{path}: field '{field}' must be string, got: {v!r}")


def _as_address(v: Any, *, field: str, path: Path) -> str:
    s = _as_str(v, field=field, path=path)
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", s):
        raise SystemExit(f"{path}: field '{field}' must be address, got: {v!r}")
    return s.lower()


EXECUTION_ADDRESSES = (
    "gov", "governanceTimelock", "gameHub", "settlementRouter", "poolRegistry", "vrfHub", "refRegistry", "refEngine",
    "moduleDice", "moduleCoinToss", "moduleRoulette", "moduleKeno",
    "modulePlinko", "moduleSicBo", "moduleSlots", "moduleBaccarat",
)
GAMES = (
    ("DICE", "dice", "moduleDice"), ("COIN_TOSS", "coin-toss", "moduleCoinToss"),
    ("ROULETTE", "roulette", "moduleRoulette"), ("KENO", "keno", "moduleKeno"),
    ("PLINKO", "plinko", "modulePlinko"), ("SIC_BO", "sic-bo", "moduleSicBo"),
    ("SLOTS", "slots", "moduleSlots"), ("BACCARAT", "baccarat", "moduleBaccarat"),
)


@lru_cache(maxsize=8)
def _game_id(name: str) -> str:
    # Use the existing Foundry Keccak implementation, not SHA3-256 or a new crypto implementation.
    return subprocess.check_output(["cast", "keccak", name], text=True).strip().lower()


def _validate_execution(manifest: Dict[str, Any], snapshot: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
    addresses = manifest.get("addresses")
    if not isinstance(addresses, dict) or set(addresses) != set(EXECUTION_ADDRESSES):
        raise SystemExit(f"{manifest_path}: unexpected or missing execution addresses")
    for key in EXECUTION_ADDRESSES:
        actual = _as_address(addresses[key], field=f"addresses.{key}", path=manifest_path)
        expected = _as_address(snapshot.get(key), field=key, path=snapshot_path)
        if actual != expected:
            raise SystemExit(f"{manifest_path}: addresses.{key} does not match authenticated snapshot")
    timeout = _as_int(manifest.get("refundTimeoutSeconds"), field="refundTimeoutSeconds", path=manifest_path)
    if not 60 <= timeout <= 86400:
        raise SystemExit(f"{manifest_path}: refundTimeoutSeconds outside [60, 86400]")
    if timeout != _as_int(snapshot.get("refundTimeoutSeconds"), field="refundTimeoutSeconds", path=snapshot_path):
        raise SystemExit(f"{manifest_path}: refundTimeoutSeconds does not match authenticated snapshot")
    games = manifest.get("games")
    if not isinstance(games, list) or len(games) != len(GAMES):
        raise SystemExit(f"{manifest_path}: expected exactly the current games")
    by_slug = {g.get("slug"): g for g in games if isinstance(g, dict)}
    if set(by_slug) != {slug for _, slug, _ in GAMES}:
        raise SystemExit(f"{manifest_path}: unexpected or duplicate game slug")
    for name, slug, key in GAMES:
        game = by_slug[slug]
        if game.get("gameId", "").lower() != _game_id(name):
            raise SystemExit(f"{manifest_path}: incorrect gameId for {slug}")
        if _as_address(game.get("module"), field=f"games.{slug}.module", path=manifest_path) != addresses[key].lower():
            raise SystemExit(f"{manifest_path}: games.{slug}.module does not match authenticated snapshot")
        for field, prefix, low, high in (("maxBetCount", "gameMaxBetCount", 1, 25),
                                         ("callbackGasLimit", "gameCallbackGasLimit", 200_000, 2_447_746)):
            value = _as_int(game.get(field), field=f"games.{slug}.{field}", path=manifest_path)
            expected = _as_int(snapshot.get(f"{prefix}_{name}"), field=f"{prefix}_{name}", path=snapshot_path)
            if not low <= value <= high or value != expected:
                raise SystemExit(f"{manifest_path}: games.{slug}.{field} does not match authenticated snapshot or admission bounds")


def _validate_pools(manifest: Dict[str, Any], snapshot: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
    pools = manifest.get("pools")
    if not isinstance(pools, list) or not pools:
        raise SystemExit(f"{manifest_path}: pools must be a non-empty array")

    num_pools = _as_int(snapshot.get("numPools"), field="numPools", path=snapshot_path)
    if len(pools) != num_pools:
        raise SystemExit(f"{manifest_path}: pools length {len(pools)} does not match snapshot numPools={num_pools}")

    for i, pool in enumerate(pools):
        if not isinstance(pool, dict):
            raise SystemExit(f"{manifest_path}: pools[{i}] must be object")
        suffix = str(i)
        expected_symbol = _as_str(
            snapshot.get(f"poolAssetSymbol_{suffix}"),
            field=f"poolAssetSymbol_{suffix}",
            path=snapshot_path,
        )
        if not expected_symbol:
            raise SystemExit(f"{snapshot_path}: poolAssetSymbol_{suffix} must be non-empty")
        expected_decimals = _as_int(
            snapshot.get(f"poolAssetDecimals_{suffix}"),
            field=f"poolAssetDecimals_{suffix}",
            path=snapshot_path,
        )
        if expected_decimals < 0 or expected_decimals > 36:
            raise SystemExit(f"{snapshot_path}: poolAssetDecimals_{suffix} out of range: {expected_decimals}")

        pool_id = _as_int(snapshot.get(f"poolId_{suffix}"), field=f"poolId_{suffix}", path=snapshot_path)
        if not 1 <= pool_id <= MAX_SAFE_POOL_ID:
            raise SystemExit(f"{snapshot_path}: poolId_{suffix}={pool_id} is outside the frontend's safe integer range")
        checks = (
            ("poolId", pool_id),
            ("domainId", _as_int(snapshot.get(f"poolDomain_{suffix}"), field=f"poolDomain_{suffix}", path=snapshot_path)),
            ("decimals", expected_decimals),
        )
        for field, expected in checks:
            actual = _as_int(pool.get(field), field=f"pools[{i}].{field}", path=manifest_path)
            if actual != expected:
                raise SystemExit(f"{manifest_path}: pools[{i}].{field}={actual} does not match snapshot {expected}")

        expected_asset = _as_address(snapshot.get(f"poolAsset_{suffix}"), field=f"poolAsset_{suffix}", path=snapshot_path)
        actual_asset = _as_address(pool.get("asset"), field=f"pools[{i}].asset", path=manifest_path)
        if actual_asset != expected_asset:
            raise SystemExit(f"{manifest_path}: pools[{i}].asset={actual_asset} does not match snapshot {expected_asset}")

        expected_bank = _as_address(snapshot.get(f"poolBank_{suffix}"), field=f"poolBank_{suffix}", path=snapshot_path)
        actual_bank = _as_address(pool.get("bank"), field=f"pools[{i}].bank", path=manifest_path)
        if actual_bank != expected_bank:
            raise SystemExit(f"{manifest_path}: pools[{i}].bank={actual_bank} does not match snapshot {expected_bank}")

        expected_vault = _as_address(snapshot.get(f"poolVault_{suffix}"), field=f"poolVault_{suffix}", path=snapshot_path)
        actual_vault = _as_address(pool.get("vault"), field=f"pools[{i}].vault", path=manifest_path)
        if actual_vault != expected_vault:
            raise SystemExit(f"{manifest_path}: pools[{i}].vault does not match authenticated snapshot")

        domain = _as_int(snapshot.get(f"poolDomain_{suffix}"), field=f"poolDomain_{suffix}", path=snapshot_path)
        if domain != 1:
            raise SystemExit(f"{snapshot_path}: poolDomain_{suffix} is not the casino domain")
        # Whether a pool takes bets is chain state (PoolRegistry.isPoolActive), which the release's activation
        # operation changes after signing; the frontend reads it live.
        if pool.get("domain") != "Casino":
            raise SystemExit(f"{manifest_path}: pool domain label does not match snapshot")

        actual_symbol = _as_str(pool.get("symbol"), field=f"pools[{i}].symbol", path=manifest_path)
        if actual_symbol != expected_symbol:
            raise SystemExit(
                f"{manifest_path}: pools[{i}].symbol={actual_symbol!r} does not match snapshot {expected_symbol!r}"
            )


def _first_casino_pool(snapshot: Dict[str, Any], *, snapshot_path: Path) -> Tuple[int, int]:
    num_pools = _as_int(snapshot.get("numPools"), field="numPools", path=snapshot_path)
    for i in range(num_pools):
        suffix = str(i)
        domain = _as_int(snapshot.get(f"poolDomain_{suffix}"), field=f"poolDomain_{suffix}", path=snapshot_path)
        if domain == 1:
            pool_id = _as_int(snapshot.get(f"poolId_{suffix}"), field=f"poolId_{suffix}", path=snapshot_path)
            decimals = _as_int(
                snapshot.get(f"poolAssetDecimals_{suffix}"),
                field=f"poolAssetDecimals_{suffix}",
                path=snapshot_path,
            )
            if decimals < 0 or decimals > 36:
                raise SystemExit(f"{snapshot_path}: poolAssetDecimals_{suffix} out of range: {decimals}")
            return pool_id, decimals
    raise SystemExit(f"{snapshot_path}: no casino pool")


def _validate_vectors(vectors: Dict[str, Any], snapshot: Dict[str, Any], *, vectors_path: Path, snapshot_path: Path) -> None:
    rows = vectors.get("vectors")
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"{vectors_path}: vectors must be a non-empty array")

    expected_pool_id, expected_decimals = _first_casino_pool(snapshot, snapshot_path=snapshot_path)
    expected_amount_per_roll = 10 ** expected_decimals

    for i, vector in enumerate(rows):
        if not isinstance(vector, dict):
            raise SystemExit(f"{vectors_path}: vectors[{i}] must be object")
        actual_pool_id = _as_int(vector.get("poolId"), field=f"vectors[{i}].poolId", path=vectors_path)
        if actual_pool_id != expected_pool_id:
            raise SystemExit(
                f"{vectors_path}: vectors[{i}].poolId={actual_pool_id} does not match first casino pool {expected_pool_id}"
            )
        stake = vector.get("stakeSpec")
        if not isinstance(stake, dict):
            raise SystemExit(f"{vectors_path}: vectors[{i}].stakeSpec must be object")
        actual_amount = _as_int(
            stake.get("amountPerRoll"),
            field=f"vectors[{i}].stakeSpec.amountPerRoll",
            path=vectors_path,
        )
        if actual_amount != expected_amount_per_roll:
            raise SystemExit(
                f"{vectors_path}: vectors[{i}].stakeSpec.amountPerRoll={actual_amount} "
                f"does not match 10**assetDecimals ({expected_amount_per_roll})"
            )


def _validate_abis(index: Dict[str, Any], path: Path, manifest: Dict[str, Any], out_dir: Path) -> None:
    """Compare untrusted inventory with this checkout's compiled source and pool routes."""
    entries = index.get("contracts")
    if not isinstance(entries, list):
        raise SystemExit(f"{path}: contracts must be an array")
    expected = {name: (qualified, key) for name, qualified, key in REQUIRED_CONTRACTS}
    expected_instances = {(row["name"], row["poolId"]): row for row in pool_instances(manifest)}
    seen, seen_instances = set(), set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise SystemExit(f"{path}: invalid ABI inventory entry")
        name = entry.get("name")
        if name in ("BankInstance", "VaultInstance"):
            pool_id = entry.get("poolId")
            if type(pool_id) is not int:
                raise SystemExit(f"{path}: invalid instance poolId")
            identity = (name, pool_id)
            if identity in seen_instances or identity not in expected_instances or entry != expected_instances[identity]:
                raise SystemExit(f"{path}: unexpected, duplicate or mismatched Bank/Vault instance")
            seen_instances.add(identity)
            continue
        if name not in expected or name in seen:
            raise SystemExit(f"{path}: unexpected or duplicate ABI: {name}")
        seen.add(name)
        qualified, key = expected[name]
        expected_address = None if key.startswith("__") else _as_address(
            manifest["addresses"].get(key), field=key, path=path)
        actual_address = entry.get("address")
        if actual_address is not None:
            actual_address = _as_address(actual_address, field=f"{name}.address", path=path)
        if entry.get("addressKey") != key or actual_address != expected_address:
            raise SystemExit(f"{path}: ABI address identity differs from authenticated manifest: {name}")
        filename = f"{name}.abi.json"
        if entry.get("abiFile") != filename:
            raise SystemExit(f"{path}: invalid ABI filename for {name}")
        bundle_file = path.parent / filename
        if bundle_file.is_symlink() or not bundle_file.is_file():
            raise SystemExit(f"missing ABI or not a regular file: {bundle_file}")
        if entry.get("abiSha256") != hashlib.sha256(bundle_file.read_bytes()).hexdigest():
            raise SystemExit(f"{path}: ABI digest mismatch for {name}")
        try:
            abi = _load_abi_from_artifact(_find_artifact(out_dir, qualified))
        except (FileNotFoundError, ValueError) as error:
            raise SystemExit(str(error)) from None
        if _load_json(bundle_file) != {"contract": name, "abi": abi}:
            raise SystemExit(f"{path}: ABI differs from current source build: {name}")
    if seen != set(expected):
        raise SystemExit(f"{path}: missing current ABIs: {sorted(set(expected) - seen)}")
    if seen_instances != set(expected_instances):
        raise SystemExit(f"{path}: missing Bank/Vault instances")


def _comparable(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _comparable(child) for key, child in value.items()}
    if isinstance(value, list):
        return [_comparable(child) for child in value]
    if isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]*", value):
        return value.lower()
    return value


def _first_difference(expected: Any, actual: Any, where: str) -> Optional[str]:
    if type(expected) is not type(actual):
        return where
    if isinstance(expected, dict):
        for key in sorted(set(expected) | set(actual)):
            if key not in expected or key not in actual:
                return f"{where}.{key}"
            found = _first_difference(expected[key], actual[key], f"{where}.{key}")
            if found:
                return found
        return None
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return f"{where} (length)"
        for i, (child, other) in enumerate(zip(expected, actual)):
            found = _first_difference(child, other, f"{where}[{i}]")
            if found:
                return found
        return None
    return None if expected == actual else where


def _validate_canonical_manifest(manifest: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
    """The whole manifest must be what GenerateFrontendManifestV16 writes for the snapshot, so a field the checks above
    do not name (a label, a parameter encoding, an extra alias) cannot reach the frontend either. Only the build
    metadata `gitSha` and `generatedAt` may differ, and hex strings compare without case."""
    # Forge scripts read only inside the project and write only below deployments/; no RPC is used.
    (ROOT / "deployments").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".canonical-manifest-", dir=ROOT / "deployments") as temporary:
        directory = Path(temporary)
        shutil.copyfile(snapshot_path, directory / "snapshot.json")
        env = {**os.environ, "SNAPSHOT_PATH": str(directory / "snapshot.json"),
               "FRONTEND_MANIFEST_OUTPUT_PATH": str(directory / "manifest.json")}
        result = subprocess.run(
            ["forge", "script", "script/release/GenerateFrontendManifestV16.s.sol:GenerateFrontendManifestV16"],
            cwd=ROOT, env=env, capture_output=True, text=True)
        if result.returncode:
            raise SystemExit(f"canonical manifest generation failed:\n{(result.stdout + result.stderr)[-2000:]}")
        expected = _load_json(directory / "manifest.json")
    metadata = ("gitSha", "generatedAt")
    expected = _comparable({key: value for key, value in expected.items() if key not in metadata})
    actual = _comparable({key: value for key, value in manifest.items() if key not in metadata})
    where = _first_difference(expected, actual, "manifest")
    if where:
        raise SystemExit(f"{manifest_path}: {where} differs from the manifest generated from the authenticated snapshot")


def _validate_checkpoint(rel: Dict[str, Any], snapshot: Dict[str, Any], *, checkpoint_path: Path,
                         release_path: Path) -> None:
    """The governance checkpoint the record signs: its canonical digest, block and release."""
    _require_keys(rel, keys=("checkpointSha256", "checkpointBlockNumber", "checkpointBlockHash"), path=release_path)
    try:
        document = load_checkpoint(checkpoint_path, str(rel["checkpointSha256"]).lower())
    except (OSError, ValueError, VerificationError) as error:
        raise SystemExit(f"{checkpoint_path}: governance checkpoint rejected: {error}")
    signed = (_as_int(rel["checkpointBlockNumber"], field="checkpointBlockNumber", path=release_path),
              str(rel["checkpointBlockHash"]).lower())
    if (document.get("blockNumber"), document.get("blockHash")) != signed:
        raise SystemExit(f"{checkpoint_path}: governance checkpoint block differs from the release record")
    release = (snapshot.get("chainId"), snapshot.get("blockNumber"),
               *(str(snapshot.get(key, "")).lower() for key in ("governanceTimelock", "poolRegistry", "gameHub")))
    found = (document.get("chainId"), document.get("historyStart"),
             *(document.get(key) for key in ("governanceTimelock", "poolRegistry", "gameHub")))
    if found != release:
        raise SystemExit(f"{checkpoint_path}: governance checkpoint belongs to another release")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", default="0")
    ap.add_argument("--release", required=True)
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--notes", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--vectors", required=True)
    # Current ABI inventory is mandatory for a strict release check.
    ap.add_argument("--abis-index", default="")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "out"))
    args = ap.parse_args()

    strict = str(args.strict) == "1"

    release_path = Path(args.release)
    snapshot_path = Path(args.snapshot)
    notes_path = Path(args.notes)
    manifest_path = Path(args.manifest)
    vectors_path = Path(args.vectors)

    checkpoint_path = Path(args.checkpoint)

    if strict:
        for p in (release_path, snapshot_path, checkpoint_path, notes_path, manifest_path, vectors_path):
            if not p.exists():
                raise SystemExit(f"missing required file: {p}")

    rel = _load_json(release_path)
    _require_keys(rel, keys=("chainId", "blockNumber", "digest"), path=release_path)
    chain_id = _as_int(rel["chainId"], field="chainId", path=release_path)
    block_number = _as_int(rel["blockNumber"], field="blockNumber", path=release_path)

    manifest = _load_json(manifest_path)
    vectors = _load_json(vectors_path)
    snapshot = _load_json(snapshot_path)

    # Schema requirements.
    manifest_keys = ("schemaVersion", "chainId", "blockNumber", "architectureVersion", "addresses", "games", "pools")
    if rel.get("schema") != "SSOT_RELEASE_DIGEST_V16":
        raise SystemExit(f"{release_path}: expected current v1.6 release schema")
    for artifact, artifact_path in [(manifest, manifest_path), (vectors, vectors_path), (snapshot, snapshot_path)]:
        if artifact.get("architectureVersion") != "v1.6-nft-liquidity":
            raise SystemExit(f"{artifact_path}: expected current v1.6 architecture")
        if (_as_int(artifact.get("chainId"), field="chainId", path=artifact_path),
            _as_int(artifact.get("blockNumber"), field="blockNumber", path=artifact_path)) != (chain_id, block_number):
            raise SystemExit(f"{artifact_path}: release identity mismatch")
    _require_keys(manifest, keys=manifest_keys, path=manifest_path)
    _require_keys(vectors, keys=("schemaVersion", "chainId", "blockNumber", "vectors"), path=vectors_path)
    _validate_checkpoint(rel, snapshot, checkpoint_path=checkpoint_path, release_path=release_path)

    # Authenticate routes before using them to validate the ABI inventory.
    _validate_execution(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
    _validate_pools(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
    _validate_vectors(vectors, snapshot, vectors_path=vectors_path, snapshot_path=snapshot_path)

    # Optional ABI inventory (frontend-only ABIs).
    abis_index_path = Path(args.abis_index) if str(args.abis_index).strip() else None
    if strict and abis_index_path is None:
        raise SystemExit("strict release validation requires --abis-index")
    if abis_index_path is not None:
        if strict and not abis_index_path.exists():
            raise SystemExit(f"missing abis index: {abis_index_path} (run: make release-abis)")
        if abis_index_path.exists():
            abis_index = _load_json(abis_index_path)
            _require_keys(abis_index, keys=("schemaVersion", "chainId", "blockNumber", "contracts"), path=abis_index_path)
            if _as_int(abis_index["schemaVersion"], field="schemaVersion", path=abis_index_path) != 2:
                raise SystemExit(f"{abis_index_path}: schemaVersion must be 2")
            if _as_int(abis_index["chainId"], field="chainId", path=abis_index_path) != chain_id:
                raise SystemExit(f"abis index chainId mismatch: expected {chain_id}, got {abis_index.get('chainId')}")
            if _as_int(abis_index["blockNumber"], field="blockNumber", path=abis_index_path) != block_number:
                raise SystemExit(
                    f"abis index blockNumber mismatch: expected {block_number}, got {abis_index.get('blockNumber')}"
                )
            if abis_index.get("architectureVersion") != "v1.6-nft-liquidity":
                raise SystemExit(f"{abis_index_path}: expected current NFT architecture")
            _validate_abis(abis_index, abis_index_path, manifest, Path(args.out))

    if _as_int(manifest["schemaVersion"], field="schemaVersion", path=manifest_path) != 2:
        raise SystemExit(f"{manifest_path}: schemaVersion must be 2")
    if _as_int(vectors["schemaVersion"], field="schemaVersion", path=vectors_path) != 2:
        raise SystemExit(f"{vectors_path}: schemaVersion must be 2")

    # Last, so the checks above name the first mismatch they know about.
    _validate_canonical_manifest(manifest, manifest_path=manifest_path, snapshot_path=snapshot_path)

    # Notes must reference digest in strict mode.
    if strict:
        digest = str(rel["digest"])
        if not digest.startswith("0x") or len(digest) != 66:
            raise SystemExit(f"{release_path}: invalid digest format: {digest}")
        notes = notes_path.read_text(encoding="utf-8")
        if digest not in notes:
            raise SystemExit(f"release notes do not reference digest {digest}")

    print(
        f"ok: frontend artifacts validated for chainId={chain_id}, blockNumber={block_number} "
        f"(manifest={manifest_path}, vectors={vectors_path})"
    )


if __name__ == "__main__":
    main()
