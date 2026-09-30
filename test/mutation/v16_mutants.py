#!/usr/bin/env python3
"""Replayable mutation check for the v1.6 release unit: the house-edge allocation and the Bank's asynchronous
redemptions and historical recovery (ADR-0034/0035, M20 on).

Each mutant removes one guarantee of SSOT v1.6 or ADR-0034/0035 and names the tests that must catch it. The runner applies one
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

GH = "src/core/GameHub.sol"
SR = "src/core/SettlementRouter.sol"
EN = "src/engines/referral/DefaultReferralEngine.sol"
SH = "src/core/SportsHub.sol"
SNAP = "script/release/V16Snapshot.sol"
BANK = "src/core/Bank.sol"

V16 = "test/unit/HouseEdgeAllocationV16.t.sol"
RT = "test/unit/SettlementRouter.t.sol"
RINV = "test/invariants/SettlementRouterInvariants.t.sol"
DIFF = "test/diff/StatefulSystemDiff.t.sol"
DEPLOY = "test/unit/DeploymentV16.t.sol"
ASYNC = "test/unit/BankAsyncRedemption.t.sol"
PENDING = "test/unit/BankPendingExposure.t.sol"
BINV = "test/invariants/BankInvariants.t.sol"
GUARDS = "test/unit/BankRedemptionGuards.t.sol"

MUTANTS = [
    {"id": "M01", "guarantee": "the Router cap",
     "patches": [(SR, "if (allocated > cap) revert", "if (allocated > cap && positionId == type(uint256).max) revert")],
     "tests": [RT, RINV]},
    {"id": "M02", "guarantee": "the Router edge bound",
     "patches": [(SR, "if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert",
                  "if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS && player == address(1)) revert")],
     "tests": [RT, RINV]},
    {"id": "M03", "guarantee": "the LP share (the engine accrues the full edge)",
     "patches": [(EN, "alloc.operatorShare = HouseEdgeLib.operatorShare(alloc.edge);", "alloc.operatorShare = alloc.edge;")],
     "tests": [V16, "test/unit/GameHubRouter.t.sol"]},
    {"id": "M04", "guarantee": "payee snapshot at acceptance",
     "patches": [(GH, "ReferralPayees storage payees = betReferralPayees[betId];",
                  "ReferralPayees memory payees; payees.l1 = IReferralRegistry(referralRegistry).referrerOf(b.player); "
                  "if (payees.l1 != address(0)) payees.l2 = IReferralRegistry(referralRegistry).referrerOf(payees.l1);")],
     "tests": [V16, DIFF]},
    {"id": "M05", "guarantee": "no L0 without a referrer",
     "patches": [(EN, "        if (input.l1 != address(0)) {\n            alloc.r0 = Math.mulDiv(baseEdge, uint256(input.l0Bps), BPS);",
                  "        {\n            alloc.r0 = Math.mulDiv(baseEdge, uint256(input.l0Bps), BPS);"),
                 (EN, "            alloc.r1 = Math.mulDiv(baseEdge, uint256(input.l1Bps), BPS);\n"
                      "            n = _push(tmp, n, input.l1, input, alloc.r1, eligible, REASON_REF_L1);",
                  "        }\n        if (input.l1 != address(0)) {\n"
                  "            alloc.r1 = Math.mulDiv(baseEdge, uint256(input.l1Bps), BPS);\n"
                  "            n = _push(tmp, n, input.l1, input, alloc.r1, eligible, REASON_REF_L1);")],
     "tests": [V16, DIFF]},
    {"id": "M06", "guarantee": "the 7-day delay",
     "patches": [(GH, "if (block.timestamp < pending.activatesAt) revert EdgeChangeNotReady(pending.activatesAt);", "")],
     "tests": [V16]},
    {"id": "M07", "guarantee": "clamping stale affiliate edges to the cap",
     "patches": [(GH, "if (heCur > maxAllowed) heCur = maxAllowed;", "")],
     "tests": [V16, DIFF]},
    {"id": "M08", "guarantee": "markup remainder to the protocol",
     "patches": [(EN, "uint256 share = Math.mulDiv(budget, uint256(inc), sumInc);",
                  "uint256 share = i == k - 1 ? budget - paid : Math.mulDiv(budget, uint256(inc), sumInc);")],
     "tests": [V16, DIFF]},
    {"id": "M09", "guarantee": "the 35% schedule cap",
     "patches": [(GH, "if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);",
                  "if (rates > BPS) revert Errors.InvalidBps(rates);")],
     "tests": [V16, "test/unit/SecurityFixes.t.sol"]},
    {"id": "M10", "guarantee": "edge 0 for sports",
     "patches": [(SH, "decision.reserved, oddsTicketHash, 0);", "decision.reserved, oddsTicketHash, 200);")],
     "tests": ["test/unit/SportsHubTicket.t.sol"]},
    {"id": "M11", "guarantee": "base edge fixed at acceptance",
     "patches": [(GH, "baseEdgeBps: b.baseHouseEdgeBps,", "baseEdgeBps: defaultHouseEdgeBps,")],
     "tests": [V16, DIFF]},
    {"id": "M12", "guarantee": "schedule fixed at acceptance",
     "patches": [(GH, "ReferralSchedule storage cfg = _refCfg[b.referralConfigId];",
                  "ReferralSchedule storage cfg = _refCfg[activeReferralConfigId];")],
     "tests": [V16, DIFF]},
    {"id": "M13", "guarantee": "immediate markup-cap decreases",
     "patches": [(GH, "if (param == EdgeParam.MaxAffiliateDelta && bps <= maxAffiliateDeltaBps) {",
                  "if (param == EdgeParam.MaxAffiliateDelta && bps < 0) {")],
     "tests": [V16]},
    {"id": "M14", "guarantee": "cancel clears the queued change",
     "patches": [(GH, "        delete _pendingEdgeChange[param];\n        emit EdgeChangeCancelled", "        emit EdgeChangeCancelled")],
     "tests": [V16]},
    {"id": "M15", "guarantee": "permissionless activation",
     "patches": [(GH, "function activateEdgeChange(EdgeParam param) external override {",
                  "function activateEdgeChange(EdgeParam param) external override onlyGov {")],
     "tests": [V16]},
    {"id": "M16", "guarantee": "the one-day refund timeout bound (audit O-06)",
     "patches": [(GH, "if (seconds_ > MAX_REFUND_TIMEOUT_SECONDS) revert InvalidRefundTimeout(seconds_);", "")],
     "tests": [V16]},
    # Caught only by the Router invariant suite on purpose: before its hardening (audit O-03) the handler
    # swallowed refused settlements, so a Router that refused a claim of exactly the cap passed.
    {"id": "M17", "guarantee": "a claim of exactly the cap is accepted (Router invariant, audit O-03)",
     "patches": [(SR, "if (allocated > cap) revert", "if (allocated > cap || (allocated == cap && cap > 0)) revert")],
     "tests": [RINV]},
    {"id": "M18", "guarantee": "no pending edge change at release (audit F-01)",
     "patches": [(SNAP, '            require(activatesAt == 0, "pending edge change is not part of the release");\n', "")],
     "tests": [DEPLOY], "args": ["--threads", "1"]},
    # Caught only by the stateful differential test on purpose: before its hardening (audit O-03) it treated
    # every failed placement as a legitimate rejection, so bets refused for no reason went unnoticed.
    {"id": "M19", "guarantee": "a correctly priced bet is not refused (differential test, audit O-03)",
     "patches": [(GH, "if (stakeSpec.betCount == 0 || stakeSpec.betCount > MAX_BET_COUNT) revert Errors.InvalidConfig();",
                  "if (stakeSpec.betCount == 0 || stakeSpec.betCount > MAX_BET_COUNT || stakeSpec.betCount == 3) "
                  "revert Errors.InvalidConfig();")],
     "tests": [DIFF]},
    # ADR-0034/0035: immediate liquid pricing and independently owned historical recovery.
    {"id": "M20", "guarantee": "an unfinished historical epoch never gates a later exit",
     "patches": [(BANK, "        batchId = currentEpoch;\n", "        if (recoveryEpoch(1).remainingHolds != 0) revert SolvencyViolation();\n        batchId = currentEpoch;\n")],
     "tests": [ASYNC, PENDING]},
    {"id": "M21", "guarantee": "LP exits never independently stop betting",
     "patches": [(BANK, "        if (reserved < stake) revert ReservedTooSmall(betId, reserved, stake);", "        if (recoveryBacking != 0) revert SolvencyViolation();\n        if (reserved < stake) revert ReservedTooSmall(betId, reserved, stake);")],
     "tests": [ASYNC, BINV, "test/unit/GameHubE2E.t.sol"]},
    {"id": "M22", "guarantee": "the all-real-supply curve cannot exceed real NAV",
     "patches": [(BANK, "return Math.min(Math.mulDiv(supply, nav_ + _virtualOffset, supply + _virtualOffset), nav_);", "return Math.mulDiv(supply, nav_ + _virtualOffset, supply + _virtualOffset);")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M23", "guarantee": "every request controller is a real beneficiary, never Bank escrow",
     "patches": [(BANK, "        _checkShareReceiver(controller);\n", "        if (controller == address(0)) revert Errors.ZeroAddress();\n")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M24", "guarantee": "ordinary batch allocation releases its exact rounding remainder",
     "patches": [(BANK, "            exitPayable -= dust;\n", "")],
     "tests": [ASYNC, BINV]},
    {"id": "M25", "guarantee": "rescue cannot take escrowed shares",
     "patches": [(BANK, "if (token == asset || token == address(this)) revert Errors.InvalidConfig();", "if (token == asset) revert Errors.InvalidConfig();")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M26", "guarantee": "NAV subtracts player payables",
     "patches": [(BANK, "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal + recoveryBacking);", "return AccountingLib.nav(B, PF, XP + exitPayable + recoveryBacking);")],
     "tests": [ASYNC, BINV]},
    {"id": "M27", "guarantee": "NAV subtracts priced exits",
     "patches": [(BANK, "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal + recoveryBacking);", "return AccountingLib.nav(B, PF, XP + playerPayableTotal + recoveryBacking);")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M28", "guarantee": "a refused payout does not block settlement",
     "patches": [(BANK, "        if (_assetToken.trySafeTransfer(player, amount)) return;\n", "        _assetToken.safeTransfer(player, amount);\n        return;\n")],
     "tests": [ASYNC, BINV]},
    {"id": "M29", "guarantee": "direct and nested token gas failures follow the same payable policy",
     "patches": [(BANK, "        if (_assetToken.trySafeTransfer(player, amount)) return;\n", "        uint256 gasBefore = gasleft();\n        if (_assetToken.trySafeTransfer(player, amount)) return;\n        if (gasleft() < gasBefore / 63) revert Errors.InvalidConfig();\n")],
     "tests": [ASYNC]},
    {"id": "M30", "guarantee": "only the controller or its operator claims liquid exits",
     "patches": [(BANK, "        _checkController(controller);\n        _syncRedeem(controller);\n        return _redeemAccounts", "        _syncRedeem(controller);\n        return _redeemAccounts")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M31", "guarantee": "a withdrawal cannot strand assets",
     "patches": [(BANK, "        if (shares_ == claimableShares && assets_ != claimableAssets) revert ClaimWouldStrandAssets();\n", "")],
     "tests": [GUARDS, ASYNC, BINV]},
    {"id": "M32", "guarantee": "a request spends a finite allowance",
     "patches": [(BANK, "                allowance[owner][msg.sender] = allowed - shares_;\n", "")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M33", "guarantee": "LP liquid claims stop while paused",
     "patches": [(BANK, "returns (RedeemAccount storage a) {\n        if (paused()) revert RiskInPaused();\n", "returns (RedeemAccount storage a) {\n")],
     "tests": [ASYNC, "test/unit/GameHubE2E.t.sol"]},
    {"id": "M34", "guarantee": "ordinary claim assignment cannot delete historical controller rights",
     "patches": [(BANK, "        a.batchId = 0;\n        a.claimableShares += s;", "        a.batchId = 0;\n        delete _requestShares[id][controller];\n        a.claimableShares += s;")],
     "tests": [ASYNC, BINV]},
    {"id": "M35", "guarantee": "an overdue unactivated queue still accepts requests",
     "patches": [(BANK, "        if (_batches[id].shares != 0) return id;", "        if (_batches[id].shares != 0) { if (block.timestamp >= _batches[id].cutoff) revert NoBatchDue(); return id; }")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M36", "guarantee": "a player payable pays only the player",
     "patches": [(BANK, "        _assetToken.safeTransfer(player, amount);\n        emit PlayerPayablePaid(", "        _assetToken.safeTransfer(msg.sender, amount);\n        emit PlayerPayablePaid(")],
     "tests": [ASYNC]},
    {"id": "M37", "guarantee": "player payables are claimable while paused",
     "patches": [(BANK, "        amount = playerPayable[player];\n", "        if (paused()) revert RiskInPaused();\n        amount = playerPayable[player];\n")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M38", "guarantee": "priced assets move to exitPayable",
     "patches": [(BANK, "        exitPayable += liquid;\n", "")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M39", "guarantee": "views compute ordinary entitlements as synchronization does",
     "patches": [(BANK, "            claimableAssets += Math.mulDiv(s, b.assets, b.shares);\n", "            claimableAssets += Math.mulDiv(s, b.assets, b.shares, Math.Rounding.Ceil);\n")],
     "tests": [GUARDS, ASYNC, BINV]},
    {"id": "M40", "guarantee": "a request synchronizes before reusing the controller slot",
     "patches": [(BANK, "        uint256 id = _batchForRequest();\n        _syncRedeem(controller);\n", "        uint256 id = _batchForRequest();\n")],
     "tests": [ASYNC, BINV]},
    {"id": "M41", "guarantee": "an empty queue is retired",
     "patches": [(BANK, "        if (remaining == 0) {\n", "        if (remaining == 0 && remaining == 1) {\n")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M42", "guarantee": "active NAV excludes all historical backing",
     "patches": [(BANK, "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal + recoveryBacking);", "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal);")],
     "tests": [ASYNC, BINV]},
    {"id": "M43", "guarantee": "staying reserve is released in the terminal transaction",
     "patches": [(BANK, "        activeReserved -= r.activeUnits;\n        _activeHolds.remove(betId);", "        activeReserved -= 0;\n        _activeHolds.remove(betId);")],
     "tests": [ASYNC, BINV]},
    {"id": "M44", "guarantee": "combined settlement cost fits its held reserve",
     "patches": [(BANK, "        if (cost > reserved) revert ReservedTooSmall(betId, reserved, cost);\n", "")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M45", "guarantee": "only activated request units receive frozen recovery rights",
     "patches": [(BANK, "position.shares = q;", "position.shares = q + balanceOf[controller];")],
     "tests": [ASYNC, BINV]},
    {"id": "M46", "guarantee": "claiming uses a cumulative entitlement rather than per-release rounding",
     "patches": [(BANK, "        position.claimableAssets = entitlement - position.claimedAssets;", "        position.claimableAssets = entitlement;")],
     "tests": [ASYNC, BINV]},
    {"id": "M47", "guarantee": "later activation never segregates historical reserve twice",
     "patches": [(BANK, "        uint256 reserve = activeReserved;", "        uint256 reserve = totalReserved;")],
     "tests": [ASYNC, BINV]},
    {"id": "M48", "guarantee": "assigned unpaid recovery remains backed after final synchronization",
     "patches": [(BANK, "            uint256 dust = view_.recoveredAssets - e.finalizedAssets;", "            uint256 dust = view_.backingAssets;")],
     "tests": [ASYNC, BINV]},
    {"id": "M49", "guarantee": "only controller or operator can redirect historical recovery",
     "patches": [(BANK, "        _checkController(controller);\n        RecoveryPosition memory position", "        RecoveryPosition memory position")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M50", "guarantee": "full-exit liquid allocation dust never becomes a later depositor windfall",
     "patches": [(BANK, "            if (b.fullExit) _accrueProtocolCapital(id, dust, 3);", "            if (b.fullExit && totalSupply == 0) _accrueProtocolCapital(id, dust, 3);")],
     "tests": [GUARDS, ASYNC]},
    {"id": "M51", "guarantee": "the virtual position is one thousandth of a token, so its residual stays negligible",
     "patches": [(BANK, "_virtualOffset = decimals_ > 3 ? 10 ** uint256(decimals_ - 3) : 1;",
                  "_virtualOffset = 10 ** uint256(decimals_);")],
     "tests": [ASYNC, "test/unit/SecurityFixes.t.sol"]},
]


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
    return {**os.environ, "FOUNDRY_PROFILE": "pr",
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
    try:
        for path, old, new in m["patches"]:
            file = ROOT / path
            backups.setdefault(path, file.read_bytes())
            file.write_text(file.read_text().replace(old, new, 1))
        paths = m["tests"]
        match = paths[0] if len(paths) == 1 else "{" + ",".join(paths) + "}"
        cmd = ["forge", "test", "--match-path", match] + m.get("args", [])
        started = time.time()
        result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=forge_environment(out_dir))
        output = result.stdout + result.stderr
        (out_dir / f"{m['id']}.log").write_text(output)
        outcome, failing = classify_mutant(result.returncode, output)
        return {"id": m["id"], "guarantee": m["guarantee"], "tests": paths, "outcome": outcome,
                "failingTests": failing, "returncode": result.returncode,
                "seconds": round(time.time() - started)}
    finally:
        for path, content in backups.items():
            (ROOT / path).write_bytes(content)


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
