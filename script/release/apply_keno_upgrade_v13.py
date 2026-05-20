#!/usr/bin/env python3
"""Apply a Keno-only module upgrade JSON to a v1.3 deployment snapshot.

This keeps the normal release pipeline intact:
1. KenoModuleUpgradeV13 writes deployments/keno-upgrade-latest-v13.json.
2. This script updates deployments/latest-v13.json with the new moduleKeno and block metadata.
3. Existing make release-* targets regenerate manifest, vectors, digest, notes, ABIs.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_SNAPSHOT = Path("deployments/latest-v13.json")
DEFAULT_UPGRADE = Path("deployments/keno-upgrade-latest-v13.json")


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def normalize_addr(value: str) -> str:
    return value.lower()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--upgrade", type=Path, default=DEFAULT_UPGRADE)
    parser.add_argument(
        "--allow-previous-mismatch",
        action="store_true",
        help="Allow applying the upgrade even when previousModuleKeno does not match the snapshot.",
    )
    args = parser.parse_args()

    snapshot = load_json(args.snapshot)
    upgrade = load_json(args.upgrade)

    if upgrade.get("schema") != "SSOT_KENO_MODULE_UPGRADE_V13":
        raise SystemExit(f"Unexpected upgrade schema in {args.upgrade}: {upgrade.get('schema')!r}")

    if int(snapshot["chainId"]) != int(upgrade["chainId"]):
        raise SystemExit("chainId mismatch between snapshot and upgrade")

    if normalize_addr(snapshot["gameHub"]) != normalize_addr(upgrade["gameHub"]):
        raise SystemExit("gameHub mismatch between snapshot and upgrade")

    snapshot_previous = normalize_addr(snapshot["moduleKeno"])
    upgrade_previous = normalize_addr(upgrade["previousModuleKeno"])
    if snapshot_previous != upgrade_previous and not args.allow_previous_mismatch:
        raise SystemExit(
            "previous module mismatch: "
            f"snapshot has {snapshot['moduleKeno']}, upgrade expected {upgrade['previousModuleKeno']}"
        )

    snapshot["moduleKeno"] = upgrade["moduleKeno"]
    snapshot["blockNumber"] = int(upgrade["blockNumber"])
    snapshot["timestamp"] = int(upgrade["timestamp"])

    write_json(args.snapshot, snapshot)
    print(f"updated {args.snapshot}")
    print(f"moduleKeno={snapshot['moduleKeno']}")
    print(f"blockNumber={snapshot['blockNumber']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
