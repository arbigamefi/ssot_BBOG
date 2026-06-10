#!/usr/bin/env python3
"""Fail if frontend-published Bank ABI drifts from the compiled artifact.

The frontend consumes per-chain ABI files from
`frontend/packages/ssot/src/abis/release/chain-*/Bank.abi.json`. Bank SSOT
shape changes are high-risk because the UI reads accounting truth through
`getSSOT()`. This guard compares the `getSSOT` output tuple from those
frontend ABI files against `out/Bank.sol/Bank.json`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _load_abi(path: Path) -> list[dict[str, Any]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"missing ABI/artifact: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON: {path}: {exc}")

    abi = raw if isinstance(raw, list) else raw.get("abi")
    if not isinstance(abi, list):
        raise SystemExit(f"{path}: expected ABI array or object with 'abi' array")
    return abi


def _get_function_outputs(path: Path, name: str) -> list[dict[str, Any]]:
    matches = [item for item in _load_abi(path) if item.get("type") == "function" and item.get("name") == name]
    if len(matches) != 1:
        raise SystemExit(f"{path}: expected exactly one function named {name!r}, found {len(matches)}")
    outputs = matches[0].get("outputs")
    if not isinstance(outputs, list):
        raise SystemExit(f"{path}: {name} outputs must be an array")
    return outputs


def _normalize_abi_param(param: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "name": param.get("name", ""),
        "type": param.get("type", ""),
        "internalType": param.get("internalType", ""),
    }
    components = param.get("components")
    if components is not None:
        if not isinstance(components, list):
            raise SystemExit(f"ABI component {param.get('name', '<unnamed>')} has non-array components")
        normalized["components"] = [_normalize_abi_param(component) for component in components]
    return normalized


def _summarize(outputs: list[dict[str, Any]]) -> str:
    rows: list[str] = []

    def visit(param: dict[str, Any], prefix: str) -> None:
        name = param.get("name", "")
        typ = param.get("type", "")
        rows.append(f"{prefix}{name}:{typ}")
        for index, component in enumerate(param.get("components", [])):
            visit(component, f"{prefix}{index}.")

    for index, output in enumerate(outputs):
        visit(output, f"{index}.")
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", default="out/Bank.sol/Bank.json")
    parser.add_argument(
        "--frontend-glob",
        default="frontend/packages/ssot/src/abis/release/chain-*/Bank.abi.json",
        help="Glob of frontend-published Bank ABI files to compare.",
    )
    args = parser.parse_args()

    artifact_path = Path(args.artifact)
    expected_outputs = [_normalize_abi_param(output) for output in _get_function_outputs(artifact_path, "getSSOT")]
    expected_summary = _summarize(expected_outputs)

    frontend_paths = sorted(Path(".").glob(args.frontend_glob))
    if not frontend_paths:
        raise SystemExit(f"no frontend Bank ABI files matched: {args.frontend_glob}")

    failures: list[str] = []
    for path in frontend_paths:
        actual_outputs = [_normalize_abi_param(output) for output in _get_function_outputs(path, "getSSOT")]
        if actual_outputs != expected_outputs:
            failures.append(
                f"{path}: getSSOT output tuple drifted from {artifact_path}\n"
                f"expected:\n{expected_summary}\n"
                f"actual:\n{_summarize(actual_outputs)}"
            )

    if failures:
        raise SystemExit("\n\n".join(failures))

    print(f"Bank getSSOT ABI drift check passed ({len(frontend_paths)} frontend ABI file(s)).")


if __name__ == "__main__":
    main()
