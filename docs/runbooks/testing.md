# Runbook: Tests, Proof Gates, and Repro

This repo treats tests as **proof gates**.

## Dependencies (pinned)
This repo pins its Foundry dependencies via `script/ci/install_deps.sh`.

```bash
bash script/ci/install_deps.sh
```

## Local quick run
```bash
make deps
make test
```

## Suite breakdown
- **Unit tests:** `test/unit/*`
- **Differential tests:** `test/diff/*`
  - `Diff*.t.sol`: module boundary reference diffs
  - `StatefulSystemDiff.t.sol`: router-backed system-level accounting diff (non-adapter mode)
  - `StatefulSystemDiffAdapter.t.sol`: system-level diff in **adapter mode** (Chainlink Wrapper + ETH/credit accounting)
- **Invariant suite:** `test/invariants/*`
  - `SettlementRouterInvariants.t.sol`: router authority, owner-hub terminality, and pool reserve isolation
  - `SportsHubInvariants.t.sol`: sports exposure, router position matching, and debt-out liveness
- **Fork tests (optional):** `test/fork/*`
  - Auto-skip when `FORK_RPC_URL` is not set
  - When set, validates request path against a *real* Chainlink VRF v2.5 Wrapper on a fork

Run individually:
```bash
forge test --match-path "test/unit/*" -vvv
forge test --match-path "test/diff/*" -vvv
forge test --match-path "test/invariants/*" -vvv
forge test --match-path "test/fork/*" -vvv
```

## PR vs Nightly profiles
Foundry profiles are defined in `foundry.toml`:
- `FOUNDRY_PROFILE=pr` : faster PR gate
- `FOUNDRY_PROFILE=nightly` : higher coverage

Examples:
```bash
FOUNDRY_PROFILE=pr forge test --match-path "test/invariants/*" -vvv
FOUNDRY_PROFILE=nightly forge test --match-path "test/diff/*" -vvv
```

## Fork test usage
Fork tests are designed to be safe for local development: they skip when no RPC URL is provided.

Environment variables:
- `FORK_RPC_URL` (required)
- `FORK_VRF_WRAPPER` (required)
- `FORK_BLOCK_NUMBER` (optional)
- `FORK_EXPECT_CHAIN_ID` (optional)
- `FORK_REQUEST_GAS_PRICE_WEI` (optional; defaults to 0 for estimate)

Example (Sepolia):
```bash
export FORK_RPC_URL=...
export FORK_VRF_WRAPPER=0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1
export FORK_EXPECT_CHAIN_ID=11155111

forge test --match-path "test/fork/*" -vvv
```

## Re-running a failing fuzz case
Foundry prints a seed/counterexample. To re-run the most recent failing test:
```bash
forge test --rerun -vvv
```

For a single test file:
```bash
forge test --match-path test/diff/StatefulSystemDiff.t.sol --rerun -vvv
forge test --match-path test/diff/StatefulSystemDiffAdapter.t.sol --rerun -vvv
```

## Linting (optional)

This repo disables automatic lint-on-build to keep deploy/verify logs clean.
If you want to run Foundry lints explicitly:

```bash
make lint
```
