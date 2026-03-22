# Prototype To Implementation Map — 2026-03

**Status**: Draft handoff map  
**Scope**: `Translate the current v2 prototype system into a realistic frontend implementation sequence`

**Related documents**
- `docs/frontend/UI-CONSTITUTION.md`
- `docs/frontend/UI-UX-DESIGN-BRIEF-2026-03.md`
- `docs/frontend/PROTOTYPE-FREEZE-REVIEW-2026-03.md`
- `docs/frontend/PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
- `docs/frontend/FRONTEND-STATE-AND-PROTOTYPE-REVIEW-2026-03-16.md`
- `docs/frontend/SCREEN-SPECS/README.md`
- `docs/frontend/COMPONENT-INVENTORY.md`

## 1. Purpose

This document is the implementation bridge between:

- the prototype system
- the screen specs
- the active frontend codebase

It answers:

1. which prototype is the source for each real route
2. which shell family each route belongs to
3. which shared components should be reused or hardened
4. what must be cleaned up before implementation parity work starts
5. what order implementation should happen in

This is not a design doc.
This is a build map.

## 2. Global Rules

### 2.1 Build by shell family, not by random page order

Implementation should follow:

1. acquisition shell
2. room shell
3. trust shell
4. route-specific polish

### 2.2 Prototype is source, but not literal source

Prototype files are now good enough to guide implementation,
but they are not copy-paste implementation source.

Before implementation parity:
- remove meta-design copy
- reduce one-off glow treatments
- normalize surfaces toward shared token roles

### 2.3 Reuse real UI where possible

Existing real components already worth preserving:
- `ShellHeader`
- `GameCard`
- `DataTable`
- `RouletteBoard`
- `AuditTabs`
- `GameBetPanel`
- `BetPanelShell`

The goal is not “throw everything away”.
The goal is:
- keep structurally correct real components
- reshape them to match the frozen prototype grammar

## 3. Shell Families

## 3.1 Acquisition shell

Routes:
- `/`
- `/games`

Shared implementation targets:
- lightweight top nav
- one dominant CTA
- lighter proof language
- room-entry cards

## 3.2 Room shell

Routes:
- `/games/[slug]`
- shared game-room variants

Shared implementation targets:
- top game selector
- compact room strip
- left ticket rail
- right play surface
- lower room tabs grammar

## 3.3 Trust shell

Routes:
- `/bets`
- `/bets/[betId]`
- `/liquidity`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Shared implementation targets:
- denser top nav
- calmer stats rhythm
- stronger table grammar
- less atmospheric surface treatment
- clear separation between player actions and authority/ops actions

## 4. Route Mapping

## 4.1 Home

**Production route**
- `frontend/apps/web/src/app/page.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-flagship/page.tsx`

**Shell family**
- acquisition

**Shared components to reuse/harden**
- `LandingShell`
- `ArbiGameFiBrand`
- `GameCard` or a lighter room-entry card variant

**Stable in prototype**
- room-first hero copy direction
- featured room teaser pattern
- featured rooms section
- proof/support hierarchy

**Still needs polish before parity**
- first-fold support density
- teaser realism
- lower-fold editorial rhythm

**Implementation note**
- do not carry over prototype-only glow values literally
- build the hero from semantic sections, not a monolithic prototype block

## 4.2 Games Directory

**Production route**
- `frontend/apps/web/src/app/games/pageClient_list.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-directory/page.tsx`

**Shell family**
- acquisition / directory

**Shared components to reuse/harden**
- `AppShell` or dedicated directory shell variant
- `GameCard`
- category pill filter primitive

**Stable in prototype**
- featured room hierarchy
- supporting room card simplification
- room-first directory tone

**Still needs polish before parity**
- featured room visual cue
- bottom proof strip density
- supporting card metadata tone

**Implementation note**
- treat directory as curated lobby, not data catalog

## 4.3 Roulette Room

**Production route**
- `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-roulette/page.tsx`

**Shell family**
- room

**Shared components to reuse/harden**
- `ShellHeader`
- `RouletteBoard`
- `GameBetPanel`
- `BetPanelShell`
- lower room tabs system

**Stable in prototype**
- top game selector
- compact room strip
- standard European table layout
- lower room tabs structure

**Still needs polish before parity**
- roulette-specific ticket rail
- stronger room-native live stage
- more mature lower analytics/data layer

**Implementation note**
- the board must stay the dominant surface
- do not let trust metadata climb back into the first fold

## 4.4 Dice Room

**Production route**
- `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-dice/page.tsx`
- supporting grammar from `ui-ux-v2-flagship/page.tsx`

**Shell family**
- room

**Shared components to reuse/harden**
- `GameBetPanel`
- `BetPanelShell`
- dice-specific play surface

**Stable in prototype**
- room grammar
- under/over direction

**Still needs polish before parity**
- stronger dice-native play stage
- more iconic relationship between lane and slip

## 4.5 Coin Toss / Keno

**Production route**
- `frontend/apps/web/src/app/games/[slug]/pageClient.tsx`

**Prototype sources**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-cointoss/page.tsx`
- `frontend/apps/web/src/app/prototype/ui-ux-v2-keno/page.tsx`

