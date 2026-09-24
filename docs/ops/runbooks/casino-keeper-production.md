# v1.5 keeper operations

Production uses the [immutable Docker stack](../../../frontend/deploy/docker/README.md). The old standalone systemd unit and host-build procedure have been removed.

The current stack runs one keeper per chain with dedicated credentials, persistent health/cursor storage and PostgreSQL. Check `/api/healthz?chainId=8453` and `/api/healthz?chainId=84532`, keeper queue depth and database receipts. An HTTP response alone does not prove chain settlement.

Use reviewed chain-specific environment files and CI-built image digests. Keep environment directories at 0700 and files at 0600. Never run two active keeper processes using the same signer. For a failed broadcast, inspect its receipt and nonce before deciding whether any retry is needed.

Keeper finalization is permissionless; it is not governance authority. Guardian pause and Safe recovery are separate operations. Follow the [v1.5 governance workflow](../../deploy/v15-release.md) and [recovery evidence](../../deploy/v15/recovery-and-guardian-drills.zh-CN.md). See the [implementation record](../../deploy/v15/implementation-status.zh-CN.md) for current scope and outstanding acceptance.

Local development templates remain in `frontend/deploy/casino-keeper/`, used only by development/backfill helpers.
