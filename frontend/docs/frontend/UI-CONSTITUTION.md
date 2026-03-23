# UI Constitution — ArbiGameFi Frontend v2

**Status**: Active baseline

**Effective date**: 2026-03-23

This document is the active constitution for the frontend.
It defines what is currently binding for layout, interaction, and visual consistency.

## 1. Source Of Truth

The frontend now uses the following priority order:

1. `frontend/apps/web/src/app/prototype/ui-ux-v2-*`
   - the only first source for visual hierarchy and page structure
2. frontend brand and copy documents
   - whitepaper
   - `BRAND-STARTER-PACK-2026-03.md`
   - `MESSAGING-COPY-PACK-2026-03.md`
   - `LANDING-COPY-DRAFT-2026-03.md`
3. current production functionality
   - provider
   - sdk
   - runtime
   - indexer
   - tx flow
4. archive frontend references
   - interaction reference only
   - never primary page structure

Any frontend implementation that conflicts with the current v2 prototypes is wrong unless the prototypes are updated first.

## 2. Active Product Families

The frontend is one product with three route families.

### 2.1 Acquisition

Routes:

- `/`
- `/games`

Purpose:

- explain the product fast
- build trust fast
- route a user into a room fast

Shell:

- `LandingShell`

### 2.2 Gameplay

Canonical routes:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Compatibility routes:

- `/games/[slug]`

Purpose:

- let a user understand one room in one glance
- choose a target
- set the ticket
- place the bet

Shell:

- `RoomShell`

### 2.3 Trust

Canonical routes:

- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Compatibility routes:

- `/liquidity`

Purpose:

- explain balances
- explain liabilities
- explain eligibility
- explain release and operational facts

Shell:

- `TrustShell`

## 3. Layout Constitution

### 3.1 Prototype-first rule

Every formal route MUST map to a current v2 prototype before major UI work begins.

### 3.2 One dominant action per first fold

The first fold MUST have one dominant action only.

Examples:

- `/`: enter rooms
- `/games`: choose a room
- `/roulette`: review or place a ticket
- `/invest`: deposit or redeem
- `/claims`: extract claimable value

### 3.3 Gameplay first fold

Gameplay first folds MUST be structured as:

1. top game selector
2. compact room HUD
3. board/stage area
4. compact ticket rail
5. lower room tabs below the fold

Gameplay pages MUST NOT lead with:

- release digest
- module identity
- indexer lag
- protocol explanation cards
- multi-card room heroes

### 3.4 Trust first fold

Trust routes MUST feel calmer and more precise than gameplay routes.

Trust routes MUST emphasize:

- facts
- balances
- eligibility
- tables
- action clarity

Trust routes MUST NOT reuse gameplay theatrical styling as the dominant visual language.

### 3.5 Acquisition first fold

Acquisition routes MUST feel editorial, premium, and low-noise.

They MUST include:

- value proposition
- primary CTA
- secondary CTA only if clearly subordinate
- lightweight proof

They MUST NOT read like:

- dashboards
- protocol control rooms
- room detail pages

## 4. Visual System Rules

### 4.1 Token discipline

Implementation MUST converge toward reusable visual roles rather than page-local one-off styling.

Allowed roles:

- background
- surface
- elevated surface
- border
- text primary
- text secondary
- accent
- success
- warning

Current prototypes may still contain hardcoded values, but implementation work MUST normalize them into reusable roles.

### 4.2 Glow discipline

Glow is allowed only as support.

Glow MUST NOT replace hierarchy.
If borders, glow, and gradients all carry the same visual weight, the page is wrong.

### 4.3 Typography discipline

Typography MUST do more hierarchy work than borders.
Numbers that represent balances, stakes, prices, blocks, or rates SHOULD use tabular numerals.

### 4.4 Copy discipline

Prototype-note language is forbidden in formal UI.

Do not render copy such as:

- `this page should feel like`
- `this route should`
- `the visual language should`

Formal UI copy must be user-facing product language only.

## 5. Shared Component Constitution

The following shared components or component families are required:

- `HeroProofRibbon`
- `RoomEntryCard`
- `RoomSelector`
- `RoomHud`
- `TicketRailBase`
- `LowerRoomTabs`
- `TrustStatsStrip`
- `TrustTableShell`

The following functional components SHOULD be preserved and re-skinned rather than replaced:

- `GameBetPanel`
- `SharedBetSlip`
- `RouletteBoard`
- audit/data table components
- transaction stepper and quote flow

## 6. Transaction UX Constitution

All write actions MUST preserve the current standardized transaction flow:

1. plan
2. preview
3. preflight
4. approval if required
5. submit
6. receipt
7. reconcile

Visual rewrites MUST NOT bypass the current provider/sdk/runtime/indexer truth path.

## 7. Route And Redirect Constitution

Canonical public routes are:

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

Compatibility routes remain valid during transition:

- `/games/[slug]`
- `/liquidity`

Long-term product navigation MUST prioritize canonical routes.

## 8. Historical Documents

The following documents are no longer active visual sources.
They are historical references only:

- `UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `UI-UX-WIREFRAME-PACK-2026-03.md`
- `FRONTEND-ROUTE-REVIEW-2026-03.md`
- `BETSWIRL-GAP-ANALYSIS-2026-03.md`
- `ACTION-PLAN-UI-PRODUCTIZATION.md`
- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`
- `PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
- `PROTOTYPE-FREEZE-CHECKLIST-2026-03.md`
- `FRONTEND-STATE-AND-PROTOTYPE-REVIEW-2026-03-16.md`

## 9. Review Checklist

A frontend UI change is acceptable only if all answers are yes:

1. Does the route map to a current v2 prototype?
2. Does the page obey the correct shell family?
3. Is the first fold dominated by one action?
4. Is the copy product-facing and free of prototype-note language?
5. Does the change preserve the existing protocol truth and transaction flow?
