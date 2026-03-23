# BetSwirl Gap Analysis — ArbiGameFi Frontend (2026-03)

> Historical reference only. BetSwirl remains an interaction benchmark, not an active page-layout source.

## Purpose

This document compares the current ArbiGameFi frontend against the publicly visible BetSwirl frontend and product grammar, then converts that comparison into an actionable improvement list.

This is not a “copy BetSwirl” document.

The goal is:

- adopt the mature casino-dApp interaction patterns that BetSwirl already gets right
- keep ArbiGameFi’s stronger trust, liquidity, and audit surfaces
- stop mixing protocol explanation with gameplay

## Source Basis

Observed on 2026-03-14.

- BetSwirl official site: <https://www.betswirl.com/>
- BetSwirl Dice route: <https://www.betswirl.com/bnb-chain/casino/dice>
- BetSwirl docs home: <https://www.betswirl.com/docs>
- BetSwirl dApp docs: <https://docs.betswirl.com/protocol-hub/where-to-bet/dapp>
- BetSwirl casino games docs: <https://docs.betswirl.com/protocol-hub/casino/games>

Current ArbiGameFi routes compared:

- `/`: `frontend/apps/web/src/app/page.tsx`
- `/games`: `frontend/apps/web/src/app/games/pageClient_list.tsx`
- `/games/[slug]`: `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`
- shared betting rail: `frontend/apps/web/src/features/betting/ui/GameBetPanel.tsx`

## Executive Read

BetSwirl is ahead in one specific area: **it already speaks fluent casino-room UI**.

ArbiGameFi is ahead in a different area: **it has deeper protocol truth, better trust-route potential, and stronger liquidity/account/audit surfaces**.

The problem is that ArbiGameFi still presents too much of that truth language inside play routes.

BetSwirl gets the top fold right:

- room first
- bet first
- table first
- explanation later

ArbiGameFi still spends too much first-fold attention on:

- narrative copy
- room philosophy
- trust framing
- meta labels

Those things are valuable, but they belong **below the fold or in dedicated trust routes**, not inside the main play task.

## What BetSwirl Gets Right

### 1. Single-task room hierarchy

Their room pages are brutally prioritized:

1. choose game
2. set bet
3. submit
4. inspect supporting detail below

There is very little ambiguity about what the player should do next.

### 2. Bet slip behaves like a casino tool, not a form

The left control rail in BetSwirl feels operational:

- quick amount entry
- multiplier shortcuts
- manual vs auto mode
- bet count / rounds
- visible payout relationship
- strong primary CTA

It reads as a “ticket console”, not a React form.

### 3. Standard post-fold information grammar

BetSwirl uses the expected room follow-up surfaces:

- live bets
- my bets
- players
- analytics
- game details

This matters because users already understand this grammar from other casinos.

### 4. Directory and home both push into rooms quickly

BetSwirl’s acquisition surface does not over-explain itself.

It points users toward:

- categories
- games
- rooms
- direct play entry

The operating principle is:

> get the user into a table fast, then let the rest of the product explain itself through use.

## What ArbiGameFi Already Does Better

These are not weaknesses. They should be preserved and amplified.

### 1. Better trust-route potential

ArbiGameFi already has deeper route potential around:

- liquidity
- account
- claims
- bet detail
- release identity

BetSwirl is stronger at the play route, but weaker as a protocol-trust product.

### 2. Better long-term differentiation

ArbiGameFi has a cleaner basis for:

- wallet-native truth
- release-bound identity
- explicit settlement visibility
- LP/audit-facing routes

This is a stronger strategic position than “just another casino skin”.

### 3. Typed roulette and protocol correctness

ArbiGameFi’s roulette direction is now better grounded in the actual game model:

- `0` separate
- `1-36` as a standard European `3 rows x 12 columns`
- typed bet families instead of raw mask-first UX

That should stay.

## Gap Analysis by Route

## `/` — Home / Landing

Current file:

- `frontend/apps/web/src/app/page.tsx`

### Current strength

- better than the original dashboard-like version
- clearer brand posture
- stronger room-first language than before

### Current gap vs BetSwirl

- still too copy-heavy
- still too self-explanatory
- too many “why we work” style blocks for a first screen
- the hero is stronger than before, but still reads like a designed product page more than a high-conversion room-entry page

### What should change

- reduce hero copy density by another 20–30%
- make the first scroll entirely about room entry, not product explanation
- keep only one true primary CTA
- convert proof blocks into lighter confidence strips instead of card-heavy sections

### Do not copy from BetSwirl

- over-gamified noise
- legal/footer clutter in the first experience
- aggressive affiliate-style promotional density

## `/games` — Games Directory

Current file:

- `frontend/apps/web/src/app/games/pageClient_list.tsx`

### Current strength

