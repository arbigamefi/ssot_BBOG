# Screen Spec — Roulette Room

**Route**: `/roulette`

**Active prototype source**: `ui-ux-v2-roulette`

**Product mode**: Gameplay

**Primary action**: `Review ticket` or `Place ticket`

## 1. Goal

Roulette must feel like the flagship table room.

The first fold must make the player instantly understand:

- this is standard European roulette
- the board is the main stage
- the ticket rail is the control deck
- deeper data lives below the fold

## 2. First Fold Structure

1. room shell header
2. top game selector
3. compact room HUD
4. main board stage
5. compact ticket rail

The first fold must not contain:

- protocol explanation cards
- room hero panels
- left global navigation
- large metadata stacks

## 3. Board Rules

- `0` is visually isolated
- `1-36` use the standard European `3 x 12` layout
- right-side `2:1` cells stay attached to the board
- dozens and outside bets remain clearly subordinate to the main grid
- the board is the largest and dominant surface

## 4. Ticket Rail Rules

Vertical order:

1. balance
2. amount input
3. quick actions
4. number of bets
5. ticket summary
6. CTA
7. advanced disclosure if needed

Rules:

- compact and tool-like
- no dense explanatory copy
- quote, fee, and approval remain visible but compressed
- CTA is the strongest element inside the rail

## 5. Lower Room Tabs

The lower data layer uses:

- `All Bets`
- `My Bets`
- `Players`
- `Analytics`
- `Game Details`

This layer is secondary to the first fold.
It must not compete visually with the board and ticket rail.

## 6. Copy Rules

Use:

- player-facing table language
- short helper text
- room-native labels

Avoid:

- bitmask language
- encoding language
- internal protocol wording in the first fold

## 7. Visual Rules

- room tone is darker and tighter than acquisition
- board-first hierarchy is mandatory
- room HUD stays compact
- support chrome remains quiet

## 8. Mobile

Order:

1. header
2. selector
3. room HUD
4. board
5. ticket rail
6. tabs and deeper data

The board stays above the slip on mobile.
