# Frontend Implementation Audit & Roadmap

| Owner | Frontend Lead |
| Status | Draft v3 |
| Last Updated | 2026-05-17 |
| Depends on | `00-charter.md`, `01-brand.md`, `02-voice-and-copy.md`, `03-information-architecture.md`, `04-page-blueprints.md`, `10-design-tokens.md`, `11-component-library.md`, `12-motion.md`, `13-web3-ux.md`, `14-data-and-state.md`, `15-forms.md`, `16-mobile.md`, `../frontend/20-accessibility.md`, `../frontend/21-i18n.md`, `../frontend/22-performance.md`, `../frontend/23-security.md`, `../frontend/24-testing.md`, `../frontend/25-observability.md`, `../frontend/30-build-and-release.md`, `../frontend/31-governance.md`, `../frontend/32-ai-pairing.md`, `frontend-rewrite-blueprint.md`, `frontend-kill-list.md`, ADR-0001, ADR-0002, ADR-0003 |
| Supersedes | ad-hoc chat-only frontend rewrite sequencing |

This document is the working implementation roadmap for the current
`codex/frontend-bundle-closeout` branch. It exists because implementation
started before Gate A/B/C were formally closed. The goal is to bring the branch
back under the SSOT process without throwing away useful work already landed.

This file does not replace `frontend-rewrite-blueprint.md`; it translates that
blueprint into an evidence-backed execution plan for the current repository
state.

## 1. Executive Conclusion

The correct strategy is still a clean-room frontend rewrite, and the branch has
now moved from broad implementation into a **closeout audit** state:

- canonical route groups, product routes, app shell, token folders, primitives,
  patterns, motion, and icons are present;
- old production route aliases and prototype routes have been physically
  removed rather than kept as compatibility wrappers;
- the v1.3 frontend SDK has been rewritten around GameHub / SportsHub /
  PoolRegistry / Bank without the old Hub / BankRegistry public surface;
- sportsbook is correctly read-only and now exposes SDK-backed SportsHub
  counters plus market / ticket / result lookup;
- the remaining work is no longer page-by-page polishing. It is gate accounting,
  release-shape residue cleanup, quality guard closure, and then a deliberate
  choice between PR closeout or sportsbook MVP expansion.

Therefore the next implementation wave must stop adding new product behavior
until the closeout surface is clean. The center of gravity is now:

1. current roadmap accuracy and Gate A/B/C accounting;
2. removal of release-shape compatibility residue such as `sports.hub`;
3. guard coverage for scripts, fixtures, and JSON, not only app source;
4. final local verification and clean local commit;
5. decide whether to push/open PR for the clean-room phase or continue into
   sportsbook MVP.

## 2. Source Documents Read

This roadmap is based on the full active frontend SSOT set:

- Layer 0: `00-charter.md`
- Layer 1: `01-brand.md`, `02-voice-and-copy.md`,
  `03-information-architecture.md`, `04-page-blueprints.md`
- Layer 2: `10-design-tokens.md`, `11-component-library.md`,
  `12-motion.md`, `13-web3-ux.md`, `14-data-and-state.md`,
  `15-forms.md`, `16-mobile.md`
- Layer 3: `../frontend/20-accessibility.md` through
  `../frontend/25-observability.md`
- Layer 4: `../frontend/30-build-and-release.md` through
  `../frontend/32-ai-pairing.md`
- Companion execution docs:
  `frontend-rewrite-blueprint.md`, `frontend-kill-list.md`,
  `north-star.md`, `../frontend/README.md`, `frontend/CLAUDE.md`
- Accepted ADRs: ADR-0001, ADR-0002, ADR-0003

## 3. Current Evidence Snapshot

Snapshot command set, refreshed on 2026-05-17:

```bash
git status --short --branch
rg -l "\| Status \| Draft" docs/design docs/frontend | wc -l
rg -l "\| Status \| Accepted" docs/design docs/frontend | wc -l
test -d frontend/apps/web/src/app/prototype && echo yes || echo no
test -d frontend/apps/web/src/sandbox && echo yes || echo no
find frontend/apps/web/src/app -maxdepth 1 -type d -name '(*' | wc -l
test -d frontend/apps/web/src/app-shell && echo yes || echo no
test -d frontend/packages/ui/src/primitives && echo yes || echo no
test -d frontend/packages/ui/src/patterns && echo yes || echo no
test -d frontend/packages/ui/src/motion && echo yes || echo no
rg -n -e "bg-\[#|text-\[#|border-\[#|shadow-\[|rounded-(2xl|3xl|\[)|transition-all|\bdark:" \
  frontend/apps/web/src frontend/packages/ui/src -S | wc -l
rg -l -e "bg-\[#|text-\[#|border-\[#|shadow-\[|rounded-(2xl|3xl|\[)|transition-all|\bdark:" \
  frontend/apps/web/src frontend/packages/ui/src -S | wc -l
find frontend/apps/web/src/app -name 'pageClient.tsx' -print0 \
  | xargs -0 wc -l | awk '$2 != "total" && $1 > 600 {print $0}'
```

Observed baseline:

| Check                                                          | Current                        |
| -------------------------------------------------------------- | ------------------------------ |
| Working tree                                                   | clean                          |
| Draft SSOT documents                                           | 29                             |
| Accepted documents                                             | 3, all ADRs                    |
| `app/prototype` directory                                      | absent                         |
| `apps/web/sandbox` directory                                   | absent; prototypes deleted     |
| app route groups `(...)`                                       | 3                              |
| `apps/web/src/app-shell`                                       | present                        |
| `packages/ui/src/primitives`                                   | present                        |
| `packages/ui/src/patterns`                                     | present                        |
| `packages/ui/src/motion`                                       | present                        |
| forbidden token/radius/shadow/transition/dark lines            | 0                              |
| files with forbidden token/radius/shadow/transition/dark lines | 0                              |
| `pageClient.tsx` files over 600 LOC                            | 0                              |
| largest `pageClient.tsx`                                       | activity detail, 408 LOC       |
| sportsbook SDK-backed lookup                                   | present                        |
| release smoke against Base Sepolia                             | passing                        |
| casino result overlay                                          | chain-derived, no simulation   |
| casino keeper health                                           | health snapshot + `/ops` panel |

Interpretation:

- The old 2,030-line game god component problem is closed.
- The original prototype route pollution is closed for production routes.
- The target route groups and UI package skeleton are now present.
- Prototype artifacts were deleted instead of moved to sandbox; the production
  App Router has no prototype surface.
- Strict local guardrails cover style, shell, prototype route, legacy route,
  placeholder, page size, web3 import boundary, and legacy SDK compatibility.
- The remaining risk is not visible-page architecture; release-shape residue is
  closed. The formal residual risk is incomplete Gate A/B/C acceptance and the
  quality checks that are intentionally deferred to CI hardening.

## 4. SSOT Gate Status

### Gate A - Identity

Required by `docs/design/README.md`:

- `00-charter`, `01-brand`, `02-voice-and-copy`,
  `03-information-architecture`, `04-page-blueprints` all `Accepted`.
- one approved hi-fi concept per primary route, desktop and mobile.
- written ADR record for Layer-1 decisions.

Current:

- all five documents are still `Draft v1`;
- no repository-visible concept package is linked from the docs;
- ADR-0001/0002/0003 are accepted, but they mostly govern cleanup, not the
  full Layer-1 acceptance package.

Status: **not closed**.

Action:

- Do not mark documents `Accepted` mechanically.
- Keep implementation on this branch as transitional work until the user/team
  explicitly approves Gate A.
- Use this roadmap as the active implementation guide while docs remain Draft.

### Gate B - System

Required:

- Layer 2 docs `Accepted`;
- `@ssot/ui` rebuilt: tokens, primitives, patterns, motion, icons;
- Storybook coverage = 100% primitives, >= 80% patterns;
- visual baseline exists.

Current:

- Layer 2 documents are Draft;
- token files exist under `frontend/packages/ui/src/tokens`;
- target folders `primitives`, `patterns`, `motion`, `icons`, and `utils` exist;
- `components/ui` and `components/protocol` still contain implementations, but
  target barrel boundaries exist and strict precheck is green;
- forbidden style scan returns 0 lines.

Status: **functionally close, formally not closed**.

Action:

- Do not call Gate B closed until Layer 2 docs are accepted and Storybook /
  visual baseline expectations are reconciled.
- Engineering can continue only on closeout guardrails or explicitly scoped
  sportsbook MVP work.

### Gate C - Quality

Required:

- Layer 3 and Layer 4 docs `Accepted`;
- CI checks for type, unit, component, visual, a11y, performance, e2e;
- Sentry/RUM/analytics wired with release tags.

Current:

- Layer 3/4 documents are Draft;
- `precheck:frontend -- --strict` passes;
- `check:release` passes;
- `smoke:release-readonly` passes against Base Sepolia;
- focused sportsbook lookup tests pass;
- `typecheck` and production `build` pass in the latest local baseline;
- Storybook coverage, axe page suite, Lighthouse CI, bundle budgets, and
  observability release tagging remain not fully closed.

Status: **not closed**.

Action:

- Implement guardrails gradually at phase boundaries; do not wait until the end
  to add all CI checks.

