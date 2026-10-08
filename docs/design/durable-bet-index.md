# Durable bet index

**2026-10-04: NFT index implemented; local PostgreSQL and replay tests passed.**
[Current application evidence](../audit/nft-consumer-integration-review.md) records the tested paths
and remaining release gates. Contracts remain the authority for executable capital.

`@ssot/bet-index` maintains a replayable PostgreSQL read model for the keeper and web application.
Contracts remain the settlement authority. The index stores chain events, casino bets, sports tickets,
per-NFT Vault cash and ownership events, and scan/recovery checkpoints.

## Identity and replay

Casino identity is `(chainId, GameHub, betId)`. Sports ticket identity includes SportsHub, and LP cash
flows include the issuing Vault and deposit ID. Bank/Vault binding is part of release identity. Identical numeric IDs or assets must never combine different authorities' facts.
Queries for the current application are scoped to the selected manifest's Hub and Vault.

`BetIndexStore.initializeSchema()` creates the current tables and indexes in a fresh database. It uses
an advisory lock for concurrent worker startup. No previous schema is upgraded or rewritten.
Event replay from the release block is idempotent; discover all NFT ownership changes, not only a recent feed. Mature/available deposit values still come from canonical Vault reads at the chosen block. Reorg handling rewinds affected source facts and
derivatives together; a successful cursor write cannot get ahead of durable events.

## Economic facts

- Full refunds are terminal events with one refund amount. A settle-path partial refund belongs to
  BetFinalized; the settlement and refund portions must not be double counted.
- LP cash flows are current Vault deposit/withdrawal events keyed by NFT. ERC-721 Transfer,
  mint and burn are ownership facts, not cash events by themselves. Keep asset payer, initial
  NFT owner, current owner and payment recipient distinct. No fungible share price, request
  batch or historical recovery entitlement is indexed. A transferee's cost basis remains unknown
  unless separately established; do not calculate a wallet ROI from the original owner's deposit.
  A gifted deposit is visible to both its payer and NFT owner, retaining those distinct roles.
  Querying either party returns the event once.
- HouseEdgeAllocated supplies the current LP/operator/referral allocation.
- Payment proof comes from the complete settlement transaction logs: exact Bank, token, player,
  position and amount. Direct cash transfer, player payable and unavailable proof are distinct.

## Runtime

The keeper initializes schema, replays the selected release, and recovers unfinished casino/sports
positions. PendingVRF refunds use the fixed per-bet deadline and authoritative absence of a stored
random seed; a local GameHub state alone must not turn an already known result into a refund. Recovery must cover
full history, not a recent-ID tail. Writes serialize by signer; shutdown waits for in-flight work.
The web reads the same index and may obtain current chain evidence when a receipt needs hydration.
Browser IndexedDB is a separate disposable current-schema cache scoped to release identity.

Normal callbacks can produce readiness and terminal logs in the same transaction. WS delivery may
be out of order; a terminal row must not regress, and HTTP replay must not duplicate cash or fees.
Use actual RPC `logIndex` for event identity. Payment proof may use positions inside the complete
receipt to delimit one bet's Bank logs; those array positions are not event IDs. Match emitter,
Bank, asset, player and bet when one receipt contains several operations.

Configure `BET_INDEX_DATABASE_URL` and TLS explicitly. See the
[keeper documentation](../../frontend/apps/keeper/README.md) and
[database runbook](../ops/runbooks/bet-index-production.md). Existing tests cover PostgreSQL concurrency, rollback, replay and cross-authority isolation.
Current NFT queries were executed on disposable PostgreSQL; a skipped PostgreSQL suite still does
not count as evidence for any subsequent source change. Browser replay removes its old tail and
lowers coverage atomically when the observed head retreats, including below deployment origin.
