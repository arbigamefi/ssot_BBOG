# UI/UX HIGH-FIDELITY CORE ROUTE PACK — ArbiGameFi

**Status**: Draft

**Date**: 2026-03-09

**Scope**: `High-fidelity route definition for core ArbiGameFi product surfaces`

**Related documents**
- `docs/frontend/BRAND-STARTER-PACK-2026-03.md`
- `docs/frontend/MESSAGING-COPY-PACK-2026-03.md`
- `docs/frontend/UI-UX-DESIGN-BRIEF-2026-03.md`
- `docs/frontend/UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `docs/frontend/UI-UX-DIRECTION-BOARD-2026-03.md`
- `docs/frontend/UI-UX-WIREFRAME-PACK-2026-03.md`
- `docs/frontend/PAGE-SPECS/`

---

## 1. Purpose

This document translates the approved architecture and wireframes into route-level high-fidelity design intent.

It defines:

- visual hierarchy
- component emphasis
- content density
- state treatment
- desktop and mobile behavior
- route-specific visual tone

This is the final design-planning layer before Figma execution or implementation.

It should be detailed enough that:

- a designer can produce final comps without redefining structure
- an engineer can understand what each route is supposed to feel like

---

## 2. Core System Rules

### 2.1 Shared global rules

- background should establish atmosphere, not replace hierarchy
- typography should do more hierarchy work than borders
- the first fold must show one dominant action
- trust is always present, but not equally loud on every route
- state changes must appear near the action origin

### 2.2 Route family differences

Acquisition routes:
- broader spacing
- larger headings
- fewer modules
- stronger editorial composition

Gameplay routes:
- tighter layouts
- denser interaction zones
- stronger contrast
- minimal explanatory chrome

Trust routes:
- calmer composition
- more neutral paneling
- stronger table and metric structure
- lower atmospheric intensity

### 2.3 Visual density rule

Do not let all modules have equal visual weight.

Every route must visibly separate:

1. primary action zone
2. supporting context zone
3. deep detail zone

---

## 3. Home

## 3.1 High-Fidelity Intent

Home should feel like a premium landing page for a product that is both playable and trustworthy.

It should not feel like:

- a dashboard
- a roadmap page
- a proof explorer

## 3.2 Desktop Composition

### First fold

Left column:
- headline
- 2-line supporting value proposition
- primary CTA
- secondary CTA
- 3 short proof bullets

Right column:
- large visual composition
- one featured room teaser
- subtle motion layer

Below hero:
- compact proof ribbon with 3 or 4 items max

### Mid fold

- featured rooms carousel or grid
- 3-step “how it works”
- trust section with 3 pillars

### Lower fold

- live proof block
- final CTA

## 3.3 Visual Rules

- hero heading should be the largest type in the product
- trust proof should read as editorial highlights, not statistics dashboard cards
- featured rooms should look playable, not catalog-like
- section backgrounds should alternate subtly to create pacing

## 3.4 Suggested component look

- Hero CTA: large pill or rounded rectangle with strong gradient emphasis
- Secondary CTA: outlined, quieter, still premium
- Proof ribbon: lightweight horizontal strip, not separate large cards
- Trust pillars: 3 medium cards with icon, label, sentence

## 3.5 Mobile

- hero stacks vertically
- proof ribbon becomes swipeable or 2x2 compact tiles
- featured rooms become a vertical stack
- trust section remains compact and scannable

## 3.6 Must-design states

- no wallet connected
- release available
- release unavailable / read-only fallback

---

## 4. Games Directory

## 4.1 High-Fidelity Intent

Games should feel like a curated room directory.

The user should feel:

- “I know the difference between these rooms”
- “I can choose quickly”

## 4.2 Desktop Composition

### First fold

- page title
- one-line explanation
- one featured room hero
- room family pills

### Main body

- structured room grid
- room cards with varying visual intensity based on priority

## 4.3 Room card structure

Each room card should include:

- icon or glyph
- room title
- one-line room promise
- quick category label
- one gameplay cue
- enter room CTA

Example cues:

- “fast binary play”
- “precision threshold”
- “classic table”
- “multi-pick board”

## 4.4 Visual Rules

- cards must not all look identical in emphasis
- featured room should have materially stronger visual treatment
- room family pills should feel crisp and tactile
- protocol truth should not appear in first-scan card copy

## 4.5 Mobile

- one featured card first
- room family pills horizontally scrollable
- cards stack vertically with stronger CTA visibility

## 4.6 Must-design states

- empty room list
- release missing
- featured room unavailable

---

## 5. Shared Game Room System

## 5.1 High-Fidelity Intent

Every game room should feel like one controlled playing environment.

The user should not have to visually fight:

- shell chrome
- explanation cards
- secondary modules

## 5.2 Shared desktop layout

Top:
- minimal room header
- top game selector
- compact room strip

Main:
- left bet slip
- right game surface

Bottom:
- recent bets / guide / protocol tabs

## 5.3 Shared room visual rules

- game selector uses compact top pills
- room strip is one short band, not a hero
- bet slip is a contained, vertically disciplined column
- game surface gets the most visual real estate
- lower tabs are clearly secondary

## 5.4 Shared bet slip structure

1. mode header
2. amount block
3. quick chips
4. round count
5. ticket summary
6. primary CTA
7. advanced disclosure

## 5.5 Bet slip visual treatment

- strong panel background
- high contrast numeric input
- chip buttons read like betting chips, not filter pills
- summary block quieter than primary CTA

## 5.6 Mobile

- top selector remains first
- game surface stays above slip
- slip becomes vertically stacked
- summary and CTA remain near each other

## 5.7 Shared gameplay states

- disconnected
- quote not yet prepared
- approval needed
- pending
- mined
- reconciled
- refund eligible
- failed

These states must be visually designed in the slip and not offloaded to generic alerts only.

---

## 6. Roulette Room

## 6.1 High-Fidelity Intent

Roulette should be the flagship “table game” room.

It should feel closest to a premium digital roulette desk:

- strong main table
- compact, serious bet slip
- clear active bet

It must not feel like:

- a generic grid
- a params editor
- a stack of unrelated cards

## 6.2 Desktop Composition

Left:
- bet slip, fixed width, strong vertical structure

Right:
- active bet strip
- main European board
- dozens and columns
- outside bets
- secondary layout-bet section below

## 6.3 Visual hierarchy

1. roulette board
2. active bet
3. bet slip CTA
4. stake entry
5. secondary structured bets

## 6.4 Board styling rules

- 0 lane must be visually distinct
- red/black number distinction must be clear
- selected bet must have a strong active outline/fill state
- dozens, columns, and outside bets should read as table extensions, not detached generic cards

## 6.5 Slip styling rules

- active amount must feel like a gaming stake input
- chips should feel tactile
- CTA should be the strongest element in the slip
- helper text must be short and low-noise

## 6.6 Secondary controls

Split / street / corner / six line should appear below the main board as advanced structured choices.

They should feel secondary, but still polished.

The raw mask disclosure should be hidden and clearly non-default.

## 6.7 Mobile

Order:

1. room strip
2. active bet strip
3. board
4. dozens / columns / outside
5. slip
6. advanced structured bets

## 6.8 Required states

- no selection
- straight selected
- outside bet selected
- advanced bet selected
- disconnected
- pending quote
- pending tx
- success
- refundable

---

## 7. Shared Room Variants

## 7.1 Dice

High-fidelity goal:
- precision threshold room

Primary visual:
- one strong cap / threshold visual
- slider with premium styling
- quick odds framing

The cap surface must dominate more than explanatory text.

## 7.2 Coin Toss

High-fidelity goal:
- clean binary decision room

Primary visual:
- two large side choices
- active side confirmation
- compact stake flow

This should feel like the cleanest room in the product.

## 7.3 Keno

High-fidelity goal:
- multi-pick strategy board

Primary visual:
- number table
- selected-count strip
- quick actions

The board should feel tactical and controlled, not spreadsheet-like.

---

## 8. Liquidity

## 8.1 High-Fidelity Intent

Liquidity should feel like a premium LP capital page.

It should explain the system in plain language while preserving financial seriousness.

It must not feel like:

- raw protocol accounting output
- a generic vault form

## 8.2 Desktop Composition

Top:
- LP intro strip
- key metric cards
- asset selection

Main:
- action panel
- interpretation panel

Lower:
- supporting metrics
- links to account and release/trust materials

## 8.3 Visual hierarchy

1. NAV / reserve / free / buffer floor
2. deposit / withdraw / redeem
3. wallet position
4. PF / XP explanation
5. secondary details

## 8.4 Component rules

- metric cards should be cleaner and more neutral than gameplay cards
- constraint messages should be explicit and readable
- action panel should feel safe and deliberate, not flashy

## 8.5 Mobile

- intro strip first
- key metrics second
- action panel third
- explanations fourth

## 8.6 Required states

- disconnected
- no position
- action available
- action blocked by constraint
- pending tx
- success
- failure

---

## 9. Bets Ledger

## 9.1 High-Fidelity Intent

Bets should feel like a clear, powerful ledger.

The user should feel:

- “I can inspect history quickly”
- “I know where to drill down”

## 9.2 Desktop Composition

Top:
- title
- source note
- compact summary strip

Main:
- filter bar
- ledger table

## 9.3 Visual rules

- filters should be compact and tool-like
- table rows should prioritize readability and click confidence
- explorer affordances should be visible but not dominant

## 9.4 Mobile

- filters stack cleanly
- each row becomes a compact card or accordion summary
- primary drilldown remains obvious

## 9.5 Required states

- loading
- empty
- indexer delayed
- filtered empty

---

## 10. Bet Detail

## 10.1 High-Fidelity Intent

Bet Detail should read like a narrative proof page for one ticket.

The user should understand:

- what they selected
- what they paid
- what happened
- what they can do now

## 10.2 Desktop Composition

Top:
- summary hero

Middle:
- lifecycle timeline
- action panel

Bottom:
- params
- txs
- protocol facts

## 10.3 Visual rules

- status should be visible immediately
- outcome should be human-readable
- action eligibility needs a plain-language explanation
- raw identifiers belong below the first summary layer

## 10.4 Mobile

- summary first
- action panel second
- timeline third
- params and tx sections after

## 10.5 Required states

- open / waiting
- settled
- won
- lost
- refunded
- finalize eligible
- refund eligible

---

## 11. Account

## 11.1 High-Fidelity Intent

Account should feel like the user’s self-audit and operating summary page.

It should not feel like just a transaction log.

## 11.2 Desktop Composition

Top:
- account identity strip
- release identity

Middle:
- asset balances
- bank positions
- allowance and refund-credit cluster

Bottom:
- tx journal

## 11.3 Visual rules

- wallet and release identity should be present but compact
- balance and allowance groupings should be distinct
- the journal should remain dense but readable

## 11.4 Mobile

- summary cards first
- positions second
- allowances / refund credit third
- journal last

## 11.5 Required states

- disconnected
- empty balances
- active balances
- refund credit claimable
- no journal entries

---

## 12. High-Fidelity Design Priorities

If design time is constrained, route priority should be:

1. Home
2. Roulette Room
3. Shared Game Room system
4. Games Directory
5. Liquidity
6. Bet Detail
7. Bets
8. Account

Reason:

- conversion and gameplay need to be solved first
- trust routes can follow once the primary product impression is strong

---

## 13. Handoff Requirements

When the high-fidelity visuals are produced, the handoff package must include:

- desktop screens
- mobile screens
- state variants
- component mapping
- spacing and hierarchy notes
- interaction notes for tx states

No major implementation work should resume until that handoff exists.
