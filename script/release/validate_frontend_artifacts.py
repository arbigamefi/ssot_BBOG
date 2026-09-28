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
from pathlib import Path
from typing import Any, Dict, Tuple

from export_frontend_abis import REQUIRED_CONTRACTS


def _load_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"missing json: {path}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"invalid json: {path}: {e}")


def _as_int(v: Any, *, field: str, path: Path) -> int:
    if isinstance(v, int):
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
    if not s.startswith("0x") or len(s) != 42:
        raise SystemExit(f"{path}: field '{field}' must be address, got: {v!r}")
    return s.lower()


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
        bank_decimals = snapshot.get(f"poolBankDecimals_{suffix}")
        if bank_decimals is not None:
            expected_bank_decimals = _as_int(
                bank_decimals,
                field=f"poolBankDecimals_{suffix}",
                path=snapshot_path,
            )
            if expected_bank_decimals != expected_decimals:
                raise SystemExit(
                    f"{snapshot_path}: poolBankDecimals_{suffix}={expected_bank_decimals} "
                    f"does not match poolAssetDecimals_{suffix}={expected_decimals}"
                )

        checks = (
            ("poolId", _as_int(snapshot.get(f"poolId_{suffix}"), field=f"poolId_{suffix}", path=snapshot_path)),
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

        actual_symbol = _as_str(pool.get("symbol"), field=f"pools[{i}].symbol", path=manifest_path)
        if actual_symbol != expected_symbol:
            raise SystemExit(
                f"{manifest_path}: pools[{i}].symbol={actual_symbol!r} does not match snapshot {expected_symbol!r}"
            )


def _validate_sports(manifest: Dict[str, Any], snapshot: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
    sports = manifest.get("sports")
    if not isinstance(sports, dict):
        raise SystemExit(f"{manifest_path}: sports must be object")
    _require_keys(
        sports,
        keys=(
            "enabled",
            "riskEngine",
            "sportsHub",
            "oddsSignerSetHash",
            "resultReporterSetHash",
            "resultReporterThreshold",
            "maxStake",
            "maxPayout",
            "maxMarketReserved",
            "maxOutcomeReserved",
            "maxEventReserved",
        ),
        path=manifest_path,
    )
    if "hub" in sports:
        raise SystemExit(f"{manifest_path}: sports.hub is not a valid frontend field; use sports.sportsHub")

    expected_hub = _as_address(snapshot.get("sportsHub"), field="sportsHub", path=snapshot_path)
    actual_hub = _as_address(sports.get("sportsHub"), field="sports.sportsHub", path=manifest_path)
    if actual_hub != expected_hub:
        raise SystemExit(f"{manifest_path}: sports.sportsHub={actual_hub} does not match snapshot {expected_hub}")

    expected_risk_engine = _as_address(snapshot.get("sportsRiskEngine"), field="sportsRiskEngine", path=snapshot_path)
    actual_risk_engine = _as_address(sports.get("riskEngine"), field="sports.riskEngine", path=manifest_path)
    if actual_risk_engine != expected_risk_engine:
        raise SystemExit(
            f"{manifest_path}: sports.riskEngine={actual_risk_engine} does not match snapshot {expected_risk_engine}"
        )


def _first_active_casino_pool(snapshot: Dict[str, Any], *, snapshot_path: Path) -> Tuple[int, int]:
    num_pools = _as_int(snapshot.get("numPools"), field="numPools", path=snapshot_path)
    for i in range(num_pools):
        suffix = str(i)
        domain = _as_int(snapshot.get(f"poolDomain_{suffix}"), field=f"poolDomain_{suffix}", path=snapshot_path)
        active = _as_int(snapshot.get(f"poolActive_{suffix}"), field=f"poolActive_{suffix}", path=snapshot_path)
        if domain == 1 and active != 0:
            pool_id = _as_int(snapshot.get(f"poolId_{suffix}"), field=f"poolId_{suffix}", path=snapshot_path)
            decimals = _as_int(
                snapshot.get(f"poolAssetDecimals_{suffix}"),
                field=f"poolAssetDecimals_{suffix}",
                path=snapshot_path,
            )
            if decimals < 0 or decimals > 36:
                raise SystemExit(f"{snapshot_path}: poolAssetDecimals_{suffix} out of range: {decimals}")
            return pool_id, decimals
    raise SystemExit(f"{snapshot_path}: no active casino pool")


def _validate_vectors(vectors: Dict[str, Any], snapshot: Dict[str, Any], *, vectors_path: Path, snapshot_path: Path) -> None:
    rows = vectors.get("vectors")
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"{vectors_path}: vectors must be a non-empty array")

    expected_pool_id, expected_decimals = _first_active_casino_pool(snapshot, snapshot_path=snapshot_path)
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


def _validate_abis(index: Dict[str, Any], path: Path) -> None:
    """The bundle inventory is untrusted; compare it with this checkout's ABI source."""
    entries = index.get("contracts")
    if not isinstance(entries, list):
        raise SystemExit(f"{path}: contracts must be an array")
    expected = {name for name, _, _ in REQUIRED_CONTRACTS}
    current = Path(__file__).resolve().parents[2] / "frontend/packages/ssot/src/abis/contracts"
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise SystemExit(f"{path}: invalid ABI inventory entry")
        name = entry.get("name")
        if name == "BankInstance":
            if entry.get("abiFile") != "Bank.abi.json":
                raise SystemExit(f"{path}: Bank instance must use current Bank ABI")
            continue
        if name not in expected or name in seen:
            raise SystemExit(f"{path}: unexpected or duplicate ABI: {name}")
        seen.add(name)
        filename = f"{name}.abi.json"
        if entry.get("abiFile") != filename:
            raise SystemExit(f"{path}: invalid ABI filename for {name}")
        bundle_file = path.parent / filename
        if not bundle_file.is_file():
            raise SystemExit(f"missing ABI: {bundle_file}")
        digest = hashlib.sha256(bundle_file.read_bytes()).hexdigest()
        if entry.get("abiSha256") != digest:
            raise SystemExit(f"{path}: ABI digest mismatch for {name}")
        if _load_json(bundle_file) != _load_json(current / filename):
            raise SystemExit(f"{path}: ABI differs from current source build: {name}")
    if seen != expected:
        raise SystemExit(f"{path}: missing current ABIs: {sorted(expected - seen)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", default="0")
    ap.add_argument("--release", required=True)
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--notes", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--vectors", required=True)
    # Current ABI inventory is mandatory for a strict release check.
    ap.add_argument("--abis-index", default="")
    args = ap.parse_args()

    strict = str(args.strict) == "1"

    release_path = Path(args.release)
    snapshot_path = Path(args.snapshot)
    notes_path = Path(args.notes)
    manifest_path = Path(args.manifest)
    vectors_path = Path(args.vectors)

    if strict:
        for p in (release_path, snapshot_path, notes_path, manifest_path, vectors_path):
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
    manifest_keys = ("schemaVersion", "chainId", "blockNumber", "architectureVersion", "addresses", "sports", "games", "pools")
    if rel.get("schema") != "SSOT_RELEASE_DIGEST_V16":
        raise SystemExit(f"{release_path}: expected current v1.6 release schema")
    for artifact, artifact_path in [(manifest, manifest_path), (vectors, vectors_path), (snapshot, snapshot_path)]:
        if artifact.get("architectureVersion") != "v1.6-house-edge-allocation":
            raise SystemExit(f"{artifact_path}: expected current v1.6 architecture")
        if (_as_int(artifact.get("chainId"), field="chainId", path=artifact_path),
            _as_int(artifact.get("blockNumber"), field="blockNumber", path=artifact_path)) != (chain_id, block_number):
            raise SystemExit(f"{artifact_path}: release identity mismatch")
    _require_keys(manifest, keys=manifest_keys, path=manifest_path)
    _require_keys(vectors, keys=("schemaVersion", "chainId", "blockNumber", "vectors"), path=vectors_path)

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
            _validate_abis(abis_index, abis_index_path)

    if _as_int(manifest["schemaVersion"], field="schemaVersion", path=manifest_path) != 2:
        raise SystemExit(f"{manifest_path}: schemaVersion must be 2")
    if _as_int(vectors["schemaVersion"], field="schemaVersion", path=vectors_path) != 2:
        raise SystemExit(f"{vectors_path}: schemaVersion must be 2")

    _validate_sports(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
    _validate_pools(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
    _validate_vectors(vectors, snapshot, vectors_path=vectors_path, snapshot_path=snapshot_path)

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
