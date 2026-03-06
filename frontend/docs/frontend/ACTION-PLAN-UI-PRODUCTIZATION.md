# ACTION PLAN — UI Productization & Governance Closeout

**Status**: Draft

This document converts the off-repo "full UI/UX rebuild" draft into a repo-native execution plan.
It keeps the useful product direction, but rejects the incorrect assumption that the frontend is still a greenfield UI shell.

This is **not** a rewrite plan.
This is a **gap-closure plan** for the current SSOT Frontend v2 codebase.

Related documents:
- PRD: `docs/frontend/PRD.md`
- Roadmap: `docs/frontend/ROADMAP.md`
- UI Constitution: `docs/frontend/UI-CONSTITUTION.md`
- Page specs: `docs/frontend/PAGE-SPECS/`
- Milestone D3: `docs/frontend/MILESTONE-D3.md`

---

## 1. Planning Principles

1. Release artifact remains the only protocol truth.
2. SDK read helpers and txPipeline remain the only contract touch surfaces.
3. Indexer remains the source of event history and live operational state.
4. `packages/ui` is extended only where needed; do not rebuild existing shared components.
5. Every UI change must satisfy `UI-CONSTITUTION.md`, especially:
   - semantic tokens over page-local styling drift
   - standard stepper for write flows
   - page spec coverage
   - Storybook coverage for shared UI changes

---

## 2. What Is Already Done

The following are already present and must be treated as baseline, not future work:

- Shared UI components exist in `packages/ui`:
  - `PageHeader`
  - `StatCard`
  - `DataTable`
  - `StatusBadge`
  - `GameCard`
  - `TabBar`
  - `TxStepper`
- Route transition wrapper exists in `apps/web`:
  - `PageTransition`
- Product routes already exist:
  - `/`
  - `/games`
  - `/games/[slug]`
  - `/bets`
  - `/bets/[betId]`
  - `/liquidity`
  - `/claims`
  - `/referral`
  - `/account`
  - `/ops`
- Core product capabilities already exist in usable form:
  - game forms wired to the shared game bet panel
  - bets list backed by the local indexer
  - liquidity actions, claims actions, referral bind, and account tx journal
  - workerized indexer observability on `/ops`

Implication:
- Do not spend time rebuilding Phase 1 "foundation components".
- Spend time on correctness, consistency, missing product depth, and governance closure.

---

## 3. Current Gaps That Actually Matter

### 3.1 Home still uses fake product data
- Home KPI cards are hardcoded.
- "Live Bets" is a mock table.
- Home is the route furthest from the frontend governance docs.

### 3.2 Page-spec governance is incomplete
- A dedicated Claims spec is now part of the repo-native page-spec set.
- Remaining work is to keep route behavior, spec language, and placeholder links aligned as implementations evolve.
- Some current route implementations have outgrown their existing page specs.

### 3.3 Several write flows bypass the standard tx stepper
- Liquidity actions currently submit directly from the page.
- Claims actions currently submit directly from the page.
- Referral bind currently submits directly from the page.
- Bet detail actions (`refund`, `finalize`) currently submit directly from the page.

This conflicts with the UI constitution and PRD requirement that write flows use the standardized stepper.

### 3.4 Bets audit loop is incomplete
- Bets list lacks filters, explorer affordances, and action visibility.
- Bet detail lacks full params decode, richer timeline, and action gating polish.
- The user-visible path from mined tx to durable audit record needs to be clearer.

### 3.5 Account route is still too thin
- It mostly exposes the tx journal.
- It does not yet satisfy the page spec expectation for balances, allowances, refund credit, and protocol identity.

### 3.6 Games productization is partial
- Games list is solid, but metadata still depends on local fallback maps for icon/description/RTP.
- Game detail lacks recent-bets context and a stronger "room" feel around the betting flow.

### 3.7 Touched pages still drift from token governance
- The home route especially uses page-local visual styling rather than consistent semantic token usage.
- Any polish pass must move toward the UI constitution, not away from it.

---

## 4. Truth-Source Matrix

Every page-level feature added in this plan must declare its truth source before implementation.

| Data Type | Primary Source | Secondary Source | Notes |
|-----------|----------------|------------------|-------|
| supported games / assets / ABI identity | release artifact | none | never hardcode protocol truth |
| bank snapshots / user positions / balances / allowances | SDK read helpers | none | fetched per connected account / asset |
| bet detail current state | SDK `hub.getBet()` + release decode | indexer row | indexer is history truth; read helper is completeness aid |
| bets list / live bets / timelines | indexer | reconcile reads | history comes from events |
| tx progress / local audit trail | tx journal | wallet explorer | must include release identity |
| KPI accelerators / analytics | optional cache or subgraph | none | never primary truth |

Rule:
- Subgraph or analytics services MAY accelerate derived metrics later, but MUST NOT be the canonical source for protocol state.

---

## 5. Execution Sequence

The work should ship in seven phases.
Each phase is intended to be independently reviewable and releasable.

### Phase 0 — Governance Baseline Repair
**Goal**: Fix repo-native planning and documentation before additional UI work.

**Deliverables**
- Add a repo-native action plan document.
- Normalize page-spec coverage for all current routes.
- Audit `specPath` references so every placeholder/error state links to a real spec.
- Record the truth source for every planned Home/Bets/Account metric.

**Acceptance**
- No route references a missing page spec.
- Every current route has exactly one corresponding page spec.
- The off-repo draft is no longer needed to understand execution order.

