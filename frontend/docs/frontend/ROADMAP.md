# ROADMAP — SSOT Frontend v2

This roadmap is intentionally written like a release plan with explicit gates (similar to contract release gates).

Companion execution document:
- `docs/frontend/ACTION-PLAN-UI-PRODUCTIZATION.md`
- `docs/frontend/FRONTEND-ROUTE-REVIEW-2026-03.md`
- `docs/frontend/BRAND-STARTER-PACK-2026-03.md`
- `docs/frontend/MESSAGING-COPY-PACK-2026-03.md`
- `docs/frontend/LOGO-CONCEPT-SHEET-2026-03.md`
- `docs/frontend/LANDING-COPY-DRAFT-2026-03.md`
- `docs/frontend/BETSWIRL-GAP-ANALYSIS-2026-03.md`
- `docs/frontend/UI-UX-DESIGN-BRIEF-2026-03.md`
- `docs/frontend/UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `docs/frontend/UI-UX-DIRECTION-BOARD-2026-03.md`
- `docs/frontend/UI-UX-WIREFRAME-PACK-2026-03.md`
- `docs/frontend/UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `docs/frontend/PROTOTYPE-FREEZE-CHECKLIST-2026-03.md`
- `docs/frontend/PROTOTYPE-FREEZE-REVIEW-2026-03.md`
- `docs/frontend/PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
- `docs/frontend/SCREEN-SPECS/README.md`

## Gate-0 — Interface Freeze (Docs)
**Goal**: Freeze public interfaces before feature coding.

**Deliverables**
- PRD accepted
- ADRs accepted
- UI Constitution accepted
- Page specs for all v2 routes
- SDK public TypeScript signatures drafted and frozen (even if implementations are TBD)
- Lint/CI gates defined (boundary rules + storybook requirement)

**Exit Criteria**
- No open “unknowns” in the following: release schema, SDK public API surface, page specs, tx pipeline UX.

---

## Milestone A — Greenfield Repo + Governance
**Goal**: Create the clean monorepo with doc governance, UI kit, and release identity.

**Deliverables**
- Monorepo: `apps/web`, `packages/ui`, `packages/ssot`
- Storybook configured for `packages/ui`
- Design tokens + base shadcn components present in `packages/ui`
- Release loader + read-only mode banner in `apps/web`
- Header release badge showing `releaseDigest[:8]`
- Dependency governance baseline (ADR-017):
  - Toolchain pinning (`.node-version`, `packageManager`, `engines`)
  - Workspace-level overrides for platform packages (initially Storybook)
  - Documented upgrade discipline (scheduled upgrade window + verification checklist)

**Exit Criteria**
- `pnpm dev` starts web
- `pnpm storybook` starts storybook
- Read-only mode activates when release is placeholder/invalid

---

## Milestone B — SSOT SDK v0 + Tx Pipeline
**Goal**: Implement the protocol SDK as the only contract touch surface.

**Deliverables**
- `packages/ssot/release`: zod schema + loader + embedded snapshot strategy
- `packages/ssot/sdk`: hub/bank/vrfHub/registry surfaces
- `packages/ssot/sdk/txPipeline`: simulate → stepper → receipt → journal
- `packages/ssot/sdk/errors`: custom errors decoded to DomainError
- `packages/ssot/encoding`: game params + stakeSpec canonical encoding
- Unit tests for encoding + error decoding

**Exit Criteria**
- A single place to call `planPlaceBet()` and `executePlan()`
- All writes are preflight-simulated
- Journal records include release digest

---

## Gate-B — Pre-Indexer Architecture Review
**Goal**: Ensure the protocol layer is correct and stable before introducing a local indexer + persistence.

**Exit Criteria**
- Release bundle is the only truth (no placeholders/compat shims)
- SDK uses release ABIs (no handwritten hub/bank/vrf ABIs)
- Approve semantics are correct (approve sets allowance; no delta)
- Golden vectors exact-hex tests pass in CI (`STRICT_VECTORS=1`)
- Multi-chain/multi-asset readiness verified

---

## Milestone C — Local Indexer v0 (Events as Facts)
**Goal**: Bet history and state machine derived from Hub events with replay.

**Deliverables**
- `packages/ssot/indexer`: getLogs incremental sync + cursor + confirmations + reorg rollback
- IndexedDB store (Dexie): hubEvents, bets, cursor, txJournal
- Reconcile helper to cross-check with `hub.getBet()` (optional)

**Exit Criteria**
- Refreshing the page resumes from cursor
- A bet’s state converges to chain truth via events

### Milestone C+ — Indexer Workerization & Ops Visualization
**Goal**: Keep the main thread responsive under heavy log scans; provide institutional-grade lag/confirmations visibility.

**Deliverables**
- Move indexer execution to a Web Worker (ADR-013)
- Ops page shows: confirmations, safeHeadBlock, lagBlocks, reorg rewind window
- Runtime wiring: worker commands (start/stop/syncOnce/status)

**Exit Criteria**
- UI remains responsive during large sync ranges
- Ops shows stable lag metrics and configuration values

---

## Milestone D — Feature End-to-End
**Goal**: Deliver core product flows on Base Sepolia (84532).

Milestone D is executed as a sequence of gated sub-milestones (D0–D6). Each sub-milestone is a **full-repo delivery**.

### D0 — Docs Gate (Stepper Spec)
**Goal**: Freeze the institutional UX and contracts for BetPanel/LP stepper.

**Deliverables**
- SPEC additions: BetPanel stepper contract, reconcile contract, allowance policy, forms/units validation
- ADRs: 022–025
- Page specs updated: Games, Bets, Liquidity, Claims, Referral, Account

**Exit Criteria**
- No open unknowns in: stepper states, reconcile algorithm, approval policy, validation rules

### D1 — System Stepper Framework (BetPanel Shell)
**Goal**: Build the reusable stepper machine + UI shell (no game-specific forms yet).

**Deliverables**
- `BetPanelShell` + `TxStepper` + `PlanPreview` system components
- Pure state machine tests
- Storybook stories for all stepper states

**Exit Criteria**
- A generic plan → stepper → execute flow works against SDK

### D2 — Game Forms (Dice/CoinToss/Roulette/Keno)
**Goal**: Connect 4 game param forms to the shared BetPanel shell.

**Deliverables**
- Page spec hardening: per-game params/validation/defaults + stakeSpec inputs spec (docs-first)
- 4 params forms with validation + stories
- Routes `/games/*` wired via release `gamesMeta`

**Exit Criteria**
- All games can produce a PlaceBetPlan and execute it

### D3 — Reconcile (tx → betId) + Bet Detail
**Doc**: `docs/frontend/MILESTONE-D3.md` (DoD + checklist)

**Goal**: Close the facts loop: executed tx reliably maps to betId and detail view.

**Deliverables**
- Reconcile implementation (receipt logs → facts store → fallback window)
- `/bets/[betId]` detail page supports params decode and actions

**Exit Criteria**
- Post-bet flow lands on bet detail with event-driven state

### D4 — Liquidity (per-asset Bank)
**Goal**: Ship LP page with SSOT metrics and deposit/redeem stepper.

**Deliverables**
- Snapshot cards (NAV/Reserved/Free/MinLiq/PF/XP)
- Deposit/Redeem stepper flows

**Exit Criteria**
- Deposit/redeem are auditable (journal) and consistent with SPEC

### D5 — Referral
**Goal**: Bind referrer and surface affiliate info.

**Deliverables**
- `/referral` bind stepper + current referrer view
- Optional affiliate input on BetPanel

**Exit Criteria**
- Referral flows are consistent and do not break non-ref users

### D6 — Account + Bets List Completion
**Goal**: Close the user-facing audit loop.

**Deliverables**
- `/account`: balances/allowances/refundCredit/txJournal
- `/bets`: filters and action availability

**Exit Criteria**
- Meets all Functional DoD in PRD

---

## Milestone E — Institutional Hardening
**Goal**: Make the repo “hard to misuse”.

**Deliverables**
- `ssot:sync` script (sync ABIs + embed release snapshot)
- CI gates: digest/ABI guard, typecheck, lint, test, build
- Dependency hardening (ADR-017):
  - Pin platform dependency versions (Next/React, wagmi/viem, Storybook, Tailwind/PostCSS, TS/ESLint)
  - Enforce lockfile in CI (`--frozen-lockfile` only)
  - `pnpm audit` policy + triage workflow for advisories
  - Optional: enable Renovate/Dependabot in “PR-only, no automerge” mode
  - Quarterly platform upgrade playbook (Next/wagmi/viem/Storybook)
- Visual regression baseline (optional)
- Remove all legacy code paths

**Exit Criteria**
- Changing release without syncing ABIs fails CI
- UI cannot import protocol internals (lint enforced)
