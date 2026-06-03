#!/usr/bin/env python3
"""Merge an AddCasinoPoolV13 artifact into deployments/latest-v13.json.

This keeps the on-chain incremental pool deployment separate from release
artifact mutation. Run after a successful AddCasinoPoolV13 broadcast, then
regenerate the frontend manifest with `make release-frontend-manifest-v13`.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


DEFAULT_SNAPSHOT = Path("deployments/latest-v13.json")
DEFAULT_POOL_ADD = Path("deployments/pool-add-latest-v13.json")


def _load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=False)
        handle.write("\n")


def _pool_ids(snapshot: dict) -> set[int]:
    count = int(snapshot.get("numPools", 0))
    return {int(snapshot[f"poolId_{i}"]) for i in range(count) if f"poolId_{i}" in snapshot}


def apply_pool_add(snapshot_path: Path, pool_add_path: Path, output_path: Path) -> None:
    snapshot = _load(snapshot_path)
    pool_add = _load(pool_add_path)

    if pool_add.get("schema") != "SSOT_CASINO_POOL_ADD_V13":
        raise SystemExit(f"{pool_add_path} is not an SSOT_CASINO_POOL_ADD_V13 artifact")
    if int(snapshot["chainId"]) != int(pool_add["chainId"]):
        raise SystemExit("chainId mismatch between snapshot and pool-add artifact")

    pool_id = int(pool_add["poolId"])
    if pool_id in _pool_ids(snapshot):
        raise SystemExit(f"poolId {pool_id} already exists in {snapshot_path}")

    index = int(snapshot.get("numPools", 0))
    snapshot["numPools"] = index + 1
    snapshot["blockNumber"] = int(pool_add["blockNumber"])
    snapshot["timestamp"] = int(pool_add["timestamp"])

    suffix = str(index)
    mapping = {
        "poolId": "poolId",
        "poolDomain": "poolDomain",
        "poolDomainLabel": "poolDomainLabel",
        "poolAsset": "poolAsset",
        "poolAssetSymbol": "poolAssetSymbol",
        "poolAssetDecimals": "poolAssetDecimals",
        "poolBank": "poolBank",
        "poolBankMinLiqBps": "poolBankMinLiqBps",
        "poolBankMinTurnoverForUnlock": "poolBankMinTurnoverForUnlock",
        "poolBankHoldbackVestingSeconds": "poolBankHoldbackVestingSeconds",
        "poolLpName": "poolLpName",
        "poolLpSymbol": "poolLpSymbol",
        "poolLpDecimals": "poolLpDecimals",
        "ctorArgs_bank": "ctorArgs_bank",
    }
    for source, target_prefix in mapping.items():
        snapshot[f"{target_prefix}_{suffix}"] = pool_add[source]

    snapshot[f"poolActive_{suffix}"] = 1
    snapshot[f"poolSportsMaxStake_{suffix}"] = 0
    snapshot[f"poolSportsMaxPayout_{suffix}"] = 0
    snapshot[f"poolSportsMaxMarketReserved_{suffix}"] = 0
    snapshot[f"poolSportsMaxOutcomeReserved_{suffix}"] = 0
    snapshot[f"poolSportsMaxEventReserved_{suffix}"] = 0
    snapshot[f"poolSportsRiskHash_{suffix}"] = (
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    )

    if output_path == snapshot_path:
        backup_path = snapshot_path.with_name(
            f"{snapshot_path.stem}.before-pool-add-{pool_add['chainId']}-{pool_add['blockNumber']}{snapshot_path.suffix}"
        )
        shutil.copyfile(snapshot_path, backup_path)
        print(f"backup: {backup_path}")

    _write(output_path, snapshot)
    print(f"merged poolId {pool_id} into {output_path} at index {index}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--pool-add", type=Path, default=DEFAULT_POOL_ADD)
    parser.add_argument("--out", type=Path, default=DEFAULT_SNAPSHOT)
    args = parser.parse_args()
    apply_pool_add(args.snapshot, args.pool_add, args.out)


if __name__ == "__main__":
    main()
