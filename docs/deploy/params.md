# Deployment parameters

This repo intentionally makes the **parameter policy explicit**.

## VRF / fee
- `VRF_WRAPPER` (required): Chainlink VRF v2.5 Wrapper address on the target chain.
- `REQUEST_GAS_PRICE_WEI` (optional, default `0`): used by the wrapper fee estimator.
  - In production you typically set this to a conservative gas price (or a moving average) used by your UI.

## Explorer verification (optional)
- `ETHERSCAN_API_KEY`: Etherscan-family API key. BaseScan/Arbiscan use the same Etherscan v2 unified key model.
- `VERIFIER_URL` (optional): override explorer API endpoint (e.g. `https://api.basescan.org/api`). If not set, the deploy script chooses a default for Base/Base Sepolia/Arbitrum/Arbitrum Sepolia.

After deploy, the script writes:
- `deployments/latest.json` (+ `deployments/deploy-<chainid>-<block>.json`)
- `deployments/verify-latest.sh` (+ `deployments/verify-<chainid>-<block>.sh`)

## Hub pricing + referral policy
- `REFUND_TIMEOUT_SECONDS` (default `3600`): when a player can claim a timeout refund.
- `DEFAULT_HOUSE_EDGE_BPS` (default `200` = 2%).
- `MAX_AFFILIATE_DELTA_BPS` (default `0` = allow up to 100% by budget limit).

Referral config (defaults match the cleanroom E2E tests):
- `REF_BASE_BUDGET_BPS` (default `10000`)
- `REF_DELTA_BUDGET_BPS` (default `10000`)
- `REF_HOLDBACK_BPS` (default `3000`)
- `REF_LEVELS` (default `2`)
- `REF_LEVEL{0..5}_BPS` (default L0=0, L1=10000, others=0)

## Per-asset banks
For each `i in [0..NUM_ASSETS-1]`:
- `ASSET_i` (required): ERC20 address
- `BANK_MIN_LIQ_BPS_i` (default `1000` = 10%)
- `BANK_MIN_TURNOVER_FOR_UNLOCK_i` (default `20 ether`)
- `BANK_HOLDBACK_VESTING_SECONDS_i` (default `86400` = 1 day)
- `LP_NAME_i`, `LP_SYMBOL_i`, `LP_DECIMALS_i` (LP share token metadata)

## Callback gas policy (fixed in code)
`Hub.quoteVRFFee(betCount)` sets `callbackGasLimit = 300k + 20k * betCount`, capped at 2,000,000.
This is part of the SSOT v1.2 policy (auditability).

## Release artifact lock (digest + signature)
These are only needed when you want a tamper-evident release lock for a deployment snapshot.

- `SNAPSHOT_PATH` (optional, default `deployments/latest.json`): snapshot input file.
- `SIGNER_PRIVATE_KEY` (optional): if set, used to sign the release digest. If unset, falls back to `PRIVATE_KEY`.
- `GOV` (recommended): if set, the release digest generator enforces that the signer address equals `GOV`.

Commands:
```bash
make release-digest
make release-verify
STRICT=1 make release-check
```