## 5. What Already Counts As Useful Work

These changes should be retained and migrated, not discarded:

1. `@ssot/ui/src/tokens/arbi-dark.css` and `arbi-light.css` exist.
2. `visual-system.ts`, old `themes/*`, and `cyber-*` files appear removed.
3. `app/prototype` is absent.
4. Canonical routes live under `app/(marketing)`, `app/(product)`, and
   `app/(legal)`.
5. Casino room has been decomposed under `features/casino/room`.
6. Portfolio, earn, ops, legal, marketing, and sportsbook have vertical feature
   folders.
7. Sportsbook has SDK-backed runtime counters and read-only market / ticket /
   result lookup.
8. Release checking and read-only chain smoke exist and pass locally.
9. Strict precheck is blocking and currently green.

The mistake would be to continue extending these as final architecture. Treat
them as transition assets that will be moved into the target structure.

## 6. Strategic Correction

The implementation should shift from:

```text
old route surface -> local component tokenization -> local test -> commit
```

to:

```text
SSOT phase -> system boundary -> target folder -> route migration -> deletion
evidence -> CI guard -> commit
```

This means small commits are still fine, but every commit must be phase-bound:

- no random token sweep without knowing which phase it closes;
- no page rewrite unless the route target is known;
- no duplicate shell added for convenience;
- no old component kept solely for compatibility;
- no deletion without `rg` evidence.

## 6.1 Receipt Proof Closeout - 2026-05-16

### Evidence

The Base Sepolia GameHub canary proved that `GameHub.finalize(positionId)`
settles correctly and, after the VRF duplicate-detach fix, no longer produces a
best-effort internal `VRFHub.detach` revert. The remaining user-facing issue is
in the frontend receipt surface, not in settlement:

- `getBet(positionId)` exposes v1.3 GameHub proof fields such as `requestId`,
  `randomHash`, `vrfFeePaid`, `vrfFeeCharged`, `vrfRequestedAt`, and
  `resolvedAt`, but the frontend SDK maps only the old minimal subset.
- The activity detail page formats `vrfFeePaid` with the bet asset decimals and
  symbol. This is wrong because VRF fees are native-token wei, not USDC units.
- GameHub v1.3 lifecycle events index the identifier as `positionId`, while the
  detail timeline filter only matches `betId` or `id`.
- Settlement economics such as `payoutNet` live in `BetFinalized` events and
  are not stored directly in the GameHub bet struct.

### Scope

This closeout is intentionally narrow. It does not add new casino games, change
the wallet flow, or alter indexer storage. It only makes the receipt page show
the canonical facts that already exist on-chain or in the indexed event log.

### Implementation Plan

1. Extend `DomainBet` and `sdk.gameHub.getBet()` to map the v1.3 GameHub bet
   struct fields required by receipt proof display.
2. Update activity timeline matching to accept `positionId` as the canonical
   GameHub v1.3 identifier.
3. Add a native-token formatter for VRF fees and use it for `vrfFeePaid` and
   `vrfFeeCharged`.
4. Extract settlement proof from the latest `BetFinalized` event when present,
   then use `payoutNet` / `refundAmount` for receipt facts and net-result
   metrics.
5. Add unit coverage proving that `positionId` events render in the timeline
   and that finalized receipts show ETH-denominated VRF fees plus request /
   random proof fields.
6. Validate with typecheck, focused tests, full frontend tests, and browser
   smoke on a local activity detail route.

### Acceptance Checks

```bash
pnpm -C frontend/apps/web test -- 'src/app/(product)/portfolio/activity/[betId]/pageClient.test.tsx'
pnpm -C frontend/packages/ssot typecheck
pnpm -C frontend typecheck
pnpm -C frontend test
```

Rendered validation target:

```text
/portfolio/activity/<positionId> -> receipt dossier -> lifecycle events,
native VRF fee display, requestId, randomHash, and settled timestamp are visible.
```

### Implementation Result

Completed in this wave:

- `sdk.gameHub.getBet()` now maps the v1.3 GameHub receipt proof fields.
- Activity detail timeline matching accepts canonical `positionId` event args.
- VRF fee facts display as native ETH, while stake / payout / protocol fee stay
  in the bet asset.
- Settlement facts are derived from the latest indexed `BetFinalized` event.
- Copy failures are handled inline instead of throwing browser console errors.

## 6.2 Casino Round Result Proof Closeout - 2026-05-17

### Evidence

The live round UX already follows the keeper-oriented path:

- the player signs approval only when needed;
- the player signs `placeBet`;
- the UI polls `sdk.gameHub.getBet(positionId)` during the active round;
- keeper / relayer settlement moves the bet into `Settled` or `Refunded`;
- the frontend receives a terminal `DomainBet` without requiring the player to
  sign `finalize`.

The remaining closeout gap was the result overlay. The old overlay used local
simulation and expected-payout display semantics after reconciliation. That is
not acceptable for a provably-fair casino surface because it can show a result
before the indexed `BetFinalized` / `BetRefunded` proof is available.

### Scope

This closeout is intentionally narrow:

1. remove local fake result simulation from the live round terminal path;
2. construct the result modal from chain-derived `DomainBet` terminal fields;
3. enrich the modal from indexed `BetFinalized` / `BetRefunded` event facts;
4. keep indexer-lag UX explicit with `Settlement confirmed. Indexing payout
   proof`;
5. delete now-unused casino simulation helpers and tests.

It does not decode per-game visual outcome numbers from `randomHash`. That is a
separate enhancement and must not be faked.

### Acceptance Checks

```bash
rg -n "simulateGameResult|Verification Success|DIRECT PREDICTION HIT|claim winnings|totalPayout|readFinalizedPayoutWin|parseFinalizedPayoutWin" \
  frontend/apps/web/src/features/casino frontend/apps/web/src/app/'(product)'/casino -g '*.ts' -g '*.tsx'
pnpm -C frontend/apps/web test -- reconciliation resolution right-pane 'src/app/(product)/casino/[slug]/pageClient.test.tsx'
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend/apps/web build
```

### Implementation Result

Completed in this wave:

- `GameRoomResultOverlay` now renders only chain-derived facts: bet id, request
  id, random hash, net payout or refund, net result, and settlement explorer
  link.
- `useGameResolutionEffect` now responds to a terminal `DomainBet` and enriches
  the modal from indexed `BetFinalized` / `BetRefunded` rows.
- `reconciliation.ts` now extracts terminal proof by canonical `positionId`.
- The old local casino simulation module and its tests were deleted.
- The forbidden-result scan returns zero matches.

## 6.3 Casino Keeper Health Closeout - 2026-05-17

### Evidence

The keeper can already enqueue from `GameHub.BetRandomReady`, enqueue from
`VRFHub.Fulfilled`, scan missed events, simulate `finalize`, write
`finalize`, and verify terminal state. The remaining production gap is
operator visibility:

- keeper health exists only as stdout structured logs;
- `/ops` exposes indexer worker health, but not casino keeper health;
- no durable `lastFinalizeSuccessAt`, `lastFinalizeFailureAt`, queue depth, or
  last scanned block snapshot exists for operators.

### Scope

1. Add an optional keeper health snapshot writer controlled by
   `KEEPER_HEALTH_PATH`.
2. Update the snapshot after startup, enqueue, scan, finalize success/failure,
   and heartbeat events.
3. Add a frontend `/ops` reader for `/ops/casino-keeper-health.json`.
4. Render missing, stale, healthy, and degraded keeper states explicitly.
5. Add unit coverage for both the keeper health writer and `/ops` rendering.

### Acceptance Checks

```bash
pnpm -C frontend/apps/keeper test -- health runtime
pnpm -C frontend/apps/web test -- 'src/app/(product)/ops/pageClient.test.tsx'
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend/apps/web build
```

## 6.4 Casino Round Timeout And Refund Fallback Closeout - 2026-05-17

### Evidence

The casino room already quotes VRF fees on page load, executes the approve /
placeBet plan from one player click, polls `sdk.gameHub.getBet(positionId)`, and
defers normal settlement to the keeper. The remaining UX gap is the fallback
ladder after a live round is mined:

- `PendingVRF` currently remains visually indistinguishable before and after the
  soft timeout threshold;
- the protocol refund timeout is documented but not surfaced as an explicit
  `Refund stake` control;
- result waiting copy is still partly driven by the old stepper labels rather
  than the round state machine.

### Scope

1. Extend `deriveCasinoRoundPhase` with `timeout_soft` and protocol refund
   timeout handling.
2. Keep polling active through `timeout_soft`.
3. Expose `Refund stake` only after `placedAt + refundTimeoutSeconds`.
4. Wire manual refund through `sdk.gameHub.refund(betId)` behind an explicit
   click.
5. Adjust CTA copy to describe the current user action, not the old ticket
   planning phase.
6. Add focused tests for soft timeout, refund fallback, and button copy.

### Acceptance Checks

```bash
pnpm -C frontend/apps/web test -- src/features/casino/room
pnpm -C frontend/apps/web typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web build
git diff --check
```

### Implementation Result

Completed in this wave:

- added `timeout_soft` to the casino round state machine;
- derived refund availability from direct chain `getBet` facts and
  `refundTimeoutSeconds`;
