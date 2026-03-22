# HOME LANDING REFACTOR CHECKLIST — 2026-03

**Status**: Draft

**Date**: 2026-03-16

**Scope**: `Concrete redesign checklist for the production homepage landing route`

**Related documents**
- `docs/frontend/LANDING-COPY-DRAFT-2026-03.md`
- `docs/frontend/BRAND-STARTER-PACK-2026-03.md`
- `docs/frontend/MESSAGING-COPY-PACK-2026-03.md`
- `docs/frontend/SCREEN-SPECS/001-HOME-LANDING.md`
- `docs/frontend/PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
- `docs/frontend/PROTOTYPE-TO-IMPLEMENTATION-MAP-2026-03.md`

---

## 1. Purpose

This document converts the current homepage review into a hard redesign checklist.

It exists to answer one practical question:

`What must change before the homepage feels like a serious product landing page instead of a good-looking product draft?`

This is not a generic design essay.
It is an execution document for:

- homepage redesign
- prototype refinement
- implementation review
- copy tightening

---

## 2. What A Qualified Landing Page Must Do

The homepage must answer four questions within the first few seconds:

1. `What is this?`
2. `Why should I care?`
3. `Why should I trust it?`
4. `What should I do next?`

If the page makes the user study the layout before understanding the product, it is not ready.

For ArbiGameFi specifically, a qualified landing page must feel:

- product-first
- room-first
- premium
- controlled
- conversion-oriented

It must not feel:

- like an ops dashboard
- like a protocol explainer deck
- like a generic crypto homepage
- like a Figma concept board that escaped into production

---

## 3. Current Assessment

### 3.1 Current score

Working assessment of the current production homepage:

`6.5 / 10`

### 3.2 Why it is not yet an 8+

The current page direction is correct, but it still shows three major weaknesses:

1. the first fold still carries too much structural weight
2. the page sections still use overly similar content grammar
3. the visual system still feels more like premium web3 than distinctly ArbiGameFi

### 3.3 What is already correct

- hero copy is aligned with the approved landing copy baseline
- primary CTA is correct: `Open Rooms`
- trust and live-proof content are now separated from the first fold
- the page is no longer dashboard-first

---

## 4. Gap Summary

### 4.1 Hero gap

The hero is cleaner than before, but it is still slightly over-instrumented.

Current issue:

- the proof strip below the hero is still presented as three separate cards
- this makes the first fold feel like a product panel instead of a persuasive landing entry

Required direction:

- replace the three-card strip with a lighter proof ribbon
- keep the first fold focused on value proposition and CTA

### 4.2 Featured rooms gap

The `Featured rooms` section is directionally correct, but the content block still behaves too much like a product module cluster.

Current issue:

- room cards still inherit too much generic `GameCard` structure
- the section reads more like “browse components” than “enter a room”

Required direction:

- create landing-specific room entry cards
- reduce explanatory text
- strengthen CTA and room identity

### 4.3 Section rhythm gap

The middle sections still share too much of the same structure:

- label
- heading
- supporting line
- three blocks

This creates repetition and weakens momentum.

Required direction:

- each section must have a distinct rhythm
- `How it works` should read as a process strip
- `Why trust it` should feel like a compact principle section
- `Live proof` should feel like a lightweight evidence rail

### 4.4 Brand gap

The page is visually stronger than earlier versions, but it still feels adjacent to generic web3 design.

Current issue:

- too much reliance on black + blue + glow as the main personality
- insufficient signature brand shapes or visual anchors

Required direction:

- strengthen ArbiGameFi-specific visual identity
- reduce generic glow dependence
- introduce one stronger hero visual anchor that is not a raw product screenshot

---

## 5. Must Remove

The following patterns must not survive the next homepage iteration:

- multi-card proof modules inside the first fold
- dense explanatory copy above the fold
- product-detail modules that compete with the hero CTA
- room cards that read like component documentation
- repeated “label + heading + support + 3 cards” rhythm across every section
- generic crypto glow used as the primary visual identity

---

## 6. Must Keep

The following parts are directionally correct and should remain:

- eyebrow: `Wallet-native game rooms`
- headline: `Play on-chain without losing the room feel.`
- primary CTA: `Open Rooms`
- secondary CTA: `How It Works`
- room-first homepage positioning
- separation between gameplay promise and trust layer
- home as acquisition surface, not product dashboard

---

## 7. Must Add

### 7.1 Hero proof ribbon

Replace the current three-card proof cluster with a lighter ribbon.

Recommended items:

- `Live rooms`
- `Wallet-first tickets`
- `Readable settlement`
- `Visible liquidity context`

Rule:

- one line each
- no large KPI card treatment

### 7.2 Landing-specific room cards

Create a dedicated homepage room card grammar rather than directly reusing the generic room card.

Required card structure:

- room label
- short descriptor
- one or two supporting facts
- strong CTA

Do not include:

- dense body copy
- too many facts
- internal product terminology

### 7.3 Hero visual anchor

The homepage needs a stronger visual memory anchor.

This should be one of:

- branded AG motion/shape field
- simplified flagship room teaser
- premium abstract stage tied to room identity

It should not be:

- a dense UI screenshot
- a full room layout inside the hero
- decorative gradients with no product meaning

---

## 8. Layout Rules

### 8.1 First fold

The first fold should contain only:

- eyebrow
- headline
- support line
- CTA row
- light proof ribbon

No more than one secondary supporting visual cluster is allowed.

### 8.2 Section order

Recommended homepage order:

1. Hero
2. Featured Rooms
3. How It Works
4. Why Trust It
5. Live Proof
6. Final CTA

### 8.3 Section rhythm

Each section must have different structural cadence:

- Hero: central, compressed, persuasive
- Featured Rooms: horizontal, browsable, entry-focused
- How It Works: linear process
- Why Trust It: principle-based, compact
- Live Proof: lightweight evidence
- Final CTA: clean close

---

## 9. Copy Rules

Homepage copy must obey these rules:

- lead with room language, not protocol language
- avoid meta design vocabulary
- avoid overusing the phrase `trust layer`
- keep support lines under control
- use verbs that imply action: `Open`, `Choose`, `Build`, `Follow`

Do not use homepage copy that sounds like:

- internal architecture notes
- investor brief language
- design review commentary

---

## 10. Visual Rules

Homepage visuals must obey these rules:

- fewer surfaces, stronger hierarchy
- fewer glows, better color discipline
- consistent surface depth
- one clear highlight color hierarchy
- one memorable hero anchor

Do not:

- solve weak hierarchy with more decoration
- use glow as a substitute for product identity
- mix too many panel idioms in one page

---

## 11. Implementation Checklist

### 11.1 P0 — required before homepage is considered production-grade

- replace hero proof cards with a ribbon
- create landing-specific room entry cards
- tighten `Featured rooms` into a true room rail
- reduce repeated section grammar
- add a stronger but quieter hero visual anchor

### 11.2 P1 — next polish pass

- unify hover and focus behavior for all homepage CTAs
- tighten room card typography and fact density
- tune spacing and section transitions for desktop and mobile
- reduce generic blue/fuchsia dependency in favor of more stable brand surfaces

### 11.3 P2 — can follow after implementation

- add motion refinement
- add light visual proof transitions
- add refined social proof or room activity teaser if it improves conversion

---

## 12. Acceptance Standard

The homepage can be treated as “landing-grade” only when:

- the first fold reads clearly in under five seconds
- the main CTA is visually obvious
- the page feels like one product, not multiple section systems stitched together
- `Featured rooms` feels like a room lobby, not a card gallery
- the brand feels specific to ArbiGameFi, not generic web3 premium UI
- design and implementation are aligned enough that the homepage no longer behaves like an experiment

Until then, the homepage should be considered:

`directionally correct, but still in refinement`
