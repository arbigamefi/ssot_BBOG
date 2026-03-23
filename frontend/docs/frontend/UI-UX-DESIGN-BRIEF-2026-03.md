# UI/UX Design Brief — ArbiGameFi Product Interface

**Status**: Active design brief

**Date**: 2026-03-23

## 1. Purpose

This brief no longer describes a pre-design discovery phase.
It now defines the active design contract for implementation:

- the current `ui-ux-v2-*` prototype suite is visually accepted
- formal UI work must align to that suite
- brand and messaging documents remain authoritative for copy
- functional implementation remains anchored to current provider/sdk/runtime/indexer truth

## 2. Product Objective

Design and implement a production-grade ArbiGameFi frontend that feels:

- premium
- game-first
- wallet-native
- non-custodial
- operationally legible

The product must not feel like:

- a DeFi admin console
- a protocol debug dashboard
- a generic neon casino clone
- a component demo

## 3. Product Families

### 3.1 Acquisition

Routes:

- `/`
- `/games`

Goal:

- explain ArbiGameFi fast
- build trust fast
- move the user into a room fast

### 3.2 Gameplay

Canonical routes:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Compatibility:

- `/games/[slug]`

Goal:

- let the player understand one room in one glance
- choose a target
- size a ticket
- place a bet

### 3.3 Trust

Canonical routes:

- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Compatibility:

- `/liquidity`

Goal:

- expose balances, liabilities, claims, and release facts clearly

## 4. Active Design Decision

The frontend no longer treats large UI choices as code-first exploration.

The correct order is now:

1. current v2 prototype
2. brand and messaging documents
3. implementation mapping
4. code

Older architecture, wireframe, and freeze-review documents are supporting context only.
They are not active visual instructions.

## 5. Design Principles

### 5.1 One dominant action per screen

Every major route must have one dominant action.

### 5.2 Trust is visible, not omnipresent

ArbiGameFi must visibly communicate custody, settlement, and verifiability.
But trust information must appear in the correct layer:

- acquisition: promise
- gameplay: reassurance
- trust routes: explicit detail

### 5.3 Gameplay must be legible in one glance

A room must instantly communicate:

- what game it is
- where to choose the target
- where to set the ticket
- where to place the bet

### 5.4 Shared language, route-specific density

The product uses one visual system, not one identical page formula.

### 5.5 Prototype cleanup before implementation

The v2 prototype suite is the layout source, but not literal production copy.
Implementation must clean:

- meta-design phrases
- one-off glow excess
- inconsistent border intensity
- generic placeholder language

## 6. Brand And Copy Rules

- `ArbiGameFi` is the public product name
- `SSOT` remains an internal architecture concept
- prototype copy never overrides messaging documents
- implementation must prefer whitepaper-backed product language over leftover prototype phrasing

## 7. Binding Companion Documents

- `V2-PROTOTYPE-BASELINE-2026-03-23.md`
- `UI-CONSTITUTION.md`
- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `PROTOTYPE-TO-IMPLEMENTATION-MAP-2026-03.md`
- `SCREEN-SPECS/`
