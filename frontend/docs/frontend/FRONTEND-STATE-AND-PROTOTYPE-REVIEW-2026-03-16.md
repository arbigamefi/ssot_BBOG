# Frontend State And Prototype Review — 2026-03-16

**Status**: Review snapshot  
**Scope**: `Current frontend repo state, active design governance docs, and v2 prototype quality`

## 1. Snapshot

This review is based on the current repo state after the latest prototype iteration pass.

Relevant recent commits:
- `504da0893` `feat(frontend): refine p0 route prototypes`
- `b23c154be` `Assess prototype optimization scope`

At review time, the working tree is clean.

The frontend now has three things in place at the same time:
- a fuller design-governance stack
- route-complete v2 prototypes
- a clearer `P0 / P1 / P2` improvement matrix

That means the biggest remaining problem is no longer architecture uncertainty.
It is alignment:
- alignment between active docs
- alignment between copy and prototype
- alignment between route families
- alignment between prototype aesthetics and implementation-ready discipline

## 2. What Should Be Updated In The Docs

### 2.1 Brand naming is still inconsistent in active frontend governance docs

The project brand is now clearly `ArbiGameFi`, but parts of the active frontend doc stack still use `SSOT Frontend v2` as if it were the product name.

Most visible examples:
- `frontend/docs/frontend/ROADMAP.md`
- `frontend/docs/frontend/UI-CONSTITUTION.md`
- `frontend/docs/frontend/PRD.md`
- `frontend/docs/frontend/SPEC.md`
- `frontend/docs/frontend/ACTION-PLAN-UI-PRODUCTIZATION.md`

Decision:
- active governance docs should use `ArbiGameFi Frontend v2`
- `SSOT` should remain an architecture principle, not the outward product name

### 2.2 The freeze review is directionally right, but slightly optimistic now

`frontend/docs/frontend/PROTOTYPE-FREEZE-REVIEW-2026-03.md` correctly froze shell grammar and route families.
But after reviewing the current prototype files again, its readiness tone is slightly ahead of the actual screens.

More accurate status today:
- shell grammar is stable
- route coverage is strong
- `Home / Directory / Roulette` are much better than before
- trust-route tone and token discipline are still not stable enough to treat the prototypes as direct implementation source everywhere

Recommendation:
- keep the freeze review as the historical decision artifact
- use `frontend/docs/frontend/PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
  and this review as the current truth for what still needs work

### 2.3 Some route docs should be updated after the latest P0 prototype pass

The latest P0 prototype iteration materially improved:
- `Home / Flagship`
- `Games Directory`
- `Roulette Room`

That means the following docs should eventually be refreshed so they do not lag behind the current screens:
- `frontend/docs/frontend/UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `frontend/docs/frontend/SCREEN-SPECS/001-HOME-LANDING.md`
- `frontend/docs/frontend/SCREEN-SPECS/002-GAMES-DIRECTORY.md`
- `frontend/docs/frontend/SCREEN-SPECS/003-ROULETTE-ROOM.md`

Not because the strategy changed,
but because the current prototypes now express a more mature version of that strategy.

## 3. Prototype Review: Where Improvement Space Still Exists

## 3.1 Home / Flagship

**File**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-flagship/page.tsx`

**What is now working**
- hero copy now matches the approved landing spine much more closely
- right-side hero visual now reads as a room teaser, not a generic concept panel
- the first fold no longer wastes a huge amount of vertical space
- featured rooms now feel closer to a curated room entry surface

**What still needs improvement**
- the first fold still has two secondary information blocks (`Room entry` and `Live proof`) that compete with the hero instead of supporting it quietly
- the featured roulette teaser is better, but still slightly more “designed block” than “real room preview”
- lower sections are structurally right, but the page still reads a little like a premium prototype rather than a publish-ready landing page

**Recommendation**
- compress the first-fold support layer by about one more step
- make the featured room teaser feel even more like a true clickable room preview
- reduce explanatory copy in the lower fold and let entry surfaces carry more of the page

## 3.2 Games Directory

**File**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-directory/page.tsx`

**What is now working**
- the page reads much more like a curated lobby than before
- the featured roulette room has proper hierarchy
- the supporting room cards are simple enough to scan quickly

**What still needs improvement**
- the featured card still relies mostly on copy and tag treatment; it lacks a stronger visual room cue
- the supporting cards are good structurally but still a bit generic in their lower metadata area
- the bottom `Lobby proof` row is better than the earlier `Lobby note` version, but it still reads like supporting documentation rather than product proof

