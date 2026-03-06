# ADR-013: Local Indexer Execution Model

## Context
Event indexing is required for bets and must remain responsive under load. Running `getLogs` and state-machine merges on the UI thread will eventually cause jank.

## Decision
- Implement the indexer in `@ssot/ssot` with a **Web Worker** execution option.
- Persist facts in **IndexedDB** (Dexie).
- Use `confirmations` + `rewindWindow` per chain to handle reorgs deterministically.
- Treat **Hub events as facts**; use views only for reconcile.

## Alternatives
- Index on the main thread (rejected): UI stalls at scale.
- Rely on a subgraph (deferred): allowed as an accelerator but not the facts source.

## Consequences
We need a small worker messaging protocol and a stable schema for stored facts.

## Status
Accepted
