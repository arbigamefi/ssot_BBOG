# Keeper operations

This runbook describes the accepted target; release gates are tracked in the [release notes](../../release/README.md)
and the [implementation plan](../../design/lp-accounting-and-callback-implementation.md).
Deploy one authenticated current release with its PostgreSQL schema,
using the [Docker stack](../../../frontend/deploy/docker/README.md) and dedicated signer.

Normal VRF callbacks settle themselves. The keeper handles failed original-result delivery/finalization,
eligible missing-randomness refunds, player payables and event indexing.
It holds no LP NFT approval/operator permission and performs no automatic mature-NFT withdrawal.
No LP batch activation or historical-right worker remains. Maturity is derived from each ID's chain
deadline; it needs no keeper state transition. Index Vault NFT ownership separately from actual
asset deposit/withdrawal cash, using the authenticated Vault binding and canonical receipt order.
A Ready event whose bet is already terminal requires indexing, not another finalize transaction.

Keep Infura HTTP scanning and Alchemy WebSocket event subscriptions. After an outage, verify the running
image, chain and actual WS configuration without printing credentials. A successful eth_subscribe/newHeads
probe proves provider availability, not the keeper's own subscription. Correlate real callback logs with
keeper ingestion and terminal indexing. Normal success should send zero keeper finalize transactions;
forced callback failure must demonstrate original-seed retry and one final payment.

Exercise WS loss/reconnect and HTTP catch-up, duplicate or out-of-order Ready/Finalized events, reorgs,
restart and pending nonces. Do not revive retired development services. Preserve independent history
reconciliation; a live queue can be empty while an older position is unresolved.

Monitor placed-to-terminal latency across all bets, canonical unbooked-result count/age, missing-randomness
deadlines, capacity, player debts, finalized cash-history coverage and actual send failures. A racing
worker that finds a terminal bet is not an error; a reproducible accounting failure is not merely a race.

Shutdown waits for in-flight writes. Delivery failures remain retryable. Health alone proves neither
complete terminalization nor payment; verify receipts and Bank accounting. Governance/Safe actions
remain separate from permissionless keeper work.
