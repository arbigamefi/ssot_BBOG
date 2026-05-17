# Frontend Lean Closeout Roadmap

| Owner | Frontend Lead |
| Status | Active v4 |
| Last Updated | 2026-05-17 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-rewrite-blueprint.md`, `indexing-strategy.md`, `durable-bet-index.md`, `casino-placebet-ux.md`, `../frontend/21-i18n.md`, `../frontend/casino-keeper-v1.md` |
| Supersedes | `Draft v3` implementation audit log and chat-only sequencing |

This roadmap is the current execution plan for the frontend closeout. The
previous version had become a long audit ledger. Historical detail remains in
git history; this file now keeps only the decisions and next actions needed to
finish the branch without reintroducing process overhead.

## 1. Operating Principle

The frontend should be simpler, not merely more documented. The fullstack
boundary is defined in `../strategy/fullstack-product-architecture.md`:
protocol-grade contracts, lean B2C product, optional future infrastructure.

Use this rule for every next change:

1. Fix user-visible correctness before architecture cleanup.
2. Keep i18n, security, testing, and release hygiene because they are launch
   requirements, not optional enterprise ceremony.
3. Collapse files only when there is a clear single owner and no meaningful
   test or runtime boundary.
4. Do not collapse a package only to reduce package count when it is shared by
   multiple runtimes.
5. Prefer small verified commits over another broad rewrite.
6. Do not add frontend complexity for white-label/operator workflows until a
   real operator requirement exists.

## 2. What Is Already Closed

The following problems should not be reopened unless new evidence appears:

| Area                  | Current state                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Prototype routes      | `app/prototype` is gone from production routes.                                                                                  |
| Visual-system drift   | Hard-coded product UI hex / old visual-system / cyber theme residues are removed from app source.                                |
| Game page size        | No `pageClient.tsx` exceeds the old 600-line guard.                                                                              |
| Casino result proof   | Result receipt reads chain-derived settlement data instead of presenting simulation as proof.                                    |
| Keeper settlement     | A Node keeper exists, writes health snapshots outside `apps/web/public`, and is documented in `../frontend/casino-keeper-v1.md`. |
| Health route conflict | `/ops/casino-keeper-health.json` is a Next route; health files must live under `.runtime`, not `public`.                         |
| Durable feed choice   | ADR-0004 rejects subgraph for MVP; ADR-0005 selects Postgres for durable bet indexing.                                           |
| i18n policy           | `../frontend/21-i18n.md` is accepted and must remain in scope.                                                                   |

## 3. Explicitly Keep For Now

These are not accidental overengineering at the current stage:

| Item                                    | Reason                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `frontend/packages/ssot`                | Contract-facing SDK, encoding, release, and indexer surface. Do not fold into app code.                                     |
| `frontend/packages/bet-index`           | Shared by web API routes and the keeper. It owns the durable Postgres store boundary.                                       |
| `frontend/apps/keeper`                  | Separate runtime for automatic settlement. It can be simplified internally, but it should not be hidden inside the web app. |
| `docs/frontend/21-i18n.md`              | Multilingual launch is a product requirement.                                                                               |
| `docs/frontend/23-security.md`          | Wallet, RPC, CSP, and secret handling are launch requirements.                                                              |
| `docs/frontend/24-testing.md`           | The repo needs deterministic proof that simplification did not break settlement or routing.                                 |
| `docs/frontend/30-build-and-release.md` | Release artifacts and chain manifests are part of the product contract.                                                     |

## 4. Current Priority Order

### P0 - Runtime Correctness

Do first whenever any of these regress:

1. Casino `placeBet -> VRF -> keeper finalize -> result modal` must complete
   without asking the player to manually settle on the normal path.
2. The result modal must show terminal win/loss, payout, bet id, request id,
   random hash, and settlement transaction from chain facts.
3. `/api/bets/recent` and `/api/bets/player/[address]` must degrade without
   noisy 500s when the local Postgres index is absent.
4. `dev:with-keeper` must not create files under `apps/web/public/ops`.
5. Embedded release metadata must match deployed token decimals and addresses.

Verification:

```bash
pnpm -C frontend/apps/web test -- \
  src/features/casino/room/casino-round.test.ts \
  src/features/casino/room/resolution.test.ts \
  src/app/api/bets/recent/route.test.ts \
  src/app/api/bets/player/\[address\]/route.test.ts \
  src/app/ops/casino-keeper-health.json/route.test.ts
