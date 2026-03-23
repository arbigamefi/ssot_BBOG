# Prototype Improvement Matrix — 2026-03

> Historical reference only. The active route/spec baseline now lives in the current prototype baseline, constitution, and screen specs.

**Status**: Historical reference  
**Scope**: `Cross-review of current v2 prototypes against design brief, constitution, brand, copy, and screen specs`

**Reference set**

- `docs/frontend/UI-CONSTITUTION.md`
- `docs/frontend/UI-UX-DESIGN-BRIEF-2026-03.md`
- `docs/frontend/UI-UX-DIRECTION-BOARD-2026-03.md`
- `docs/frontend/UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `docs/frontend/BRAND-STARTER-PACK-2026-03.md`
- `docs/frontend/MESSAGING-COPY-PACK-2026-03.md`
- `docs/frontend/LANDING-COPY-DRAFT-2026-03.md`
- `docs/frontend/SCREEN-SPECS/001-HOME-LANDING.md`
- `docs/frontend/SCREEN-SPECS/003-ROULETTE-ROOM.md`
- `docs/frontend/PROTOTYPE-FREEZE-REVIEW-2026-03.md`

## Purpose

This document answers a narrower question than the freeze review:

> What still needs to change in the current prototype system before it should be treated as a reliable implementation source?

The answer is not “everything”.
The route families and shell grammar are now coherent.
The remaining problems are concentrated in:

- flagship acquisition density
- room-first gameplay discipline
- trust-route tone consistency
- token discipline
- copy discipline

## Top-Level Findings

### 1. Home is still under-spec-compliant

The current flagship Home prototype is directionally better than earlier drafts,
but it still does not fully reflect the approved messaging and screen spec.

Main issue:

- hero language and right-side visual treatment are still too generic / conceptual

### 2. Roulette is not fully “implementation-ready”

Roulette now has the correct European board structure,
but the surrounding room grammar is still incomplete compared with the approved spec.

Main issue:

- the board is closer to ready than the room around it

### 3. Trust routes are now structurally aligned, but not tonally aligned

`Liquidity / Bets / Account / Claims / Ops` now share a header grammar,
but they still do not all feel like one trust-route family.

Main issue:

- some pages still read like prototype explanation boards
- some still read like glowing DeFi panels

### 4. Prototype visual token discipline is not strong enough

The current prototypes still use too many direct color values and one-off visual treatments.

Main issue:

- they are good enough for ideation
- not yet strict enough to become clean implementation source material

## Global Improvements Required

### A. Copy cleanup

Remove meta-design language from user-facing prototype copy.

Bad pattern:

- “this page should feel like...”
- “this route should...”
- “the visual language should...”

These sentences are valid for design notes.
They are not valid inside the actual screen copy.

### B. Token cleanup

Reduce prototype reliance on:

- direct hex backgrounds
- one-off glow values
- repeated custom border opacities

The goal is not full production tokenization yet,
but the prototypes should already group visuals into a smaller set of reusable roles.

### C. CTA normalization

Every route should clearly expose one dominant CTA only.

Prototype pages should stop implying equal CTA weight across:

- connect
- inspect
- view pack
- sync
- claim
- enter room

### D. Trust-route family consistency

`Liquidity / Bets / Account / Claims / Ops / Referral`
should feel like one product family with:

- calmer panel language
- stronger table/metrics rhythm
- lower atmospheric intensity
- clearer operator vs player action separation

## Route-by-Route Matrix

## 1. Home / Flagship

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-flagship/page.tsx`

**Current state**

- structurally strong enough to continue
- not yet final enough to drive full implementation

**Main issues**

- hero headline/copy still drifts from approved landing copy baseline
- right-side hero visual is still too conceptual in some states
- proof and featured-room blocks still carry too much equal visual weight
- some sections still feel like a design exploration deck rather than a high-conversion landing page

**Document basis**

- `LANDING-COPY-DRAFT-2026-03.md`
- `MESSAGING-COPY-PACK-2026-03.md`
- `SCREEN-SPECS/001-HOME-LANDING.md`
- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`

**Must change**

- align the hero to the approved room-first copy spine
- reduce conceptual hero decoration in favor of one real room teaser
- make the proof ribbon lighter and more editorial
- ensure the featured room area reads as entry-first, not explanation-first

**Can defer**

- motion polish
- visual texture polish
- final iconography choices

**Ready when**

- a new visitor can understand the product in one scan
- the hero has one dominant CTA
- the right-side visual reads as a room teaser, not a concept poster

## 2. Games Directory

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-directory/page.tsx`

**Current state**

- usable as a room-lobby direction
- still too close to a product catalog in card treatment

**Main issues**

- room cards remain too information-dense in first scan
- emoji/glyph treatment is inconsistent with the premium brand direction
- room metadata feels slightly too generic / game portal-like
- the page still needs one stronger featured-room hierarchy move

**Document basis**

- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `SCREEN-SPECS/002-GAMES-DIRECTORY.md`
- `MESSAGING-COPY-PACK-2026-03.md`

**Must change**

- remove anything that makes the page feel like a broad game portal
- tighten room-card copy to one room promise plus one gameplay cue
- make the featured-room hierarchy visually stronger
- align card icons and badges with the premium brand system

**Can defer**

- dynamic states
- mobile filter polish

**Ready when**

- the page reads as a curated lobby
- the user can choose quickly
- the featured room stands out materially from the rest

