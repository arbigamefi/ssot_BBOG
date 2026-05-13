# Deploy runbook (Milestone 2.5)

This runbook turns the SSOT cleanroom into a **real-network reproducible deployment**:
- Optional fork tests against a real Chainlink VRF v2.5 Wrapper
- Deterministic deployment script
- Parameter checklist

## Prereqs
- Foundry installed (stable channel recommended)
- RPC URL for the target chain
- Deployer private key (this script assumes **deployer == GOV**)
- Chainlink VRF v2.5 Wrapper address for the target chain

## 1) Install pinned dependencies
```bash
bash script/ci/install_deps.sh
```

## 2) Choose network + set environment

Wrapper addresses below come from Chainlink's official **VRF v2.5 supported networks** table.

(Helper: see `docs/deploy/networks.ts` for a repo-local address map you can keep aligned with your frontend.)

### Base Sepolia (example)
Chainlink VRF Wrapper (direct funding): `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`

```bash
export RPC_URL=...
export PRIVATE_KEY=...
export GOV=$(cast wallet address --private-key $PRIVATE_KEY)
export VRF_WRAPPER=0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed

export NUM_ASSETS=1
export ASSET_0=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # USDC (Base Sepolia)
```

### Arbitrum Sepolia (example)
Chainlink VRF Wrapper (direct funding): `0x29576aB8152A09b9DC634804e4aDE73dA1f3a3CC`

```bash
export RPC_URL=...
export PRIVATE_KEY=...
export GOV=$(cast wallet address --private-key $PRIVATE_KEY)
export VRF_WRAPPER=0x29576aB8152A09b9DC634804e4aDE73dA1f3a3CC

export NUM_ASSETS=1
export ASSET_0=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d  # USDC (Arbitrum Sepolia)
```

### Base mainnet (example)
Chainlink VRF Wrapper (direct funding): `0xb0407dbe851f8318bd31404A49e658143C982F23`

```bash
export RPC_URL=...
export PRIVATE_KEY=...
export GOV=$(cast wallet address --private-key $PRIVATE_KEY)
export VRF_WRAPPER=0xb0407dbe851f8318bd31404A49e658143C982F23

export NUM_ASSETS=1
export ASSET_0=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # USDC (Base)
```

### Arbitrum One (example)
Chainlink VRF Wrapper (direct funding): `0x14632CD5c12eC5875D41350B55e825c54406BaaB`

```bash
export RPC_URL=...
export PRIVATE_KEY=...
export GOV=$(cast wallet address --private-key $PRIVATE_KEY)
export VRF_WRAPPER=0x14632CD5c12eC5875D41350B55e825c54406BaaB

export NUM_ASSETS=1
export ASSET_0=0xaf88d065e77c8cC2239327C5EDb3A432268e5831  # USDC (Arbitrum One)
```

## 3) Deploy

### Legacy v1.2 deployment
```bash
forge script script/Deploy.s.sol:Deploy   --rpc-url $RPC_URL   --broadcast   -vvv
```

The script prints all deployed addresses to stdout **and writes auditable artifacts**:
- `deployments/latest.json` (+ `deployments/snapshots/deploy-<chainid>-<block>.json`)
- `deployments/verify-latest.sh` (+ `deployments/verify/verify-<chainid>-<block>.sh`)

### v1.3 router/pool deployment

Use this path for pre-mainnet SettlementRouter deployments:

```bash
export NUM_POOLS=1
export POOL_ID_0=1
export POOL_DOMAIN_0=1          # 1=Casino, 2=Sports, 3=Future
export POOL_ASSET_0=$ASSET_0    # ASSET_0 is still accepted as a compatibility alias

# Required only when at least one pool uses POOL_DOMAIN_i=2.
export SPORTS_MAX_STAKE=...
export SPORTS_MAX_PAYOUT=...
export SPORTS_MAX_MARKET_RESERVED=...
export SPORTS_MAX_OUTCOME_RESERVED=...
export SPORTS_MAX_EVENT_RESERVED=...
export SPORTS_ODDS_SIGNER_SET_HASH=0x...
export SPORTS_RESULT_REPORTER_SET_HASH=0x...

# Optional per-Sports-pool raw-unit overrides.
export SPORTS_MAX_STAKE_POOL_0=...
export SPORTS_MAX_PAYOUT_POOL_0=...
export SPORTS_MAX_MARKET_RESERVED_POOL_0=...
export SPORTS_MAX_OUTCOME_RESERVED_POOL_0=...
export SPORTS_MAX_EVENT_RESERVED_POOL_0=...

forge script script/DeployV13.s.sol:DeployV13   --rpc-url $RPC_URL   --broadcast   -vvv
```

For a public testnet Casino+Sports rehearsal, start from a v1.3 Sports env example and run the
preflight before broadcasting:

