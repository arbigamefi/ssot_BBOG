# Keeper signer custody

The keeper submits permissionless settlement, refund and batch-pricing transactions. Give it a
dedicated funded signer; it must not hold governance, guardian, odds-signing, result-reporting or
LP operator authority. Use independent signer credentials for redundant workers.

Configure `KEEPER_PRIVATE_KEY` only in the keeper's secret environment file. Keep file permissions
restricted and exclude the file from source control, deploy bundles and logs. Never pass a key as a
command-line argument or paste it into a transaction log. Safe signer material does not belong on
the application host.

For an authorized signer change:

1. Stop the affected worker and let its in-flight operations finish. Record outstanding transaction
   hashes and nonce state before starting another process with the same signer.
2. Fund and verify the new dedicated signer on the intended chain.
3. Supply the key to [swap-keeper-key.sh](../../../script/ops/swap-keeper-key.sh) through standard
   input. Its argument is the environment file's basename; `KEEPER_ENV_DIR` selects its directory
   (default `/opt/arbigamefi/frontend/deploy/docker/env`). The file must already contain exactly one
   canonical `KEEPER_PRIVATE_KEY=` declaration. The script atomically replaces that value with mode
   0600 and creates no copy of the previous secret.
4. Restart only the affected worker using the current immutable image and verified release.
   Confirm its public signer address, chain, nonce progression, health and first transaction receipt.
5. Reconcile outstanding transactions from the previous signer. Event replay and current-state reads
   handle already-terminal work; changing keys must not advance recovery cursors.

The script only changes the local secret file. It does not fund accounts, restart containers or
change contract roles. See [keeper operations](casino-keeper-production.md) for runtime recovery.
