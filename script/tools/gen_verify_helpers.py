#!/usr/bin/env python3
"""Generate Etherscan-family verification helper scripts from deployments/latest-v13.json.

Why this exists
- Etherscan API V1 endpoints have been deprecated across the Etherscan family.
- Contract verification should use the unified Etherscan API V2 endpoint.

This tool regenerates:
- deployments/verify-latest-v13.sh
- deployments/verify/verify-<chainid>-<block>.sh

The scripts default to:
  https://api.etherscan.io/v2/api?chainid=<CHAIN_ID>

Refs:
- Etherscan "Verify with Foundry" (API V2 URL format)
  https://docs.etherscan.io/contract-verification/verify-with-foundry
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _must(d: dict, key: str):
    if key not in d:
        raise KeyError(f"missing key '{key}' in deployments snapshot")
    return d[key]


def _is_hex0x(s: str) -> bool:
    return isinstance(s, str) and s.startswith("0x")


def _is_zero_addr(s: str) -> bool:
    return isinstance(s, str) and s.lower() == "0x0000000000000000000000000000000000000000"


def _verify_line(addr: str, contract_id: str, ctor_args: str) -> str:
    addr = addr.strip()
    if not addr.startswith("0x") or len(addr) != 42:
        raise ValueError(f"invalid address: {addr}")

    # NOTE: Foundry's CLI historically used --chain, but some older builds also
    # accepted --chain-id. The generated helper decides which to use at runtime
    # via $CHAIN_FLAG.
    base = (
        f"forge verify-contract {addr} {contract_id} "
        f"$CHAIN_FLAG $CHAIN_ID $PROFILE_FLAG --watch --verifier etherscan "
        f"--verifier-url \"$VERIFIER_URL\" --etherscan-api-key \"$ETHERSCAN_API_KEY\""
    )

    if ctor_args and ctor_args != "0x":
        if not _is_hex0x(ctor_args):
            raise ValueError(f"invalid ctor args for {addr}: {ctor_args}")
        base += f" --constructor-args {ctor_args}"

    return base + "\n"


def main() -> int:
    in_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("deployments/latest-v13.json")
    if not in_path.exists():
        print(f"error: {in_path} not found", file=sys.stderr)
        return 2

    data = json.loads(in_path.read_text())
    chain_id = int(_must(data, "chainId"))
    block_number = int(_must(data, "blockNumber"))
    architecture_version = str(data.get("architectureVersion", ""))
    if not architecture_version.startswith("v1.3"):
        print(f"error: expected v1.3 snapshot, got architectureVersion={architecture_version!r}", file=sys.stderr)
        return 2
    tag = f"{chain_id}-{block_number}-v13"

    out_dir = Path("deployments")
    (out_dir / "verify").mkdir(parents=True, exist_ok=True)

    default_verifier_url = f"https://api.etherscan.io/v2/api?chainid={chain_id}"

    header = (
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        "# Ensure verification compiles with the same settings as deployment.\n"
        # Use the default profile unless the user explicitly overrides.
        "export FOUNDRY_PROFILE=\"${FOUNDRY_PROFILE:-default}\"\n"
        "ETHERSCAN_API_KEY=\"${ETHERSCAN_API_KEY:-${ETHERSCAN_V2_API_KEY:-}}\"\n"
        "if [ -z \"$ETHERSCAN_API_KEY\" ]; then echo \"set ETHERSCAN_API_KEY (or ETHERSCAN_V2_API_KEY)\"; exit 1; fi\n"
        f"CHAIN_ID={chain_id}\n"
        f"VERIFIER_URL=\"${{VERIFIER_URL:-{default_verifier_url}}}\"\n\n"
        "# Foundry uses --chain (docs) but some older builds accepted --chain-id.\n"
        "CHAIN_FLAG=\"--chain\"\n"
        "if forge verify-contract --help 2>/dev/null | grep -q -- \"--chain-id\"; then CHAIN_FLAG=\"--chain-id\"; fi\n\n"
        "PROFILE_FLAG=\"\"\n"
        "if forge verify-contract --help 2>/dev/null | grep -q -- \"--compilation-profile\"; then PROFILE_FLAG=\"--compilation-profile default\"; fi\n\n"
    )

    contracts: list[tuple[str, str, str]] = [
        ("adapter", "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter", "ctorArgs_adapter"),
        ("vrfHub", "src/core/VRFHub.sol:VRFHub", "ctorArgs_vrfHub"),
        ("poolRegistry", "src/core/PoolRegistry.sol:PoolRegistry", "ctorArgs_poolRegistry"),
        ("settlementRouter", "src/core/SettlementRouter.sol:SettlementRouter", "ctorArgs_settlementRouter"),
        ("refRegistry", "src/engines/referral/ReferralRegistry.sol:ReferralRegistry", "ctorArgs_refRegistry"),
        ("refEngine", "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine", "ctorArgs_refEngine"),
        ("gameHub", "src/core/GameHub.sol:GameHub", "ctorArgs_gameHub"),
        ("sportsRiskEngine", "src/core/SportsRiskEngine.sol:SportsRiskEngine", "ctorArgs_sportsRiskEngine"),
        ("sportsHub", "src/core/SportsHub.sol:SportsHub", "ctorArgs_sportsHub"),
    ]

    # Banks: per-pool
    n_banks = int(data.get("numPools", 0))
    for i in range(n_banks):
        contracts.append((f"bank_{i}", "src/core/Bank.sol:Bank", f"ctorArgs_bank_{i}"))

    # Modules: no-arg constructors
    contracts.extend(
        [
            ("moduleDice", "src/modules/dice/DiceModule.sol:DiceModule", "ctorArgs_moduleDice"),
            ("moduleCoinToss", "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "ctorArgs_moduleCoinToss"),
            ("moduleRoulette", "src/modules/roulette/RouletteModule.sol:RouletteModule", "ctorArgs_moduleRoulette"),
            ("moduleKeno", "src/modules/keno/KenoModule.sol:KenoModule", "ctorArgs_moduleKeno"),
            ("moduleSlots", "src/modules/slots/SlotsModule.sol:SlotsModule", "ctorArgs_moduleSlots"),
        ]
    )

    script = header
    for addr_key, contract_id, ctor_key in contracts:
        if addr_key not in data:
            # keep going so partial snapshots still work
            continue
        addr = data[addr_key]
        if _is_zero_addr(addr):
            continue
        ctor_args = data.get(ctor_key, "0x")
        script += _verify_line(addr, contract_id, ctor_args)

    # Outputs
    out_latest = out_dir / "verify-latest-v13.sh"
    out_convention = out_dir / "verify" / f"verify-{tag}.sh"

    for p in (out_latest, out_convention):
        p.write_text(script)

    # Make scripts executable (best-effort)
    for p in (out_latest, out_convention):
        try:
            os.chmod(p, 0o755)
        except Exception:
            pass

    print(f"Wrote verify helper: {out_latest}")
    print(f"Wrote verify helper: {out_convention}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
