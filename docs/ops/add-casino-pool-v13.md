# Add a v1.3 Casino Pool

Status: Active

Use this runbook to add a new casino bankroll asset without redeploying the
v1.3 kernel. The script deploys one new `Bank(asset)`, registers it as a new
Casino `poolId`, and allows the existing `GameHub` to use the pool.

It intentionally does not redeploy `GameHub`, `SettlementRouter`,
`PoolRegistry`, `VRFHub`, game modules, or referral contracts.

## WETH on Base mainnet

Use a new `poolId`; do not reuse the existing USDC pool. Base mainnet WETH is
expected to be supplied explicitly as `ADD_POOL_ASSET`. Re-check the address
from an authoritative source before broadcast.

```bash
source .env.base-mainnet-v13-casino

ADD_POOL_ID=2 \
ADD_POOL_ASSET=0x4200000000000000000000000000000000000006 \
ADD_LP_NAME="LP WETH Casino" \
ADD_LP_SYMBOL="lpWETH-C" \
ADD_LP_DECIMALS=18 \
make casino-add-pool-v13
```

The deploy writes:

- `deployments/pool-add-latest-v13.json`
- `deployments/pool-add-<chainId>-<blockNumber>-v13.json`
- `deployments/verify-pool-add-latest-v13.sh`

## Merge into release artifacts

After the chain transaction is confirmed and reviewed:

```bash
make casino-add-pool-apply-v13
make release-frontend-manifest-v13
make release-golden-vectors-v13
make release-abis-v13
make release-digest-v13
make release-verify-v13
```

Then copy or publish the regenerated frontend release artifacts through the
normal frontend deployment process.

## Verify the new Bank

```bash
FOUNDRY_PROFILE=default bash deployments/verify-pool-add-latest-v13.sh
```

## Operational checklist

- Confirm `PRIVATE_KEY` belongs to `GOV`, or use the governance execution path
  instead of this EOA broadcast script.
- Confirm `ADD_POOL_ID` is unused.
- Confirm `ADD_POOL_ASSET` is a standard ERC20 with exact transfers.
- Do not use fee-on-transfer, rebasing, or blacklist-heavy tokens as Bank assets.
- Seed the new Bank with enough WETH before exposing it in the frontend.
- Restart keeper/indexer processes after publishing the updated release manifest
  so Bank provider ledger and bet indexing include the new pool.
