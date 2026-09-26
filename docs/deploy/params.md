> Current governance and signer requirements: [v1.5 workflow](v15-release.md).

# Deployment parameters

This repo intentionally makes the **parameter policy explicit**.

## VRF / fee
- `VRF_WRAPPER` (required): Chainlink VRF v2.5 Wrapper address on the target chain.
- `REQUEST_GAS_PRICE_WEI`: used by the wrapper fee estimator.
  - Local-only deployments may leave it at `0`.
  - Public testnet/mainnet deployments must set a non-zero conservative gas price. A zero value can underquote Chainlink wrapper requests and make `GameHub.placeBet` revert before VRF request creation.
  - In production you typically set this to a conservative gas price or moving average used by your UI.

## Explorer verification (optional)
- `ETHERSCAN_API_KEY`: Etherscan-family API key. BaseScan/Arbiscan use the same Etherscan v2 unified key model.
- `VERIFIER_URL` (optional): override explorer API endpoint (e.g. `https://api.etherscan.io/v2/api?chainid=8453`). If not set, the deploy script chooses a default for Base/Base Sepolia/Arbitrum/Arbitrum Sepolia.

After deploy, the script writes:
- `deployments/latest-v15.json` (+ `deployments/snapshots/deploy-<chainid>-<block>-v15.json`)
- `deployments/verify-latest-v15.sh` (+ `deployments/verify/verify-<chainid>-<block>-v15.sh`)

## GameHub pricing + referral policy

The contract sources implement the v1.6 allocation ([SSOT v1.6](../constitution/SSOT.v1.6.md),
[ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md)): LPs keep a fixed 50% of the turnover
edge and referral rewards are paid from the operator's 50%. The deploy script keeps its V15 name until the
v1.6 release. For the parameters of the live v1.5 deployment, read this file at commit `7ee449b88`.

- `REFUND_TIMEOUT_SECONDS` (default `3600`): when a player can claim a timeout refund.
- `DEFAULT_HOUSE_EDGE_BPS` (default `200` = 2%): the initial base edge, `1..500`. Later changes are queued
  on chain and take effect after 7 days.

Referral schedule, in bps of the base edge (defaults are the ADR-0032 initial rates):
- `REF_L0_BPS` (default `1000`): player rakeback, paid only to players with a referrer.
- `REF_L1_BPS` (default `2000`): direct referrer.
- `REF_L2_BPS` (default `500`): the referrer's referrer.
- `REF_HOLDBACK_BPS` (default `3000`): share of L1, L2 and markup rewards that vests linearly.
- `REF_L0_BPS + REF_L1_BPS + REF_L2_BPS` must not exceed `3500`.

Affiliate markup always starts disabled; governance can enable it after deployment through the 7-day
delay. The script refuses the retired v1.5 variables `MAX_AFFILIATE_DELTA_BPS`, `REF_BASE_BUDGET_BPS`,
`REF_DELTA_BUDGET_BPS`, `REF_LEVELS` and `REF_LEVEL{0..5}_BPS` so they cannot be silently ignored. The
`docs/deploy/v15/*.env.example` files record the live v1.5 parameters and still contain
`MAX_AFFILIATE_DELTA_BPS`.

## Pool banks
`script/DeployV15.s.sol:DeployV15` uses pools, not assets, as the deployment unit.

For each `i in [0..NUM_POOLS-1]`:
- `POOL_ID_i` (default `i + 1`): protocol risk/accounting domain id.
- `POOL_ASSET_i` (required): ERC20 address.
- `POOL_DOMAIN_i` (default `1`): `1=Casino`, `2=Sports`, `3=Future`.
- `BANK_MIN_LIQ_BPS_i`, `BANK_MIN_TURNOVER_FOR_UNLOCK_i`, `BANK_HOLDBACK_VESTING_SECONDS_i`.
- `LP_NAME_i`, `LP_SYMBOL_i`, `LP_DECIMALS_i`.

For public-network preflight, `LP_DECIMALS_i` is required and must match `POOL_ASSET_i.decimals()`
on chain. This prevents release metadata from treating 6-decimal assets such as USDC as 18-decimal
assets.

The deploy script writes `deployments/latest-v15.json` and `deployments/verify-latest-v15.sh`.
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
- `SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS`: optional timeout after a challenged result can be governance-voided;
  defaults to `604800` (7 days) and must be at least `600` (10 minutes).
- `SPORTS_DERIVE_ROLE_SET_HASHES`: optional boolean. When `true`, the deploy script replaces the constructor
  bootstrap hashes with deterministic hashes derived from the deployed `SportsHub`, chain id, and bootstrap
  odds signer/result reporter. This is useful when the role-set hash policy intentionally binds the active
  signer set to a specific deployed hub address.
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
script writes the default Sports caps, challenge timeout, and each Sports pool's effective caps/risk hash
into the v1.3 snapshot. For production deployments, pick caps per target pool asset and lock the resulting
snapshot with `make release-digest-v15`.

## Callback gas policy (fixed in code)
`GameHub.quoteVRFFee(betCount)` sets `callbackGasLimit = 300k + 20k * betCount`, capped at 2,000,000.

## Release artifact lock (digest + signature)
These are only needed when you want a tamper-evident release lock for a deployment snapshot.

- `SNAPSHOT_PATH` (optional, default `deployments/latest-v15.json`): snapshot input file.
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
make release-digest
make release-notes
make release-frontend-manifest
make release-golden-vectors
make release-abis
make release-verify
STRICT=1 make release-check
make release-package
```

The frontend manifest writes schemaVersion 2 with explicit `pools[]` rows. Golden vectors prove
`IGameHub.placeBet(gameId,poolId,...)` calldata.
