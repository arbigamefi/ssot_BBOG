# v1.5 deployment checklist

Use the [versioned workflow](v15-release.md) and chain-specific public parameter packet.

- Confirm chain ID, approved deployer and signing account, gas balance, Safe code/owners/threshold/control hashes, guardian and dedicated keeper addresses.
- Run dependency and test gates, then `make deploy-dryrun`. Inspect simulation and nonce before broadcast.
- Broadcast with `make deploy-v15`; preserve v1.5 broadcast traces and reconcile uncertain receipts before resuming.
- Verify runtime code/configuration and fresh Bank pause states with independent RPCs.
- Execute the reviewed Safe governance acceptance packet and verify actual inner calls, hash, events and final permissions.
- Sign and package via `make release-v15`, with trusted release signer and live governance checks.
- Import verified artifacts into the frontend; validate both chain manifests, ABI consistency and exact golden vectors.
- Build immutable images in CI and follow the [Docker runbook](../../frontend/deploy/docker/README.md). Verify health, persistent cursors, database receipts and public UI after deployment.
- Confirm LP amount, betting budget and maximum loss separately before business acceptance. A successful deployment or LP deposit is not completed betting acceptance.
- Record outstanding historical chain obligations and operational incidents in the [implementation status](v15/implementation-status.zh-CN.md).
