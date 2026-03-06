# ADR-021: Facts store implementation (Dexie/IndexedDB)

## Status
Accepted

## Context
We require a local, replayable store for Hub events and derived bet lifecycle state. This store must:
- support incremental sync via cursors
- allow deterministic replay/repair (reorg rewind)
- support local audit trail (tx journal)

## Decision
Use **Dexie** (an IndexedDB wrapper) for the facts store.

We store:
- `hubEvents`: append-only raw facts
- `bets`: derived lifecycle state machine
- `cursors`: per (chainId, hub) incremental sync cursor
- `txJournal`: local audit trail emitted by the SDK tx pipeline

## Alternatives
- raw IndexedDB: too verbose/error-prone
- sqlite/wasm: heavier and unnecessary at current scale

## Consequences
- DB is browser-only; all consumers must be client components.
- We maintain a small schema migration surface (Dexie `version(n).stores(...)`).
