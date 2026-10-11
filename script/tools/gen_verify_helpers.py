#!/usr/bin/env python3
"""Generate the current verification helper from a deployment snapshot.

Uses the unified Etherscan V2 endpoint and ETHERSCAN_V2_API_KEY.
Reference: https://docs.etherscan.io/contract-verification/verify-with-foundry
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def _must(d: dict, key: str):
    if key not in d:
        raise KeyError(f"missing key '{key}' in deployments snapshot")
    return d[key]


def _is_hex0x(s: str) -> bool:
    return isinstance(s, str) and re.fullmatch(r"0x(?:[0-9a-fA-F]{2})*", s) is not None


def _is_zero_addr(s: str) -> bool:
    return isinstance(s, str) and s.lower() == "0x0000000000000000000000000000000000000000"


def _verify_line(addr: str, contract_id: str, ctor_args: str) -> str:
    addr = addr.strip()
    if not _is_hex0x(addr) or len(addr) != 42:
        raise ValueError(f"invalid address: {addr}")

    base = (
        f"forge verify-contract {addr} {contract_id} "
        f"--chain $CHAIN_ID --compilation-profile default --watch --verifier etherscan "
        f"--verifier-url \"$VERIFIER_URL\" --etherscan-api-key \"$ETHERSCAN_V2_API_KEY\""
    )

    if not _is_hex0x(ctor_args):
        raise ValueError(f"invalid ctor args for {addr}: {ctor_args}")
    if ctor_args != "0x":
        base += f" --constructor-args {ctor_args}"

    return base + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the verification helper from a v1.6 deployment snapshot.")
    parser.add_argument("snapshot", nargs="?", default="deployments/latest-v16.json")
    parser.add_argument("--out", default="deployments/verify-latest-v16.sh", help="helper to write")
    args = parser.parse_args()
    in_path = Path(args.snapshot)
    if not in_path.exists():
        print(f"error: {in_path} not found", file=sys.stderr)
        return 2

    data = json.loads(in_path.read_text())
    chain_id = int(_must(data, "chainId"))
    architecture_version = str(data.get("architectureVersion", ""))
    if architecture_version != "v1.6-nft-liquidity":
        print(f"error: expected a v1.6 snapshot, got architectureVersion={architecture_version!r}", file=sys.stderr)
        return 2

    default_verifier_url = f"https://api.etherscan.io/v2/api?chainid={chain_id}"

    header = (
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        "# Ensure verification compiles with the same settings as deployment.\n"
        "export FOUNDRY_PROFILE=default\n"
        "if [ -z \"${ETHERSCAN_V2_API_KEY:-}\" ]; then echo \"set ETHERSCAN_V2_API_KEY\" >&2; exit 1; fi\n"
        f"CHAIN_ID={chain_id}\n"
        f"VERIFIER_URL=\"${{VERIFIER_URL:-{default_verifier_url}}}\"\n\n"
    )

    contracts: list[tuple[str, str, str]] = [
        ("vrfHub", "src/core/VRFHub.sol:VRFHub", "ctorArgs_vrfHub"),
        ("poolRegistry", "src/core/PoolRegistry.sol:PoolRegistry", "ctorArgs_poolRegistry"),
        ("settlementRouter", "src/core/SettlementRouter.sol:SettlementRouter", "ctorArgs_settlementRouter"),
        ("refRegistry", "src/engines/referral/ReferralRegistry.sol:ReferralRegistry", "ctorArgs_refRegistry"),
        ("refEngine", "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine", "ctorArgs_refEngine"),
        ("gameHub", "src/core/GameHub.sol:GameHub", "ctorArgs_gameHub"),
    ]

    # Each Bank creates its immutable LiquidityVault; both have verified source.
    n_banks = int(_must(data, "numPools"))
    if not 1 <= n_banks <= 32:
        raise ValueError("numPools must be in [1, 32]")
    for i in range(n_banks):
        contracts.append((f"poolBank_{i}", "src/core/Bank.sol:Bank", f"ctorArgs_bank_{i}"))
        contracts.append((f"poolVault_{i}", "src/core/LiquidityVault.sol:LiquidityVault", f"ctorArgs_vault_{i}"))

    # Modules: no-arg constructors
    contracts.extend(
        [
            ("moduleDice", "src/modules/dice/DiceModule.sol:DiceModule", "ctorArgs_moduleDice"),
            ("moduleCoinToss", "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "ctorArgs_moduleCoinToss"),
            ("moduleRoulette", "src/modules/roulette/RouletteModule.sol:RouletteModule", "ctorArgs_moduleRoulette"),
            ("moduleKeno", "src/modules/keno/KenoModule.sol:KenoModule", "ctorArgs_moduleKeno"),
            ("modulePlinko", "src/modules/plinko/PlinkoModule.sol:PlinkoModule", "ctorArgs_modulePlinko"),
            ("moduleSicBo", "src/modules/sicbo/SicBoModule.sol:SicBoModule", "ctorArgs_moduleSicBo"),
            ("moduleSlots", "src/modules/slots/SlotsModule.sol:SlotsModule", "ctorArgs_moduleSlots"),
            ("moduleBaccarat", "src/modules/baccarat/BaccaratModule.sol:BaccaratModule", "ctorArgs_moduleBaccarat"),
        ]
    )

    script = header
    for addr_key, contract_id, ctor_key in contracts:
        addr = _must(data, addr_key)
        if _is_zero_addr(addr):
            continue
        ctor_args = _must(data, ctor_key)
        script += _verify_line(addr, contract_id, ctor_args)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(script)
    out.chmod(0o755)
    print(f"Wrote verify helper: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
