#!/usr/bin/env python3
"""Live V14 Bank shape smoke for release candidates.

The static ABI drift guard proves that compiled artifacts and frontend release
ABIs agree. This script checks the other half of the boundary: the addresses in
the deployment snapshot still expose the expected live Bank views.

By default the script skips when no chain-specific RPC URL is configured. Set
BANK_LIVE_SMOKE_REQUIRED=1 in a production release preflight to fail closed.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SNAPSHOT_ENV = "SNAPSHOT_PATH"
DEFAULT_SNAPSHOT = "deployments/latest-v14.json"

SSOT_SIG = (
    "getSSOT()((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,"
    "uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint256,"
    "uint256,uint256))"
)
PERFORMANCE_SIG = (
    "getPerformance()(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
)

SSOT_FIELDS = [
    "B",
    "PF",
    "XP",
    "NAV",
    "R",
    "minLiquidityBps",
    "minLiq",
    "free",
    "riskReserveBps",
    "riskReserve",
    "riskFree",
    "withdrawalBufferBps",
    "withdrawalBuffer",
    "withdrawable",
    "riskInPaused",
    "xpAccruedTotal",
    "xpLockedTotal",
    "xpHoldbackTotal",
    "holdbackVestingSeconds",
    "minPlayerTurnoverForUnlock",
]

PERFORMANCE_FIELDS = [
    "turnover",
    "payoutGross",
    "payoutNet",
    "refunded",
    "feeOnPayout",
    "protocolFeeAccrued",
    "betsHeld",
    "betsSettled",
    "betsRefunded",
]


@dataclass(frozen=True)
class PoolBank:
    index: int
    pool_id: str
    bank: str
    symbol: str


def main() -> int:
    snapshot_path = Path(os.environ.get(SNAPSHOT_ENV, DEFAULT_SNAPSHOT))
    if not snapshot_path.exists():
        print(f"{snapshot_path} not found; skipping live Bank shape smoke")
        return 0

    snapshot = json.loads(snapshot_path.read_text())
    chain_id = int(snapshot["chainId"])
    rpc_url = resolve_rpc_url(chain_id)
    if not rpc_url:
        message = (
            f"No chain-specific RPC URL configured for chain {chain_id}; "
            "skipping live Bank shape smoke"
        )
        if required():
            print(message, file=sys.stderr)
            return 1
        print(message)
        return 0

    banks = active_pool_banks(snapshot)
    if not banks:
        print(f"No active pool banks found in {snapshot_path}; skipping live Bank shape smoke")
        return 0

    failures: list[str] = []
    for pool in banks:
        try:
            ssot_raw = cast_call(pool.bank, SSOT_SIG, rpc_url)
            ssot = parse_cast_values(ssot_raw, SSOT_FIELDS, expected_len=20)
            assert_ssot_sane(pool, ssot)

            perf_raw = cast_call(pool.bank, PERFORMANCE_SIG, rpc_url)
            performance = parse_cast_values(perf_raw, PERFORMANCE_FIELDS, expected_len=9)
            assert_performance_sane(pool, performance)

            print(
                "ok: "
                f"chain={chain_id} pool={pool.pool_id} symbol={pool.symbol} bank={short(pool.bank)} "
                f"NAV={ssot['NAV']} turnover={performance['turnover']}"
            )
        except Exception as exc:  # noqa: BLE001 - release gate should collect all pool failures.
            failures.append(
                f"chain={chain_id} pool={pool.pool_id} symbol={pool.symbol} "
                f"bank={pool.bank}: {exc}"
            )

    if failures:
        print("V14 live Bank shape smoke failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(f"V14 live Bank shape smoke passed ({len(banks)} active bank(s)).")
    return 0


def required() -> bool:
    return os.environ.get("BANK_LIVE_SMOKE_REQUIRED", "").strip() in {"1", "true", "TRUE", "yes"}


def resolve_rpc_url(chain_id: int) -> str | None:
    chain_specific = {
        8453: ["BASE_MAINNET_RPC_URL", "NEXT_PUBLIC_BASE_RPC_URL", "BASE_RPC_URL"],
        84532: [
            "BASE_SEPOLIA_RPC_URL",
            "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
            "NEXT_PUBLIC_BASE_SEPOLIA_RPC_UR",
            "BASE_TESTNET_RPC_URL",
        ],
    }
    for name in chain_specific.get(chain_id, []):
        value = os.environ.get(name)
        if value:
            return value

    if os.environ.get("BANK_LIVE_SMOKE_ALLOW_GENERIC_RPC", "").strip() in {"1", "true", "TRUE", "yes"}:
        return os.environ.get("ETH_RPC_URL") or os.environ.get("RPC_URL")
    return None


def active_pool_banks(snapshot: dict[str, Any]) -> list[PoolBank]:
    count = int(snapshot.get("numPools", 0))
    banks: list[PoolBank] = []
    for index in range(count):
        active = str(snapshot.get(f"poolActive_{index}", "")).lower() in {"1", "true"}
        bank = str(snapshot.get(f"poolBank_{index}", ""))
        if not active or not is_address(bank):
            continue
        banks.append(
            PoolBank(
                index=index,
                pool_id=str(snapshot.get(f"poolId_{index}", index)),
                bank=bank,
                symbol=str(snapshot.get(f"poolAssetSymbol_{index}", f"pool-{index}")),
            )
        )
    return banks


def cast_call(address: str, signature: str, rpc_url: str) -> str:
    completed = subprocess.run(
        ["cast", "call", address, signature, "--rpc-url", rpc_url],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "cast call failed"
        raise RuntimeError(detail)
    return completed.stdout


def parse_cast_values(output: str, fields: list[str], expected_len: int) -> dict[str, int | bool]:
    tokens = re.findall(r"\btrue\b|\bfalse\b|\b\d+\b", output, flags=re.IGNORECASE)
    if len(tokens) != expected_len:
        raise ValueError(f"expected {expected_len} decoded values, got {len(tokens)} from cast output: {output!r}")

    values: dict[str, int | bool] = {}
    for field, token in zip(fields, tokens, strict=True):
        if token.lower() == "true":
            values[field] = True
        elif token.lower() == "false":
            values[field] = False
        else:
            values[field] = int(token)
    return values


def assert_ssot_sane(pool: PoolBank, ssot: dict[str, int | bool]) -> None:
    ints = {key: int(value) for key, value in ssot.items() if isinstance(value, int)}
    b = ints["B"]
    pf = ints["PF"]
    xp = ints["XP"]
    nav = ints["NAV"]
    reserved = ints["R"]
    risk_bps = ints["riskReserveBps"]
    withdrawal_bps = ints["withdrawalBufferBps"]

    if ints["minLiquidityBps"] != risk_bps:
        raise ValueError("minLiquidityBps legacy alias does not match riskReserveBps")
    if risk_bps > 10_000 or withdrawal_bps > 10_000:
        raise ValueError("riskReserveBps/withdrawalBufferBps exceeds 10000")
    if b < pf + xp:
        raise ValueError("B < PF + XP; NAV would underflow")
    if nav != b - pf - xp:
        raise ValueError("NAV != B - PF - XP")
    if xp != ints["xpAccruedTotal"] + ints["xpLockedTotal"] + ints["xpHoldbackTotal"]:
        raise ValueError("XP bucket total mismatch")

    risk_reserve = nav * risk_bps // 10_000
    withdrawal_buffer = nav * withdrawal_bps // 10_000
    if ints["minLiq"] != risk_reserve or ints["riskReserve"] != risk_reserve:
        raise ValueError("risk reserve calculation mismatch")
    if ints["free"] != max(nav - reserved - risk_reserve, 0):
        raise ValueError("free calculation mismatch")
    if ints["riskFree"] != max(nav - reserved - risk_reserve, 0):
        raise ValueError("riskFree calculation mismatch")
    if ints["withdrawalBuffer"] != withdrawal_buffer:
        raise ValueError("withdrawal buffer calculation mismatch")
    if ints["withdrawable"] != max(nav - reserved - withdrawal_buffer, 0):
        raise ValueError("withdrawable calculation mismatch")
    if not isinstance(ssot["riskInPaused"], bool):
        raise ValueError(f"riskInPaused is not decoded as bool for pool {pool.pool_id}")


def assert_performance_sane(pool: PoolBank, performance: dict[str, int | bool]) -> None:
    ints = {key: int(value) for key, value in performance.items() if isinstance(value, int)}
    if len(ints) != len(PERFORMANCE_FIELDS):
        raise ValueError(f"performance tuple contains non-integer values for pool {pool.pool_id}")
    if ints["payoutNet"] > ints["payoutGross"]:
        raise ValueError("payoutNet exceeds payoutGross")
    if ints["betsSettled"] + ints["betsRefunded"] > ints["betsHeld"]:
        raise ValueError("settled + refunded bet count exceeds held bet count")


def is_address(value: str) -> bool:
    return bool(re.fullmatch(r"0x[a-fA-F0-9]{40}", value))


def short(value: str) -> str:
    return f"{value[:6]}...{value[-4:]}"


if __name__ == "__main__":
    raise SystemExit(main())
