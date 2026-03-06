# Gate-B: Pre-Indexer Architecture Review (Milestone C entry gate)

This gate is the frontend equivalent of a contract release gate.
It must pass before implementing the local Indexer (Milestone C).

## Gate-B checklist

### Correctness
- [x] **Release bundle is the only source of truth** (ssot:sync consumes deployments/... + abis/... + vectors + lock)
- [x] Golden vectors **exact-hex** tests pass (stakeSpec + placeBetCalldata)
- [x] SDK uses **release ABIs** (not handwritten fragments)
- [x] Approve semantics are correct: `approve(required)` (not delta)

### Architecture & Maintainability
- [x] apps/web does not touch viem/wagmi outside provider wiring
- [x] packages/ui is protocol-agnostic and Storybook-driven
- [x] packages/ssot contains all protocol integration logic
- [x] Multi-chain readiness: wagmi chains derived from `embeddedChainIds`
- [x] Multi-asset readiness: assets derived from embedded release

### Hygiene
- [x] No legacy placeholder embedded releases (only `chain-<id>.json`)
- [x] No obsolete out/ parsing or compatibility shims

## Notes
Milestone C introduces a local indexer + persistence. Any boundary violation prior to C tends to become irreversible technical debt.
