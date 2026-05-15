# Frontend Implementation Audit & Roadmap

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-15 |
| Depends on | `00-charter.md`, `01-brand.md`, `02-voice-and-copy.md`, `03-information-architecture.md`, `04-page-blueprints.md`, `10-design-tokens.md`, `11-component-library.md`, `12-motion.md`, `13-web3-ux.md`, `14-data-and-state.md`, `15-forms.md`, `16-mobile.md`, `../frontend/20-accessibility.md`, `../frontend/21-i18n.md`, `../frontend/22-performance.md`, `../frontend/23-security.md`, `../frontend/24-testing.md`, `../frontend/25-observability.md`, `../frontend/30-build-and-release.md`, `../frontend/31-governance.md`, `../frontend/32-ai-pairing.md`, `frontend-rewrite-blueprint.md`, `frontend-kill-list.md`, ADR-0001, ADR-0002, ADR-0003 |
| Supersedes | ad-hoc chat-only frontend rewrite sequencing |

This document is the working implementation roadmap for the current
`codex/frontend-north-star` branch. It exists because implementation started
before Gate A/B/C were formally closed. The goal is to bring the branch back
under the SSOT process without throwing away useful work already landed.

This file does not replace `frontend-rewrite-blueprint.md`; it translates that
blueprint into an evidence-backed execution plan for the current repository
state.

## 1. Executive Conclusion

The correct strategy is still a clean-room frontend rewrite, but the branch is
now in a **transitional rewrite** state:

- useful page and casino-room decomposition work has already landed;
- the protocol layer remains untouched and should stay untouched;
- the design-token source exists, but the component and route architecture has
  not reached the target shape;
- continuing to token-fix individual files without first closing the system
  gaps will recreate the same drift the rewrite is meant to remove.

Therefore the next implementation wave must stop treating `/games/*` as the
center of gravity. The center of gravity is now:

1. SSOT acceptance state and gate accounting.
2. `@ssot/ui` target structure: `tokens`, `primitives`, `patterns`, `motion`.
3. app route groups and provider islands.
4. casino migration from `features/games` to `features/casino`.
5. deletion and CI guardrails.

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

Snapshot command set, run on 2026-05-15:

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

| Check                                                          | Current                              |
| -------------------------------------------------------------- | ------------------------------------ |
| Working tree                                                   | clean                                |
| Draft SSOT documents                                           | 26                                   |
| Accepted documents                                             | 3, all ADRs                          |
| `app/prototype` directory                                      | absent                               |
| `src/sandbox` directory                                        | absent                               |
| app route groups `(...)`                                       | 0                                    |
| `apps/web/src/app-shell`                                       | absent                               |
| `packages/ui/src/primitives`                                   | absent                               |
| `packages/ui/src/patterns`                                     | absent                               |
| `packages/ui/src/motion`                                       | absent                               |
| forbidden token/radius/shadow/transition/dark lines            | 320                                  |
| files with forbidden token/radius/shadow/transition/dark lines | 40                                   |
| `pageClient.tsx` files over 600 LOC                            | 0                                    |
| largest `pageClient.tsx`                                       | `sportsbook/pageClient.tsx`, 409 LOC |
| game-room files with old style vocabulary                      | 7                                    |

Interpretation:

- The old 2,030-line game god component problem has been meaningfully reduced.
- The original prototype route pollution has been removed, but the sandbox
  replacement has not been established.
- The system structure required by `11-component-library.md` has not landed.
- The branch is not ready for Phase 5-style casino completion because Gate B
  infrastructure is incomplete.

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
- target folders `primitives`, `patterns`, and `motion` do not exist;
- old `components/ui` and `components/protocol` still hold production UI;
- forbidden style scan still returns 320 lines across 40 files.

Status: **not closed**.

Action:

- Next engineering work must prioritize Gate B foundations before more page
  polishing.

### Gate C - Quality

Required:

- Layer 3 and Layer 4 docs `Accepted`;
- CI checks for type, unit, component, visual, a11y, performance, e2e;
- Sentry/RUM/analytics wired with release tags.

Current:

- Layer 3/4 documents are Draft;
- local typecheck/test/build pass for current slices;
- target scripts such as `precheck:ai`, route-blueprint checks, Storybook
  coverage checks, Lighthouse CI, axe page suite, and bundle budgets are not
  fully proven from this snapshot.

Status: **not closed**.

Action:

- Implement guardrails gradually at phase boundaries; do not wait until the end
  to add all CI checks.