**Verification**
- `pnpm -C frontend lint`
- manual grep for `specPath=`

### Phase 1 — Home Truthification
**Goal**: Replace the marketing mock home with a governed, data-backed protocol overview.

**Deliverables**
- Replace hardcoded KPI ribbon with real, explicitly sourced values.
- Replace mock "Live Bets" table with indexer-backed latest bets.
- Rebuild the Home route using shared components where appropriate:
  - `PageHeader`
  - `StatCard`
  - `DataTable` or a deliberate variant if table density requires it
- Add release identity and a footer block aligned with product/legal needs.
- Define clear loading, empty, and error states.

**Acceptance**
- No hardcoded KPI values remain in the page source.
- Home numbers come from a declared truth source.
- Home matches the UI constitution more closely than the current implementation.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`

### Phase 2 — Bets Audit Loop Completion
**Goal**: Make bets history and bet detail fully auditable from the UI.

**Deliverables**
- Enhance `/bets` with:
  - status filter
  - game filter
  - explorer affordances
  - better stake / result / timestamp columns
  - clear empty state CTA back to Games
- Enhance `/bets/[betId]` with:
  - summary metrics
  - decoded params card
  - richer event/timeline view
  - explicit action eligibility presentation
  - stronger linkage to tx journal / tx hash
- Ensure refund/finalize/bind actions use the standardized stepper rather than direct one-shot writes.

**Acceptance**
- Bets list is event-driven and filterable.
- Bet detail reflects chain truth with event context.
- All write actions on the detail page go through the standard transaction UX.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`

### Phase 3 — Liquidity, Claims, Referral Transaction Standardization
**Goal**: Bring all user-facing write flows into one institutional transaction model.

**Deliverables**
- Refactor Liquidity deposit / withdraw / redeem to use plan -> preflight -> stepper -> receipt -> journal.
- Refactor Claims actions to the same model:
  - XP claim
  - holdback sync
  - protocol fee claim
- Refactor Referral bind to the same model.
- Keep current visual structure where it is already adequate; do not rewrite these pages from scratch.

**Acceptance**
- No direct write submitters remain on Liquidity, Claims, or Referral.
- Errors are surfaced only through the DomainError model.
- The journal records all resulting writes consistently.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`

### Phase 4 — Account Route Completion
**Goal**: Make `/account` match its own page spec and close the user self-audit loop.

**Deliverables**
- Add balances by supported asset.
- Add allowance visibility for Bank spenders.
- Add refund credit visibility and claim access if exposed by the SDK.
- Keep tx journal as the historical backbone, but turn the route into a full account overview.
- Surface release identity and chain identity where useful.

**Acceptance**
- `/account` is no longer "journal-only".
- Route covers the core modules promised in the page spec.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`

### Phase 5 — Games Productization Pass
**Goal**: Upgrade Games routes from "functional" to "product-ready" without rebuilding the architecture.

**Deliverables**
- Replace local game metadata fallbacks with release-driven or centrally governed metadata where possible.
- Add recent bets or local activity context to the game detail page.
- Improve page framing so the game detail route feels like a game room, not just a form beside a stepper.
- Evaluate whether search / categorization is justified after metadata truth is clarified.

**Acceptance**
- Games routes stay release-driven.
- Any new discovery affordances are backed by stable metadata, not ad-hoc UI constants.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`

### Phase 6 — Design-System and Storybook Closeout
**Goal**: Ensure the touched UI is governed, reviewable, and reproducible.

**Deliverables**
- Move any touched route away from hardcoded visual drift and toward semantic-token usage.
- Add or update Storybook stories for shared components changed during Phases 1–5.
- Add missing loading / empty / error states where touched pages still rely on raw text placeholders.
- Capture desktop and mobile screenshots for changed routes as release evidence.

**Acceptance**
- Shared UI changes have corresponding stories.
- No major touched route violates the UI constitution without an explicit exception note.

**Verification**
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test:strict`
- `pnpm -C frontend build`
- `pnpm -C frontend storybook:build`

### Phase 7 — Release Gate
**Goal**: Treat the above as a product closeout, not a loose UI polish stream.

**Deliverables**
- Final gap review against:
  - `PRD.md`
  - `UI-CONSTITUTION.md`
  - route page specs
- Per-route screenshot set
- Short release note for what changed and what remains deferred

**Acceptance**
- Every changed route has:
  - matching page spec
  - loading/empty/error behavior
  - mobile verification
  - explicit truth source for displayed metrics

---

## 6. Deferred Until Explicitly Justified

These items are allowed backlog candidates, but they should not block the above phases:

- TVL charts and other time-series visualizations
- referral sharing stats / leaderboard style widgets
- global search or category facets on `/games`
- broader marketing/analytics instrumentation
- subgraph-backed acceleration layers

Reason:
- Each of these adds product scope or operational cost without first improving the trustworthiness of the current user journey.

---

## 7. Review Checklist Per PR

Every PR under this action plan should answer:

1. Which phase does this PR belong to?
2. What truth source backs every new metric shown?
3. Did this PR add or modify any write flow? If yes, does it use the standard stepper?
4. Did this PR touch shared UI? If yes, were stories updated?
5. Did this PR change page behavior enough to require page-spec updates?
6. Which verification commands were run?

---

## 8. Suggested Order of Implementation

Recommended merge order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7

Recommended rationale:
- fix governance first
- replace fake homepage data early
- close bets and tx audit loop before adding broader product polish
- standardize all write flows before expanding route complexity
