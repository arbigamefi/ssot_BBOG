# UI/UX DESIGN BRIEF — ArbiGameFi Product Interface

**Status**: Draft

**Date**: 2026-03-09

**Scope**: `ArbiGameFi web product`

**Related documents**
- `docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md`
- `docs/WHITEPAPER.product.zh-CN.md`
- `docs/release/ARBIGAMEFI-RELEASE-PACK.zh-CN.md`
- `docs/release/ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`
- `docs/frontend/PRD.md`
- `docs/frontend/UI-CONSTITUTION.md`
- `docs/frontend/FRONTEND-ROUTE-REVIEW-2026-03.md`
- `docs/frontend/UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `docs/frontend/UI-UX-DIRECTION-BOARD-2026-03.md`
- `docs/frontend/UI-UX-WIREFRAME-PACK-2026-03.md`
- `docs/frontend/PAGE-SPECS/`

---

## 1. Purpose

This brief formally changes the frontend workflow.

From this point, major frontend product work should follow:

1. product intent freeze
2. information architecture and flow design
3. high-fidelity UI design
4. component and state inventory
5. implementation

The repo should no longer treat large UI decisions as code-first exploration.

The current frontend has enough protocol correctness to support a serious product pass.
What it lacks is a unified, professional, end-to-end interface system.

This document defines that system at the brief level so design can be produced deliberately before further major UI rebuilding.

---

## 2. Why This Exists

The current interface has three structural problems:

1. it still mixes three products into one surface
   - acquisition
   - gameplay
   - trust / audit

2. it still oscillates between two visual languages
   - protocol dashboard
   - casino room

3. it still allows layout decisions to be made inside implementation
   - this creates drift
   - this creates inconsistency
   - this makes it hard to know whether a route is wrong because of product logic, interaction design, or visual execution

Therefore the next correct step is not "tweak more code".
The next correct step is to design the full interface system first.

---

## 3. Design Objective

Design a complete, production-grade ArbiGameFi interface that feels:

- premium
- trustworthy
- game-first
- fast to understand
- wallet-native
- non-custodial by default

The interface should not feel like:

- a DeFi admin console
- a protocol debugging dashboard
- a generic neon casino clone
- a component library demo

The end state should make ArbiGameFi look like a coherent on-chain gaming product with institutional-grade trust surfaces.

---

## 4. Product Model

The frontend should be designed as three connected products sharing one brand system.

### 4.1 Acquisition Product

Routes:
- `/`
- `/games`

Job:
- explain the product quickly
- build trust quickly
- route the user into a room quickly

Primary UX rule:
- the user should understand what ArbiGameFi is and where to click within 5 seconds

### 4.2 Gameplay Product

Routes:
- `/games/[slug]`
- immediate post-bet state
- `/bets/[betId]` when reached from play

Job:
- help the user choose an outcome
- set a stake
- submit a bet
- understand result / wait / refund state

Primary UX rule:
- every game room must feel like a playable table, not a protocol page

### 4.3 Trust / Audit Product

Routes:
- `/bets`
- `/bets/[betId]`
- `/liquidity`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Job:
- explain facts
- explain balances and liabilities
- explain actions and eligibility
- support verification and operational confidence

Primary UX rule:
- these routes should read as clear financial or audit tools, not as player entry points

---

## 5. Design Principles

### 5.1 One dominant action per screen

Every major route must have a single primary action.

Examples:
- `/`: start playing
- `/games`: pick a room
- `/games/[slug]`: place a ticket
- `/liquidity`: deposit or redeem
- `/account`: inspect and claim available user-level balances

If a screen presents multiple equal-weight actions, the design is wrong.

### 5.2 Trust must be visible, but not first everywhere

ArbiGameFi is differentiated by truth, custody, and verifiability.
That must be visible.

But it should appear in the correct layer:

- first layer on acquisition pages: trust promise
- second layer on gameplay pages: reassurance
- first layer on trust pages: precise explanations

Do not lead every page with protocol mechanics.

### 5.3 Gameplay surfaces must be legible in one glance

Every game room should be understandable without reading paragraphs.

The user should instantly identify:

- what game they are in
- where to choose the outcome
- where to enter stake
- where to place the bet

### 5.4 Shared system, route-specific emphasis

The product should use one design system, but not one identical page formula.

Needed distinctions:

- landing page should feel like a marketing surface
- games directory should feel like a room selector
- game rooms should feel like active tables
- liquidity should feel like a capital dashboard
- bets should feel like a ledger

### 5.5 Mobile is not a fallback

All critical routes must be designed for:

- desktop
- tablet
- mobile

This includes:

- room interactions
- bet slip
- wallet disconnected state
- pending transaction state
- empty / loading / error states

### 5.6 Design first, code second

No major route should be visually reworked in code before:

- wireframes exist
- final layout hierarchy exists
- desktop and mobile variants exist
- critical states exist

---

## 6. Brand and Visual Direction

### 6.1 Brand Position

`ArbiGameFi` is the product brand.

`SSOT` remains an internal architectural principle and proof model.

Design should never present `SSOT` as the public-facing product name.

### 6.2 Visual Target

The visual direction should be:

- dark, cinematic, and premium
- high contrast, but not noisy
- game-table-oriented in active play contexts
- cleaner and more editorial in acquisition contexts
- more data-dense and institutional in liquidity and audit contexts

### 6.3 Avoid

Avoid these failure modes:

- random gradients without hierarchy
- overuse of glowing cards
- too many bordered boxes in one viewport
- equal emphasis across all sections
- purple-only design language without brand discipline
- DeFi dashboard clutter on player routes

### 6.4 Recommended design language

The ideal visual system should combine:

- premium gaming atmosphere
- clean financial legibility
- restrained motion
- strong typography hierarchy

The design should feel more like a polished gaming product with institutional trust rails than either:

- a raw crypto dashboard
- or a casual Web2 casino skin

---

## 7. Information Architecture

### 7.1 Top-Level Route Hierarchy

Primary:
- Home
- Games
- Bets
- Liquidity
- Account

Secondary:
- Claims
- Referral

Advanced:
- Ops

### 7.2 Player Journey

Primary path:

1. land on `/`
2. move to `/games`
3. choose `/games/[slug]`
4. select outcome
5. set amount
6. review and sign
7. inspect result on `/bets/[betId]`

### 7.3 LP Journey

Primary path:

1. land on `/`
2. inspect trust and bankroll framing
3. move to `/liquidity`
4. understand NAV / reserve / buffer
5. deposit or redeem
6. validate positions on `/account`

### 7.4 Audit Journey

Primary path:

1. move to `/bets`
2. inspect indexed history
3. drill into `/bets/[betId]`
4. inspect tx, params, lifecycle, refunds, finalization

---

## 8. Page-by-Page Design Requirements

## 8.1 Home

Role:
- acquisition landing page

Must achieve:
- clear value proposition
- clear trust promise
- clear CTA into rooms

Must include:
- hero
- featured rooms
- simple "how it works"
- trust section
- lightweight live proof
- final CTA

Must not include:
- large operational tables
- protocol telemetry as first-fold content
- duplicate room-directory blocks already covered by `/games`

## 8.2 Games Directory

Role:
- room selection page

Must achieve:
- fast comparison
- intuitive grouping
- quick room entry

Must include:
- room cards
- strong differentiation between room types
- clear mental grouping
- featured or promoted rooms

Must not include:
- governance-heavy explanations
- deep protocol explanations

## 8.3 Game Room

Role:
- single playable room

Must achieve:
- one-glance playability
- strong sense of active table
- minimal distraction

Above-the-fold requirements:
- game selector stays on top, not on the left
- one compact room header only
- primary table surface
- bet slip
- dominant CTA

The first fold should read as:

1. choose game
2. choose outcome
3. set amount
4. place ticket

The room should not open with:
- protocol explanation cards
- excessive sync and release framing
- multiple competing side modules

### Roulette-specific requirement

Roulette must default to a standard European roulette table:

- `0-36`
- straight
- red / black
- odd / even
- low / high
- dozen
- column

Secondary bets may appear below:

- split
- street
- corner
- six line

Legacy raw mask input must be hidden behind an advanced disclosure.

### Other game room requirements

Dice:
- central cap or threshold interaction
- immediate outcome comprehension

Coin Toss:
- binary call surface with strong immediate choice affordance

Keno:
- number board that feels like a selection table, not a bitmask editor

## 8.4 Bets

Role:
- audit ledger

Must achieve:
- quick filtering
- confidence in current and historical state

Must include:
- filters
- state grouping
- game grouping
- explorer affordances
- fast row-to-detail drilldown

## 8.5 Bet Detail

Role:
- lifecycle proof page

Must achieve:
- explain exactly what happened to one bet

Must include:
- decoded params
- timeline
- status
- tx hashes
- actionable buttons when eligible

## 8.6 Liquidity

Role:
- LP explanation and action page

Must achieve:
- explain the capital model in plain language
- let LP act with confidence

Must include:
- NAV
- reserve
- optional outflow / exit room
- PF / XP explanation
- deposit / withdraw / redeem flows

Must not read like:
- a raw metrics dump

## 8.7 Account

Role:
- user finance and journal page

Must include:
- wallet balances
- bank positions
- allowances
- refund credit
- tx journal

## 8.8 Claims / Referral / Ops

These routes should be designed after the core routes.

They are real product surfaces, but not primary acquisition or primary gameplay routes.

---

## 9. Required Design Deliverables

The design phase must produce all of the following.

### 9.1 Product architecture

- sitemap
- top-level navigation model
- route hierarchy
- user journeys

### 9.2 Wireframes

Required routes:
- `/`
- `/games`
- `/games/[slug]` for all current game types
- `/bets`
- `/bets/[betId]`
- `/liquidity`
- `/account`

### 9.3 High-fidelity desktop designs

Required routes:
- same as above

### 9.4 High-fidelity mobile designs

Required routes:
- `/`
- `/games`
- `/games/[slug]`
- `/liquidity`
- `/bets/[betId]`

### 9.5 State library

Every major route needs designed states for:

- disconnected wallet
- loading
- empty
- indexer delayed
- quote not ready
- approval required
- tx pending
- tx success
- tx failure
- refund eligible

### 9.6 Design system package

Must include:
- color tokens
- typography scale
- spacing scale
- radius
- elevation
- icon style
- chips / pills
- buttons
- tabs
- cards
- tables
- bet slip patterns
- alerts / banners
- empty states

### 9.7 Interaction prototype

At minimum, clickable prototype coverage for:

- landing to games to room
- room to bet confirmation
- bet result and detail
- liquidity deposit / redeem

---

## 10. Workflow and Phasing

## Phase A — Design Discovery

Outputs:
- route intent confirmation
- competitor moodboard
- product hierarchy decision

Inputs:
- whitepaper suite
- route review
- release pack

## Phase B — IA and Wireframes

Outputs:
- sitemap
- low-fidelity route wireframes
- per-route task hierarchy

Rule:
- no visual polishing before wireframes are accepted

## Phase C — Visual System

Outputs:
- brand direction
- color and typography
- foundational components
- motion rules

Rule:
- the design system must be defined before route-level high-fidelity work is finalized

## Phase D — High-Fidelity Screens

Outputs:
- final desktop screens
- final mobile screens
- component variants
- state variants

## Phase E — Prototype and Review

Outputs:
- clickable flows
- UX review
- implementation notes

## Phase F — Frontend Handoff

Outputs:
- screen inventory
- component mapping
- responsive notes
- state behavior notes

Rule:
- only after this phase should large frontend route rewrites resume

---

## 11. Acceptance Criteria

The UI design phase is complete only when:

1. every primary route has desktop and mobile design coverage
2. every gameplay route has disconnected, loading, and tx states designed
3. every trust route explains its metrics in plain language
4. the game room pattern is unified, but each game still feels distinct
5. acquisition pages, gameplay pages, and audit pages no longer share the same visual hierarchy
6. implementation can proceed without inventing new major layout decisions in code

---

## 12. Implementation Rules After Design Freeze

Once the design phase is accepted:

- implementation should map components to the approved design
- route-level experiments should stop
- any major deviation must be documented before coding
- page specs must be updated to reflect the accepted design
- Storybook should mirror the approved component states

---

## 13. Non-Goals

This brief does not authorize:

- immediate full-code rewrite before design completion
- speculative new routes
- token or governance UI promises that do not exist in protocol scope
- cosmetic-only redesign without product hierarchy correction

---

## 14. Immediate Next Step

The next artifact after this brief should be:

`UI/UX Architecture Pack`

That pack should include:

- sitemap
- route hierarchy
- primary user flows
- low-fidelity wireframes
- design-system direction board

Only after that should high-fidelity UI work begin.
