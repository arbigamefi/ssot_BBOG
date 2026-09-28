# Durable bet index

`@ssot/bet-index` maintains a replayable PostgreSQL read model for the keeper and web application.
Contracts remain the settlement authority. The index stores chain events, casino bets, sports tickets,
LP cash ledger entries and scan/recovery checkpoints.

## Identity and replay

Casino identity is `(chainId, GameHub, betId)`. Sports ticket identity includes SportsHub, and LP cash
flows include Bank. Identical numeric IDs or assets must never combine different authorities' facts.
Queries for the current application are scoped to the selected manifest's Hub and Bank.

`BetIndexStore.initializeSchema()` creates the current tables and indexes in a fresh database. It uses
an advisory lock for concurrent worker startup. No previous schema is upgraded or rewritten.
Event replay from the release block is idempotent. Reorg handling rewinds affected source facts and
derivatives together; a successful cursor write cannot get ahead of durable events.

## Economic facts

- Full refunds are terminal events with one refund amount. A settle-path partial refund belongs to
  BetFinalized; the settlement and refund portions must not be double counted.
- LP cash flows are current Bank Deposit and Withdraw events. Share transfers, escrow requests and
  batch burns do not prove money changed hands.
- HouseEdgeAllocated supplies the current LP/operator/referral allocation.
- Payment proof comes from the complete settlement transaction logs: exact Bank, token, player,
  position and amount. Direct cash transfer, player payable and unavailable proof are distinct.

## Runtime

The keeper initializes schema, replays the selected release, and recovers unfinished casino/sports
positions. PendingVRF refunds use chain state and current timeout eligibility. Recovery must cover
full history, not a recent-ID tail. Writes serialize by signer; shutdown waits for in-flight work.
The web reads the same index and may obtain current chain evidence when a receipt needs hydration.
Browser IndexedDB is a separate disposable current-schema cache scoped to release identity.

Configure `BET_INDEX_DATABASE_URL` and TLS explicitly. See the
[keeper documentation](../../frontend/apps/keeper/README.md) and
[database runbook](../ops/runbooks/bet-index-production.md). Tests include real PostgreSQL concurrency,
rollback, replay and cross-authority isolation.
