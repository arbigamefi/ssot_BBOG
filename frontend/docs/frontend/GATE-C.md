# Gate C — Indexer + Facts Store + TxJournal

This gate defines the minimum requirements for the **Milestone C** deliverable:

## Scope

- Local, replayable **facts store** (IndexedDB via Dexie)
- Event-driven **Hub indexer** (Hub events as facts)
- Derived **Bets** table (pure reducer)
- Local **TxJournal** (SDK tx pipeline -> Dexie sink)
- Minimal UI surfacing for verification (`/bets`, `/account`, `/ops`)

## MUST

- All on-chain log retrieval happens in `@ssot/ssot/indexer` (no `getLogs` in feature pages)
- Facts store tables:
  - `hubEvents` (raw)
  - `bets` (derived)
  - `cursors` (incremental sync)
  - `txJournal` (audit)
- Indexer MUST implement confirmations + rewind strategy
- Derived bet reducer MUST be pure and covered by unit tests
- Tx pipeline MUST write journal rows for at least:
  - submitted
  - mined
  - failed

## SHOULD

- Indexer status should be visible in `/ops`
- Bets page should show derived lifecycle state and latest sync blocks

## Validation

```bash
pnpm ssot:sync -- --from <release-bundle>
pnpm test
pnpm dev
```
