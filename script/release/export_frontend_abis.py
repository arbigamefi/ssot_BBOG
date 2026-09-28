#!/usr/bin/env python3
"""Export the current compiled ABIs, without bytecode or deployment inference.

--source-only generates the single frontend/keeper ABI source and its JS/TS entrypoints.
Without that flag, export a current release inventory bound to an explicit manifest.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import time

REQUIRED_CONTRACTS = [
    # core
    ("GameHub", "src/core/GameHub.sol:GameHub", "gameHub"),
    ("VRFHub", "src/core/VRFHub.sol:VRFHub", "vrfHub"),
    ("PoolRegistry", "src/core/PoolRegistry.sol:PoolRegistry", "poolRegistry"),
    ("SettlementRouter", "src/core/SettlementRouter.sol:SettlementRouter", "settlementRouter"),
    ("SportsRiskEngine", "src/core/SportsRiskEngine.sol:SportsRiskEngine", "sportsRiskEngine"),
    ("SportsHub", "src/core/SportsHub.sol:SportsHub", "sportsHub"),
    ("ReferralRegistry", "src/engines/referral/ReferralRegistry.sol:ReferralRegistry", "refRegistry"),
    ("DefaultReferralEngine", "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine", "refEngine"),
    # adapter
    ("ChainlinkV2PlusWrapperAdapter", "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter", "adapter"),
    # modules
    ("DiceModule", "src/modules/dice/DiceModule.sol:DiceModule", "moduleDice"),
    ("CoinTossModule", "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "moduleCoinToss"),
    ("RouletteModule", "src/modules/roulette/RouletteModule.sol:RouletteModule", "moduleRoulette"),
    ("KenoModule", "src/modules/keno/KenoModule.sol:KenoModule", "moduleKeno"),
    ("PlinkoModule", "src/modules/plinko/PlinkoModule.sol:PlinkoModule", "modulePlinko"),
    ("SicBoModule", "src/modules/sicbo/SicBoModule.sol:SicBoModule", "moduleSicBo"),
    ("SlotsModule", "src/modules/slots/SlotsModule.sol:SlotsModule", "moduleSlots"),
    ("BaccaratModule", "src/modules/baccarat/BaccaratModule.sol:BaccaratModule", "moduleBaccarat"),
    # bank (type)
    ("Bank", "src/core/Bank.sol:Bank", "__bank_type__"),
    ("IGameModule", "src/core/interfaces/IGameModule.sol:IGameModule", "__interface__"),
]

def _sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def _find_artifact(out_dir: Path, qualified_name: str) -> Path:
    source, name = qualified_name.split(":")
    artifact = out_dir / Path(source).name / f"{name}.json"
    if not artifact.is_file():
        raise FileNotFoundError(f"Missing current Foundry artifact: {artifact} (run: forge build)")
    return artifact


def _write_entrypoints(dest: Path) -> None:
    names = [row[0] for row in REQUIRED_CONTRACTS]
    js = ["// Generated from current Foundry artifacts by script/release/export_frontend_abis.py."]
    types = ['import type { Abi } from "viem";']
    for name in names:
        js.append(f'import {name} from "./contracts/{name}.abi.json" with {{ type: "json" }};')
        js.append(f'export const {name}Abi = {name}.abi;')
        types.append(f'export declare const {name}Abi: Abi;')
    js.extend(['const abis = Object.freeze({', *[f'  {name}Abi,' for name in names], '});',
               'export function getContractAbis() { return abis; }', ''])
    types.extend(['export declare function getContractAbis(): {',
                  *[f'  readonly {name}Abi: Abi;' for name in names], '};', ''])
    (dest.parent / 'index.mjs').write_text('\n'.join(js))
    (dest.parent / 'index.d.mts').write_text('\n'.join(types))
    (dest.parent / 'index.ts').write_text('export * from "./index.mjs";\n')


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
    ap.add_argument("--manifest", default="deployments/frontend-manifest-latest-v16.json")
    ap.add_argument("--out", default="out")
    ap.add_argument("--dest", default=None)
    ap.add_argument("--source-only", action="store_true")
    ap.add_argument("--git-sha", default=os.environ.get("GIT_SHA", ""))
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    manifest = {}
    if not args.source_only:
        manifest = _read_json(manifest_path)
        if manifest.get("schemaVersion") != 2 or manifest.get("architectureVersion") != "v1.6-house-edge-allocation":
            raise SystemExit("manifest must describe the current v1.6 architecture and schemaVersion=2")
        if manifest.get("chainId") is None or manifest.get("blockNumber") is None:
            raise SystemExit("manifest missing chainId/blockNumber")
    addresses = manifest.get("addresses", {})
    if not isinstance(addresses, dict):
        raise SystemExit("manifest.addresses must be an object")
    chain_id = manifest.get("chainId")
    block_number = manifest.get("blockNumber")

    out_dir = Path(args.out)
    if not out_dir.exists():
        raise SystemExit(f"missing out/ directory: {out_dir} (run: forge build)")
    # Resolve every artifact before replacing the generated source.
    source_abis = [(name, key, _load_abi_from_artifact(_find_artifact(out_dir, qualified)))
                   for name, qualified, key in REQUIRED_CONTRACTS]
    dest_dir = Path(args.dest or ("frontend/packages/ssot/src/abis/contracts" if args.source_only else "deployments/abis-v16"))
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
    for file_name, addr_key, abi in source_abis:

        abi_obj = {
            "contract": file_name,
            "abi": abi,
        }
        abi_file = f"{file_name}.abi.json"
        _write_json(dest_dir / abi_file, abi_obj)

        exported.append({
            "name": file_name,
            "addressKey": addr_key,
            "address": _contract_key_to_address(addresses, addr_key) if not addr_key.startswith("__") else None,
            "abiFile": abi_file,
            "abiSha256": _sha256_hex((dest_dir / abi_file).read_bytes()),
        })

    if args.source_only:
        _write_entrypoints(dest_dir)
        print(f"Wrote {len(exported)} current source ABIs and JS/TS entrypoints: {dest_dir}")
        return

    # Add per-pool banks (addresses from manifest.pools[]).
    pools = manifest.get("pools") or []
    if isinstance(pools, list):
        for p in pools:
            if not isinstance(p, dict):
                continue
            bank = p.get("bank")
            asset = p.get("asset")
            pool_id = p.get("poolId")
            domain = p.get("domain")
            if isinstance(bank, str) and isinstance(asset, str):
                exported.append({
                    "name": "BankInstance",
                    "poolId": pool_id,
                    "domain": domain,
                    "asset": asset,
                    "address": bank,
                    "abiFile": "Bank.abi.json",
                })

    index = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "chainId": chain_id,
        "blockNumber": block_number,
        "gitSha": args.git_sha,
        "manifestPath": str(manifest_path),
        "contracts": exported,
    }
    _write_json(dest_dir / "index.json", index)

    print(f"Wrote: {dest_dir / 'index.json'}")
    print(f"Wrote: {len(list(dest_dir.glob('*.abi.json')))} ABI files")

if __name__ == "__main__":
    main()
