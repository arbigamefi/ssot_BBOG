#!/usr/bin/env python3
"""Export *frontend-only* ABIs into deployments/abis/.

This is intentionally a "trimmed ABI" export:
  - We DO NOT ship full Foundry artifacts (bytecode/metadata).
  - We only export the `abi` array needed by frontend tooling.

Outputs:
  - deployments/abis/index.json
  - deployments/abis/<Contract>.abi.json (one per contract type)

The index is tied to the release identity (chainId + blockNumber) so that
frontend can be zero-inference: copy+consume.

Requires:
  - `deployments/frontend-manifest-latest.json` (for addresses)
  - `out/` artifacts present (run `forge build` first)
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import hashlib
import time

REQUIRED_CONTRACTS = [
    # core
    ("Hub", "src/core/Hub.sol:Hub", "hub"),
    ("VRFHub", "src/core/VRFHub.sol:VRFHub", "vrfHub"),
    ("BankRegistry", "src/core/BankRegistry.sol:BankRegistry", "bankRegistry"),
    ("ReferralRegistry", "src/engines/referral/ReferralRegistry.sol:ReferralRegistry", "refRegistry"),
    ("DefaultReferralEngine", "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine", "refEngine"),
    # adapter
    ("ChainlinkV2PlusWrapperAdapter", "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter", "adapter"),
    # modules
    ("DiceModule", "src/modules/dice/DiceModule.sol:DiceModule", "moduleDice"),
    ("CoinTossModule", "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "moduleCoinToss"),
    ("RouletteModule", "src/modules/roulette/RouletteModule.sol:RouletteModule", "moduleRoulette"),
    ("KenoModule", "src/modules/keno/KenoModule.sol:KenoModule", "moduleKeno"),
    # bank (type)
    ("Bank", "src/core/Bank.sol:Bank", "__bank_type__"),
]

def _sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def _find_artifact(out_dir: Path, contract_name: str) -> Path:
    # Look for out/**/<Contract>.json
    candidates = list(out_dir.rglob(f"{contract_name}.json"))
    if not candidates:
        raise FileNotFoundError(f"Could not find Foundry artifact for contract '{contract_name}' under {out_dir}/ (run: forge build)")
    # Prefer the shortest path (closest match), then deterministic order
    candidates.sort(key=lambda p: (len(p.parts), str(p)))
    return candidates[0]

def _load_abi_from_artifact(artifact_path: Path) -> List[Dict[str, Any]]:
    art = _read_json(artifact_path)
    abi = art.get("abi")
    if not isinstance(abi, list):
        raise ValueError(f"Artifact {artifact_path} missing 'abi' array")
    return abi

def _contract_key_to_address(addresses: Dict[str, str], key: str) -> Optional[str]:
    v = addresses.get(key)
    if v is None:
        return None
    if not isinstance(v, str):
        return None
    return v

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="deployments/frontend-manifest-latest.json")
    ap.add_argument("--out", default="out")
    ap.add_argument("--dest", default="deployments/abis")
    ap.add_argument("--schema", type=int, default=1)
    ap.add_argument("--git-sha", default=os.environ.get("GIT_SHA", ""))
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        raise SystemExit(f"missing manifest: {manifest_path} (run: make release-frontend-manifest)")
    manifest = _read_json(manifest_path)

    # Basic schema checks
    schema_version = manifest.get("schemaVersion")
    if schema_version != args.schema:
        raise SystemExit(f"manifest schemaVersion mismatch: expected {args.schema}, got {schema_version}")
    chain_id = manifest.get("chainId")
    block_number = manifest.get("blockNumber")
    if chain_id is None or block_number is None:
        raise SystemExit("manifest missing chainId/blockNumber")

    addresses = manifest.get("addresses") or {}
    if not isinstance(addresses, dict):
        raise SystemExit("manifest.addresses must be an object")

    out_dir = Path(args.out)
    if not out_dir.exists():
        raise SystemExit(f"missing out/ directory: {out_dir} (run: forge build)")
    dest_dir = Path(args.dest)
    if dest_dir.exists():
        # clean but keep directory
        for p in dest_dir.glob("*"):
            if p.is_file():
                p.unlink()
            elif p.is_dir():
                import shutil
                shutil.rmtree(p)
    dest_dir.mkdir(parents=True, exist_ok=True)

    exported: List[Dict[str, Any]] = []

    # Export each required ABI
    for file_name, _fq, addr_key in REQUIRED_CONTRACTS:
        artifact_path = _find_artifact(out_dir, file_name)
        abi = _load_abi_from_artifact(artifact_path)

        abi_obj = {
            "contract": file_name,
            "abi": abi,
        }
        abi_file = f"{file_name}.abi.json"
        _write_json(dest_dir / abi_file, abi_obj)

        exported.append({
            "name": file_name,
            "addressKey": addr_key,
            "address": _contract_key_to_address(addresses, addr_key) if addr_key != "__bank_type__" else None,
            "abiFile": abi_file,
            "abiSha256": _sha256_hex((dest_dir / abi_file).read_bytes()),
        })

    # Add per-asset banks (addresses from manifest.assets[])
    assets = manifest.get("assets") or []
    if isinstance(assets, list):
        for a in assets:
            if not isinstance(a, dict):
                continue
            bank = a.get("bank")
            asset = a.get("asset")
            if isinstance(bank, str) and isinstance(asset, str):
                exported.append({
                    "name": "BankInstance",
                    "asset": asset,
                    "address": bank,
                    "abiFile": "Bank.abi.json",
                })

    index = {
        "schemaVersion": args.schema,
        "generatedAt": int(time.time()),
        "chainId": chain_id,
        "blockNumber": block_number,
        "gitSha": args.git_sha,
        "manifestPath": str(manifest_path),
        "contracts": exported,
    }
    _write_json(dest_dir / "index.json", index)

    # Also write an immutable per-release copy for auditability.
    release_dir = Path("deployments/release")
    release_dir.mkdir(parents=True, exist_ok=True)
    per_release = release_dir / f"abi-index-{chain_id}-{block_number}.json"
    _write_json(per_release, index)

    print(f"Wrote: {dest_dir / 'index.json'}")
    print(f"Wrote: {len(list(dest_dir.glob('*.abi.json')))} ABI files")

if __name__ == "__main__":
    main()