```bash
cp docs/deploy/base-sepolia-v13-sports.env.example .env.base-sepolia-v13-sports
# edit .env.base-sepolia-v13-sports
ENV_FILE=.env.base-sepolia-v13-sports make sports-testnet-preflight-v13
source .env.base-sepolia-v13-sports
forge script script/DeployV13.s.sol:DeployV13 --rpc-url $RPC_URL --broadcast -vvv
```

The same flow applies to `docs/deploy/arbitrum-sepolia-v13-sports.env.example`.

The v1.3 script deploys and wires:
- `PoolRegistry`
- `SettlementRouter`
- one `Bank` per pool
- `GameHub`
- `SportsRiskEngine` + `SportsHub` when at least one Sports pool is configured
- `VRFHub` + Chainlink wrapper adapter
- referral registry/engine and casino modules

It writes separate v1.3 artifacts while the legacy release pipeline is still being migrated:
- `deployments/latest-v13.json`
- `deployments/snapshots/deploy-<chainid>-<block>-v13.json`
- `deployments/verify-latest-v13.sh`
- `deployments/verify/verify-<chainid>-<block>-v13.sh`

For v1.3, each `Bank.settlementRouter()` must equal `SettlementRouter`. Casino pools are allowlisted
for `GameHub`; Sports pools are allowlisted for `SportsHub` after the deployment script has deployed
and registered the Sports vertical. Sports result-oracle configuration includes both
`sportsResultReporterSetHash` and `sportsResultReporterThreshold` in the release snapshot, plus
optional bootstrap `sportsResultChallenger` and `sportsResultArbitrator` addresses for dispute
operations.

## 3.1) Verify on explorer (optional but recommended)
Set an Etherscan-family API key (BaseScan/Arbiscan also work with Etherscan API v2 unified keys).

```bash
export ETHERSCAN_API_KEY=...
bash deployments/verify-latest.sh
```


## 3.2) Lock the deployment (release digest + signature)
After a successful deploy (which writes `deployments/latest.json`), generate a **tamper-evident release artifact**:

```bash
# Uses SIGNER_PRIVATE_KEY if provided, otherwise falls back to PRIVATE_KEY.
# Recommended: set GOV and sign with the governance key.
make release-digest
```

This writes:
- `deployments/release-latest.json` (+ `deployments/release/release-<chainid>-<block>.json`)

For a v1.3 router/pool deployment, use the v1.3 release lock path:

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

This writes:
- `deployments/release-latest-v13.json`
- `deployments/release/release-<chainid>-<block>-v13.json`
- `deployments/frontend-manifest-latest-v13.json`
- `deployments/golden-vectors-latest-v13.json`
- `deployments/release-notes-latest-v13.md`
- `deployments/abis-v13/index.json`
- `deployments/release/frontend-manifest-<chainid>-<block>-v13.json`
- `deployments/release/golden-vectors-<chainid>-<block>-v13.json`
- `deployments/release/release-notes-<chainid>-<block>-v13.md`
- `deployments/release/abi-index-<chainid>-<block>-v13.json`

The v1.3 digest includes `PoolRegistry`, `SettlementRouter`, `GameHub`, and every pool id/domain/bank
row from the deployment snapshot. The v1.3 frontend manifest is schemaVersion 2 and exposes `pools[]`
instead of the legacy `assets[]`; v1.3 golden vectors use `IGameHub.placeBet(gameId,poolId,...)`.

Verify deterministically (offline):

```bash
make release-verify
```

Generate human-facing release notes (must include the digest):

```bash
TAG_NAME=vX.Y.Z make release-notes
```

For tag/release pipelines, enforce strict presence (snapshot + lock + notes):

```bash
STRICT=1 make release-check
```

Optionally bundle the audit artifacts into a single archive:

```bash
TAG_NAME=vX.Y.Z make release-package
```

See:
- `release-artifacts.md` for the digest rationale
- `docs/release/README.md` and `docs/release/checklist.md` for the full release flow
## 4) Optional fork validation
Fork tests are designed to auto-skip when no RPC URL is set. To validate the **real wrapper request path**:

```bash
export FORK_RPC_URL=$RPC_URL
export FORK_VRF_WRAPPER=$VRF_WRAPPER
export FORK_EXPECT_CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL)

forge test --match-path "test/fork/*" -vvv
```

## 5) Post-deploy checks
See `checklist.md` for the recommended preflight + postflight checks.


### Solidity compiler note (verification)

If you deploy with `via_ir = true` on macOS using solc **0.8.20**, BaseScan/Etherscan verification can fail with bytecode mismatch due to a known tooling/compiler discrepancy. Use solc **0.8.24+** for deployments you intend to verify.