- preserved live polling through the soft-timeout state;
- exposed `Refund stake` only as an explicit delayed fallback;
- switched the soft-timeout toast to the state-machine phase instead of an
  unused local pending flag;
- locked the bet controls while a round is being placed, mined, or watched;
- removed old ticket-oriented CTA copy from the casino room;
- carried `refundTimeoutSeconds` through the frontend release schema and
  embedded Base Sepolia release snapshot.

Evidence:

```bash
pnpm -C frontend/apps/web test -- src/features/casino/room
pnpm -C frontend/packages/ssot test -- src/release/loader.test.ts
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/packages/ssot typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend/apps/web test -- 'src/app/(product)/casino/[slug]/pageClient.test.tsx'
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
pnpm -C frontend check:bundle
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend lint
CI=true PLAYWRIGHT_BASE_URL=http://localhost:3007 pnpm -C frontend/apps/web e2e
git diff --check
```

Observed:

- casino room focused tests passed: 15 files, 53 tests;
- app tests passed: 38 files, 143 tests;
- full frontend tests passed: keeper 16 tests, ssot 137 tests, ui 23 tests,
  web 143 tests;
- production build passed and the bundle budget stayed green:
  `/casino/[slug]` 177.5 kB gzip JS against a 195 kB budget;
- Playwright route + accessibility smoke passed: 14 tests;
- known local warnings remain unchanged: Node v22 vs project Node 20,
  deprecated `next lint`, existing Next ESLint plugin warning, and the
  Next/ESM warning during production build.

## 6.5 Casino Round Hook Ownership Closeout - 2026-05-17

### Evidence

After 6.4, the behavior is correct, but the route composer still wires several
round concerns directly:

- `usePlaceBetStepper`;
- `useCasinoVrfQuote`;
- `useCasinoRoundWatcher`;
- `useBetStepperFailureToast`;
- `useVrfTimeoutToast`;
- `executeGamePlaceBetAction`.

That is too much round orchestration inside
`app/(product)/casino/[slug]/pageClient.tsx` and leaves the implementation
slightly behind `casino-placebet-ux.md §6`, which says the casino room owns one
hook: `useCasinoRound`.

### Scope

1. Add `features/casino/room/use-casino-round.ts`.
2. Move the round composition into that hook without changing SDK calls.
3. Keep game-specific params and visual state in `pageClient.tsx`.
4. Keep the existing stepper reducer unchanged in this slice.
5. Preserve all 6.4 timeout/refund behavior.

### Acceptance Checks

```bash
pnpm -C frontend/apps/web test -- 'src/app/(product)/casino/[slug]/pageClient.test.tsx' src/features/casino/room
pnpm -C frontend/apps/web typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web build
git diff --check
```

### Implementation Result

Completed in this wave:

- added `features/casino/room/use-casino-round.ts`;
- moved stepper execution, VRF quote, round watcher, timeout toast, and fallback
  settlement/refund controls behind `useCasinoRound`;
- kept game parameter state, visual stage state, and result-proof enrichment in
  the route composer;
- preserved the 6.4 timeout and refund behavior;
- kept manual finalize calls explicitly named as manual fallback paths for grep
  enforcement.

Evidence:

```bash
pnpm -C frontend/apps/web test -- 'src/app/(product)/casino/[slug]/pageClient.test.tsx' src/features/casino/room
pnpm -C frontend/apps/web test -- 'src/app/(product)/portfolio/activity/[betId]/pageClient.test.tsx' src/features/casino/room/casino-round.test.ts
pnpm -C frontend/apps/web typecheck
rg -n "finalize\\(" frontend/apps/web/src/features/casino 'frontend/apps/web/src/app/(product)/casino' 'frontend/apps/web/src/app/(product)/portfolio' -S | rg -v "manual|keeper|test"
git diff --check
```

Observed:

- casino route + room tests passed: 16 files, 58 tests;
- portfolio manual fallback and casino round tests passed: 2 files, 8 tests;
- web typecheck passed;
- forbidden non-manual frontend `finalize(` scan returned 0 findings.

## 7. Current Closeout Roadmap

This section supersedes the historical phase ledger below for the current
branch. Use it for new commits.

### C0 - Roadmap Refresh

Goal: make the branch plan match repository reality.

Exit criteria:

```bash
git status --short --branch
pnpm -C frontend precheck:frontend -- --strict
```

### C1 - Release Compatibility Residue Closeout

Goal: remove the last frontend release-shape compatibility residue.

Tasks:

1. Remove `sports.hub` fallback from `scripts/ssot-sync.mjs`.
2. Convert v1.3 fixtures to `sports.sportsHub`.
3. Keep negative tests for legacy release shapes, but do not keep legacy keys
   as normal runtime input paths.
4. Extend `frontend-precheck` to scan scripts, fixtures, and JSON release
   artifacts.

Exit criteria:

```bash
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
rg -n '"hub"\s*:|bankRegistry|SSOTHubAPI|sdk\.hub|contracts\.hub|release\.contracts\.hub|sports\.hub|s\.hub' \
  frontend/packages/ssot/src frontend/apps/web/src frontend/scripts -S
```

Only `scripts/frontend-precheck.mjs` may contain the literal forbidden-regex
definition.

Implementation result on 2026-05-17:

- `precheck:frontend -- --strict` passes.
- `check:release` passes.
- `smoke:release-readonly` passes on Base Sepolia.
- The legacy compatibility scan returns only the intentional
  `frontend-precheck.mjs` regex definition.

### C2 - Full Local Verification

Goal: prove the clean-room phase is locally coherent.

Run:

```bash
pnpm -C frontend/apps/web exec vitest run 'src/app/(product)/sportsbook/pageClient.test.tsx'
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
pnpm -C frontend typecheck
pnpm -C frontend build
```

Expected caveats:

- Node warning is expected while local Node is v22 and project asks for v20.
- Next ESLint plugin warning is pre-existing and should be handled separately
  before public launch.

Implementation result on 2026-05-17:

```bash
pnpm -C frontend/apps/web exec vitest run 'src/app/(product)/sportsbook/pageClient.test.tsx'
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend/apps/web build
```

All commands passed. The read-only smoke validated Base Sepolia chain `84532`,
the embedded `v1.3` release, `GameHub`, `SportsHub`, `VRFHub`, all eight casino
module mappings, Casino pool `1`, Sports pool `2`, and SportsRiskEngine pool
hash. Production build remains within the current post-optimization envelope:
`/casino/[slug]` first load `181 kB`, `/sportsbook` first load `159 kB`, `/ops`
first load `127 kB`.

### C3 - Clean-Room PR Decision

After C0-C2 are committed locally, choose one:

- push/open PR for the clean-room frontend phase; or
- continue locally into sportsbook MVP phase.

Do not start sportsbook ticket placement work until C1 is closed.

### C4 - Sportsbook MVP Phase

Only after C1-C2:

1. market list from provider-backed signed snapshots;
2. market detail route;
3. operator market creation/result write surfaces;
4. ticket placement behind explicit env and release gates;
5. settlement/readback path;
6. challenge/void/admin ops surfaces.

### C5 - Sportsbook Frontend Env Purity

The C4 MVP surface exists, but the frontend-owned odds signing route still
accepted historical canary aliases for the signer private key. That is a
compatibility path, not a production frontend contract.

Scope:

1. Require `SPORTS_ODDS_SIGNER_PRIVATE_KEY` in
   `POST /api/sportsbook/odds-snapshot`.
2. Remove `FOOTBALL_ODDS_SIGNER_PRIVATE_KEY` and
   `CANARY_ODDS_SIGNER_PRIVATE_KEY` from frontend docs and tests.
3. Keep canary script aliases out of scope; they are ops rehearsal inputs, not
   browser/API runtime configuration.

Exit criteria:

```bash
pnpm -C frontend/apps/web test -- src/app/api/sportsbook/odds-snapshot/route.test.ts
pnpm -C frontend/apps/web typecheck
rg -n "FOOTBALL_ODDS_SIGNER_PRIVATE_KEY|CANARY_ODDS_SIGNER_PRIVATE_KEY" \
  frontend/apps/web/src frontend/apps/web/.env.example docs/frontend -S
```

Implementation result:

- `POST /api/sportsbook/odds-snapshot` now fails closed unless
  `SPORTS_ODDS_SIGNER_PRIVATE_KEY` is present;
- frontend docs and route tests no longer mention canary signer aliases;
- removed the unused milestone-era `SDKStatusCard`;
- renamed stale product page client names and transition keys from old route
  labels to canonical `earn`, `portfolio`, and `portfolio-activity` names;
- renamed portfolio overview and activity-list feature components so the
  physical file layout matches the clean-room route model.

Evidence:

```bash
pnpm -C frontend/apps/web test -- src/app/api/sportsbook/odds-snapshot/route.test.ts
pnpm -C frontend/apps/web test -- src/components src/app-shell/AppShell.test.tsx
pnpm -C frontend/apps/web test -- src/app/\(product\)/portfolio/pageClient.test.tsx \
  src/app/\(product\)/portfolio/activity/pageClient.test.tsx \
  src/app/\(product\)/portfolio/activity/\[betId\]/pageClient.test.tsx \
  src/app/\(product\)/portfolio/claims/pageClient.test.tsx
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web build
git diff --check
```

