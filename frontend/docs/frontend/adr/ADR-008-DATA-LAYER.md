# ADR-008: Data Layer Separation (React Query + Local Indexer Store)

## Context
We have two data modalities:
- View calls: cacheable reads
- Events: factual state machine

## Decision
- React Query manages view reads & caching
- Local Indexer (Dexie/IndexedDB) stores event-derived facts (bets, cursor)

## Consequences
- Clear ownership boundaries
- Easier to swap event source to subgraph later without changing UI
