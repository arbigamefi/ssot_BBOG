# Prototype Freeze Checklist — 2026-03

> Historical reference only. The current v2 prototype suite is already frozen as the active layout baseline.

**Status**: Historical reference  
**Scope**: `frontend prototype system before formal UI implementation`

## Purpose

This checklist defines when the current ArbiGameFi prototype suite is coherent enough
to start formal frontend UI implementation.

The goal is not to make prototypes perfect.
The goal is to prevent implementation from starting while:

- route hierarchy is still drifting
- shells are inconsistent
- trust routes and gameplay routes still use different product grammars
- critical states are still implied instead of designed

## Coverage Checklist

The following routes must have a v2 prototype before implementation starts:

- [x] `Home / Flagship`
- [x] `Games Directory`
- [x] `Roulette Room`
- [x] `Dice Room`
- [x] `Coin Toss Room`
- [x] `Keno Room`
- [x] `Liquidity`
- [x] `Bets`
- [x] `Bet Detail`
- [x] `Account`
- [x] `Referral`
- [x] `Claims`
- [x] `Ops`

## Product-Surface Freeze

### 1. Acquisition Surface

Routes:

- `/`
- `/games`

Must be frozen on:

- primary CTA hierarchy
- hero structure
- room-card grammar
- proof ribbon density
- trust message placement

Implementation must not begin if these pages still read like dashboards.

### 2. Gameplay Surface

Routes:

- `/games/[slug]`
- `Shared Bet Slip`
- `/bets/[betId]` when reached from play

Must be frozen on:

- top game selector placement
- left/right room layout
- table dominance over supporting UI
- ticket rail structure
- room tabs grammar

Implementation must not begin if the room still feels like a protocol page.

### 3. Trust / Audit Surface

Routes:

- `/liquidity`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Must be frozen on:

- shell density
- stats-card hierarchy
- table grammar
- action-panel placement
- authority separation

Implementation must not begin if trust pages still mix player and operator actions without clear visual separation.

## Shared System Freeze

The following shared systems must be visually settled:

- global product header
- trust-route header
- room-route header
- room strip
- bet slip rail
- room tabs
- audit tabs
- stat cards
- CTA hierarchy
- empty / loading / disconnected states

If any of these still varies arbitrarily by page, the design is not frozen.

## Critical Interaction States

The following states must exist in prototype form before implementation:

- wallet disconnected
- loading
- empty data
- sync delayed
- tx pending
- tx confirmed
- tx failed
- governance-only action
- read-only mode

These do not need pixel-perfect polish, but the layout and component treatment must be decided.

## Copy Freeze

Before implementation begins:

- route titles must be final enough for build-out
- CTA verbs must be stable
- player-facing terms must be preferred over protocol terms on player routes
- trust routes must use precise financial language

Examples:

- use `Open rooms`, not `Inspect modules`
- use `Claim XP`, not generic `Execute`
- use `European roulette`, not `mask table`

## Route-by-Route Ready Conditions

### Home

Ready when:

- the hero has one dominant CTA
- the right-side flagship preview is stable
- the lower sections read like a real landing page, not a design deck

### Games Directory

Ready when:

- directory hero is lighter than Home
- room cards share one entry grammar
- category controls are stable

### Room Pages

Ready when:

- table is dominant
- bet slip is compact and readable
- lower tabs use the shared room grammar

### Liquidity

Ready when:

- capital overview and action terminal are clearly separated
- LP-specific explanations are stable

### Bets / Bet Detail

Ready when:

- list and detail pages share one receipt / ledger language

### Account / Referral / Claims / Ops

Ready when:

- all four feel like one trust product family
- but authority levels are still visually distinct

## Implementation Gate

Frontend implementation should start only when:

1. all v2 prototypes exist
2. shared systems are stable
3. core states are represented
4. route copy is mostly frozen
5. design reviewers agree the product reads as one brand across acquisition, gameplay, and trust

## Immediate Remaining Work

Before using the prototypes as direct implementation source:

1. re-review `Home v2` for final landing density
2. re-review `Roulette Room v2` for final table-to-slip balance
3. re-review `Games Directory` for final lobby density
4. decide whether `Referral` remains player-facing or becomes an advanced trust route

## Output of Freeze

Once this checklist is satisfied, the next artifact should be:

- a route-by-route implementation map

That map should list:

- prototype file
- production route
- shared components to build or adapt
- implementation order
- verification requirements
