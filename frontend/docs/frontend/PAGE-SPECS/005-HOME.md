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

## Data Sources
- Release snapshot: supported assets list
- Bank snapshots (view/cache)
- Indexer: latest bets

## Acceptance Criteria
- Always display release identity
- All numbers formatted via shared format helpers
- Links to primary flows (Games, Liquidity, Bets)