## 3. Roulette Room

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-roulette/page.tsx`

**Current state**

- board logic and room intent are directionally correct
- surrounding room grammar still incomplete

**Main issues**

- missing the full approved top game selector layer
- left rail still depends too heavily on a generic shared slip
- no full lower room-tabs grammar
- table stage is correct, but room identity and ticket hierarchy are still too generic

**Document basis**

- `SCREEN-SPECS/003-ROULETTE-ROOM.md`
- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`

**Must change**

- complete the room shell according to the approved order:
  - room shell header
  - top selector
  - compact room strip
  - left slip
  - right table
  - lower room tabs
- make the slip visually roulette-specific, not just shared-system generic
- add the mature room data layer:
  - `All Bets`
  - `My Bets`
  - `Players`
  - `Analytics`
  - `Game Details`

**Can defer**

- advanced structured-bet presentation polish
- motion polish on chips and active states

**Ready when**

- the room reads as one coherent table environment
- the board is clearly the dominant surface
- the slip is compact, legible, and roulette-specific

## 4. Dice Room

**Prototype**

- currently represented through the flagship prototype set

**Current state**

- room grammar exists
- visual confidence remains behind roulette

**Main issues**

- play surface still lacks the same product confidence as roulette
- the ticket rail and play lane relationship is not yet iconic

**Document basis**

- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `SCREEN-SPECS/004-SHARED-GAME-ROOM-SYSTEM.md`

**Must change**

- create a stronger under/over play stage
- define dice-specific ticket language
- ensure the surface feels like a real room, not a parameter widget

**Can defer**

- deeper animation
- minor telemetry polish

## 5. Liquidity

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-liquidity/page.tsx`

**Current state**

- strongest trust-route action structure after Claims/Ops
- still visually too glow-driven and dashboard-like

**Main issues**

- visual tone still leans too much toward growth dashboard
- chart block is oversized relative to action terminal
- capital product language is present, but still mixed with generic DeFi UI signals

**Document basis**

- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `UI-UX-DIRECTION-BOARD-2026-03.md`
- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`

**Must change**

- calm the visual tone
- sharpen the split between capital overview and action terminal
- make liquidity feel more institutional and less promo-like

**Can defer**

- chart detail polish
- APY visualization polish

## 6. Bets

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-bets/page.tsx`

**Current state**

- structurally clear
- still too close to a ledger mock rather than a branded ticket-history route

**Main issues**

- route title and filters are acceptable
- but the table rows still feel like plain audit entries rather than game receipts
- the page lacks one clear summary zone before the ledger

**Document basis**

- `UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`

**Must change**

- establish a small summary band above the table
- make ticket state language feel more like product receipts than audit records

**Can defer**

- row micro-interactions
- filter expansion

## 7. Bet Detail

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-bet-detail/page.tsx`

**Current state**

- visually strong as a receipt artifact
- still ambiguous as to whether it is part of gameplay or trust-ledger family

**Main issues**

- current design over-indexes on receipt drama
- not yet reconciled with trust-route shell grammar

**Document basis**

- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`

**Must change**

- decide whether the page is:
  - receipt-first
  - or trust-detail-first
- align shell and surrounding context accordingly

## 8. Account

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-account/page.tsx`

**Current state**

- good high-level identity
- still split between profile page language and trust-route language

**Main issues**

- top profile treatment is expressive
- but the route still needs stronger balance/action hierarchy
- should feel like user capital + activity surface, not like a social profile

**Must change**

- reduce profile-page cues
- strengthen capital and ledger zones

## 9. Referral

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-referral/page.tsx`

**Current state**

- the least settled trust-route page

**Main issues**

- still unclear whether Referral belongs with player routes or advanced trust routes
- tone is closer to affiliate dashboard than the rest of the trust family

**Must change**

- settle product role first
- only then finalize density and hierarchy

## 10. Claims

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-claims/page.tsx`

**Current state**

- structurally strong
- copy still contains meta-design language

**Main issues**

- internal explanatory copy still reads like a design note in several places
- route hierarchy is correct, but product language is not yet fully “public UI ready”

**Document basis**

- `MESSAGING-COPY-PACK-2026-03.md`
- `UI-UX-DESIGN-BRIEF-2026-03.md`

**Must change**

- replace meta commentary with actual product copy
- keep primary / secondary / governance action separation

## 11. Ops

**Prototype**

- `frontend/apps/web/src/app/prototype/ui-ux-v2-ops/page.tsx`

**Current state**

- structurally strong
- tonally close to target

**Main issues**

- some explanatory text is still written as design guidance rather than final route copy
- still slightly more atmospheric than a true institutional trust route should be

**Must change**

- convert remaining explanatory paragraphs into precise operator-facing copy
- reduce a little more visual drama

## Priority Order

### P0

- `Home / Flagship`
- `Roulette Room`
- `Games Directory`

These three determine whether the product reads as mature on first contact.

### P1

- `Dice Room`
- `Liquidity`
- `Bets`

These define whether the supporting surfaces feel coherent once the user moves beyond the first impression.

### P2

- `Bet Detail`
- `Account`
- `Claims`
- `Ops`
- `Referral`

These can follow once the flagship surfaces are visually frozen.

## Final Verdict

The current prototype system is strong enough to support implementation planning,
but not yet strong enough to be treated as a “just build exactly this” source for all routes.

The biggest remaining work is:

1. finish the flagship trio:
   - `Home`
   - `Games Directory`
   - `Roulette Room`
2. remove meta-design copy from trust routes
3. enforce stronger visual token discipline across all prototypes

Once those three things are done,
the prototype system becomes a much safer direct input for formal UI implementation.
