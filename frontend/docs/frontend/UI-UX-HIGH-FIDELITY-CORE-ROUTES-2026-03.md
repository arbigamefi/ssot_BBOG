# UI/UX High-Fidelity Core Routes — ArbiGameFi

**Status**: Active route-level design intent

**Date**: 2026-03-23

## 1. Purpose

This document describes the currently accepted high-fidelity route intent behind the active v2 prototypes.

It is no longer a pre-prototype planning layer.
It is the route-level interpretation of the live prototype baseline.

## 2. Core System Rules

### 2.1 Shared visual rules

- background creates atmosphere but does not replace hierarchy
- typography carries more hierarchy than borders
- first fold exposes one dominant action
- trust is visible but not equally loud on every route
- tables and metrics are secondary on gameplay routes and primary on trust routes

### 2.2 Family differences

Acquisition:

- broader spacing
- stronger editorial rhythm
- lighter proof

Gameplay:

- tighter layouts
- board-first hierarchy
- compact support chrome

Trust:

- calmer surfaces
- stronger table grammar
- lower atmospheric intensity

## 3. Current Core Routes

### 3.1 Home

Source:

- `ui-ux-v2-flagship`

Accepted intent:

- hero-led landing page
- one dominant CTA
- proof ribbon
- featured room rail
- editorial marketing sections

Not allowed:

- dashboard first fold
- room-detail first fold
- protocol metrics wall

### 3.2 Games Directory

Source:

- `ui-ux-v2-directory`

Accepted intent:

- curated room directory
- one featured room
- supporting room entry cards
- lightweight proof

Not allowed:

- data catalog tone
- release-manifest language
- flat card wall with equal weight

### 3.3 Roulette Room

Source:

- `ui-ux-v2-roulette`

Accepted intent:

- top game selector
- compact room HUD
- dominant European table stage
- compact ticket rail
- lower room tabs with `All Bets / My Bets / Players / Analytics / Game Details`

Not allowed:

- left global game rail
- hero cards above the table
- protocol metadata in the first fold

### 3.4 Dice Room

Source:

- `ui-ux-v2-dice`

Accepted intent:

- same room shell as roulette
- dice-specific stage and ticket language
- same lower room ledger grammar

### 3.5 Coin Toss and Keno

Sources:

- `ui-ux-v2-cointoss`
- `ui-ux-v2-keno`

Accepted intent:

- reuse the shared room shell
- differentiate the stage and ticket language

### 3.6 Trust Routes

Sources:

- `ui-ux-v2-liquidity`
- `ui-ux-v2-bets`
- `ui-ux-v2-bet-detail`
- `ui-ux-v2-account`
- `ui-ux-v2-claims`
- `ui-ux-v2-referral`
- `ui-ux-v2-ops`

Accepted intent:

- common trust header grammar
- calmer stats rhythm
- stronger table shells
- clearer authority vs player actions

## 4. Implementation Rule

Any formal route implementation must match:

1. the correct current prototype page
2. the correct route family
3. the correct copy baseline

If one of these differs, the docs or prototype must be updated before continuing implementation.
