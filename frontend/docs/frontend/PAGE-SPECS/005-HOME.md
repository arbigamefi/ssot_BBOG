# Page Spec — Home

## Route
- `/`

## Purpose
Provide a protocol overview: supported assets, key bank snapshots, latest bets, and release identity.

## Modules
- `HomeHeader` (title + release badge)
- `AssetsOverview` (cards per asset)
- `LatestBets` (event-driven)
- `OpsMini` (optional, read-only health signals)
- `Footer` (support, docs, legal/disclaimer links)

## Truth Sources
- Release artifact:
  - supported assets / game identity
  - release digest / read-only reason
- SDK read helpers:
  - bank snapshots or derived protocol overview metrics
- Indexer:
  - latest bets / live activity feed

## Rules
- Shipped Home metrics MUST NOT use hardcoded product KPIs.
- If an accelerator such as a subgraph is introduced later, it MUST remain secondary to release + SDK + indexer truth.

## Acceptance Criteria
- Always display release identity
- All numbers formatted via shared format helpers
- Links to primary flows (Games, Liquidity, Bets)
- No hardcoded KPI values in production UI
