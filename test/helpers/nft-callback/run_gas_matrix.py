#!/usr/bin/env python3
"""Run each callback gas case in an independent Forge setUp/test transaction pair.

Only local forks; never sends transactions. RPC is provided by NFT_GAS_RPC_URL.
Exit 0 proves the requested semantic checks, NOT that all callbacks fit the provider
budget. Use --require-fit to make every sampled budget failure fail this runner.
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = "test/fork/NftCallbackGasQualificationFork.t.sol"
FIT_LABEL = "provider bounded callback settled"


def source_manifest(cases_path: Path) -> str:
    # Cover production/test inputs and a superset of compiled Solidity dependencies.
    # Upstream identity is still authenticated by the separate dependency gate.
    paths = set()
    for directory in ("src", "lib/forge-std/src", "lib/openzeppelin-contracts/contracts", "lib/chainlink-brownie-contracts/contracts"):
        paths.update((ROOT / directory).rglob("*.sol"))
    paths.update({ROOT / FIXTURE, Path(__file__), cases_path.resolve(), ROOT / "foundry.toml", ROOT / "deps.lock"})
    lines = []
    for path in sorted(paths):
        if path.is_file():
            label = str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else path.name
            lines.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {label}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("gas-qualification-cases.json"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--filter", default="*")
    parser.add_argument("--require-fit", action="store_true")
    parser.add_argument("--isolate-build", action="store_true", help="use Forge out/cache directories inside this output")
    args = parser.parse_args()
    rpc = os.environ.get("NFT_GAS_RPC_URL")
    if not rpc:
        parser.error("NFT_GAS_RPC_URL must name a Base Sepolia archive RPC; do not put credentials in arguments")
    forge = shutil.which("forge") or str(Path.home() / ".foundry/bin/forge")
    cases = json.loads(args.cases.read_text())
    cases = [case for case in cases if fnmatch.fnmatchcase(case["name"], args.filter)]
    if not cases:
        parser.error("no cases match filter")
    names = [case["name"] for case in cases]
    if len(set(names)) != len(names) or any(not re.fullmatch(r"[a-z0-9-]+", name) for name in names):
        parser.error("case names must be unique safe lowercase filenames")
    args.output.mkdir(parents=True, exist_ok=True)
    build_args = ["--out", str((args.output / "forge-out").resolve()),
                  "--cache-path", str((args.output / "forge-cache").resolve())] if args.isolate_build else []
    source_before = source_manifest(args.cases)
    (args.output / "SOURCE_BEFORE.sha256").write_text(source_before)
    # Foundry also accepts legacy DAPP_* options. Neither may override the pinned build.
    base = {key: value for key, value in os.environ.items()
            if not key.startswith(("NFT_GAS_", "FOUNDRY_", "DAPP_"))}
    base.update(NFT_GAS_RPC_URL=rpc, NFT_GAS_QUALIFICATION_FORK="true", FOUNDRY_PROFILE="default")
    cfg = subprocess.run([forge, "config", "--json"], cwd=ROOT, env=base, text=True,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if cfg.returncode:
        parser.error("cannot read effective Forge configuration; endpoint-bearing diagnostics withheld")
    full_cfg = json.loads(cfg.stdout)
    expected = {"solc": "0.8.37", "evm_version": "cancun", "via_ir": True, "optimizer": True, "optimizer_runs": 500}
    effective = {key: full_cfg.get(key) for key in expected}
    effective["profile"] = "default"
    effective["forgeVersion"] = subprocess.check_output([forge, "--version"], text=True, env=base).strip()
    (args.output / "forge-effective-config.json").write_text(json.dumps(effective, indent=2) + "\n")
    if any(effective[key] != value for key, value in expected.items()):
        parser.error("effective compiler config differs from the explicitly qualified configuration")
    if args.require_fit:
        base["NFT_GAS_REQUIRE_FIT"] = "true"
    results = []
    source_drift = False
    for case in cases:
        case_source = source_manifest(args.cases)
        if case_source != source_before:
            source_drift = True
            print(json.dumps({"sourceDriftBeforeCase": case["name"]}), flush=True)
            break
        config = {key: value for key, value in case.items() if key != "name"}
        env = dict(base)
        for key, value in config.items():
            env["NFT_GAS_" + key] = str(value).lower() if isinstance(value, bool) else str(value)
        if args.require_fit:
            env["NFT_GAS_REQUIRE_FIT"] = "true"
        started = time.time()
        process = subprocess.run(
            [forge, "test", "--threads", "1", "--match-path", FIXTURE, *build_args, "-vv"],
            cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False,
        )
        # Avoid storing RPC credentials if Foundry includes the configured endpoint in an error.
        output = process.stdout.replace(rpc, "<private RPC>")
        log_path = args.output / f"{case['name']}.log"
        log_path.write_text(output)
        row = {"name": case["name"], "config": config, "exitCode": process.returncode,
               "elapsedSeconds": round(time.time() - started, 2), "log": log_path.name,
               "inputManifestSha256": hashlib.sha256(case_source.encode()).hexdigest()}
        for line in output.splitlines():
            match = re.fullmatch(r"  ([^:]+): (\d+)", line)
            if match:
                row[match[1]] = int(match[2])
        row["semanticChecksPassed"] = process.returncode == 0 and FIT_LABEL in row
        if not row["semanticChecksPassed"]:
            row["failure"] = "; ".join(line.strip() for line in output.splitlines() if "FAIL" in line or "Error:" in line)
        results.append(row)
        print(json.dumps(row), flush=True)
        (args.output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
        if process.returncode and "Compiler run failed" in output:
            break  # A common build failure cannot provide independent per-case gas observations.
    source_after = source_manifest(args.cases)
    (args.output / "SOURCE_AFTER.sha256").write_text(source_after)
    source_unchanged = not source_drift and source_before == source_after
    semantic = sum(bool(row["semanticChecksPassed"]) for row in results)
    fits = sum(row.get(FIT_LABEL) == 1 for row in results)
    summary = {"requestedCases": len(cases), "cases": len(results), "semanticChecksPassed": semantic, "callbacksFit": fits,
               "callbacksDidNotFit": sum(row.get(FIT_LABEL) == 0 for row in results),
               "requireFit": args.require_fit, "sourceUnchanged": source_unchanged,
               "isolatedBuild": args.isolate_build,
               "scope": "Sampled local real-wrapper callbacks; excludes proof/billing and is not a worst-case bound."}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
    return 0 if source_unchanged and semantic == len(cases) and (not args.require_fit or fits == len(results)) else 1


if __name__ == "__main__":
    raise SystemExit(main())