**Recommendation**
- add one stronger room-preview signal to the featured card
- tighten supporting cards so the promise and cue feel more product-like and less descriptive
- either compress or partially merge the bottom proof row into a more editorial, lighter strip

## 3.3 Roulette Room

**File**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-roulette/page.tsx`

**What is now working**
- the top selector is present and correct
- the compact room strip is in place
- the board uses the correct European table structure
- the lower room tabs grammar exists and is now much closer to a mature room system

**What still needs improvement**
- the left ticket rail is denser and quieter than before, but still reads as a shared control block more than a truly roulette-native slip
- the main stage above the board is still minimal; the room would benefit from a slightly stronger live-table personality
- the lower data layer is now secondary, but still reads more like a ledger module than a polished casino-room analytics layer

**Recommendation**
- make the ticket rail more roulette-specific without making it louder
- strengthen the live-table stage with room-native context, not extra explanation
- refine the lower tabs area so it feels like mature room telemetry rather than generic audit panels

## 3.4 Claims

**File**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-claims/page.tsx`

**What is working**
- route structure is correct
- action hierarchy is clear: main claim, secondary sync, governance fee sweep
- trust-route shell family is consistent

**What still needs improvement**
- the page still contains meta-design copy such as:
  - “This page should feel like...”
  - “The route should make it obvious...”
  - “This route should clearly separate...”
- this is still prototype-language, not product-language
- visual treatment is still a little too bright and reward-terminal-themed relative to the calmer trust-route family we want

**Recommendation**
- remove all design-instruction copy from the screen
- rewrite the route into plain user-facing language
- calm the route down so it remains part of the trust/audit family

## 3.5 Ops

**File**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-ops/page.tsx`

**What is working**
- the content structure is right
- the route clearly separates release proof, health, and event trail
- it belongs to the trust family rather than the player family

**What still needs improvement**
- it still contains meta copy:
  - “This route should feel institutional and precise...”
  - “This panel should give operators and LPs...”
  - “Keep emergency controls separated...”
- glow treatment and card tone are still slightly too atmospheric for an operational surface

**Recommendation**
- replace all meta-design text with operator-facing product copy
- reduce glow and color drama
- make the route calmer, more precise, and more document-like

## 3.6 Liquidity / Bets / Account / Referral

**Current state**
- route family alignment is much better than before
- structure is generally coherent
- the design system direction is visible

**Remaining issue**
- some pages still sit between “trust product” and “showcase prototype”
- several still use stronger direct-color surfaces and glow effects than the trust family should keep

**Recommendation**
- run one dedicated trust-route tone pass across:
  - `ui-ux-v2-liquidity`
  - `ui-ux-v2-bets`
  - `ui-ux-v2-bet-detail`
  - `ui-ux-v2-account`
  - `ui-ux-v2-referral`

## 4. Prototype-System Issues That Still Need Cleanup

### 4.1 Token discipline is still too loose

The UI Constitution says the system should move toward tokenized, reusable visual roles.
The current prototypes still use many one-off values:
- direct hex backgrounds
- one-off glow strengths
- repeated custom border-opacity combinations

This is especially visible in:
- `ui-ux-v2-flagship`
- `ui-ux-v2-liquidity`
- `ui-ux-v2-claims`
- `ui-ux-v2-ops`

This is acceptable for exploration,
but it is not strong enough yet for clean implementation mapping.

### 4.2 Meta-design language is still present in screens

Current prototypes should stop rendering internal design comments as visible copy.

The most obvious offenders are:
- `ui-ux-v2-claims`
- `ui-ux-v2-ops`

This is now a cleanup task, not an open design question.

## 5. Updated Verdict

Compared with the previous freeze review, the current state is:

- **better** on `Home / Directory / Roulette`
- **good enough** on shell families and route coverage
- **still not finished** on trust-route tone and token discipline

So the right conclusion is:

> The prototype system is now stable enough to guide implementation planning, but not yet polished enough to become direct route-by-route implementation source without one more cleanup pass.

## 6. Recommended Next Sequence

1. Finish `P0` properly
   - one more polish pass on `Home`
   - one more polish pass on `Games Directory`
   - one more roulette-native pass on `Roulette Room`

2. Run a dedicated trust-route cleanup pass
   - `Claims`
   - `Ops`
   - `Liquidity`
   - `Bets`
   - `Account`
   - `Referral`

3. Normalize active governance docs
   - product naming
   - freeze-state language
   - screen-spec references

4. Produce the next artifact
   - `PROTOTYPE-TO-IMPLEMENTATION-MAP-2026-03.md`

That is the correct handoff point before large-scale formal UI implementation resumes.