Observed:

- web test suite passed: 38 files / 144 tests;
- strict frontend precheck passed with 0 findings;
- production build passed;
- post-cleanup source scan has no old page client names, transition keys,
  frontend canary signer aliases, milestone SDK card, or old portfolio feature
  file names;
- expected local warnings remain unchanged: Node v22 vs project Node 20 and
  the existing Next ESLint plugin warning.

## 8. Historical Execution Phases

The phase names below are retained as an implementation log and audit trail.
They map back to `frontend-rewrite-blueprint.md §6`, but the authoritative
next-work sequence for the current branch is the C0-C4 closeout roadmap above.

### R0 - Roadmap And Gate Accounting

Goal: make the implementation path explicit before more code changes.

Tasks:

- Add this roadmap.
- Link it from `docs/design/README.md` and `north-star.md`.
- Record the current evidence baseline.
- Keep all existing SSOT `Status: Draft` values unchanged.

Exit criteria:

- This document exists and is linked.
- `git status` is clean after local commit.

### R1 - Gate B Skeleton: UI Package Structure

Goal: make `@ssot/ui` match the target physical architecture before migrating
pages.

Tasks:

1. Create target folders:
   - `frontend/packages/ui/src/primitives`
   - `frontend/packages/ui/src/patterns`
   - `frontend/packages/ui/src/motion`
   - `frontend/packages/ui/src/icons`
   - `frontend/packages/ui/src/utils`
2. Move or wrap current generic components into `primitives`:
   - Button
   - Input
   - CopyButton
   - Badge / StatusBadge
   - Skeleton
   - Table base
   - Tabs
   - Toast
3. Move product-aware composites into `patterns`:
   - AppShell
   - PageHeader
   - StatBlock / StatStrip
   - LedgerTable
   - ReleaseProof
   - WalletGate
   - BetSlip
   - TxStatusChip / TxStepper
   - EmptyState / ErrorState
4. Add subpath exports per `11-component-library.md §2`.
5. Add `tokens/VERSION.md`.
6. Keep compatibility exports temporarily only from `@ssot/ui/src/index.ts`,
   not from duplicate component files.

Do not:

- retokenize every protocol component in this phase;
- touch `frontend/packages/ssot/**`;
- create new product routes.

Exit criteria:

```bash
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
```

### R2 - Guardrail Seed

Goal: install cheap automated checks before large migrations.

Tasks:

1. Add a local script for forbidden frontend patterns:
   - hex utility classes
   - arbitrary radius
   - inline shadow utilities
   - `transition-all`
   - `dark:` variant
   - old shell names
   - prototype route reintroduction
2. Add a script for pageClient LOC.
3. Add a script for forbidden wagmi/viem/RainbowKit import locations.
4. Wire them into an npm script such as `pnpm -C frontend precheck:frontend`.

Do not:

- make every target-state check blocking if the current branch still violates
  it. Start with `--report` mode, then flip groups to blocking as phases close.

Exit criteria:

```bash
pnpm -C frontend precheck:frontend -- --report
```

The report should show known violations, not crash.

### R3 - App Shell And Provider Islands

Goal: separate wallet/provider cost from marketing/legal and establish the one
shell rule.

Tasks:

1. Create `frontend/apps/web/src/app-shell/`.
2. Move provider logic from `app/providers` into:
   - `ProductProviders.tsx`
   - `WalletProviderIsland.tsx`
   - `QueryProvider.tsx`
   - `ThemeProvider.tsx`
3. Ensure root layout remains provider-light.
4. Build one `AppShell` pattern in `@ssot/ui/patterns`.
5. Replace current app-level shell usage with the pattern.

Do not:

- add a new `*Shell.tsx` under `apps/web/src/components`;
- keep multiple product shells in parallel.

Exit criteria:

```bash
rg -n -e "from ['\"]wagmi|from ['\"]viem|from ['\"]@rainbow" frontend/apps/web/src \
  | rg -v "app-shell/WalletProviderIsland|features/.*/data|features/.*/actions|@ssot/ui"
rg -n -e "SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher" frontend/apps/web/src
pnpm -C frontend/apps/web build
```

### R4 - Route Groups And Boundary Redirects

Goal: make the App Router match `03-information-architecture.md §3`.

Tasks:

1. Create route groups:
   - `app/(marketing)`
   - `app/(product)`
   - `app/(legal)`
2. Introduce canonical routes:
   - `/casino`
   - `/casino/[slug]`
   - `/portfolio`
   - `/portfolio/activity`
   - `/portfolio/claims`
   - `/earn`
   - `/legal/privacy`
   - `/legal/terms`
   - `/legal/disclaimer`
3. Leave old routes as redirect boundaries only:
   - `/dice`, `/cointoss`, `/roulette`, `/keno`
   - `/games` only if a temporary redirect is needed
   - `/account`, `/bets`, `/claims`, `/referral`
   - `/invest`, `/liquidity`
4. Create `apps/web/src/sandbox/` if any preserved prototype artifacts are
   still useful. Otherwise record that prototypes were deleted instead of
   moved.

Do not:

- keep legacy pageClient logic under old route names;
- introduce route groups without preserving working URLs via redirects.

Exit criteria:

```bash
test ! -d frontend/apps/web/src/app/prototype
find frontend/apps/web/src/app -maxdepth 2 -type d -name '(*'
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
```

### R5 - Casino Vertical Migration

Goal: convert the current useful `features/games` work into the target
`features/casino` vertical.

Tasks:

1. Create `features/casino`.
2. Move catalog and route mapping:
   - `features/games/catalog.ts` -> `features/casino/catalog`
   - `features/games/routes.ts` -> `features/casino/routes`
3. Move room files:
   - `features/games/room/*` -> `features/casino/room/*`
4. Create `features/casino/modules`.
5. Convert Dice, Coin Toss, Roulette, Keno into module registrations.
6. Retokenize the 7 old-style room files:
   - `coin-toss-stage.tsx`
   - `dice-cube-display.tsx`
   - `dice-range-control.tsx`
   - `history-widget.tsx`
   - `keno-stage.tsx`
   - `result-overlay.tsx`
   - `roulette-stage.tsx`
7. Ensure all casino routes render via `/casino/[slug]`.

Do not:

- add new games in this phase;
- change encoding or protocol calls;
- edit `frontend/packages/ssot/**`.

Exit criteria:

```bash
rg -l -e "bg-\[#|text-\[#|border-\[#|shadow-\[|rounded-(2xl|3xl|\[)|purple|emerald|amber|fuchsia|indigo|white/" \
  frontend/apps/web/src/features/casino/room -S
find frontend/apps/web/src/app -name 'pageClient.tsx' -print0 \
  | xargs -0 wc -l | awk '$2 != "total" && $1 > 600 {print $0}'
pnpm -C frontend/apps/web test -- src/features/casino
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
```

Rendered QA:

- `/casino/dice`
- `/casino/coin-toss`
- `/casino/roulette`
- `/casino/keno`
- desktop plus 390px mobile
- no framework overlay, no horizontal overflow, primary controls interact

### R6 - Portfolio And Earn Route Convergence

Goal: remove the legacy dashboard route fragmentation.

Tasks:

1. Create `features/portfolio`.
2. Move/adapt:
   - `features/account`
   - `features/bets`
   - `features/bet-detail`
   - `features/claims`
   - `features/referral`
3. Create canonical routes:
   - `/portfolio`
   - `/portfolio/activity`
   - `/portfolio/claims`
4. Create `features/earn`.
5. Keep `/earn` as canonical LP route.
6. Replace `/account`, `/bets`, `/claims`, `/referral`, `/invest`,
   `/liquidity` with redirect boundaries.

Do not:

- keep old pageClient files for compatibility;
- merge route migration with new LP protocol behavior.

Exit criteria:

```bash
rg -n -e "features/account|features/bets|features/claims|features/referral" frontend/apps/web/src/app
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
```

### R7 - Sportsbook Readiness Surface

Goal: keep sportsbook aligned with provider-readiness and ops gating.

Tasks:

1. Keep `/sportsbook` read-only unless both gates are true:
   - `NEXT_PUBLIC_SPORTSBOOK_ENABLED=true`
   - release metadata exposes enabled SportsHub metadata
2. Do not expose public ticket placement until the required ops memo and
   go/no-go packet exist.
3. Move sportsbook code into `features/sportsbook`.
4. Add market detail route only as read/detail surface until placement is
   approved.

Do not:

- treat sports as casino-style pure RNG;
- invent odds rules locally;
- bypass the signed odds / oracle path.

Exit criteria:

```bash
pnpm -C frontend/apps/web test -- src/app/sportsbook src/features/sportsbook
pnpm -C frontend/apps/web build
```

### R8 - Final Deletion And Blocking CI

Goal: end the transitional state.

Tasks:

1. Delete old route components after canonical routes are active.
2. Delete or migrate old `packages/ui/src/components/protocol` files.
3. Remove stale app components listed in `frontend-kill-list.md §7`.
4. Flip precheck scripts from report mode to blocking mode.
5. Add final Storybook coverage checks.
6. Add Lighthouse, axe, and bundle-budget gates.

