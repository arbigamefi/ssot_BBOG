# ADR-026: Extend Indexer to Bank Events

## Context

The Hub indexer (ADR-013) tracks four Hub events: `BetPlaced`, `BetRandomReady`, `BetFinalized`, `BetRefunded`. This is sufficient for bet lifecycle tracking but leaves the **Bank contract events completely unindexed**.

Bank emits critical accounting events:
- `XPAwarded` — XP distribution per bet settlement (accrued + locked + holdback per payee)
- `XPLockedUnlocked` — locked XP released when source player meets turnover threshold
- `XPHoldbackReleased` — vested holdback released after `holdbackVestingSeconds`
- `XPAcruedClaimed` — user claimed accrued XP
- `BetSettled` — bet settlement accounting (payout, fees, XP breakdown)

Without indexing these events, the Claims page relies entirely on on-demand `view` calls (`xpAccruedOf`, `xpLockedOf`, `xpHoldbackOf`, `holdbackReleasable`). This works for current balances but provides **zero historical visibility** — users cannot see when XP was awarded, which bets generated it, or when holdback will vest.

Additionally, there is an **atomicity bug** in the Hub indexer: the cursor update occurs outside the Dexie transaction. If the DB write succeeds but the cursor update fails (e.g., crash), the next sync will reprocess already-written events.

## Decision

1. **Create `bankIndexer.ts`** following the same pattern as `hubIndexer.ts`:
   - Cursor-based polling with configurable `confirmations`, `batchSize`, `rewindBlocks`
   - Events stored in a new `bankEvents` table
   - XP events reduced into an `xpHistory` table for efficient per-payee queries

2. **Extend Dexie schema** (version bump):
   ```
   bankEvents: '++id, chainId, blockNumber, logIndex'
   xpHistory:  '[chainId+payee+blockNumber], payee, eventType'
   ```

3. **Fix cursor atomicity**: Move cursor update inside the Dexie transaction for both Hub and Bank indexers.

4. **Bank indexer runs in a separate Web Worker** (same as Hub indexer pattern) to avoid blocking the UI thread.

## Alternatives

- **Server-side indexer (subgraph)**: Deferred per ADR-013. Local-first indexing provides offline resilience and eliminates trust in a third-party indexer.
- **Index only on Claims page mount**: Rejected — would miss events when user is on other pages, and would require re-sync on every visit.
- **Single combined indexer for Hub + Bank**: Rejected — Hub and Bank have different event schemas and query patterns. Separate indexers are more maintainable.

## Consequences

- Schema version bump requires migration consideration (Dexie handles this gracefully for additive changes)
- Second Web Worker increases memory footprint slightly (~2MB)
- Claims page can show full XP timeline instead of just current balances
- Ops page gains visibility into Bank indexer sync status

## Status

Proposed
