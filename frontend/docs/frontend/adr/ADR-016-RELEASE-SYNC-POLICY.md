# ADR-016: Release Sync Policy (Digest Guard)

## Context
The frontend must not drift from the contract release bundle. Addresses, ABIs and encoding fixtures must be consistent with the displayed release digest.

## Decision
- `pnpm ssot:sync -- --from <bundleRoot|tar.gz>` MUST sync the **FINAL SHAPE Release Bundle** (see `docs/frontend/SPEC.md` and ADR-018), including:
  - `deployments/frontend-manifest-latest.json`
  - `deployments/golden-vectors-latest.json`
  - `deployments/release-latest.json`
  - `abis/index.json` + `abis/*.abi.json`
- The repo generates:
  - embedded release snapshots (`packages/ssot/src/release/embedded/*`)
  - synchronized ABIs (`packages/ssot/src/abis/release/*`)
  - an auditable mirror under `packages/ssot/src/fixtures/release-bundles/*`
- CI SHOULD implement a **digest guard**: if the embedded release digest changed without updating the synced artifacts, CI fails.

## Alternatives
- Manual copy (rejected): too easy to drift.
- Reading Foundry `out/` (rejected): not FINAL SHAPE; violates “frontend must not authoritatively derive ABI”.

## Consequences
The release artifact becomes the single source of truth for runtime configuration.

## Status
Accepted
