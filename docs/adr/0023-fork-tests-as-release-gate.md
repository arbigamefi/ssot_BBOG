> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# ADR-0023: Fork tests as a release gate

## Context

SSOT proof gates (unit/diff/invariants) provide strong correctness guarantees **within a controlled environment**.
However, Milestone 2.5 introduces a real Chainlink VRF v2.5 Wrapper integration path. Integration risk exists if:

- wrapper addresses differ by network
- wrapper behavior (quote/request) differs from mocks
- deployment wiring (coordinator / adapter / hub) is misconfigured

## Decision

- Maintain a dedicated `test/fork/*` suite that:
  - **auto-skips** when `FORK_RPC_URL` is not set (safe for local dev + PR CI)
  - validates the VRF request path against a **real on-chain Wrapper** on a fork
- Treat fork tests as a **release gate** for production artifacts:
  - releases MUST pass `forge test --match-path "test/fork/*"` for the target chain(s)
  - PR CI MAY run fork tests, but passing is only required when RPC envs are available

## Consequences

- Releases require secure handling of RPC endpoints (and potentially explorer keys) in CI.
- Fork tests become a canonical integration contract between SSOT and real provider behavior.

## Alternatives considered

1. **No fork tests; rely on mocks only**
   - Rejected: can miss address/config/wiring errors and wrapper behavior drift.
2. **Always-on fork tests in PR CI**
   - Rejected: PR CI typically cannot access private RPC envs and would become flaky.

## References

- Milestone 2.5 plan: `docs/plan/Milestone-2.5-RealNetwork-Readiness.md`
- Deploy runbook: `docs/deploy/README.md`
- Fork tests: `test/fork/*`

## Implementation

- Release CI runs `script/ci/fork_release_gate.sh`, which reads the deployed `chainId` and `vrfWrapper` from the versioned release snapshot (`deployments/latest-v13.json` by default, or an explicit `SNAPSHOT_PATH`) and executes `test/fork/*` with `FORK_REQUIRED=1`.
- The workflow expects per-network RPC URLs to be provided via repository secrets (see `docs/release/README.md`).
