# ADR-003: Hub Events as Facts (Local Indexer)

## Context
Bet lifecycle and truth are emitted through Hub events (placed/randomReady/finalized/refunded). Subgraphs can drift.

## Decision
The app MUST treat Hub events as the primary fact source and build bet state from an event stream. A local indexer using `getLogs` provides replayability.

## Alternatives
- Subgraph as truth (rejected: unverifiable and schema-drift prone)

## Consequences
- Requires cursor storage, confirmations, and reorg handling.
