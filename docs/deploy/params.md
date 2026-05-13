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
- `MAX_AFFILIATE_DELTA_BPS` (default `0` = affiliate house edge is capped at `DEFAULT_HOUSE_EDGE_BPS`).

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

## v1.3 pool banks
`script/DeployV13.s.sol:DeployV13` uses pools, not assets, as the deployment unit.

For each `i in [0..NUM_POOLS-1]`:
- `POOL_ID_i` (default `i + 1`): protocol risk/accounting domain id.
- `POOL_ASSET_i` (required; `ASSET_i` is accepted as a compatibility alias): ERC20 address.
- `POOL_DOMAIN_i` (default `1`): `1=Casino`, `2=Sports`, `3=Future`.
- `BANK_MIN_LIQ_BPS_i`, `BANK_MIN_TURNOVER_FOR_UNLOCK_i`, `BANK_HOLDBACK_VESTING_SECONDS_i`.
- `LP_NAME_i`, `LP_SYMBOL_i`, `LP_DECIMALS_i`.

The v1.3 deploy script writes `deployments/latest-v13.json` and `deployments/verify-latest-v13.sh`.
Casino pools are allowlisted for `GameHub`; Sports pools are allowlisted for `SportsHub`; Future pools
are registered and wired to `SettlementRouter` but still need their own vertical hub before risk-in can
open positions.

When any `POOL_DOMAIN_i=2` pool exists, the following Sports deployment parameters are required:
- `SPORTS_MAX_STAKE`: default per-ticket stake cap in raw asset units.
- `SPORTS_MAX_PAYOUT`: default per-ticket payout cap in raw asset units.
- `SPORTS_MAX_MARKET_RESERVED`: default total reserved exposure cap per market.
- `SPORTS_MAX_OUTCOME_RESERVED`: default reserved exposure cap per market outcome.
- `SPORTS_MAX_EVENT_RESERVED`: default total reserved exposure cap per pool/event.
- `SPORTS_ODDS_SIGNER_SET_HASH`: governance-published hash of the active odds signer set.
- `SPORTS_RESULT_REPORTER_SET_HASH`: governance-published hash of the active result reporter set.
- `SPORTS_RESULT_REPORTER_THRESHOLD`: optional quorum threshold for result proposals; defaults to `1`.
  If set above `1`, allowlist enough reporters through governance before result proposals are expected.
- `SPORTS_RESULT_CHALLENGER`: optional bootstrap address allowed to challenge a proposed result.
- `SPORTS_RESULT_ARBITRATOR`: optional bootstrap address allowed to resolve challenged results with an
  on-chain arbitration decision hash.

Optional per-Sports-pool overrides:
- `SPORTS_MAX_STAKE_POOL_i`
- `SPORTS_MAX_PAYOUT_POOL_i`
- `SPORTS_MAX_MARKET_RESERVED_POOL_i`
- `SPORTS_MAX_OUTCOME_RESERVED_POOL_i`
- `SPORTS_MAX_EVENT_RESERVED_POOL_i`

Optional one-address bootstrap allowlists:
- `SPORTS_ODDS_SIGNER`: if set, the deploy script immediately allowlists this address.
- `SPORTS_RESULT_REPORTER`: if set, the deploy script immediately allowlists this address.
- `SPORTS_RESULT_CHALLENGER`: if set, the deploy script immediately allowlists this address.
- `SPORTS_RESULT_ARBITRATOR`: if set, the deploy script immediately allowlists this address.

Risk caps are intentionally raw token units because pools can use different ERC20 decimals. The deploy
script writes both the default Sports caps and each Sports pool's effective caps/risk hash into the v1.3
snapshot. For production deployments, pick caps per target pool asset and lock the resulting snapshot
with `make release-digest-v13`.

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

For v1.3 router/pool snapshots:
```bash
SNAPSHOT_PATH=deployments/latest-v13.json make release-digest-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-notes-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-frontend-manifest-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-golden-vectors-v13
make release-abis-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-verify-v13
STRICT=1 make release-check-v13
make release-package-v13
```

The v1.3 frontend manifest writes schemaVersion 2 with explicit `pools[]` rows. The v1.3 golden
vectors prove `IGameHub.placeBet(gameId,poolId,...)` calldata, not the legacy `Hub(asset,...)` shape.
