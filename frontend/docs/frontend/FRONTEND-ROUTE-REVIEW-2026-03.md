# FRONTEND ROUTE REVIEW — 2026-03

> Historical reference only. Use the current v2 prototype baseline, constitution, and screen specs for active implementation decisions.

**Status**: Historical reference

This document re-evaluates the frontend after the ArbiGameFi branding correction, whitepaper suite, and release materials were stabilized.

It is not a redesign spec by itself.
It is the route-by-route review that answers:

- who each route is for
- what job that route should do
- where the current implementation is drifting
- what should be preserved
- what should be removed or demoted
- what should be built next

Related documents:

- `docs/frontend/PRD.md`
- `docs/frontend/SPEC.md`
- `docs/frontend/UI-CONSTITUTION.md`
- `docs/frontend/ACTION-PLAN-UI-PRODUCTIZATION.md`
- `docs/frontend/PAGE-SPECS/*`
- `docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md`
- `docs/release/ARBIGAMEFI-RELEASE-PACK.zh-CN.md`
- `docs/release/ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`

Reviewed implementation surface:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/games/pageClient_list.tsx`
- `apps/web/src/app/games/[slug]/pageClient.tsx`
- `apps/web/src/app/bets/page.tsx`
- `apps/web/src/app/bets/[betId]/page.tsx`
- `apps/web/src/app/liquidity/pageClient.tsx`
- `apps/web/src/app/claims/pageClient.tsx`
- `apps/web/src/app/referral/pageClient.tsx`
- `apps/web/src/app/account/page.tsx`
- `apps/web/src/app/ops/page.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/LandingShell.tsx`
- `apps/web/src/components/SiteChrome.tsx`

## 1. Executive Read

The frontend should now be treated as three products sharing one codebase:

1. Acquisition product
   - `/`
   - `/games`
2. Gameplay product
   - `/games/[slug]`
   - `/bets/[betId]` immediately after play
3. Trust and audit product
   - `/bets`
   - `/liquidity`
   - `/account`
   - `/claims`
   - `/referral`
   - `/ops`

The current implementation has improved technically, but still mixes these audiences too often.

Main conclusion:

- the problem is no longer "missing infrastructure"
- the problem is now "route intent drift"

## 2. Cross-Cutting Findings

### 2.1 The frontend now has the right facts, but not always the right emphasis

Release identity, digest, bank semantics, and event truth are now well-defined at the repo level.
The remaining issue is placement:

- acquisition routes still expose too much protocol framing
- gameplay routes still expose too much surrounding context
- trust routes still need more plain-language interpretation

Truth is no longer missing.
Truth is often in the wrong visual layer.

### 2.2 Navigation is still too flat for the real audience split

`AppShell.tsx` still treats many advanced routes as first-class global navigation items:

- `Claims`
- `Referral`
- `Account`
- `Ops`

That is acceptable for an internal demo or protocol console.
It is not ideal for a user-facing gaming product.

Recommended direction:

- primary navigation should favor `Games`, `Bets`, `Liquidity`
- `Claims`, `Referral`, `Account`, and especially `Ops` should move into a secondary or profile/audit layer

### 2.3 Consumer-facing copy still drifts into operator vocabulary

Many pages explain the system correctly, but the wording still reads like internal protocol documentation:

- "release manifest"
- "protocol truth"
- "indexer health"
- "governed presentation"
- "transport truth"

Those phrases are useful in audit and ops contexts.
They are not the right default surface for players.

### 2.4 `/ops` should exist, but not as a normal player nav destination

`/ops` is useful.
The mistake is prominence, not existence.

This page should behave like an advanced diagnostics route, not a normal player tab.

### 2.5 `/claims` currently mixes two audiences

The page currently combines:

- player-facing XP actions
- governance-style protocol fee withdrawal

Those are not the same audience.
The route is technically correct, but product-wise muddy.

### 2.6 The gameplay core is finally close enough to review seriously

The betting shell, stepper, and per-game controls now exist in a usable form.
That means the next gameplay pass should not be architectural.
It should be a strict UX pass:

- fewer distractions
- stronger game-specific control surfaces
- clearer pre-bet and post-bet states

## 3. Route Review

## 3.1 `/`

Implementation:

- `apps/web/src/app/page.tsx`
- shell: `components/LandingShell.tsx`
- spec: `PAGE-SPECS/005-HOME.md`

Audience:

- first-time visitor
- returning visitor deciding where to play
- partner who wants a fast product read

Primary job:

- explain what ArbiGameFi is
- establish trust quickly
- route the user into playable rooms

What is working:

- landing shell separation is correct
- home is no longer a raw dashboard
- live proof is now conceptually lighter than before

Where it is still drifting:

- copy still over-explains protocol ideas too early
- some sections still feel like a protocol showcase instead of a conversion page
- release/truth language appears too close to the primary conversion path

Keep:

- landing-specific shell
- featured rooms
- lightweight live proof
- compact trust framing

Cut or demote:

- any section that makes the visitor parse release mechanics before choosing a room
- any repeated room-directory content that duplicates `/games`
- any operator-style diagnostics that belong on `/bets`, `/liquidity`, or `/ops`

Add or strengthen:

- stronger hero promise
- one dominant primary CTA
- shorter "why trust it" copy with cleaner hierarchy
- social proof or live proof that reads like momentum, not like telemetry

Truth sources:

- release for room catalog and identity
- SDK for compact bankroll proof
- indexer for recent activity only

Priority:

- high

## 3.2 `/games`

Implementation:

- `apps/web/src/app/games/pageClient_list.tsx`
- spec: `PAGE-SPECS/010-GAMES.md`

Audience:

- player choosing a room
- returning player comparing game types

Primary job:

- help the user pick a room quickly
- set expectation for each room before entry

What is working:

- rooms are release-driven
- directory structure is clear
- card system is already reusable and coherent

Where it is drifting:

- the page still talks too much about release truth instead of player choice
- "Selection rules" and protocol-oriented copy are heavier than the route really needs
- it still behaves partly like a governed directory explanation page

Keep:

- release-derived room catalog
- featured room
- compact cards

Cut or demote:

- long warnings about governed presentation on the main discovery surface
- unnecessary protocol explanation on first scan

Add or strengthen:

- room categorization or clearer mental grouping
- stronger difference between "fast game", "precision game", "multi-pick game", etc.
- more obvious "why choose this room" signals

Truth sources:

- release only for game identity and assets
- presentation map only for decorative metadata

Priority:

- medium

## 3.3 `/games/[slug]`

Implementation:

- `apps/web/src/app/games/[slug]/pageClient.tsx`
- primary betting surface: `features/betting/ui/GameBetPanel.tsx`
- spec: `PAGE-SPECS/010-GAMES.md`

Audience:

- active player
- returning player repeating a known game loop

Primary job:

- allow the user to select an outcome
- size the bet
- confirm the transaction
- understand what happened after submission

What is working:

- route is release-driven
- room flow is much closer to the intended bet console model
- recent activity is integrated
- game-specific inputs exist

Where it is drifting:

- room framing still competes with the actual betting task
- top-level context is still heavier than a room needs
- live activity and protocol explanation still compete with the control surface
- the page is not yet visually opinionated enough per game

Keep:

- outcome board + stake console + stepper model
- activity tabs
- protocol truth below the primary interaction fold

Cut or demote:

- any hero or card content that competes with "select outcome -> set amount -> play"
- any repeated explanation that belongs in help tabs or bet detail

Add or strengthen:

- stronger per-game visual grammar
- tighter first-screen composition
- clearer "waiting / mined / reconciled / refunded" post-submit states
- clearer one-screen relationship between input, total cost, and possible outcome

Truth sources:

- release for game identity, params encoding, supported assets
- SDK for plan and execute
- indexer for room activity

Priority:

- highest

## 3.4 `/bets`

Implementation:

- `apps/web/src/app/bets/page.tsx`
- spec: `PAGE-SPECS/020-BETS.md`

Audience:

- player checking recent outcomes
- power user auditing flow
- partner verifying local event history behavior

Primary job:

- present the bet ledger clearly
- support filtering and click-through to detail

What is working:

- filtering exists
- search exists
- explorer links exist
- row click-through is clear

Where it is drifting:

- page title "My Bets" may overclaim if the local store is broader than wallet-only history
- columns still under-communicate economic meaning
- the route reads like an indexer table more than a betting ledger

Keep:

- searchable, filterable table
- click-through detail
- explorer affordance

Cut or demote:

- terminology that implies stronger user scoping than the current data actually guarantees

Add or strengthen:

- clearer stake / payout / result columns
- explicit source labeling when the table is local indexed history
- better empty-state route back to gameplay

Truth sources:

- indexer primary
- release for labels

Priority:

- medium

## 3.5 `/bets/[betId]`

Implementation:

- `apps/web/src/app/bets/[betId]/page.tsx`

Audience:

- player validating a specific bet
- support/audit workflow

Primary job:

- explain one bet from placement to outcome
- surface lifecycle, amount, result, and actionability

What is working:

- lifecycle is explicit
- on-chain and local facts are merged sensibly
- finalize/refund flows are standardized

Where it is drifting:

- still reads a bit like a protocol inspection page
- summary hierarchy can be cleaner
- params and outcome interpretation could be more human-readable

Keep:

- lifecycle and action trace
- timeline merge of local and on-chain

Cut or demote:

- low-signal raw identifiers above the fold

Add or strengthen:

- stronger human summary card
- clearer "why can I refund / why can I finalize" explanation
- better outcome storytelling for wins, losses, and refunds

Truth sources:

- SDK `getBet` plus release decode
- indexer timeline

Priority:

- medium

## 3.6 `/liquidity`

Implementation:

- `apps/web/src/app/liquidity/pageClient.tsx`
- spec: `PAGE-SPECS/030-LIQUIDITY.md`

Audience:

- LP
- partner evaluating bankroll semantics

Primary job:

- explain bank health
- allow deposit / withdraw / redeem safely

What is working:

- write flows are standardized
- snapshot and position data are live
- asset selection exists

Where it is drifting:

- the route still assumes the user already understands `NAV`, `reserved`, `free`, `minLiq`, `PF`, `XP`
- it is technically correct but not yet LP-friendly enough
- current copy does not sufficiently translate protocol accounting into LP decisions

Keep:

- stepper-based write flow
- live bank snapshot cards
- position and allowance visibility

Cut or demote:

- any raw metric blocks that lack a plain-language interpretation

Add or strengthen:

- direct mapping to the LP onboarding note
- short explanations for each liquidity metric
- clearer separation between wallet state, LP position, and protocol state
- stronger warnings when a selected action is blocked by domain constraints

Truth sources:

- release for supported assets
- SDK bank reads and writes

Priority:

- highest

## 3.7 `/claims`

Implementation:

- `apps/web/src/app/claims/pageClient.tsx`
- spec: `PAGE-SPECS/045-CLAIMS.md`

Audience:

- player claiming XP
- operator or governance actor handling protocol-level claims

Primary job:

- present claimable state clearly
- allow legitimate claim flows without ambiguity

What is working:

- standardized transaction traces
- XP bucket visibility
- holdback sync exists

Where it is drifting:

- player claims and protocol fee withdrawal still share one page
- page semantics are mixed
- "claims" is too broad a bucket for the current audience split

Keep:

- XP bucket visibility
- stepper traces

Cut or demote:

- governance fee claim from the default player-facing surface

Add or strengthen:

- clearer split between player claims and advanced/governance actions
- stronger explanation of accrued vs locked vs holdback
- better connection to LP/accounting semantics when XP affects backing

Truth sources:

- SDK bank reads and writes
- release for asset identity

Priority:

- medium-high

## 3.8 `/referral`

Implementation:

- `apps/web/src/app/referral/pageClient.tsx`
- spec: `PAGE-SPECS/040-REFERRAL.md`

Audience:

- referred player
- referrer sharing a link

Primary job:

- show current binding state
- allow one-time binding
- help the user understand the consequence

What is working:

- bind flow is standardized
- current status is visible

Where it is drifting:

- page is operationally correct but product-thin
- it behaves like a one-off form, not a referral surface

Keep:

- one-time bind semantics
- current referrer view

Cut or demote:

- bare form-only presentation

Add or strengthen:

- shareable referral link
- explanation of first-touch or one-time binding semantics
- clearer benefit framing

Truth sources:

- SDK referral reads and writes

Priority:

- medium

## 3.9 `/account`

Implementation:

- `apps/web/src/app/account/page.tsx`
- spec: `PAGE-SPECS/050-ACCOUNT.md`

Audience:

- connected player
- power user checking self-audit state

Primary job:

- show wallet balances, bank exposure, allowances, refund credit, and local tx history

What is working:

- the page is no longer journal-only
- release identity is present
- refund credit claim is integrated

Where it is drifting:

- the page still reads more like a technical ledger than an account center
- too much emphasis is placed on protocol identity relative to personal state
- money organization can be clearer

Keep:

- balances
- allowances
- refund credit
- tx journal

Cut or demote:

- protocol identity blocks that overshadow user-specific state

Add or strengthen:

- clearer grouping: wallet / bank / recoverable / history
- stronger "what should I do next" actions

Truth sources:

- SDK reads
- local tx journal
- release for identity

Priority:

- medium

## 3.10 `/ops`

Implementation:

- `apps/web/src/app/ops/page.tsx`
- primary nav exposure: `components/AppShell.tsx`
- spec: `PAGE-SPECS/060-OPS.md`

Audience:

- internal operator
- advanced tester

Primary job:

- expose indexer diagnostics

What is working:

- the page is useful
- the metrics are coherent
- worker/indexer diagnostics have real value

Where it is drifting:

- not the route itself, but its visibility
- this should not read like a mainstream player navigation destination

Keep:

- route
- metrics
- refresh and sync actions

Cut or demote:

- primary-nav prominence

Add or strengthen:

- "advanced" positioning
- optional access from a secondary nav, footer, or debug profile menu

Truth sources:

- runtime and indexer only

Priority:

- high, but as a navigation change rather than a feature build

## 4. Chrome Review

### 4.1 Landing shell

`LandingShell.tsx` is directionally correct.
It should remain separate from the app shell.

Needed next:

- reduce protocol identity prominence even further
- keep wallet and room CTA, but not much more

### 4.2 App shell

`AppShell.tsx` is still too much of a flat protocol console nav.

Recommended next:

- keep `Games`, `Bets`, `Liquidity` primary
- move `Claims`, `Referral`, `Account`, `Ops` into a secondary layer

### 4.3 Site chrome split

`SiteChrome.tsx` currently splits only `/` from everything else.

That is a good start, but not the final shape.

Recommended medium-term split:

- landing chrome
- room chrome
- audit chrome

The room chrome should be the lightest.
The audit chrome can tolerate more protocol identity and secondary routes.

## 5. Recommended Execution Order

1. Navigation and chrome cleanup
   - demote `Ops`
   - reduce advanced-route prominence
   - prepare separate audit-oriented navigation grouping
2. Liquidity interpretation pass
   - align `/liquidity` with LP onboarding semantics
3. Game room strict UX pass
   - reduce surrounding context
   - strengthen game-specific interaction surfaces
4. Home conversion pass
   - simplify copy
   - keep proof compact
   - reduce protocol-first phrasing
5. Claims and referral audience split
   - separate player-facing actions from advanced/governance actions
6. Bets and account polish
   - improve economic readability and self-audit clarity

## 6. Immediate Next PR-Sized Work

The highest-ROI next PR is:

### PR-1

- demote `/ops` from primary nav
- simplify `AppShell` information density
- keep room pages on a lighter chrome

### PR-2

- rewrite `/liquidity` copy and metric framing using `ARBIGAMEFI-LP-ONBOARDING`
- make every snapshot metric answer "what does this mean for LPs?"

### PR-3

- strip the game room upper fold down to gameplay essentials
- push more protocol explanation below the primary interaction surface

## 7. Final Position

The frontend should no longer be judged as "missing infra" or "still early".
It now has enough infrastructure, truth sources, and release discipline.

From this point onward, frontend quality is mainly about whether each route does one job clearly for one audience.
