# Page Spec — Bets

## Routes
- `/bets` (list)
- `/bets/[betId]` (detail)

## Purpose
Provide an auditable, event-driven bet history that mirrors protocol truth.

## Truth Sources
- Indexer (Hub events):
  - primary source for bet history
  - primary source for lifecycle transitions
- SDK read helpers:
  - `sdk.hub.getBet(betId)` for reconcile and detail completeness
- Release artifact + encoder/decoder registry:
  - game identity
  - params decode/display
- Local tx journal:
  - txHash linkage and local user action context

## List Page
### Modules
- Filters: asset, game, status, time range
- Table: betId, game, stake, vrfFee, status, timestamps, actions
- Linkage: show txHash (if available from TxJournal) and link to explorer
- Actions:
  - `Refund` available when eligible (pending > refundTimeout)
  - `Finalize` if protocol exposes it and eligible

### States
- Loading: skeleton
- Empty: explain and link to games
- Error: DomainError

## Detail Page
### Modules
- Summary card (betId, status, player, asset, stake, vrfFee)
- Params card (game-specific decoded fields)
- Timeline card (events list)
- Actions card (refund/finalize/claim)

### Actions (MUST)
- All write actions on bet detail MUST reuse the standardized tx stepper (ADR-022).
- If the bet is eligible for refund (pending > refundTimeout), the Refund button becomes enabled.

### Reconcile UX (MUST)
- If a placeBet tx is mined but betId is unknown, the page MUST expose "Bind betId" (ADR-023) and persist it to TxJournal.

## Acceptance Criteria
- All state transitions come from events
- Actions use standardized tx stepper
- The list/detail views declare which fields are event-derived vs read-derived