Exit criteria:

```bash
rg -n -e "bg-\[#|text-\[#|border-\[#|shadow-\[" frontend/apps/web/src frontend/packages/ui/src
rg -n -e "rounded-(2xl|3xl|\[)" frontend/apps/web/src frontend/packages/ui/src
rg -n -e "transition-all|\bdark:" frontend/apps/web/src frontend/packages/ui/src
rg -n -e "visual-system|--ag-|cyber-" frontend/apps/web/src frontend/packages/ui/src
test ! -d frontend/apps/web/src/app/prototype
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend/apps/web build
```

This is the first point where pushing a large branch and opening a PR is
architecturally justified.

## 9. File-Level Next Work

The next concrete engineering slice is C1, not more page work.

### C1.1 Release manifest normalization

Update the v1.3 sync path so the frontend accepts only the current release
shape:

- `frontend/scripts/ssot-sync.mjs`
- `frontend/packages/ssot/src/fixtures/release-bundles/**/frontend-manifest-*.json`
- `frontend/packages/ssot/src/release/loader.test.ts`

### C1.2 Guard coverage expansion

Extend `frontend/scripts/frontend-precheck.mjs` so legacy release-shape checks
scan:

- app source;
- `packages/ssot/src`;
- `frontend/scripts`;
- JSON fixtures and embedded release artifacts.

### C1.3 Closeout validation

Run C2 verification and commit locally. Do not push until the user explicitly
asks for the phase PR.

## 10. Risk Register

| Risk                                                | Why it matters                                                    | Mitigation                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Docs remain Draft while code changes continue       | Formal gates do not match reality                                 | Treat this roadmap as transitional; do not claim Gate A/B/C closure until statuses are accepted |
| Release-shape fallback survives in sync scripts     | A future bundle could silently reintroduce old `sports.hub` shape | C1 removes fallback and expands strict precheck to scripts / JSON                               |
| Guard scripts themselves create false positives     | Literal forbidden names can hide real scan failures               | Keep forbidden literals centralized in `frontend-precheck`; computed keys in other guard files  |
| Sportsbook accidentally exposed as public placement | Regulatory and product-readiness risk                             | Keep page read-only until explicit env + release + ops gates                                    |
| Storybook / visual / a11y gates lag code            | Gate C can look complete while launch-quality checks are absent   | Track separately; do not claim public-launch readiness                                          |
| Pushing before closeout commit                      | Large branch review becomes noisy and unstable                    | Finish C0-C2 locally first                                                                      |

## 11. Do Not Do Next

- Do not add new casino games.
- Do not start sportsbook ticket placement before C1 closes.
- Do not push or open PR for this branch until C0-C2 closes.
- Do not mark Draft SSOT docs as Accepted without explicit human sign-off.
- Do not edit accepted ADRs substantively.
- Do not touch protocol encoding / transaction behavior as part of release
  residue cleanup.
- Do not create temporary duplicate shells.

## 12. How To Enforce This Roadmap

Before every implementation slice, cite one roadmap phase in the commit plan.

## 13. Implementation Log

### 2026-05-15 - C1 Release Compatibility Residue Closeout

Status: completed locally.

Changes:

- removed the `sports.hub` input fallback from `scripts/ssot-sync.mjs`;
- normalized the v1.3 frontend manifest fixture to `sports.sportsHub`;
- kept the release-schema negative test while avoiding normal runtime fallback
  paths for old release keys;
- expanded `frontend-precheck` legacy SDK compatibility scanning to include
  scripts and JSON release artifacts;
- kept release guard scripts as rejection surfaces, not compatibility surfaces.

Evidence:

```bash
pnpm -C frontend/packages/ssot test -- src/release/loader.test.ts
pnpm -C frontend/apps/web exec vitest run 'src/app/(product)/sportsbook/pageClient.test.tsx'
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
pnpm -C frontend typecheck
pnpm -C frontend build
```

### 2026-05-15 - C2 Full Local Verification

Status: completed locally.

Evidence:

```bash
pnpm -C frontend test
pnpm -C frontend lint
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
pnpm -C frontend typecheck
pnpm -C frontend build
```

Observed:

- full workspace tests passed:
  - `packages/ssot`: 11 files, 131 tests;
  - `packages/ui`: 4 files, 23 tests;
  - `apps/web`: 35 files, 125 tests;
- lint passed for all workspace packages;
- strict frontend precheck passed;
- embedded release check passed;
- Base Sepolia read-only smoke passed for contracts, pool registry, banks,
  GameHub VRF quote, SportsHub wiring, and SportsRiskEngine pool hash;
- workspace typecheck passed;
- production web build passed.

Known non-blocking warnings:

- local Node is v22.6.0 while `frontend/package.json` declares Node 20.x;
- `next lint` is deprecated and should be migrated to the ESLint CLI before
  public launch;
- Next build still reports the pre-existing "Next.js plugin was not detected"
  ESLint configuration warning.

### 2026-05-15 - R5 Casino Vertical Migration

Status: completed as a transitional vertical migration.

Changes:

- moved the `features/games` vertical to `features/casino`;
- renamed `GameMiniIcons.tsx` to `CasinoMiniIcons.tsx`;
- added `features/casino/modules` as the casino module registry for Roulette,
  Dice, Coin Toss, and Keno;
- wired catalog and route helpers to the module registry;
- removed old `features/games` imports from app and marketing routes;
- retokenized the casino room surface to remove per-game color families,
  hex utility classes, arbitrary radius utilities, inline shadow utilities,
  `transition-all`, and `white/` opacity utilities from
  `features/casino/room`;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "features/games|GameMiniIcons|\\.\\./games|/features/games" frontend/apps/web/src -S
rg -n -e "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[|rounded-(2xl|3xl|\\[)|purple|emerald|amber|fuchsia|indigo|white/|transition-all|\\bdark:" frontend/apps/web/src/features/casino/room -S
pnpm -C frontend/apps/web test -- src/features/casino
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend precheck:frontend -- --report
git diff --check
```

Observed:

- no old `features/games` app imports remain;
- no R5-forbidden casino room style utilities remain;
- casino slice tests passed: 18 files, 57 tests;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend typecheck` passed;
- `pnpm -C frontend/apps/web build` passed with the known MetaMask optional
  storage, ESLint plugin, `indexedDB`, and `punycode` warnings;
- `precheck:frontend -- --report` improved forbidden-style warnings from the
  earlier baseline of 320 to 246; remaining warnings are outside
  `features/casino`;
- browser smoke QA loaded `/casino/dice`, `/casino/roulette`, `/casino/keno`,
  and `/casino/coin-toss` locally on port 3001 with expected route text and no
  visible error overlay.

Follow-up:

- R6 should migrate `account`, `bets`, `claims`, and `referral` into
  `features/portfolio`;
- R8 still needs to convert the precheck report warnings into blocking checks
  after the remaining legacy components are removed.

### 2026-05-15 - R6 Portfolio Vertical Convergence

Status: completed as a physical feature-boundary migration.

Changes:

- moved account overview files into `features/portfolio/overview`;
- moved betting activity UI files into `features/portfolio/activity`;
- moved bet detail files into `features/portfolio/activity/detail`;
- moved claims files into `features/portfolio/claims`;
- moved referral files into `features/portfolio/referral`;
- moved shared betting data hooks from `features/bets` to `features/betting`;
- updated canonical portfolio, casino, and marketing imports to the new
  boundaries;
- removed the old physical directories:
  `features/account`, `features/bets`, `features/bet-detail`,
  `features/claims`, and `features/referral`;
- kept legacy URL routes as redirect boundaries only;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "features/(account|bets|claims|referral|bet-detail)" frontend/apps/web/src -S
test ! -d frontend/apps/web/src/features/account
test ! -d frontend/apps/web/src/features/bets
test ! -d frontend/apps/web/src/features/bet-detail
test ! -d frontend/apps/web/src/features/claims
test ! -d frontend/apps/web/src/features/referral
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend precheck:frontend -- --report
git diff --check
```

Observed:

- no app imports reference the old feature paths;
- the old physical feature directories are absent;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend typecheck` passed;
- `pnpm -C frontend/apps/web build` passed with the known MetaMask optional
  storage, ESLint plugin, `indexedDB`, and `punycode` warnings;
- `precheck:frontend -- --report` remains at 246 forbidden-style warnings and
  2 legacy-shell warnings, which are outside the R6 scope.

Follow-up:

- R7 should keep `/sportsbook` gated and move sportsbook-specific code under
  `features/sportsbook`;
- R8 should remove the remaining stale app components and flip selected
  prechecks from report-only to blocking.

### 2026-05-15 - R7 Sportsbook Readiness Surface

Status: completed as a gated feature-boundary migration.

Changes:

- moved sportsbook implementation from the app route into
  `features/sportsbook/page-client.tsx`;
- kept `app/(product)/sportsbook/pageClient.tsx` as a thin route export only;
- preserved the read-only readiness model: SportsHub metadata and caps are
  visible, but ticket placement remains disabled even when the metadata gate is
  enabled;