- already moving toward room-first browsing
- no longer exposes internal protocol implementation language at the top

### Current gap vs BetSwirl

- still too much explanation around the directory itself
- not enough sense of a live casino lobby
- cards still read a little like product cards instead of active room entry points

### What should change

- compress the top section
- promote room categories or room states over explanatory text
- make room cards feel more “joinable” and less “readable”
- show more operational room signals:
  - live
  - fast entry
  - popular
  - hot table

## `/games/[slug]` — Shared Room Shell

Current file:

- `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`

### Current strength

- top selector is in the right place
- room strip is much lighter than before
- the page is no longer dominated by protocol explanation

### Current gap vs BetSwirl

- still too much meta language in the room shell
- labels like `Quiet room`, `Settlement readable`, `Board-first`, `Ticket rail` are good internal design phrases, but not always player-facing language
- the shell still behaves a little like a designed concept board instead of a production casino room

### What should change

- reduce designer-language labels on the first fold
- reserve room-state copy for a smaller strip
- keep the first fold almost entirely task-driven
- move more explanation into the below-the-fold tabs

## `GameBetPanel` — Shared Bet Slip

Current file:

- `frontend/apps/web/src/features/betting/ui/GameBetPanel.tsx`

### Current strength

- clear improvement over the old generic form
- left/right split is directionally correct
- primary action path is much clearer than before

### Current gap vs BetSwirl

- still too generic across games
- still feels componentized instead of operational
- missing stronger “casino console” grammar:
  - more obvious amount hierarchy
  - clearer fast presets
  - stronger manual/auto distinction
  - stronger payout/return preview posture

### What should change

- keep the shared system, but stop making all games look like one shell with different inputs
- define 3 bet-slip families instead of 1:
  - binary / quick games
  - table games
  - board/pick games

## `Roulette` Room

Current files:

- `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`
- `frontend/packages/ui/src/components/protocol/roulette-params-form.tsx`

### Current strength

- the table structure is now fundamentally right
- standard European board grammar is now represented correctly

### Current gap vs BetSwirl

- the room still needs a more theatrical live stage
- the winning-number / live-wheel area can feel more premium
- the relationship between left slip and right board still needs stronger contrast in importance

### What should change

- make the right table stage unquestionably dominant
- keep the slip visually quieter
- add a more mature live-state layer above the board:
  - current selection
  - recent result
  - wheel strip / result band
- keep analytics and detail under the fold

## Below-the-fold system

This is one of the biggest gaps.

### BetSwirl expectation

Users expect a stable lower navigation system in casino rooms.

Recommended ArbiGameFi room tabs:

1. `All Bets`
2. `My Bets`
3. `Players`
4. `Analytics`
5. `Game Details`

### Why this matters

This is not visual polish. This is product grammar.

If the room has no expected lower system, the page still feels like a custom prototype instead of a production-grade casino route.

## Priority Actions

## P0 — Must Fix

### P0.1 Reduce first-fold copy in play routes

Target:

- `/games/[slug]`
- `GameBetPanel`

Success condition:

- the first fold is almost entirely actionable

### P0.2 Build the standard room tab system

Target:

- room lower fold

Success condition:

- every flagship room has the same stable follow-up structure

### P0.3 Split bet-slip system by room family

Target:

- `GameBetPanel`

Success condition:

- roulette does not feel like the same ticket as keno or coin toss

## P1 — High Value

### P1.1 Compress `/games` into a stronger lobby

Make it feel like:

- browse
- scan
- enter

not:

- read
- compare
- interpret

### P1.2 Tighten the landing page again

The landing should sell:

- entry
- trust
- room variety

It should not spend too much time narrating itself.

### P1.3 Push more “trust explanation” into dedicated trust routes

Trust should stay strong, but its best routes are:

- `/bets`
- `/bets/[betId]`
- `/liquidity`
- `/account`
- `/claims`

not the gameplay first fold.

## P2 — Nice to Have

### P2.1 Add richer casino-room motion language

- better hover states
- active-chip motion
- outcome reveal language
- room-state transitions

### P2.2 Add more visible social proof

- active players
- recent winners
- live streaks
- room heat

Only do this after the layout hierarchy is correct.

## What ArbiGameFi Should Copy vs Not Copy

## Copy

- room-first hierarchy
- compact ticket rail logic
- standard room tab grammar
- faster entry into play
- lower explanation density on play routes

## Do Not Copy

- generic “casino clone” visual noise
- over-promotional affiliate feeling
- shallow trust treatment
- visual chaos around side panels and footer density

## Decision

ArbiGameFi should **adopt BetSwirl’s room grammar**, but not its whole product identity.

The correct strategic direction is:

- play routes become more like a mature casino dApp
- trust routes remain stronger than BetSwirl
- landing and directory become faster, lighter, and more conversion-oriented

That is the real upgrade path.
