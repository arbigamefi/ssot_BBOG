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