- retokenized the sportsbook surface to remove the local hardcoded dark panel,
  `white/` opacity utilities, and emerald/amber status color families from the
  sportsbook feature;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n -e "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[|rounded-(2xl|3xl|\\[)|purple|emerald|amber|fuchsia|indigo|white/|transition-all|\\bdark:" frontend/apps/web/src/features/sportsbook frontend/apps/web/src/app/'(product)'/sportsbook -S
pnpm -C frontend/apps/web test -- 'src/app/(product)/sportsbook/pageClient.test.tsx'
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend precheck:frontend -- --report
git diff --check
```

Observed:

- sportsbook route tests passed: 1 file, 3 tests;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend typecheck` passed;
- `pnpm -C frontend/apps/web build` passed with the known MetaMask optional
  storage, ESLint plugin, `indexedDB`, and `punycode` warnings;
- `precheck:frontend -- --report` improved forbidden-style warnings from 246 to
  245 and remains at 2 legacy-shell warnings;
- no sportsbook-local forbidden style utilities remain.

Follow-up:

- R8 should remove remaining stale app components, especially the legacy trust
  shell fragments and home visual exploration artifacts still reported by
  `precheck:frontend`;
- R8 should decide which precheck groups can become blocking immediately.

### 2026-05-15 - R8 Stale Surface Deletion and Blocking Guards

Status: completed as a final cleanup guardrail pass.

Changes:

- deleted unused stale exploration components:
  `components/TrustStatsStrip.tsx`, `components/TrustTableShell.tsx`, and
  `components/home/HomeHeroVisual.tsx`;
- retokenized the product brand mark and global footer so they no longer
  contribute hardcoded dark backgrounds or forbidden radius utilities;
- promoted `legacy-shell` to a blocking strict precheck now that the count is
  zero;
- promoted `web3-import-boundary` to a blocking strict precheck while direct
  wagmi, viem, and RainbowKit imports remain isolated to provider islands;
- kept `forbidden-style` report-only because the remaining warnings are
  concentrated in protocol visualization components and need a separate
  controlled retokenization pass;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "TrustStatsStrip|TrustTableShell|HomeHeroVisual" frontend/apps/web/src frontend/packages/ui/src -S
pnpm -C frontend precheck:frontend -- --report
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
git diff --check
```

Observed:

- stale component scan returned no product source hits;
- `legacy-shell` is now 0 and blocking;
- `web3-import-boundary` is now 0 and blocking;
- `precheck:frontend -- --strict` passed;
- `forbidden-style` improved from 245 to 224 warnings;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend typecheck` passed;
- `pnpm -C frontend/apps/web build` passed with the known Node 20 engine,
  MetaMask optional storage, ESLint plugin, `indexedDB`, and `punycode`
  warnings.
- browser smoke on `/` passed: brand/footer rendered, no visible Next overlay,
  and no horizontal overflow at 1280px.

Follow-up:

- Next pass should focus on `packages/ui/src/components/protocol/*`, which now
  owns nearly all remaining forbidden-style warnings;
- after that retokenization lands, `forbidden-style` can move from report-only
  to blocking.

### 2026-05-15 - R9 Protocol Surface Prune

Status: completed as a package-level dead surface removal.

Changes:

- deleted unused protocol-era casino forms, boards, selectors, and matching
  stories that no product route imports anymore;
- removed deleted protocol exports from `@ssot/ui` root and `@ssot/ui/patterns`;
- cleaned stale casino route test mocks that referred to removed protocol
  components;
- retokenized the still-used `AuditTabs` helpers and `ErrorCallout` details
  block;
- kept active protocol system components: `AssetSelector`, `AuditTabs`,
  `ReadOnlyBanner`, `ReleaseBadge`, `ErrorCallout`, `TxStatusChip`, and
  `TxStepper`;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "CoinTossParamsForm|DiceParamsForm|KenoParamsForm|RouletteParamsForm|DiceSlider|CoinStage|KenoGrid|MaskPickerGrid|RouletteBoard|SharedBetSlip|StakeSpecForm" frontend/apps/web/src frontend/packages/ui/src -S
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend/apps/web test -- 'src/app/(product)/casino/[slug]/pageClient.test.tsx' 'src/features/casino/room/audit-ledger.test.tsx'
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web build
```

Observed:

- stale protocol component scan returned no product or UI source hits;
- focused casino/audit tests passed: 2 files, 7 tests;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend/packages/ui typecheck` passed;
- `pnpm -C frontend typecheck` passed;
- `precheck:frontend -- --strict` passed;
- `forbidden-style` improved from 224 to 62 warnings;
- `pnpm -C frontend/apps/web build` passed with the known Node 20 engine,
  MetaMask optional storage, ESLint plugin, `indexedDB`, and `punycode`
  warnings;
- build first-load JS dropped on several product routes after deleting the
  unused protocol exports, for example `/casino/[slug]` from about 509 kB after
  R7 to about 498 kB.

Follow-up:

- Remaining forbidden-style warnings are now in base UI primitives such as
  `alert`, `button`, `card`, `game-card`, `glass-card`, and `glass-modal`;
- the next cleanup pass should retokenize those primitives before promoting
  `forbidden-style` to blocking.

### 2026-05-15 - R10 Primitive Style Gate Closeout

Status: completed as the final design-debt gate closure.

Changes:

- deleted unused primitive-era artifacts with no product imports:
  `GameCard`, `GlassCard`, `GlassModal`, `ReceiptTicket`, `StatBlock`, and
  `WinLossOverlay`;
- removed deleted primitive exports from `@ssot/ui` root and
  `@ssot/ui/patterns`;
- retokenized active primitives: `Button`, `Card`, `Alert`, `Input`,
  `ShellHeader`, `TabBar`, and `Toaster`;
- promoted `forbidden-style` to a blocking strict precheck after it reached
  zero;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "GameCard|GlassCard|GlassModal|ReceiptTicket|WinLossOverlay|StatBlock" frontend/apps/web/src frontend/packages/ui/src -S
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
```

Observed:

- unused primitive scan returned no product or UI source hits;
- `precheck:frontend -- --strict` passed with all checks at zero, including
  `forbidden-style`;
- full web tests passed: 37 files, 133 tests;
- `pnpm -C frontend/packages/ui typecheck` passed;
- `pnpm -C frontend typecheck` passed;
- `pnpm -C frontend/apps/web build` passed with the known Node 20 engine,
  MetaMask optional storage, ESLint plugin, `indexedDB`, and `punycode`
  warnings;
- build first-load JS dropped further, for example `/casino/[slug]` from about
  498 kB after R9 to about 496 kB.

Follow-up:

- The next phase should move from cleanup to visual QA and route-level polish:
  run browser screenshots for `/`, `/casino`, `/casino/dice`,
  `/portfolio`, `/earn`, `/ops`, and `/sportsbook`;
- if those routes pass, this frontend cleanup block can be treated as closed
  for a larger PR.

### 2026-05-15 - R11 Legacy Route Alias Deletion

Status: completed as a route-surface closeout.

Changes:

- deleted root-level legacy route aliases instead of keeping redirect
  boundaries:
  `/dice`, `/cointoss`, `/roulette`, `/keno`, `/games`, `/games/[slug]`,
  `/account`, `/bets`, `/bets/[betId]`, `/claims`, `/referral`, `/invest`,
  `/liquidity`, `/privacy`, `/terms`, and `/disclaimer`;
- removed the `/casino/cointoss` slug alias so `coin-toss` is the only
  canonical coin-toss room slug;
- removed legacy-only redirect tests and updated AppShell tests to canonical
  routes;
- added a strict `legacy-route-alias` frontend precheck so these route files
  cannot return unnoticed;
- updated IA and kill-list docs to state that old aliases 404 unless a future
  ADR explicitly reintroduces one;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
rg -n "redirect\\(|/games|/dice|/cointoss|/roulette|/keno|/account|/bets|/invest|/liquidity|/claims|/referral|/privacy|/terms|/disclaimer" \
  frontend/apps/web/src/app-shell frontend/apps/web/src/app/(product) -S
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
```

Follow-up:

- browser smoke should verify canonical URLs and legacy 404 behavior together:
  `/casino/coin-toss`, `/portfolio/activity`, `/legal/privacy`, plus legacy
  `/games`, `/dice`, `/privacy`, and `/casino/cointoss`;
- if those pass, the frontend cleanup block is ready for a local phase commit.

### 2026-05-15 - R12 Route-Level Visual QA

Status: completed as rendered QA polish.

Changes:

- verified production route status for canonical URLs and removed aliases:
  `/casino/coin-toss`, `/portfolio/activity`, and `/legal/privacy` return 200;
  `/games`, `/dice`, `/privacy`, and `/casino/cointoss` return 404;
- fixed `/casino` directory dead links by filtering release metadata through
  the implemented casino module registry before rendering room cards;
- fixed mobile horizontal overflow on `/` caused by the long release digest
  forcing bank metric grid width beyond the 390 px viewport;
- captured desktop Browser screenshots for `/casino` and `/casino/dice`, and
  mobile Playwright screenshots for `/`, `/casino`, and `/casino/dice`;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
