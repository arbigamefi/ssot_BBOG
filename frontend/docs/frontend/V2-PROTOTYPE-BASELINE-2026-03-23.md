# V2 Prototype Baseline — 2026-03-23

**Status**: Active visual baseline

## 1. Purpose

This document freezes one decision:

**the current `ui-ux-v2-*` prototype suite is the only first source for frontend visual hierarchy and page structure.**

This baseline exists so implementation, governance, and copy no longer drift between:

- old architecture docs
- old freeze reviews
- archive references
- informal layout experiments

## 2. Active Prototype Routes

The active prototype suite is:

- `ui-ux-v2-flagship`
- `ui-ux-v2-directory`
- `ui-ux-v2-roulette`
- `ui-ux-v2-dice`
- `ui-ux-v2-cointoss`
- `ui-ux-v2-keno`
- `ui-ux-v2-liquidity`
- `ui-ux-v2-bets`
- `ui-ux-v2-bet-detail`
- `ui-ux-v2-account`
- `ui-ux-v2-claims`
- `ui-ux-v2-referral`
- `ui-ux-v2-ops`

## 3. Route Mapping

Formal routes must map as follows:

- `/` → `ui-ux-v2-flagship`
- `/games` → `ui-ux-v2-directory`
- `/roulette` → `ui-ux-v2-roulette`
- `/dice` → `ui-ux-v2-dice`
- `/cointoss` → `ui-ux-v2-cointoss`
- `/keno` → `ui-ux-v2-keno`
- `/invest` → `ui-ux-v2-liquidity`
- `/bets` → `ui-ux-v2-bets`
- `/bets/[betId]` → `ui-ux-v2-bet-detail`
- `/account` → `ui-ux-v2-account`
- `/claims` → `ui-ux-v2-claims`
- `/referral` → `ui-ux-v2-referral`
- `/ops` → `ui-ux-v2-ops`

Compatibility routes remain:

- `/games/[slug]`
- `/liquidity`

## 4. Active Shell System

### 4.1 LandingShell

Routes:

- `/`
- `/games`

Purpose:

- hero-led acquisition
- proof ribbon
- room-entry rail
- editorial sections

### 4.2 RoomShell

Routes:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Structure:

- game tabs header
- compact room HUD
- stage + ticket rail
- lower room tabs

### 4.3 TrustShell

Routes:

- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Purpose:

- calm metrics
- clearer tables
- explicit player vs operator actions

## 5. Non-Negotiable Layout Decisions

- no archive-first page structures
- no left global game rail
- no heavy gameplay hero above the table
- no protocol-first first fold on gameplay routes
- no prototype-note copy in production-facing UI
- no dual visual baselines

## 6. Copy And Brand Relationship

The prototypes define layout and visual emphasis.
They do not override:

- product brand naming
- whitepaper terminology boundaries
- messaging pack
- landing copy baseline

If a prototype contains generic or design-note copy, implementation must follow the copy documents instead.

## 7. Archive Usage Policy

The archive frontend is not a page-layout source.

It may only be referenced for:

- compact betting rail density
- room tab grammar
- mature casino interaction details

It may not override:

- page composition
- shell family
- route hierarchy
- brand language

## 8. Historical Reference Status

Any older design doc that conflicts with this document is automatically treated as historical reference unless explicitly reactivated.
