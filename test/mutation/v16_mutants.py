#!/usr/bin/env python3
"""Replayable mutation check for the v1.6 release unit: house-edge allocation, NFT capital custody and durable VRF settlement.

Each mutant removes one guarantee of the current SSOT and NFT/callback decisions and names the tests that must catch it. The runner applies one
mutant at a time, runs those tests with FOUNDRY_PROFILE=pr, restores the source and reports whether the mutant
was killed (the named tests fail). It exits non-zero if a mutant survives, if a mutant does not compile, or if an
anchor is not found exactly once, which means the source moved and the mutant needs updating.

Usage (from the repository root):
  python3 test/mutation/v16_mutants.py              # every mutant; about half an hour with via-ir
  python3 test/mutation/v16_mutants.py M17 M19      # selected mutants
  python3 test/mutation/v16_mutants.py --check      # verify the anchors only, no tests
  python3 test/mutation/v16_mutants.py --out DIR    # keep per-mutant logs and summary.json in DIR
"""
import argparse
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

MUTANTS = [{'id': 'M01',
  'guarantee': 'the Router cap',
  'patches': [('src/core/SettlementRouter.sol',
               'if (allocated > cap) revert',
               'if (allocated > cap && positionId == type(uint256).max) revert')],
  'tests': ['test/unit/SettlementRouter.t.sol', 'test/invariants/SettlementRouterInvariants.t.sol']},
 {'id': 'M02',
  'guarantee': 'the Router edge bound',
  'patches': [('src/core/SettlementRouter.sol',
               'if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert',
               'if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS && player == address(1)) revert')],
  'tests': ['test/unit/SettlementRouter.t.sol', 'test/invariants/SettlementRouterInvariants.t.sol']},
 {'id': 'M03',
  'guarantee': 'the LP share (the engine accrues the full edge)',
  'patches': [('src/engines/referral/DefaultReferralEngine.sol',
               'alloc.operatorShare = HouseEdgeLib.operatorShare(alloc.edge);',
               'alloc.operatorShare = alloc.edge;')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/unit/GameHubRouter.t.sol']},
 {'id': 'M04',
  'guarantee': 'payee snapshot at acceptance',
  'patches': [('src/core/GameHub.sol',
               'ReferralPayees storage payees = betReferralPayees[betId];',
               'ReferralPayees memory payees; payees.l1 = '
               'IReferralRegistry(referralRegistry).referrerOf(b.player); if (payees.l1 != address(0)) '
               'payees.l2 = IReferralRegistry(referralRegistry).referrerOf(payees.l1);')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M05',
 'guarantee': 'no L0 without an acceptance-time referrer',
 'patches': [('src/engines/referral/DefaultReferralEngine.sol',
              'if (input.l1 != address(0)) {',
              'if (true) {')],
 'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M06',
  'guarantee': 'the 7-day delay',
  'patches': [('src/core/GameHub.sol',
               'if (block.timestamp < pending.activatesAt) revert EdgeChangeNotReady(pending.activatesAt);',
               '')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol']},
 {'id': 'M07',
 'guarantee': 'the user-signed house-edge ceiling is enforced',
 'patches': [('src/core/GameHub.sol',
              'if (houseEdge > usedMaxHE) revert HouseEdgeTooHigh(houseEdge, usedMaxHE);',
              '')],
 'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/unit/GameHubRouter.t.sol']},
 {'id': 'M08',
 'guarantee': 'missing referral rewards and rounding remain protocol fees',
 'patches': [('src/engines/referral/DefaultReferralEngine.sol',
              'alloc.protocolFee = alloc.operatorShare - alloc.r0 - alloc.r1 - alloc.r2;',
              'alloc.protocolFee = 0;')],
 'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M09',
  'guarantee': 'the 35% schedule cap',
  'patches': [('src/core/GameHub.sol',
               'if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);',
               'if (rates > BPS) revert Errors.InvalidBps(rates);')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/unit/SecurityFixes.t.sol']},
 {'id': 'M11',
 'guarantee': 'settlement uses the accepted house-edge snapshot',
 'patches': [('src/core/GameHub.sol',
              'houseEdgeBps: b.houseEdgeBps,',
              'houseEdgeBps: defaultHouseEdgeBps,')],
 'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M12',
  'guarantee': 'schedule fixed at acceptance',
  'patches': [('src/core/GameHub.sol',
               'ReferralSchedule storage cfg = _refCfg[b.referralConfigId];',
               'ReferralSchedule storage cfg = _refCfg[activeReferralConfigId];')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol', 'test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M13',
 'guarantee': 'new positions respect the 128-open-hold limit',
 'patches': [('src/core/Bank.sol', 'if (openHolds() >= MAX_OPEN_HOLDS) revert OpenHoldLimit();', '')],
 'tests': ['test/unit/BankNFTAccounting.t.sol']},
 {'id': 'M14',
 'guarantee': 'cancelling the queued edge change clears it',
 'patches': [('src/core/GameHub.sol',
              '        delete _pendingEdgeChange;\n        emit EdgeChangeCancelled',
              '        emit EdgeChangeCancelled')],
 'tests': ['test/unit/HouseEdgeAllocationV16.t.sol']},
 {'id': 'M15',
 'guarantee': 'only the immutable Bank may lock or settle Vault capital',
 'patches': [('src/core/LiquidityVault.sol', 'if (msg.sender != bank) revert OnlyBank();', '')],
 'tests': ['test/unit/LiquidityVaultAdversarial.t.sol', 'test/unit/BankNFTAccounting.t.sol']},
 {'id': 'M16',
  'guarantee': 'the one-day refund timeout bound (audit O-06)',
  'patches': [('src/core/GameHub.sol', 'seconds_ > MAX_REFUND_TIMEOUT_SECONDS', 'false')],
  'tests': ['test/unit/HouseEdgeAllocationV16.t.sol']},
 {'id': 'M17',
  'guarantee': 'a claim of exactly the cap is accepted (Router invariant, audit O-03)',
  'patches': [('src/core/SettlementRouter.sol',
               'if (allocated > cap) revert',
               'if (allocated > cap || (allocated == cap && cap > 0)) revert')],
  'tests': ['test/invariants/SettlementRouterInvariants.t.sol']},
 {'id': 'M18',
 'guarantee': 'a pending edge change prevents release acceptance',
 'patches': [('script/release/V16Snapshot.sol',
              '        require(activatesAt == 0, "pending edge change is not part of the release");\n',
              '')],
 'tests': ['test/unit/DeploymentV16.t.sol'],
 'args': ['--threads', '1']},
 {'id': 'M19',
  'guarantee': 'a correctly priced bet is not refused (differential test, audit O-03)',
  'patches': [('src/core/GameHub.sol',
               'if (stakeSpec.betCount == 0 || stakeSpec.betCount > gameMaxBetCount[gameId]) revert '
               'Errors.InvalidConfig();',
               'if (stakeSpec.betCount == 0 || stakeSpec.betCount > gameMaxBetCount[gameId] || '
               'stakeSpec.betCount == 3) revert Errors.InvalidConfig();')],
  'tests': ['test/diff/StatefulSystemDiff.t.sol']},
 {'id': 'M20',
  'guarantee': "Bank pulls only the authenticated hub's stake, not a player's deposit approval",
  'patches': [('src/core/Bank.sol',
               '_assetToken.safeTransferFrom(fundingHub, address(this), stake);',
               '_assetToken.safeTransferFrom(player, address(this), stake);')],
  'tests': ['test/unit/SettlementRouter.t.sol', 'test/unit/GameHubRouter.t.sol']},
 {'id': 'M21',
  'guarantee': 'accepted refund rights do not change with governance timeout updates',
  'patches': [('src/core/GameHub.sol',
               'uint256 readyAt = b.refundDeadline;',
               'uint256 readyAt = uint256(b.placedAt) + refundTimeoutSeconds;')],
  'tests': ['test/unit/GameHubRouter.t.sol']},
 {'id': 'M22',
  'guarantee': 'minimum per-round amount cannot be bypassed by buying more rounds',
  'patches': [('src/core/GameHub.sol',
               'if (stakeSpec.amountPerRoll < minimum) {\n'
               '            revert IBank.BetAmountBelowMinimum(stakeSpec.amountPerRoll, minimum);\n'
               '        }', '')],
  'tests': ['test/unit/GameHubRouter.t.sol']},
 {'guarantee': 'NFT cash belongs to its current owner',
  'patches': [('src/core/LiquidityVault.sol', 'if (owner != msg.sender) revert NotDepositOwner();', '')],
  'tests': ['test/unit/LiquidityVaultAdversarial.t.sol'],
  'id': 'M23'},
 {'guarantee': 'the fixed deposit maturity is enforced',
  'patches': [('src/core/LiquidityVault.sol',
               'if (block.timestamp < withdrawAfter[id]) revert '
               'LPUnavailable(ILiquidityVaultBank.LPStatus.CoolingDown);',
               '')],
  'tests': ['test/unit/LiquidityVaultAdversarial.t.sol'],
  'id': 'M24'},
 {'guarantee': 'NFT withdrawals preserve locked capital',
  'patches': [('src/core/LiquidityVault.sol', 'if (assets > free) revert InsufficientFreeCapital();', '')],
  'tests': ['test/unit/LiquidityVaultAdversarial.t.sol'],
  'id': 'M25'},
 {'guarantee': 'a position removes all pending principal exactly once',
  'patches': [('src/core/Bank.sol', 'pendingStakeTotal -= h.stake;', '')],
  'tests': ['test/unit/BankNFTAccounting.t.sol', 'test/unit/NftCallbackIntegration.t.sol'],
  'id': 'M26'},
 {'guarantee': 'received results fence LP operations until accounting',
  'patches': [('src/core/VRFHub.sol', '++unbookedResultCount[r.bank];', '')],
  'tests': ['test/unit/VRFHubDirect.t.sol', 'test/unit/NftCallbackIntegration.t.sol'],
  'id': 'M27'},
 {'guarantee': 'successful accounting clears its result fence',
  'patches': [('src/core/VRFHub.sol', '--unbookedResultCount[r.bank];', '')],
  'tests': ['test/unit/VRFHubDirect.t.sol', 'test/unit/NftCallbackIntegration.t.sol'],
  'id': 'M28'},
 {'guarantee': 'a seed cannot be replaced by a duplicate response',
  'patches': [('src/core/VRFHub.sol',
               'if (r.state != RequestState.Awaiting || words.length != 1) {',
               'if (r.state == RequestState.None || words.length != 1) {')],
  'tests': ['test/unit/VRFHubDirect.t.sol'],
  'id': 'M29'},
 {'guarantee': 'only the owning Hub can acknowledge a result',
  'patches': [('src/core/VRFHub.sol',
               'if (msg.sender != r.hub) revert NotOwningHub();\n'
               '        if (r.state != RequestState.Received)',
               'if (r.state != RequestState.Received)')],
  'tests': ['test/unit/VRFHubDirect.t.sol'],
  'id': 'M30'},
 {'guarantee': 'native excess paid successfully does not create credit',
  'patches': [('src/core/VRFHub.sol', 'if (!refunded) {', 'if (refunded) {')],
  'tests': ['test/unit/VRFHubDirect.t.sol'],
  'id': 'M31'}]


def check_anchors(mutants):
    problems = []
    for m in mutants:
        for path, old, _ in m["patches"]:
            count = (ROOT / path).read_text().count(old)
            if count != 1:
                problems.append(f"{m['id']}: anchor found {count} times in {path}: {old[:70]!r}")
    return problems


def forge_environment(out_dir):
    # Keep mutant artifacts and failing sequences separate from the canonical build. A later ABI export
    # or local integration test must never pick up a deliberately broken Bank from out/.
    clean = {key: value for key, value in os.environ.items()
             if not key.startswith(("FOUNDRY_", "DAPP_"))}
    return {**clean, "FOUNDRY_PROFILE": "pr",
            "FOUNDRY_FUZZ_SEED": os.environ.get("FOUNDRY_FUZZ_SEED", "0x160035"),
            "FOUNDRY_OUT": str(out_dir / "build"),
            "FOUNDRY_CACHE_PATH": str(out_dir / "cache"),
            "FOUNDRY_FUZZ_FAILURE_PERSIST_DIR": str(out_dir / "fuzz"),
            "FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR": str(out_dir / "invariant")}


def failing_methods(output):
    # Unit/fuzz failures name their method on the [FAIL] line; an invariant counterexample names its
    # method on the following indented line. Do not mistake suite/setup failures for a killed mutant.
    methods = set(re.findall(r"^\[FAIL[^\n]*?\] (\w+)\(", output, re.M))
    methods |= set(re.findall(r"^\s+(\w+)\(\) \(runs: \d+", output, re.M))
    return sorted(methods)


def classify_mutant(returncode, output):
    failures = failing_methods(output)
    tests = [name for name in failures if name.startswith(("test", "invariant_"))]
    if returncode not in (0, 1) or len(tests) != len(failures):
        return "error", failures
    if returncode == 0:
        # A misspelled --match-path can otherwise produce a false survivor with no test execution.
        return ("survived" if re.search(r"^\[PASS\] ", output, re.M) else "error"), failures
    return ("killed" if tests else "error"), failures


def run_baseline(mutants, out_dir):
    paths = sorted({path for mutant in mutants for path in mutant["tests"]})
    match = paths[0] if len(paths) == 1 else "{" + ",".join(paths) + "}"
    # Deployment tests change process-wide Foundry environment variables, so serialize the baseline.
    cmd = ["forge", "test", "--match-path", match, "--threads", "1"]
    started = time.time()
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=forge_environment(out_dir))
    output = result.stdout + result.stderr
    (out_dir / "baseline.log").write_text(output)
    passed = len(re.findall(r"^\[PASS\] ", output, re.M))
    return {"command": cmd, "tests": paths, "returncode": result.returncode, "passedTests": passed,
            "outcome": "passed" if result.returncode == 0 and passed > 0 else "error",
            "seconds": round(time.time() - started)}


def run_mutant(m, out_dir):
    backups = {}
    patched = {}
    try:
        for path, old, new in m["patches"]:
            file = ROOT / path
            backups.setdefault(path, file.read_bytes())
            current = file.read_bytes().decode("utf-8")
            if current.count(old) != 1:
                raise RuntimeError(f"Source changed before mutation: {path}")
            patched[path] = current.replace(old, new, 1).encode("utf-8")
            file.write_bytes(patched[path])
        paths = m["tests"]
        match = paths[0] if len(paths) == 1 else "{" + ",".join(paths) + "}"
        cmd = ["forge", "test", "--match-path", match, "--threads", "1"]
        started = time.time()
        result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=forge_environment(out_dir))
        output = result.stdout + result.stderr
        (out_dir / f"{m['id']}.log").write_text(output)
        outcome, failing = classify_mutant(result.returncode, output)
        return {"id": m["id"], "guarantee": m["guarantee"], "tests": paths, "outcome": outcome,
                "failingTests": failing, "returncode": result.returncode,
                "seconds": round(time.time() - started)}
    finally:
        conflicts = []
        for path, content in backups.items():
            file = ROOT / path
            if file.read_bytes() == patched.get(path, content):
                file.write_bytes(content)
            elif file.read_bytes() != content:
                # Never overwrite concurrent user edits with the saved preimage.
                recovery = out_dir / "source-preimages" / path
                recovery.parent.mkdir(parents=True, exist_ok=True)
                recovery.write_bytes(content)
                conflicts.append(path)
        if conflicts:
            raise RuntimeError(f"Concurrent source changes preserved; mutation stopped: {conflicts}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("ids", nargs="*", help="mutant ids to run (default: all)")
    parser.add_argument("--check", action="store_true", help="verify anchors only")
    parser.add_argument("--out", help="directory for per-mutant logs and summary.json")
    args = parser.parse_args(argv)

    selected = [m for m in MUTANTS if not args.ids or m["id"] in args.ids]
    unknown = set(args.ids) - {m["id"] for m in MUTANTS}
    if unknown:
        print(f"unknown mutant ids: {sorted(unknown)}", file=sys.stderr)
        return 2
    problems = check_anchors(selected)
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 2
    if args.check:
        print(f"{len(selected)} mutants, every anchor found exactly once")
        return 0

    out_dir = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix="mutation-v16-"))
    out_dir.mkdir(parents=True, exist_ok=True)
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    # HEAD does not identify uncommitted prelaunch work. Record exact Solidity/test inputs as well.
    inputs = sorted([*ROOT.joinpath("src").rglob("*.sol"), *ROOT.joinpath("test").rglob("*.sol"),
                     *ROOT.joinpath("script").rglob("*.sol"),
                     ROOT / "foundry.toml", ROOT / "deps.lock", Path(__file__).resolve()])
    input_hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}
    summary = {"commit": commit, "inputSha256": input_hashes,
               "fuzzSeed": forge_environment(out_dir)["FOUNDRY_FUZZ_SEED"], "baseline": None, "results": []}

    def save_summary():
        (out_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")

    save_summary()
    try:
        summary["baseline"] = run_baseline(selected, out_dir)
        save_summary()
        print(f"baseline {summary['baseline']['outcome']}: {summary['baseline']['passedTests']} tests "
              f"({summary['baseline']['seconds']}s)", flush=True)
        if summary["baseline"]["outcome"] != "passed":
            return 1
        for m in selected:
            result = run_mutant(m, out_dir)
            summary["results"].append(result)
            print(f"{result['id']} {result['outcome']:8} {len(result['failingTests']):3} failing "
                  f"({result['seconds']}s) {result['guarantee']}", flush=True)
            save_summary()
    finally:
        summary["restoredSha256"] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                                     for path in inputs}
        summary["sourceRestored"] = summary["restoredSha256"] == input_hashes
        save_summary()
    print(f"logs and summary.json in {out_dir}")
    return 0 if summary["sourceRestored"] and all(r["outcome"] == "killed" for r in summary["results"]) else 1


if __name__ == "__main__":
    # A normal termination must unwind run_mutant's byte restoration as an interrupt does.
    def terminate(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, terminate)
    sys.exit(main())