## 5. What Already Counts As Useful Work

These changes should be retained and migrated, not discarded:

1. `@ssot/ui/src/tokens/arbi-dark.css` and `arbi-light.css` exist.
2. `visual-system.ts`, old `themes/*`, and `cyber-*` files appear removed.
3. `app/prototype` is absent.
4. Game room has been decomposed into feature files under
   `features/games/room`.
5. `games/[slug]/pageClient.tsx` is down to 237 LOC.
6. `/games` directory page and game room bet rail have been partially
   tokenized.
7. Several legacy placeholder-like pages were rewritten into more serious
   product surfaces.
8. Full web test suite currently passes in the recent local baseline.

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

## 7. Revised Execution Phases

The phase names below are for this branch. They map back to
`frontend-rewrite-blueprint.md §6` but account for the fact that some work has
already happened.

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
- `/casino/cointoss`
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

## 8. File-Level Next Work

The next concrete engineering slice should be R1, not more casino polish.

### R1.1 `@ssot/ui` folder skeleton

Create empty target directories and non-breaking barrel files:

```text
frontend/packages/ui/src/primitives/index.ts
frontend/packages/ui/src/patterns/index.ts
frontend/packages/ui/src/motion/index.ts
frontend/packages/ui/src/icons/index.ts
frontend/packages/ui/src/utils/index.ts
frontend/packages/ui/src/tokens/VERSION.md
```

Then re-export existing components through the new paths without moving all
call sites yet. This makes later migrations mechanical and safe.

### R1.2 First primitive migration

Move or wrap the low-risk primitives:

- `button.tsx`
- `input.tsx`
- `badge.tsx`
- `skeleton.tsx`
- `copy-button.tsx`
- `status-badge.tsx`

Do not start with `game-card`, `receipt-ticket`, `shared-bet-slip`, or protocol
forms; those are not primitives and need pattern ownership decisions.

### R1.3 First pattern migration

Move or build:

- `page-header`
- `stat-block`
- `ledger-table`
- `empty-state`
- `error-state`

Only after those exist should route pages be migrated.

## 9. Risk Register

| Risk                                                | Why it matters                                                         | Mitigation                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Docs remain Draft while code changes continue       | Formal gates do not match reality                                      | Treat this roadmap as transitional; do not claim Gate A/B/C closure until statuses are accepted |
| Continuing local token sweeps                       | Can produce partial style consistency without architecture consistency | R1/R2/R3 must precede more page work                                                            |
| Old routes kept for compatibility                   | Violates kill-list and IA                                              | Keep redirects only; no legacy components                                                       |
| `@ssot/ui/components/protocol` becomes permanent    | It bypasses primitive/pattern split                                    | Classify each file as pattern, app feature, or delete in R1/R8                                  |
| Wagmi/RainbowKit provider mounted globally          | Marketing pays product wallet cost                                     | R3 provider island migration                                                                    |
| Sportsbook accidentally exposed as public placement | Regulatory and product-readiness risk                                  | R7 gated-read-only rule                                                                         |
| CI added only at the end                            | Violations keep reappearing                                            | R2 report-mode scripts, then phase-by-phase blocking                                            |

## 10. Do Not Do Next

- Do not add new casino games.
- Do not continue tokenizing the remaining game stages before R1/R2.
- Do not push or open PR for this branch until a phase closes.
- Do not mark Draft SSOT docs as Accepted without explicit human sign-off.
- Do not edit accepted ADRs substantively.
- Do not touch `frontend/packages/ssot/**` or `deployments/**` as part of UI
  cleanup.
- Do not create temporary duplicate shells.

## 11. How To Enforce This Roadmap

Before every implementation slice, cite one roadmap phase in the commit plan.

## 12. Implementation Log

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

## 12. Next Immediate Commit After This Document

After this roadmap lands, the next commit should be:

```text
Scaffold UI primitive and pattern exports
```

Scope:

- `frontend/packages/ui/src/primitives/index.ts`
- `frontend/packages/ui/src/patterns/index.ts`
- `frontend/packages/ui/src/motion/index.ts`
- `frontend/packages/ui/src/icons/index.ts`
- `frontend/packages/ui/src/utils/index.ts`
- `frontend/packages/ui/src/tokens/VERSION.md`
- `frontend/packages/ui/src/index.ts`
- package export adjustments if required

Validation:

```bash
pnpm -C frontend/packages/ui typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend typecheck
```

No route migration and no visual retokenization should be bundled into that
commit.
