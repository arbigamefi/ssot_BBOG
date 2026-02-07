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
```bash
forge script script/Deploy.s.sol:Deploy   --rpc-url $RPC_URL   --broadcast   -vvv
```

The script prints all deployed addresses to stdout **and writes auditable artifacts**:
- `deployments/latest.json` (+ `deployments/snapshots/deploy-<chainid>-<block>.json`)
- `deployments/verify-latest.sh` (+ `deployments/verify/verify-<chainid>-<block>.sh`)

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
