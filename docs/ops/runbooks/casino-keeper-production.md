# Keeper operations

Deploy the current keeper using the [Docker stack](../../../frontend/deploy/docker/README.md) and
[keeper configuration](../../../frontend/apps/keeper/README.md). Use a verified current manifest,
dedicated signer, chain-specific RPC and the current PostgreSQL schema.

The keeper finalizes eligible casino results, refunds timed-out PendingVRF positions, handles admitted
sports terminal paths, and activates LP queues to price liquid cash without waiting for old positions. It does not hold user claim permissions.
Requests/claims are not inferred from health status; check contract events and actual receipts.

Monitor health, backlog, oldest open positions, historical-recovery age and discovery completeness, write failures and database replay
coverage. Restart after a transport incident only once the configured RPC is available; reconcile
pending transaction receipts and signer nonces. Shutdown waits for in-flight writes before closing the
store. Use independent credentials for redundant workers.

Alert delivery failures must remain retryable. A healthy HTTP snapshot alone does not prove all bets
terminated or all user funds were transferred. Governance and guardian actions remain separate from
permissionless keeper calls; follow the [deployment workflow](../../deploy/v16-release.md).
