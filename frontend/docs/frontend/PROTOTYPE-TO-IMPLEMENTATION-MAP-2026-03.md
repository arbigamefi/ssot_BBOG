# Prototype To Implementation Map — 2026-03

**Status**: Active implementation bridge

## 1. Purpose

This document answers four questions:

1. which current v2 prototype is authoritative for each formal route
2. which shell family each route belongs to
3. which real functional components should be preserved and re-skinned
4. what compatibility routes remain during cutover

## 2. Global Rules

- current `ui-ux-v2-*` prototypes are the only first visual source
- brand and copy docs override prototype placeholder copy
- current provider/sdk/runtime/indexer/tx flow remain the only functionality truth
- archive frontend is interaction reference only

## 3. Shared Shell System

### 3.1 LandingShell

Used by:

- `/`
- `/games`

Responsibilities:

- hero
- proof ribbon
- room entry rail
- editorial sections

### 3.2 RoomShell

Used by:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Responsibilities:

- game tabs header
- compact room HUD
- stage
- ticket rail
- lower room tabs

### 3.3 TrustShell

Used by:

- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Responsibilities:

- trust header grammar
- trust stats strip
- trust table shell
- clearer player vs operator action grouping

## 4. Shared Components To Preserve

These real components should be preserved and re-skinned instead of replaced:

- `GameBetPanel`
- `SharedBetSlip`
- `RouletteBoard`
- audit/data table components
- transaction stepper / quote / approval / journal flow

These visual components must be hardened as shared primitives:

- `HeroProofRibbon`
- `RoomEntryCard`
- `RoomSelector`
- `RoomHud`
- `TicketRailBase`
- `LowerRoomTabs`
- `TrustStatsStrip`
- `TrustTableShell`

## 5. Route Mapping

### 5.1 Acquisition

- `/` → `ui-ux-v2-flagship` → `LandingShell`
- `/games` → `ui-ux-v2-directory` → `LandingShell`

### 5.2 Gameplay

- `/roulette` → `ui-ux-v2-roulette` → `RoomShell`
- `/dice` → `ui-ux-v2-dice` → `RoomShell`
- `/cointoss` → `ui-ux-v2-cointoss` → `RoomShell`
- `/keno` → `ui-ux-v2-keno` → `RoomShell`

Compatibility:

- `/games/[slug]` stays as an implementation shell during transition

### 5.3 Trust

- `/invest` → `ui-ux-v2-liquidity` → `TrustShell`
- `/bets` → `ui-ux-v2-bets` → `TrustShell`
- `/bets/[betId]` → `ui-ux-v2-bet-detail` → `TrustShell`
- `/account` → `ui-ux-v2-account` → `TrustShell`
- `/claims` → `ui-ux-v2-claims` → `TrustShell`
- `/referral` → `ui-ux-v2-referral` → `TrustShell`
- `/ops` → `ui-ux-v2-ops` → `TrustShell`

Compatibility:

- `/liquidity` stays available while `/invest` is the canonical LP route

## 6. Active Implementation Order

1. shared shell cleanup
2. acquisition routes
3. gameplay routes
4. trust routes
5. compatibility redirect cleanup

## 7. Compatibility Policy

Canonical public routes:

- `/`
- `/games`
- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`
- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Compatibility routes:

- `/games/[slug]`
- `/liquidity`

Implementation may continue to use compatibility routes internally,
but user-visible navigation should point to canonical routes.
