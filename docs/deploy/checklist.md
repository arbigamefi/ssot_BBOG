# Deployment checklist

Use the [versioned workflow](v16-release.md) and chain-specific public parameter packet.

- Confirm chain ID, approved deployer and signing account, gas balance, Safe code/owners/threshold/control hashes, guardian and dedicated keeper addresses.
- Use the operator RPC keys only through `script/tools/with-ops-rpc.sh`; the production keeper keys stay on the server.
- Run dependency and test gates, then the preflight (`script/release/run_preflight.sh`): chain readback, dry run, plan
  review and the rehearsal of the deployment, the wiring and the activation on a fork. Prepare the deploy copy from it.
- The Owner broadcasts with `script/release/broadcast_v16.sh`, which refuses unless the preflight still matches the chain;
  preserve broadcast traces and reconcile uncertain receipts before anything else.
- Verify runtime code and configuration with independent RPCs.
- Review and schedule the Safe's wiring operation (`make timelock-batches-v16`), publish its calls for the 72-hour
  review, and after execution verify the inner calls, events and final permissions.
- Sign and package via `make release-v16`, with trusted release signer and live governance checks; run the Release
  Gate from the release tag and accept it only on `release-ready` with the expected commit and jobs.
- After the release, the Safe schedules the activation; it opens betting 72 hours later at the earliest.
- Import verified artifacts into the frontend; validate both chain manifests, ABI consistency and exact golden vectors.
- Build immutable images in CI and follow the [Docker runbook](../../frontend/deploy/docker/README.md). Verify health, persistent cursors, database receipts and public UI after deployment.
- Confirm LP amount, betting budget and maximum loss separately before business acceptance. A successful deployment or LP deposit is not completed betting acceptance.