**Shell family**
- room

**Shared components to reuse/harden**
- shared room shell
- shared ticket shell
- game-specific play surfaces

**Implementation note**
- keep room grammar shared
- make the play surface and ticket language game-specific

## 4.6 Liquidity

**Production route**
- `frontend/apps/web/src/app/liquidity/pageClient.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-liquidity/page.tsx`

**Shell family**
- trust

**Shared components to reuse/harden**
- `PageHeader`
- `DataTable`
- stat cluster
- action terminal card

**Stable in prototype**
- capital-product framing
- action + metrics split

**Still needs polish before parity**
- glow intensity
- trust-family calmness
- token consistency

## 4.7 Bets

**Production route**
- `frontend/apps/web/src/app/bets/page.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-bets/page.tsx`

**Shell family**
- trust

**Shared components to reuse/harden**
- `DataTable`
- filter rail
- status chips

**Stable in prototype**
- ledger-first structure

**Still needs polish before parity**
- stronger mature-ledger tone
- less generic dashboard styling

## 4.8 Bet Detail

**Production route**
- `frontend/apps/web/src/app/bets/[betId]/page.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-bet-detail/page.tsx`

**Shell family**
- trust / receipt

**Implementation note**
- combine the prototype’s receipt clarity with the real route’s chain-truth depth

## 4.9 Account

**Production route**
- `frontend/apps/web/src/app/account/page.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-account/page.tsx`

**Shell family**
- trust

**Implementation note**
- final route should land between:
  - personal operating summary
  - self-audit page

## 4.10 Claims

**Production route**
- `frontend/apps/web/src/app/claims/pageClient.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-claims/page.tsx`

**Shell family**
- trust

**Stable in prototype**
- action hierarchy
- route inclusion in the trust family

**Must clean before parity**
- remove all meta-design copy
- calm the route tone
- keep governance action visibly secondary to player claim action

## 4.11 Referral

**Production route**
- `frontend/apps/web/src/app/referral/pageClient.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-referral/page.tsx`

**Shell family**
- trust / affiliate

**Implementation note**
- keep it in trust family
- but retain clearer action language than ops routes

## 4.12 Ops

**Production route**
- `frontend/apps/web/src/app/ops/page.tsx`

**Prototype source**
- `frontend/apps/web/src/app/prototype/ui-ux-v2-ops/page.tsx`

**Shell family**
- trust / ops

**Stable in prototype**
- release proof, health, and event-trail structure

**Must clean before parity**
- remove meta-design copy
- reduce glow and atmospheric treatment
- make the route read more like an institutional surface

## 5. Shared Component Work Before Full Parity

These are the components that should be hardened before broad route implementation starts.

### 5.1 Room family
- room top selector
- room strip
- ticket rail base
- room lower tabs
- room analytics side stack

### 5.2 Trust family
- trust shell header
- stat cluster
- trust table wrapper
- calm action terminal
- secondary authority action card

### 5.3 Acquisition family
- featured room teaser
- room-entry card
- proof strip

## 6. Cleanup Tasks Before Large-Scale Implementation

### Mandatory
- remove meta-design copy from prototypes
- reduce hardcoded glow usage in trust routes
- normalize active doc naming to `ArbiGameFi Frontend v2`

### Strongly recommended
- lighten prototype reliance on one-off hex/background values
- update screen-spec docs to match the latest `P0` prototype pass

## 7. Recommended Build Order

1. `Home`
2. `Games Directory`
3. `Roulette Room`
4. `Shared room tabs`
5. `Shared ticket rail base`
6. `Liquidity`
7. `Bets`
8. `Bet Detail`
9. `Account`
10. `Claims`
11. `Ops`
12. `Referral`
13. `Dice / Coin Toss / Keno` final route-specific room polish

## 8. Exit Condition For This Map

This map has done its job when:

- the team is no longer asking “which prototype is the source?”
- the next implementation step is shared-component build-out, not another architecture debate
- route implementation can proceed by shell family with limited ambiguity
