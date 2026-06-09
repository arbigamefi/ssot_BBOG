#!/usr/bin/env python3

"""Deterministic validation of frontend artifacts for release gating.

Goals:
  - No heuristics, no grep, no "best effort".
  - In STRICT=1, fail fast with actionable messages.
  - Ensure frontend artifacts are zero-inference and tied to the release identity.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Tuple


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


def _validate_v13_pools(manifest: Dict[str, Any], snapshot: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
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


def _validate_v13_sports(manifest: Dict[str, Any], snapshot: Dict[str, Any], *, manifest_path: Path, snapshot_path: Path) -> None:
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
        raise SystemExit(f"{manifest_path}: sports.hub is not a valid v1.3 frontend field; use sports.sportsHub")

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


def _validate_v13_vectors(vectors: Dict[str, Any], snapshot: Dict[str, Any], *, vectors_path: Path, snapshot_path: Path) -> None:
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


def _pick_release_artifact(
    *,
    kind: str,
    latest_path: Path,
    chain_id: int,
    block_number: int,
    tag_suffix: str,
    strict: bool,
) -> Path:
    """Prefer the release-tagged artifact if present."""

    tagged = Path("deployments") / "release" / f"{kind}-{chain_id}-{block_number}{tag_suffix}.json"
    if tagged.exists():
        return tagged

    # If the tagged file is missing, strict mode should fail with a clear message.
    if strict:
        target = "frontend-manifest" if kind == "frontend-manifest" else "golden-vectors"
        command = f"make release-{target}{tag_suffix}"
        raise SystemExit(
            f"missing release-tagged {kind} at {tagged}. "
            f"Run: {command}"
        )

    # Non-strict: fall back to latest.
    return latest_path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", default="0")
    ap.add_argument("--release", required=True)
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--notes", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--vectors", required=True)
    ap.add_argument("--schema", type=int, default=1)
    ap.add_argument("--tag-suffix", default="")
    # Optional ABI inventory (frontend-only ABIs). In STRICT=1 this can be a hard gate.
    ap.add_argument("--abis-index", default="")
    args = ap.parse_args()

    strict = str(args.strict) == "1"

    release_path = Path(args.release)
    snapshot_path = Path(args.snapshot)
    notes_path = Path(args.notes)
    manifest_latest = Path(args.manifest)
    vectors_latest = Path(args.vectors)
    tag_suffix = str(args.tag_suffix)

    if strict:
        for p in (release_path, snapshot_path, notes_path, manifest_latest, vectors_latest):
            if not p.exists():
                raise SystemExit(f"missing required file: {p}")

    rel = _load_json(release_path)
    _require_keys(rel, keys=("chainId", "blockNumber", "digest"), path=release_path)
    chain_id = _as_int(rel["chainId"], field="chainId", path=release_path)
    block_number = _as_int(rel["blockNumber"], field="blockNumber", path=release_path)

    # Pick the release-tagged artifacts if available/required.
    manifest_path = _pick_release_artifact(
        kind="frontend-manifest",
        latest_path=manifest_latest,
        chain_id=chain_id,
        block_number=block_number,
        tag_suffix=tag_suffix,
        strict=strict,
    )
    vectors_path = _pick_release_artifact(
        kind="golden-vectors",
        latest_path=vectors_latest,
        chain_id=chain_id,
        block_number=block_number,
        tag_suffix=tag_suffix,
        strict=strict,
    )

    manifest = _load_json(manifest_path)
    vectors = _load_json(vectors_path)
    snapshot = _load_json(snapshot_path)

    # Schema requirements.
    manifest_keys = (
        ("schemaVersion", "chainId", "blockNumber", "addresses", "games", "assets")
        if args.schema == 1
        else ("schemaVersion", "chainId", "blockNumber", "architectureVersion", "addresses", "sports", "games", "pools")
    )
    _require_keys(manifest, keys=manifest_keys, path=manifest_path)
    _require_keys(vectors, keys=("schemaVersion", "chainId", "blockNumber", "vectors"), path=vectors_path)

    # Optional ABI inventory (frontend-only ABIs).
    abis_index_path = Path(args.abis_index) if str(args.abis_index).strip() else None
    if abis_index_path is not None:
        if strict and not abis_index_path.exists():
            raise SystemExit(f"missing abis index: {abis_index_path} (run: make release-abis)")
        if abis_index_path.exists():
            abis_index = _load_json(abis_index_path)
            _require_keys(abis_index, keys=("schemaVersion", "chainId", "blockNumber", "contracts"), path=abis_index_path)
            if _as_int(abis_index["schemaVersion"], field="schemaVersion", path=abis_index_path) != args.schema:
                raise SystemExit(f"{abis_index_path}: schemaVersion must be {args.schema}")
            if _as_int(abis_index["chainId"], field="chainId", path=abis_index_path) != chain_id:
                raise SystemExit(f"abis index chainId mismatch: expected {chain_id}, got {abis_index.get('chainId')}")
            if _as_int(abis_index["blockNumber"], field="blockNumber", path=abis_index_path) != block_number:
                raise SystemExit(
                    f"abis index blockNumber mismatch: expected {block_number}, got {abis_index.get('blockNumber')}"
                )
            abis_dir = abis_index_path.parent
            missing_files = []
            for c in abis_index.get("contracts", []):
                if not isinstance(c, dict):
                    continue
                f = c.get("abiFile")
                if isinstance(f, str) and not (abis_dir / f).exists():
                    missing_files.append(f)
            if missing_files:
                raise SystemExit(f"abis missing files under {abis_dir}: {missing_files}")

    if _as_int(manifest["schemaVersion"], field="schemaVersion", path=manifest_path) != args.schema:
        raise SystemExit(f"{manifest_path}: schemaVersion must be {args.schema}")
    if _as_int(vectors["schemaVersion"], field="schemaVersion", path=vectors_path) != args.schema:
        raise SystemExit(f"{vectors_path}: schemaVersion must be {args.schema}")

    m_chain = _as_int(manifest["chainId"], field="chainId", path=manifest_path)
    m_block = _as_int(manifest["blockNumber"], field="blockNumber", path=manifest_path)
    v_chain = _as_int(vectors["chainId"], field="chainId", path=vectors_path)
    v_block = _as_int(vectors["blockNumber"], field="blockNumber", path=vectors_path)

    if (m_chain, m_block) != (chain_id, block_number):
        raise SystemExit(
            f"frontend manifest identity mismatch. expected chainId={chain_id}, blockNumber={block_number} "
            f"but got chainId={m_chain}, blockNumber={m_block} in {manifest_path}"
        )
    if (v_chain, v_block) != (chain_id, block_number):
        raise SystemExit(
            f"golden vectors identity mismatch. expected chainId={chain_id}, blockNumber={block_number} "
            f"but got chainId={v_chain}, blockNumber={v_block} in {vectors_path}"
        )

    if args.schema == 2:
        _validate_v13_sports(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
        _validate_v13_pools(manifest, snapshot, manifest_path=manifest_path, snapshot_path=snapshot_path)
        _validate_v13_vectors(vectors, snapshot, vectors_path=vectors_path, snapshot_path=snapshot_path)

    # Also ensure the "latest" pointers match the current release identity in STRICT=1.
    if strict:
        ml = _load_json(manifest_latest)
        vl = _load_json(vectors_latest)
        ml_chain = _as_int(ml.get("chainId"), field="chainId", path=manifest_latest)
        ml_block = _as_int(ml.get("blockNumber"), field="blockNumber", path=manifest_latest)
        vl_chain = _as_int(vl.get("chainId"), field="chainId", path=vectors_latest)
        vl_block = _as_int(vl.get("blockNumber"), field="blockNumber", path=vectors_latest)
        if (ml_chain, ml_block) != (chain_id, block_number):
            raise SystemExit(
                f"frontend-manifest-latest-v13.json does not match release identity. "
                f"expected chainId={chain_id}, blockNumber={block_number} but got chainId={ml_chain}, blockNumber={ml_block}. "
                f"Run: make release-frontend-manifest{tag_suffix}"
            )
        if (vl_chain, vl_block) != (chain_id, block_number):
            raise SystemExit(
                f"golden-vectors-latest-v13.json does not match release identity. "
                f"expected chainId={chain_id}, blockNumber={block_number} but got chainId={vl_chain}, blockNumber={vl_block}. "
                f"Run: make release-golden-vectors{tag_suffix}"
            )

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
