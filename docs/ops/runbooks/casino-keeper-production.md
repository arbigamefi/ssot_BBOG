# Keeper operations

Deploy the current keeper using the [Docker stack](../../../frontend/deploy/docker/README.md) and
[keeper configuration](../../../frontend/apps/keeper/README.md). Use a verified current manifest,
dedicated signer, chain-specific RPC and the current PostgreSQL schema.

The keeper finalizes eligible casino results, refunds timed-out PendingVRF positions, handles admitted
sports terminal paths, activates LP queues to price liquid cash without waiting for old positions, and
claims player payables, which always pay the player's own address. It does not hold user claim permissions.
Requests/claims are not inferred from health status; check contract events and actual receipts.

After an RPC quota or WebSocket outage, verify the running image revision and its actual
`KEEPER_RPC_WS` configuration without printing the URL credential. From the same host,
check the chain ID, a successful `eth_subscribe` acknowledgement and incoming `newHeads`.
This establishes provider availability, not the keeper's own subscription state. Inspect
watch errors and correlate the next authorized testnet ready event with the keeper's
`gameHub`/`vrfHub` enqueue and mined receipt. A `scan` enqueue is HTTP discovery evidence;
an already queued item keeps its original source even if a later WS event wakes it.
Deploy the current keeper with the newly deployed contracts and their verified release.
Retired development instances are not recovery targets or dependencies of this deployment.
Keep HTTP catch-up enabled and check pending signer nonces before restarting a current instance.

Monitor health, backlog, oldest open positions, historical-recovery age and discovery completeness, write failures and database replay
coverage. Restart after a transport incident only once the configured RPC is available; reconcile
pending transaction receipts and signer nonces. Shutdown waits for in-flight writes before closing the
store. Use independent credentials for redundant workers.

Alert delivery failures must remain retryable. A healthy HTTP snapshot alone does not prove all bets
terminated or all user funds were transferred. Governance and guardian actions remain separate from
permissionless keeper calls; follow the [deployment workflow](../../deploy/v16-release.md).
