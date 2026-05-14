# Page Spec — Games

## Purpose

Allow a user to place bets through the current SSOT transaction flow while presenting the current v2 room grammar.

## Routes

Canonical public routes:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Compatibility route:

- `/games/[slug]`

Rules:

- top-level room routes are the public product routes
- `/games/[slug]` remains a compatibility and shared implementation route during transition
- `/games/coin-toss` may exist internally, but the user-facing canonical route is `/cointoss`

## Active Layout Source

Gameplay layout and visual hierarchy come from the active v2 prototypes:

- roulette → `ui-ux-v2-roulette`
- dice → `ui-ux-v2-dice`
- cointoss → `ui-ux-v2-cointoss`
- keno → `ui-ux-v2-keno`

## Information Architecture

1. room shell header
2. top game selector
3. compact room HUD
4. primary surface:
   - board or stage
   - ticket rail
5. lower room tabs:
   - `All Bets`
   - `My Bets`
   - `Players`
   - `Analytics`
   - `Game Details`

The first fold must stay gameplay-first.

## Shared Modules

- `RoomShell`
- `RoomSelector`
- `RoomHud`
- `GameRoomBetPanel`
- `usePlaceBetStepper`
- game-specific stage component
- `LowerRoomTabs`

## Data Sources

- release manifest for room identity and protocol truth
- sdk plan/execute flow for writes
- indexer for live bet history and room activity

## Canonical Room Mapping

The active room MUST be resolved from the release manifest, but route presentation follows canonical public room routes.

Implementation rule:

1. canonical room route determines the visible public route
2. release manifest determines protocol identity
3. if a room slug is unsupported by the release, the route becomes unavailable and all writes are disabled

## First Fold Rules

The first fold must show:

- what room the player is in
- where the stage is
- where the ticket rail is
- how to submit the ticket

The first fold must not show:

- release digest
- module addresses
- params encoding copy
- room explanation cards
- protocol truth walls

## Ticket Rail Rules

The ticket rail remains compact and control-focused.

Required content:

- amount
- quick actions
- count or ticket repetition control
- summary
- CTA
- tx state near the action

## Lower Tabs Rules

Deeper information belongs below the first fold.
The lower tabs hold history, players, analytics, and detailed room information.

## Acceptance Criteria

- no route leads with protocol jargon
- no room introduces a left-side global game rail
- top-level routes remain canonical public routes
- current transaction behavior and protocol truth are preserved