pnpm -C frontend/apps/web test -- 'src/app/(product)/casino/pageClient.test.tsx'
pnpm -C frontend/apps/web test -- 'src/app/(marketing)/page.test.tsx'
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend/apps/web exec next start -p 3001
```

Rendered QA observations:

- desktop `/casino` rendered exactly four room cards: `dice`, `roulette`,
  `coin-toss`, and `keno`;
- desktop interaction from `/casino` room card to `/casino/dice` completed
  without a framework overlay or horizontal overflow;
- mobile 390 px checks for `/`, `/casino`, `/casino/dice`, `/portfolio`,
  `/earn`, `/ops`, and `/sportsbook` all returned 200 with no framework overlay
  and no horizontal overflow.

### 2026-05-15 - R13 Wallet Runtime Slimdown

Status: completed as build-warning and bundle cleanup.

Changes:

- removed RainbowKit from the web app runtime and package dependencies;
- replaced RainbowKit `ConnectButton` with a local wagmi-powered
  `WalletButton`;
- replaced RainbowKit `getDefaultConfig` with direct wagmi `createConfig`;
- switched the wallet connector to wagmi's core `injected` export instead of
  the `wagmi/connectors` barrel so MetaMask and WalletConnect SDK modules are
  not pulled into the server build;
- removed RainbowKit global CSS import;
- kept `frontend/packages/ssot/**` untouched.

Evidence:

```bash
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
pnpm -C frontend/apps/web build
```

Observed:

- production build no longer prints the MetaMask optional
  `@react-native-async-storage/async-storage` warning;
- production build no longer prints `indexedDB is not defined`;
- `/casino/[slug]` first-load JS dropped from about 496 kB to about 313 kB.

Useful commands:

```bash
# Current status
git status --short --branch

# Gate status
rg -n "\| Status \| Draft|\| Status \| Accepted" docs/design docs/frontend

# Target architecture presence
test -d frontend/packages/ui/src/primitives
test -d frontend/packages/ui/src/patterns
test -d frontend/packages/ui/src/motion
test -d frontend/apps/web/src/app-shell
find frontend/apps/web/src/app -maxdepth 1 -type d -name '(*'

# Forbidden style scan
rg -n -e "bg-\[#|text-\[#|border-\[#|shadow-\[|rounded-(2xl|3xl|\[)|transition-all|\bdark:" \
  frontend/apps/web/src frontend/packages/ui/src -S

# Legacy shell scan
rg -n -e "SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher|RoomHud|LowerRoomTabs|HeroProofRibbon|TrustStatsStrip|TrustTableShell" \
  frontend/apps/web/src frontend/packages/ui/src -S

# Forbidden import scan
rg -n -e "from ['\"]wagmi|from ['\"]viem|from ['\"]@rainbow" frontend/apps/web/src -S

# Page client size
find frontend/apps/web/src/app -name 'pageClient.tsx' -print0 \
  | xargs -0 wc -l | awk '$2 != "total" && $1 > 600 {print $0}'
```

## 14. 2026-05-16 Audit Refresh And Action Plan

This refresh supersedes the 2026-05-15 bundle-risk numbers in the external
audit. It does not supersede the Gate A/B/C requirements.

### 14.1 Refreshed Evidence

Commands run on `codex/frontend-bundle-closeout`:

```bash
git status --short --branch
git log --oneline -8
pnpm -C frontend precheck:frontend -- --strict
find frontend/apps/web/src/app -name 'pageClient.tsx' -print0 | xargs -0 wc -l | sort -n
rg -n "#[0-9a-fA-F]{3,8}\b|rgba\(|rgb\(" frontend/apps/web/src frontend/packages/ui/src
rg -n "rgba\(|147,51,234|purple|emerald|amber|fuchsia|indigo|white/|text-white|bg-white|border-white" \
  frontend/apps/web/src/features/casino frontend/apps/web/src/app frontend/packages/ui/src
pnpm -C frontend/apps/web build
```

Observed:

- working tree was clean at the start of this audit;
- strict frontend precheck passes under its current rule set;
- old production alias routes and `app/prototype` are absent;
- no legacy shell names remain in app or UI source;
- no `pageClient.tsx` exceeds 600 lines; the largest current file is
  `earn/pageClient.tsx` at 324 lines;
- bundle risk from the prior report is materially reduced:
  `/casino/[slug]` is now 178 kB first-load JS,
  `/sportsbook/[marketId]` is now 159 kB, and shared first-load JS is 104 kB;
- `frontend/apps/web/sandbox/prototype/**` exists outside `src/`, so it is not
  part of the App Router. This is acceptable as non-routable reference code;
- raw hex literals still exist in `app/global-error.tsx`;
- a raw purple `rgba(147,51,234,0.05)` background still exists in the Dice
  stage;
- several `@ssot/ui` legacy primitives still use Tailwind color families
  (`white`, `slate`, `emerald`, `amber`, `rose`, `blue`, `green`) instead of
  SSOT tokens;
- casino stage implementations are still physically flat in
  `features/casino/room/*-stage.tsx` instead of living under
  `features/casino/modules/<slug>/`.

### 14.2 Finding Disposition

| External audit item                                                  | Current disposition                                                                                                                                                        | Action                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle high risk (`/casino/[slug]` 504 kB, sportsbook detail 289 kB) | **Resolved enough for closeout.** Current build is 178 kB / 159 kB after lazy Sentry, lazy stages, lightweight page transition, custom toaster, and lazy RainbowKit modal. | Do not chase 150 kB as a hard blocker. Keep a future bundle-budget gate.                                                                             |
| N3 single AppShell                                                   | **Closed.** No legacy shell names remain. Feature-level `GameRoomShell` is not a competing app chrome.                                                                     | No code action.                                                                                                                                      |
| N5 no hex literal                                                    | **Open.** `global-error.tsx` still uses raw hex because it cannot rely on normal providers/components.                                                                     | Replace raw hex with token-compatible HSL fallbacks; extend precheck to catch raw hex literals in source.                                            |
| N2 no per-game color family                                          | **Partially open.** The Tailwind color-family scan missed raw `rgba(147,51,234,0.05)` in Dice and old UI primitive color families.                                         | Replace with `brand` / `accent` / semantic token classes; extend precheck to catch ad-hoc Tailwind color families and raw rgb/rgba in app/UI source. |
| Phase 5 casino modules                                               | **Partially open.** Registry exists, but stage implementations are flat in `room/`.                                                                                        | Move stage components/tests into `modules/<slug>/`; keep shared room framework in `room/`. Do not add new games in this slice.                       |
| Phase 1 primitives physical migration                                | **Transitional.** `primitives/index.ts` re-exports `components/ui/*`; this is acceptable short-term but not final Gate B.                                                  | Do not do a broad move in this slice. First retokenize remaining `components/ui` debt and keep the later physical move separate.                     |
| Gate A/B/C document statuses                                         | **Formally open.** Draft documents should not be mechanically marked Accepted.                                                                                             | Keep Draft until human sign-off. Record implementation evidence here instead.                                                                        |
| Lighthouse / a11y / bundle-budget CI                                 | **Open but not first-order correctness.** CI already runs release sanity, lint, typecheck, strict tests, build, and Storybook build.                                       | Add budget/a11y/perf gates after token discipline and module ownership are clean.                                                                    |
| v1.3 four new casino games                                           | **Product expansion, not closeout.** Earlier product decision paused adding games.                                                                                         | Do not add Baccarat / Plinko / Sic Bo / Slots in this closeout slice.                                                                                |

### 14.3 Immediate Implementation Slice

The next local commit should be:

```text
Close frontend audit residue
```

Scope:

1. **Token discipline closeout**
   - retokenize `app/global-error.tsx`;
   - retokenize `features/casino/room/dice-stage.tsx`;
   - retokenize old `@ssot/ui` files still referenced by the public barrel:
     `stat-card.tsx`, `room-strip.tsx`, `status-badge.tsx`, and
     `page-header.tsx`;
   - extend `frontend-precheck` so raw hex, raw rgb/rgba, and ad-hoc Tailwind
     color families are blocking in app/UI source.

2. **Casino module ownership**
   - move Dice / Coin Toss / Roulette / Keno stage files from `room/` to
     `modules/<slug>/`;
   - update dynamic imports and tests;
   - leave shared room framework files in `room/`.

3. **Verification**
   - `pnpm -C frontend precheck:frontend -- --strict`
   - `pnpm -C frontend/packages/ui test`
   - `pnpm -C frontend/apps/web test -- src/features/casino`
   - `pnpm -C frontend/apps/web typecheck`
   - `pnpm -C frontend/packages/ui typecheck`
   - `pnpm -C frontend/apps/web build`
   - `git diff --check`

No new game, sportsbook, SDK, or release behavior belongs in this commit.

### 14.4 Implementation Result

Status: completed locally.

Changes:

- replaced raw hex colors in `app/global-error.tsx` with token-compatible HSL
  fallbacks that still work if the root providers fail;
- replaced the Dice stage's raw purple `rgba(...)` visual with the `brand`
  token;
- retokenized old exported UI primitives/pattern helpers:
  `copy-button`, `data-table`, `page-header`, `room-strip`, `stat-card`, and
  `status-badge`;
- extended `frontend-precheck` with a blocking
  `forbidden-color-literal` check for raw hex, raw rgb/rgba, raw numeric hsl,
  and ad-hoc Tailwind color families in app/UI source;
- moved Dice / Coin Toss / Roulette / Keno stage implementations into
  `features/casino/modules/<slug>/stage.tsx`;
- moved stage tests under `features/casino/modules/`;
- kept shared room framework, controls, params, model, and history widgets in
  `features/casino/room/`.

Evidence:

```bash
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test -- src/features/casino
pnpm -C frontend/packages/ui test
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend/apps/web build
pnpm -C frontend test
pnpm -C frontend lint
pnpm -C frontend typecheck
git diff --check
```

Observed:

- strict precheck now includes `forbidden-color-literal` and passes with 0
  findings;
- raw color scans outside token files return 0 findings;
- old flat casino stage filename references return 0 findings;
- full frontend tests passed: `packages/ssot` 137 tests,
  `packages/ui` 23 tests, and `apps/web` 135 tests;
- production build passed and preserved the latest bundle profile:
  `/casino/[slug]` 178 kB, `/sportsbook/[marketId]` 159 kB, shared 104 kB;
- known non-blocking warnings remain unchanged: local Node v22 vs project Node
  20, deprecated `next lint`, and the existing Next ESLint plugin warning.

## 15. Gate C Smoke CI Slice

Status: completed locally.

The frontend clean-room closeout now has enough token, route, and casino-module
discipline to start moving Gate C from local evidence into CI. This slice must
stay narrow: it adds no product features, no new games, no sportsbook behavior,
and no design-system migrations.

### 15.1 Problem

The existing Playwright smoke suite still reflects the pre-clean-room route
surface. It checks legacy URLs such as `/games` and `/bets`, while the current
product routes are `/casino` and `/portfolio/activity`. That makes the suite
unsafe to promote into CI because it would either fail for the wrong reason or
encourage compatibility routes to come back.

The existing frontend CI also runs lint, typecheck, tests, build, and Storybook,
but it does not run the strict frontend architecture precheck or a browser-level
route smoke. Those two checks are the lowest-risk Gate C additions because they
are deterministic and do not depend on wallets, testnet writes, or external
indexer freshness.

### 15.2 Scope

1. Update `frontend/apps/web/e2e/smoke.spec.ts` to cover the current route
   surface:
   - `/`;
   - `/casino`;
   - `/casino/dice`;
   - `/portfolio`;
   - `/portfolio/activity`;
   - `/earn`;
   - `/sportsbook`;
   - `/ops`;
   - `/legal/privacy`;
   - legacy aliases such as `/games`, `/dice`, `/bets`, and `/privacy` remain
     404.
2. Keep the e2e suite read-only and wallet-free.
3. Update the Playwright web-server command so CI can reuse the production build
   already created by the `Build` step.
4. Add `pnpm precheck:frontend -- --strict` to frontend CI.
5. Add Chromium smoke e2e to frontend CI after the production build.

### 15.3 Acceptance Checks

```bash
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test -- src/smoke.test.ts
pnpm -C frontend/apps/web e2e
pnpm -C frontend/apps/web build
git diff --check
```

CI must keep the known non-blocking warnings separate from this slice:

- local Node 22 warning in this workspace;
- deprecated `next lint`;
- existing Next ESLint plugin detection warning.

### 15.4 Implementation Result

Changes:

- promoted `pnpm precheck:frontend -- --strict` into
  `.github/workflows/frontend-ci.yml`;
- promoted a wallet-free Chromium Playwright smoke into frontend CI after the
  production build;
- replaced the stale Playwright smoke suite that targeted `/games`, `/bets`,
  and the removed theme/mobile-menu controls;
- added browser coverage for the current canonical routes and for legacy-route
  404s;
- made Playwright read `PLAYWRIGHT_BASE_URL`, so local validation can avoid an
  occupied port without changing CI behavior.

Evidence:

```bash
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web test -- src/smoke.test.ts
CI=true PLAYWRIGHT_BASE_URL=http://localhost:3007 pnpm -C frontend/apps/web e2e
pnpm -C frontend/apps/web build
git diff --check
```

Observed:

- strict frontend precheck passed with 0 findings;
- app-level smoke unit test passed;
- Playwright browser smoke passed: 5 tests covering `/`, `/casino`,
  `/casino/roulette` navigation, core product pages, and deleted legacy aliases;
- production build passed with the same bundle profile:
  `/casino/[slug]` 181 kB, `/sportsbook/[marketId]` 159 kB, shared 104 kB;
- local e2e used port 3007 because port 3000 was already occupied by an
  unrelated local process;
- known non-blocking warnings remain unchanged: local Node v22 vs project Node
  20, deprecated `next lint`, existing Next ESLint plugin warning, and the
  Playwright/Next `NO_COLOR` vs `FORCE_COLOR` runtime warning.

## 16. Gate C Bundle Budget Slice

Status: completed locally.

### 16.1 Problem

The bundle risk from the external audit was resolved enough for product
closeout, but the repo still had no blocking budget guard. Without a CI budget,
future feature work can silently reintroduce the same failure mode: wallet,
motion, analytics, or sportsbook code drifting into every product route.

This slice is intentionally no-dependency. It reads the production Next
`app-build-manifest.json` after `pnpm build`, gzips the JavaScript chunks for
each canonical route, and compares the total against route-specific ceilings.
Those ceilings are deliberately wider than the current build so CI blocks
regression, not normal hash-level noise.

### 16.2 Scope

1. Add `frontend/scripts/check-bundle-budget.mjs`.
2. Add `pnpm check:bundle` at the frontend workspace root.
3. Run `pnpm check:bundle` in frontend CI immediately after `pnpm build`.
4. Track canonical route budgets for:
   - `/`;
   - `/casino`;
   - `/casino/[slug]`;
   - `/earn`;
   - `/ops`;
   - `/portfolio`;
   - `/portfolio/activity`;
   - `/portfolio/claims`;
   - `/sportsbook`;
   - `/sportsbook/[marketId]`;
   - `/legal/privacy`.

### 16.3 Acceptance Checks

```bash
pnpm -C frontend/apps/web build
pnpm -C frontend check:bundle
pnpm -C frontend precheck:frontend -- --strict
git diff --check
```

### 16.4 Implementation Result

Changes:

- added `frontend/scripts/check-bundle-budget.mjs`;
- added `pnpm check:bundle`;
- wired bundle budget into frontend CI immediately after `pnpm build`;
- used gzip totals from `.next/app-build-manifest.json` to approximate the
  Next build table's First Load JS values without adding analyzer dependencies.

Evidence:

```bash
pnpm -C frontend/apps/web build
pnpm -C frontend check:bundle
pnpm -C frontend precheck:frontend -- --strict
git diff --check
```

Observed:

- production build passed;
- bundle budget passed for all tracked canonical routes;
- tightest margins were `/legal/privacy` at 12.6 kB and `/portfolio/activity`
  at 15.2 kB;
- `/casino/[slug]` measured 177.1 kB gzip JS against a 195 kB budget;
- `/sportsbook` measured 156.1 kB gzip JS against a 175 kB budget;
- known local warnings remain unchanged: Node v22 vs project Node 20 and the
  existing Next ESLint plugin warning.

## 17. Gate C Accessibility Smoke Slice

Status: completed locally.

### 17.1 Problem

`docs/frontend/20-accessibility.md` and `docs/frontend/24-testing.md` require
axe coverage, but frontend CI previously had no browser-level accessibility
guard. The right first step is not a broad manual accessibility audit; it is a
deterministic smoke suite that fails on serious or critical WCAG violations for
the canonical route surface.

### 17.2 Scope

1. Add `@axe-core/playwright` as a web dev dependency.
2. Add a read-only Playwright a11y smoke for the same canonical routes covered
   by the route smoke suite.
3. Fail only serious and critical axe violations in this slice.
4. Run the a11y smoke through the existing `pnpm e2e` CI step.

### 17.3 Acceptance Checks

```bash
CI=true PLAYWRIGHT_BASE_URL=http://localhost:3007 pnpm -C frontend/apps/web e2e
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web build
git diff --check
```

### 17.4 Implementation Result

Changes:

- added `@axe-core/playwright` and `frontend/apps/web/e2e/a11y.spec.ts`;
- expanded `pnpm e2e` to include serious/critical axe coverage for the
  canonical route surface;
- renamed the CI step to `E2E and accessibility smoke`;
- raised dark-mode `--fg-subtle`, `--fg-inverse`, and `--brand` tokens to meet
  WCAG AA contrast thresholds on the current surface stack;
- added accessible names to casino bet amount, roll count, and dice target
  controls;
- associated `AssetSelector` labels with the underlying select control.

Evidence:

```bash
CI=true PLAYWRIGHT_BASE_URL=http://localhost:3007 pnpm -C frontend/apps/web e2e
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend precheck:frontend -- --strict
pnpm -C frontend/apps/web build
pnpm -C frontend check:bundle
git diff --check
```

Observed:

- Playwright route + accessibility smoke passed: 14 tests;
- all axe serious/critical violations were eliminated from the covered routes;
- web and UI typecheck passed;
- strict frontend precheck passed with 0 findings;
- production build and bundle budget passed;
- bundle profile remains effectively unchanged after token/a11y fixes:
  `/casino/[slug]` 181 kB, `/sportsbook` 159 kB, shared 104 kB.