pnpm -C frontend/apps/keeper test
pnpm -C frontend/apps/web typecheck
```

### P1 - I18n Completion

This is not optional. Continue until visible product copy is locale-driven.

Scope:

1. Page metadata uses localized strings.
2. Product UI labels, button text, empty states, error states, and receipt copy
   use `next-intl` keys.
3. API error bodies may remain technical, but client UI must not render raw
   server English as product copy.
4. Root `global-error.tsx` may keep a tiny local fallback because i18n providers
   may be unavailable during a root crash.

Verification:

```bash
rg -n "\"[A-Z][^\"]*(failed|Failed|Error|Loading|Connect|Place|Settle|Pending|Result|Claim|Deposit|Withdraw|Bet|Wallet)" \
  frontend/apps/web/src
pnpm -C frontend/apps/web test -- src/i18n/config.test.ts
pnpm -C frontend/apps/web test
```

### P2 - Lean Structural Cleanup

Only apply cleanup when all three are true:

1. The file has a single production consumer.
2. The file does not own a durable domain boundary, runtime boundary, or test
   seam.
3. Folding it makes the code easier to read without creating a new large file.

Good examples:

- tiny one-type files used by one component;
- one-use wrapper components that only switch between adjacent controls;
- stale public health snapshots or compatibility files.

Bad examples:

- folding `packages/bet-index` into web while keeper also consumes it;
- folding `apps/keeper` into a browser app;
- deleting i18n/security/testing docs because they look procedural;
- merging chain SDK code into UI features.

Verification:

```bash
rg -n "prototype|compat|legacy|visual-system|cyber-" frontend/apps/web/src frontend/packages
find frontend/apps/web/src/features/casino/room -maxdepth 1 -type f | sort
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
```

### P3 - Docs Slimming

Docs should answer current decisions, not preserve every implementation log.

Keep:

- accepted ADRs;
- i18n/security/testing/release specs;
- keeper and durable index specs;
- concise roadmap and kill-list references.

Slim or archive:

- long historical audit logs;
- obsolete Gate ceremony text that no longer matches a small-team closeout;
- duplicated findings already captured by ADRs or tests.

Verification:

```bash
for f in docs/design/*.md docs/frontend/*.md; do
  printf '%5s %s\n' "$(wc -l < "$f")" "$f"
done | sort -nr
rg -n "Status \\| Draft|Gate A|Gate B|Gate C" docs/design docs/frontend
```

### P4 - Product Expansion

Do not start this until P0/P1 are stable and P2 no longer finds cheap cleanup.

Candidates:

1. Add the remaining v1.3 casino games if the contracts and SDK are ready.
2. Continue sportsbook provider/oracle hardening.
3. Improve portfolio and feed indexing using the durable Postgres path.

## 5. Current Next Actions

Execute in this order:

1. Finish i18n fallback cleanup and metadata localization.
2. Fix any P0 runtime regressions found during local testing.
3. Collapse only obvious one-consumer frontend files.
4. Keep `packages/bet-index` and `apps/keeper` as separate runtime boundaries.
5. Slim roadmap/docs that became historical logs.
6. Run full local gates and commit locally.
7. Only then decide whether this phase is ready for push and PR.

## 6. Do Not Do Next

- Do not introduce The Graph or a subgraph for MVP indexing.
- Do not move keeper health JSON back to `apps/web/public`.
- Do not expose raw server errors as product copy.
- Do not mark all SSOT docs `Accepted` just to close a formal gate.
- Do not collapse shared runtime packages for cosmetic file-count reduction.
- Do not add new casino games before the current casino round UX is stable.

## 7. Standard Local Gate

Use this gate before each local closeout commit:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

After `pnpm -C frontend/apps/web build`, restore
`frontend/apps/web/next-env.d.ts` to reference `.next-dev/types/routes.d.ts`
before committing.

## 8. Decision Log

| Date       | Decision                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| 2026-05-17 | i18n stays in scope because multilingual launch is required.                |
| 2026-05-17 | `packages/bet-index` stays separate because web and keeper both consume it. |
| 2026-05-17 | Keeper remains a separate runtime because it owns automatic settlement.     |
| 2026-05-17 | Roadmap changed from historical audit ledger to lean closeout plan.         |
