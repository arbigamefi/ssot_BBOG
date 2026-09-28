#!/usr/bin/env python3
"""Replayable mutation check for the v1.6 release unit: the house-edge allocation and the Bank's asynchronous
redemptions (ADR-0034, M20 on).

Each mutant removes one guarantee of SSOT v1.6 or ADR-0034 and names the tests that must catch it. The runner applies one
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
import json
import os
import re
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

MUTANTS = [
    {"id": "M01", "guarantee": "the Router cap",
     "patches": [(SR, "if (allocated > cap) revert", "if (allocated > cap && positionId == type(uint256).max) revert")],
     "tests": [RT, RINV]},
    {"id": "M02", "guarantee": "the Router edge bound",
     "patches": [(SR, "if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert",
                  "if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS && player == address(1)) revert")],
     "tests": [RT, RINV]},
    {"id": "M03", "guarantee": "the LP share (the engine accrues the full edge, as in v1.5)",
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
    # ADR-0034: asynchronous LP redemptions settled in drained batches.
    {"id": "M20", "guarantee": "a batch is priced only once every position has ended",
     "patches": [(BANK, "        if (open != 0) revert OpenHolds(open);\n", "")],
     "tests": [PENDING, ASYNC]},
    {"id": "M21", "guarantee": "betting closes at the cutoff",
     "patches": [(BANK, "        if (redemptionDraining()) revert RedemptionDraining();\n", "")],
     "tests": [ASYNC, BINV]},
    {"id": "M22", "guarantee": "the real-equity ceiling on batch pricing",
     "patches": [(BANK, "Math.min(Math.mulDiv(q, n + _virtualOffset, supply + _virtualOffset), Math.mulDiv(q, n, supply))",
                  "Math.mulDiv(q, n + _virtualOffset, supply + _virtualOffset)")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M23", "guarantee": "cancellation only before the cutoff",
     "patches": [(BANK, "if (id < firstUnpricedBatch || block.timestamp >= _batches[id].cutoff) revert NothingToCancel();",
                  "if (id < firstUnpricedBatch) revert NothingToCancel();")],
     "tests": [ASYNC, BINV]},
    {"id": "M24", "guarantee": "a batch's rounding remainder returns to NAV",
     "patches": [(BANK, "                exitPayable -= b.assets - assignedAssets;\n", "")],
     "tests": [ASYNC, BINV]},
    {"id": "M25", "guarantee": "rescue cannot take escrowed shares",
     "patches": [(BANK, "if (token == asset || token == address(this)) revert Errors.InvalidConfig();",
                  "if (token == asset) revert Errors.InvalidConfig();")],
     "tests": [ASYNC]},
    {"id": "M26", "guarantee": "NAV subtracts player payables",
     "patches": [(BANK, "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal);",
                  "return AccountingLib.nav(B, PF, XP + exitPayable);")],
     "tests": [ASYNC, BINV]},
    {"id": "M27", "guarantee": "NAV subtracts priced exits",
     "patches": [(BANK, "return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal);",
                  "return AccountingLib.nav(B, PF, XP + playerPayableTotal);")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M28", "guarantee": "a refused payout does not block settlement",
     "patches": [(BANK, "        if (_assetToken.trySafeTransfer(player, amount)) return;\n",
                  "        _assetToken.safeTransfer(player, amount);\n        return;\n")],
     "tests": [ASYNC, BINV]},
    {"id": "M29", "guarantee": "a payout that ran out of gas is not a refusal",
     "patches": [(BANK, "        if (gasleft() < gasBefore / 63) revert PayoutOutOfGas();\n", "")],
     "tests": [ASYNC]},
    {"id": "M30", "guarantee": "only the controller or its operator claims",
     "patches": [(BANK, "        _checkController(controller);\n        _syncRedeem(controller);\n        return _redeemAccounts",
                  "        _syncRedeem(controller);\n        return _redeemAccounts")],
     "tests": [ASYNC]},
    {"id": "M31", "guarantee": "a withdrawal cannot strand assets",
     "patches": [(BANK, "        if (shares_ == claimableShares && assets_ != claimableAssets) revert ClaimWouldStrandAssets();\n",
                  "")],
     "tests": [ASYNC, BINV]},
    {"id": "M32", "guarantee": "a request spends a finite allowance",
     "patches": [(BANK, "                allowance[owner][msg.sender] = allowed - shares_;\n", "")],
     "tests": [ASYNC]},
    {"id": "M33", "guarantee": "LP claims stop while paused",
     "patches": [(BANK, "returns (RedeemAccount storage a) {\n        if (paused()) revert RiskInPaused();\n",
                  "returns (RedeemAccount storage a) {\n")],
     "tests": [ASYNC, "test/unit/GameHubE2E.t.sol"]},
    {"id": "M34", "guarantee": "at most two unpriced batches",
     "patches": [(BANK, "if (id - first >= 2) revert RedeemBatchesFull();", "if (id - first >= 3) revert RedeemBatchesFull();")],
     "tests": [ASYNC, BINV]},
    {"id": "M35", "guarantee": "a request on the cutoff joins the next batch",
     "patches": [(BANK, "if (id > first && block.timestamp < _batches[id - 1].cutoff) return id - 1;",
                  "if (id > first && block.timestamp <= _batches[id - 1].cutoff) return id - 1;")],
     "tests": [ASYNC, BINV]},
    {"id": "M36", "guarantee": "a player payable pays only the player",
     "patches": [(BANK, "        _assetToken.safeTransfer(player, amount);\n        emit PlayerPayablePaid(",
                  "        _assetToken.safeTransfer(msg.sender, amount);\n        emit PlayerPayablePaid(")],
     "tests": [ASYNC]},
    {"id": "M37", "guarantee": "player payables are claimable while paused",
     "patches": [(BANK, "        amount = playerPayable[player];\n",
                  "        if (paused()) revert RiskInPaused();\n        amount = playerPayable[player];\n")],
     "tests": [ASYNC]},
    {"id": "M38", "guarantee": "priced assets move to exitPayable",
     "patches": [(BANK, "            exitPayable += assets_;\n", "")],
     "tests": [ASYNC, PENDING, BINV]},
    {"id": "M39", "guarantee": "views compute entitlements as synchronization does",
     "patches": [(BANK, "                claimableAssets += Math.mulDiv(s, b.assets, b.shares);\n",
                  "                claimableAssets += Math.mulDiv(s, b.assets, b.shares, Math.Rounding.Ceil);\n")],
     "tests": [ASYNC, BINV]},
    {"id": "M40", "guarantee": "a request synchronizes before reusing a slot",
     "patches": [(BANK, "        uint256 id = _batchForRequest();\n        _syncRedeem(controller);\n",
                  "        uint256 id = _batchForRequest();\n")],
     "tests": [ASYNC, BINV]},
    {"id": "M41", "guarantee": "an empty batch is retired",
     "patches": [(BANK, "        if (remaining == 0) {\n", "        if (remaining == 0 && remaining == 1) {\n")],
     "tests": [ASYNC]},
]


def check_anchors(mutants):
    problems = []
    for m in mutants:
        for path, old, _ in m["patches"]:
            count = (ROOT / path).read_text().count(old)
            if count != 1:
                problems.append(f"{m['id']}: anchor found {count} times in {path}: {old[:70]!r}")
    return problems


def run_mutant(m, out_dir):
    backups = {}
    try:
        for path, old, new in m["patches"]:
            file = ROOT / path
            backups.setdefault(path, file.read_text())
            file.write_text(file.read_text().replace(old, new, 1))
        paths = m["tests"]
        match = paths[0] if len(paths) == 1 else "{" + ",".join(paths) + "}"
        cmd = ["forge", "test", "--match-path", match] + m.get("args", [])
        started = time.time()
        # Failing fuzz and invariant sequences go to the run's directory, not the repository's cache, where
        # forge would replay them against the real source on the next run.
        env = {**os.environ, "FOUNDRY_PROFILE": "pr",
               "FOUNDRY_FUZZ_FAILURE_PERSIST_DIR": str(out_dir / "fuzz"),
               "FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR": str(out_dir / "invariant")}
        result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=env)
        output = result.stdout + result.stderr
        (out_dir / f"{m['id']}.log").write_text(output)
        # A failed unit or fuzz test names itself on the [FAIL] line; a failed invariant names itself on an
        # indented line after it, while passing ones print on a [PASS] line.
        failing = set(re.findall(r"^\[FAIL[^\n]*?\] (\w+)\(", output, re.M))
        failing |= set(re.findall(r"^\s+(\w+)\(\) \(runs: \d+", output, re.M))
        failing = sorted(failing)
        if result.returncode == 0:
            outcome = "survived"
        elif failing or "Suite result: FAILED" in output:
            outcome = "killed"
        else:
            outcome = "error"  # no test ran: most often a compile error in the mutant itself
        return {"id": m["id"], "guarantee": m["guarantee"], "tests": paths, "outcome": outcome,
                "failingTests": failing, "seconds": round(time.time() - started)}
    finally:
        for path, content in backups.items():
            (ROOT / path).write_text(content)


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
    results = []
    for m in selected:
        result = run_mutant(m, out_dir)
        results.append(result)
        print(f"{result['id']} {result['outcome']:8} {len(result['failingTests']):3} failing "
              f"({result['seconds']}s) {result['guarantee']}", flush=True)
        (out_dir / "summary.json").write_text(json.dumps({"commit": commit, "results": results}, indent=2) + "\n")
    print(f"logs and summary.json in {out_dir}")
    return 0 if all(r["outcome"] == "killed" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
