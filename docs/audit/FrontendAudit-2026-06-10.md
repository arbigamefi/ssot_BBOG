# ArbiGameFi Frontend — Security & Quality Assessment

| Field         | Value                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Client        | ArbiGameFi (FanSwapOrg)                                                                                                          |
| Codebase      | `frontend/` monorepo: `apps/web`, `apps/keeper`, `packages/ssot`, `packages/bet-index`, `packages/ui`                            |
| Audit type    | Full-surface assessment (chain boundary, funds-path UX, off-chain settlement, durable index, web security, i18n/release hygiene) |
| Companion     | `DeltaAudit-2026-06-10.md` (smart contracts)                                                                                     |
| Review HEAD   | `3bb7cc2c67b42725529620b1e4c4925d76e82519` (2026-06-10) + uncommitted working tree                                               |
| Toolchain     | Next.js 15 (App Router), React, viem/wagmi, next-intl (5 locales), vitest, Node keeper, Postgres (`postgres` driver)             |
| Reviewer      | AI-assisted review (Claude Opus 4.8), human-owned process                                                                        |
| Report date   | 2026-06-10                                                                                                                       |
| Report status | Final for the stated scope                                                                                                       |

---

## 1. Disclaimer

This assessment reviews application-layer code: it covers how the frontend,
keeper, and index handle funds-affecting inputs, chain-derived truth, secrets,
and user data. It does not re-audit the smart contracts (see the companion
report), does not constitute a penetration test of deployed infrastructure, and
did not exercise a production deployment. The working tree contained
substantial uncommitted changes at review time; findings note whether they
apply to HEAD, the working tree, or both.

**Scope boundary.** This is a code / chain-boundary / deployment-readiness
assessment. It is **not** a UI/UX product acceptance review: visual design,
mobile ergonomics, sharing/OG creative quality, and conversion flows are
tracked in the separate product UI/UX acceptance workstream and are
intentionally not graded here.

---

## 2. Executive Summary

The frontend codebase is in materially better shape than typical pre-launch
crypto consumer apps. Its defining strength is a **zero-inference chain
boundary**: the web app and keeper consume digest-pinned, per-chain release
manifests and ABIs from `packages/ssot` (verified against golden vectors), so
no contract address, decimal, or struct shape is ever guessed at runtime. The
funds-affecting paths honor the repo's own hard rules almost everywhere:
transactions are simulated before sending (web SDK and keeper), asset amounts
cross the float boundary only through an exact string→bigint parser, SQL is
parameterized by construction, and raw RPC/contract errors are mapped to an
i18n error taxonomy before reaching users.

**No Critical or High severity issues were identified.** One Low finding
(FE-01) and one Informational finding (FE-05) are resolved in the uncommitted
working tree; two Low findings (FE-02, FE-03) remain open. The remaining items
are hardening and hygiene.

Verification at review time (all green):

- **703 tests across 125 files, 0 failures**: web 464/98, ssot 170/12,
  keeper 30/9, bet-index 16/2, ui 23/4.
- `tsc --noEmit` clean for the web app (working tree, including this cycle's
  UI/i18n/OG changes); production build clean with all routes registered.
- Repo fast scans (CLAUDE.md): no prototype routes, no legacy shells, no
  visual-system/cyber residue, no ops files under `public/`, no native
  `<input type="number">` for amounts. The only `legacy|compat|prototype`
  matches are benign comments and `Object.prototype.hasOwnProperty`.
- Bank `getSSOT` ABI alignment with the compiled contract verified for both
  chains (see companion report, Appendix B); an ABI drift CI guard is present
  (uncommitted) and reviewed favorably.

| Severity      | Count | Open | Resolved | Acknowledged |
| ------------- | ----- | ---- | -------- | ------------ |
| Critical      | 0     | —    | —        | —            |
| High          | 0     | —    | —        | —            |
| Medium        | 0     | —    | —        | —            |
| Low           | 3     | 2    | 1        | —            |
| Informational | 4     | 2    | 1        | 1            |

---

## 3. Scope

### 3.1 In scope (full review)

| Surface                                                                            | What was reviewed                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain boundary (`packages/ssot`)                                                   | SDK read/write paths (`sdk/create.ts`), by-name `getSSOT` decode with legacy fallbacks, embedded release manifests + per-chain ABIs, encoding modules, indexer store types   |
| Funds-path UX (`apps/web/features/casino`, `features/earn`, `features/sportsbook`) | Amount input parsing and clamping, `placeBet` build path (`place-bet.ts`), simulation-before-send, pool/asset selection, risk gates                                          |
| Off-chain settlement (`apps/keeper`)                                               | Key handling (`env.ts`), transaction path (`runtime.ts`), finalizer/scan/backfill structure, health snapshot placement, primary/backup roles                                 |
| Durable index (`packages/bet-index`)                                               | SQL construction (parameterization), schema bootstrap, transaction use, filter composition                                                                                   |
| Web security (`apps/web`)                                                          | `security-headers.mjs` (CSP + headers, with tests), API route input validation (`normalizeBetId`, `parseRequestChainId`), Sentry scrubbing (tested), JSON-LD injection sites |
| i18n & release hygiene                                                             | 5-locale parity analysis (key-level diff), deep-merge fallback design, metadata/OG correctness, `next-env.d.ts` discipline                                                   |

### 3.2 Out of scope

- Smart contracts (companion report `DeltaAudit-2026-06-10.md`).
- Production infrastructure (reverse proxy, Docker images under
  `frontend/deploy/` reviewed only as templates), DNS/TLS posture.
- Third-party dependency audit beyond what tests/build exercise.
- Economic correctness of odds/payout values (chain-derived; contract scope).

---

## 4. Methodology

1. **Rules-first**: the repo's own `frontend/CLAUDE.md` hard rules and
   `docs/frontend/{21,23,24,30}` launch requirements were treated as the
   compliance baseline; each rule was checked against code, not changelogs.
2. **Funds-path tracing**: user keystroke → UI state → stake encoding →
   simulation → transaction, and chain event → keeper → Postgres → API → UI,
   with attention to every float/string/bigint conversion.
3. **Injection surface review**: SQL composition in `bet-index`, JSON-LD
   `dangerouslySetInnerHTML` sites, API route parameter handling.
4. **Secret and key handling**: keeper key lifecycle, local env file
   inventory, `.gitignore` verification (`git check-ignore`), tracked-file
   sweep for credentials (only `.env.example` templates are tracked).
5. **Dynamic verification**: full test suites for all five packages,
   typecheck, production build, and the CLAUDE.md fast scans, all at review
   HEAD + working tree.

Severity classification follows the same Impact × Likelihood matrix as the
companion contract report (§4.1 there).

---

## 5. Findings

### Summary table

| ID    | Title                                                                                    | Severity      | Status                  |
| ----- | ---------------------------------------------------------------------------------------- | ------------- | ----------------------- |
| FE-01 | Page-level Twitter metadata silently dropped `summary_large_image`                       | Low           | Resolved (working tree) |
| FE-02 | Casino amount input parses user input with `Number()`, deviating from the repo hard rule | Low           | Open                    |
| FE-03 | Plaintext mainnet deployment keys in local env files at the repo root                    | Low           | Open (operational)      |
| FE-04 | Production CSP allows `script-src 'unsafe-inline'`                                       | Informational | Open                    |
| FE-05 | Receipt OG route could reach the RPC fallback un-throttled                               | Informational | Resolved (working tree) |
| FE-06 | Bet-amount precision is capped at 2 decimals regardless of asset                         | Informational | Open                    |
| FE-07 | i18n coverage gaps in pt-BR/ru/tr (sportsbook, legal)                                    | Informational | Acknowledged            |

---

### FE-01 — Page-level Twitter metadata silently dropped `summary_large_image`

- **Severity**: Low (marketing/share quality; no security impact)
- **Location**: `apps/web/src/i18n/metadata.ts` (`buildPageMetadata`)
- **Status**: **Resolved** — fixed in the uncommitted working tree.

**Description.** Next.js merges page metadata into layout metadata shallowly
per top-level field: a page-level `twitter` object **replaces** the root
layout's wholesale. `buildPageMetadata` set `twitter = { title, description }`,
so every page using it (all eight game rooms included) silently lost the
layout's `card: "summary_large_image"` and rendered the small Twitter card.
The receipt page had independently re-added the card type — evidence the trap
had been hit before without being fixed at the source.

**Resolution.** `buildPageMetadata` now asserts
`card: "summary_large_image"` whenever it emits a `twitter` object, with a
comment documenting the Next merge behavior. The receipt page's local patch
was reduced to image-only. Covered by the existing metadata tests.

---

### FE-02 — Casino amount input parses user input with `Number()`, deviating from the repo hard rule

- **Severity**: Low (precision is bounded; transaction edge is exact)
- **Location**: `apps/web/src/features/casino/room/bet-panel-sections.tsx`
  (`parseBetAmountInput`, `parseWholeUnitInput`)
- **Status**: Open

**Description.** `frontend/CLAUDE.md` forbids `parseFloat`/`Number(...)` on
user-entered asset amounts. The casino bet panel keeps the bet amount as a
JavaScript number: `parseBetAmountInput` regex-extracts `\d+(\.\d{0,2})?` from
the input and converts it with `Number(match[0])`. By contrast, the sportsbook
slip (`useBetSlip.ts`) keeps the stake as a string and parses it directly with
the exact `parseDecimalToUnits` — the pattern the rule intends.

**Why this is Low rather than higher**: the float intermediate is bounded to
two decimal places at every entry point (regex, `toCents`, clamps), and the
transaction edge re-serializes with
`toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: decimals })`
before the exact string→bigint `parseDecimalToUnits`
(`place-bet.ts::toUnits`). At ≤2 decimal places, float→string round-trips are
exact far beyond any realistic stake, and the locale pin avoids
decimal-comma corruption. No value-corruption path was found.

**Recommendation.** Fix together with FE-06 as **one amount-model task** —
they are the same root cause (a float-cents amount model inherited from the
USDC-only era): migrate the casino amount state to the string-first pattern
already used by the sportsbook slip, with per-asset precision/minimum
resolved from the pool context. Alternatively, record an explicit, scoped
exemption next to the hard rule so future reviews don't re-litigate it. Keep
the regression tests on `parseBetAmountInput` either way.

---

### FE-03 — Plaintext mainnet deployment keys in local env files at the repo root

- **Severity**: Low (operational; nothing is git-tracked)
- **Location**: repo root `.env`, `.base-mainnet-v13-casino.env`,
  `.base-mainnet-v14-casino.env`, `.env.sports-roles.local` (local disk only)
- **Status**: Open

**Description.** Local env files at the repo root contain `PRIVATE_KEY`
entries — including files named for Base **mainnet** deployments — plus canary
signer/reporter keys for sports roles. Verified: none of these files are
git-tracked (only `*.env.example` templates are), and `git check-ignore`
confirms `.env`, `.env.*`, and `/.base-mainnet*.env` are covered by
`.gitignore`. The residual risks are local-machine compromise, accidental
`git add -f`, ignore-pattern drift on rename, and shell history/backup leakage
— standard plaintext-key-on-disk exposure.

Mitigating design note (positive): the **keeper key is low-privilege by
construction**. `finalize`/`refund` are permissionless on-chain, so the keeper
key holds no special authority — worst case is gas drain, not fund risk. The
concern concentrates on the **deployment/governance** keys in the mainnet env
files.

**Recommendation — operational checklist** (in order):

1. **Rotate.** Treat every key that has existed in plaintext on disk as
   exposed: rotate the mainnet deployment/governance keys and the sports-role
   canary signer/reporter keys. The keeper key is low-privilege but cheap to
   rotate in the same pass.
2. **Re-home production signing.** Move mainnet governance/deployment signing
   to a hardware wallet or an encrypted keystore
   (`cast wallet import` + `--account`); production env files keep only RPC
   URLs and addresses, never key material.
3. **Commit guard.** Keep `.env`, `.env.*`, and `/.base-mainnet*.env` ignored
   (verified present in `.gitignore`); add a pre-commit hook that blocks
   `PRIVATE_KEY=0x` patterns outside `*.example`; avoid keys in shell history
   (keystore prompts / `read -s`, not inline env assignment).
4. **Artifact hygiene.** No key material was copied into this report or any
   review artifact; keep that rule for all future audit/incident documents.

---

### FE-04 — Production CSP allows `script-src 'unsafe-inline'`

- **Severity**: Informational (defense-in-depth)
- **Location**: `apps/web/src/server/security-headers.mjs`
- **Status**: Open

**Description.** The security-header set is otherwise strong — `default-src
'self'`, `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `object-src
'none'`, HSTS preload, `nosniff`, restrictive Permissions-Policy, and a tight
`connect-src` allowlist (RPCs, WalletConnect, Sentry) — and it is covered by
tests. However, production `script-src` includes `'unsafe-inline'` (no nonces
or hashes), which neutralizes much of CSP's XSS containment for inline script
injection. The JSON-LD `dangerouslySetInnerHTML` sites were reviewed and only
serialize static/server-derived data (no user input), so there is no known
injection source today; this is purely hardening.

**Recommendation.** Adopt nonce-based CSP (Next.js supports per-request nonces
via middleware) with `'strict-dynamic'`, and remove `'unsafe-inline'` from
`script-src` in production. Keep `style-src 'unsafe-inline'` if styled-jsx
requires it; it is far lower risk.

---

### FE-05 — Receipt OG route could reach the RPC fallback un-throttled

- **Severity**: Informational (availability/cost, not integrity)
- **Location**:
  `apps/web/src/app/(product)/casino/receipt/[chainId]/[betId]/og/route.tsx`
- **Status**: **Resolved** — fix present in the uncommitted working tree at
  review time; pending commit.

**Description.** The receipt surface in the working tree has moved to
`/casino/receipt/[chainId]/[betId]` and now carries the protection this finding
asked for:

- the **receipt API and hydrate API are rate-limited**
  (`publicReadRateLimit` per route key, 429 + quota headers);
- the **OG route serves terminal receipts with immutable cache headers**
  (`OG_IMMUTABLE_CACHE_HEADERS` — correct, since terminal receipts never
  change);
- the **OG route itself is rate-limited** before querying receipt data
  (`BETS_RECEIPT_OG_RATE_LIMIT_PER_MINUTE`, fallback 120/minute, 429 + quota
  headers);
- the **not-ready path is short-lived cacheable** (`s-maxage=5`,
  `stale-while-revalidate=30`, `Retry-After: 5`), so crawler/probe bursts
  collapse instead of repeatedly falling through to the RPC window fallback.

This closes the residual availability/cost gap. Input validation
(`normalizeBetId`, strict chainId path segment) remains the integrity boundary.

---

### FE-06 — Bet-amount precision is capped at 2 decimals regardless of asset

- **Severity**: Informational (product/UX, multi-asset)
- **Location**: `bet-panel-sections.tsx` (`toCents`, `MIN_BET_AMOUNT = 0.01`,
  input pattern `\d+(\.\d{0,2})?`)
- **Status**: Open

**Description.** The casino amount model is hard-wired to cent precision and a
0.01 minimum. For 6-decimal stables (USDC) this is natural. For 18-decimal
assets (the WETH pool added by the multi-asset work), 0.01 WETH is both the
minimum stake and the step size — a coarse and comparatively expensive
granularity (~tens of dollars), and ½/2× quick-adjusts quantize to it. This is
a product decision, not a defect, but it was likely inherited from the
USDC-only era rather than chosen.

**Recommendation.** Same remediation task as FE-02 (one refactor, one
review): string-first amount state with per-asset precision and minimum
resolved from the pool/asset context (e.g. a display-decimals field). If the
cent model is instead kept deliberately, document it as a cross-asset product
choice.

---

### FE-07 — i18n coverage gaps in pt-BR/ru/tr (sportsbook, legal)

- **Severity**: Informational (launch-scope tracking)
- **Status**: Acknowledged (explicit decisions on record)

**Description.** Key-level locale diff at review time: **zh-Hans has 100%
parity with en** (the receipt block was localized into all four non-English
locales during this cycle, terminology-matched per locale). pt-BR/ru/tr still
fall back to English for ~897 keys each: `sportsbook.*` (683 — feature is
behind `NEXT_PUBLIC_SPORTSBOOK_ENABLED`), `ops.*`/`opsSportsbook.*` (164 —
English by design, documented in `config.test.ts`), `legal.*` (47 — held for
professional legal translation by explicit decision), plus 3 trivia. The
deep-merge fallback guarantees no missing-key crashes; gaps degrade to English.

**Recommendation.** Track sportsbook localization as a launch gate for that
feature (a prepared task exists); commission legal translation before serving
those locales' markets in earnest; leave ops English.

---

## 6. Positive Observations

These are deliberate design strengths worth preserving (several are direct
hard-rule compliance, verified rather than assumed):

1. **Zero-inference chain boundary.** Per-chain embedded release manifests are
   digest-pinned; ABIs ship with the release bundle; golden-vector tests pin
   encoding bytes. The `getSSOT` decode accesses fields **by name with legacy
   fallbacks** (`riskReserve ?? minLiq`), which is what kept the v13→v14
   struct insertion from breaking the UI.
2. **Simulation before send, everywhere.** The web SDK plans/simulates before
   `placeBet`; the keeper calls `simulateContract` before both of its
   `writeContract` paths.
3. **Permissionless-keeper architecture.** Settlement liveness does not depend
   on a privileged key; the keeper merely pays gas for what anyone could call.
   Health snapshots live outside `public/` (route-served), primary/backup
   roles exist.
4. **Parameterized SQL by construction.** `bet-index` uses the `postgres`
   tagged-template driver throughout; the only `sql.unsafe` is a static DDL
   constant. Filter composition (`asset`, `since`) stays inside tagged
   fragments.
5. **Error taxonomy.** Raw RPC/viem/contract errors are mapped to i18n product
   copy (tested: `sports-errors.test.ts`, casino feedback tests) — no raw
   server errors leak as UI text.
6. **Tested security headers and telemetry scrubbing.**
   `security-headers.test.ts` and `sentry-scrub.test.ts` exist and pass; CSP
   `connect-src` is an explicit allowlist.
7. **API input validation.** `normalizeBetId` (try/catch → 404) and
   `parseRequestChainId` (supported-chain pin) gate the public bet endpoints.
8. **Release hygiene discipline.** `next-env.d.ts` dev-pointer restoration,
   prettier/i18n-parity gates, and the CLAUDE.md fast scans all came back
   clean at review time; an ABI drift CI guard is queued in the working tree.

---

## 7. Verification Evidence

All commands executed 2026-06-10 at HEAD `3bb7cc2c6` + working tree.

| Gate                                       | Result                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -C frontend/apps/web test`           | 98 files / **464 passed** / 0 failed                                                                                                                       |
| `pnpm -C frontend/packages/ssot test`      | 12 files / **170 passed** / 0 failed (encoding + SDK integration + golden vectors)                                                                         |
| `pnpm -C frontend/apps/keeper test`        | 9 files / **30 passed** / 0 failed                                                                                                                         |
| `pnpm -C frontend/packages/bet-index test` | 2 files / **16 passed** / 0 failed                                                                                                                         |
| `pnpm -C frontend/packages/ui test`        | 4 files / **23 passed** / 0 failed                                                                                                                         |
| `pnpm -C frontend/apps/web typecheck`      | clean                                                                                                                                                      |
| `pnpm -C frontend/apps/web build`          | clean; OG/receipt/API routes registered; `next-env.d.ts` restored                                                                                          |
| CLAUDE.md fast scans                       | no prototype dir; no legacy shells; no ops files in `public/`; no `<input type="number">`; token matches classified benign (comments / `Object.prototype`) |
| Secrets sweep                              | git-tracked env files: `*.example` only; local key-bearing env files confirmed gitignored (`git check-ignore`)                                             |
| ABI alignment                              | `getSSOT` 20-field match, compiled artifact vs both chains' frontend ABIs (companion report, Appendix B)                                                   |

---

## 8. Conclusion

The frontend's funds-affecting machinery — chain boundary, amount handling,
settlement keeper, durable index — is disciplined and test-backed, and the
repo's self-imposed hard rules are real constraints that the code actually
follows, with one bounded deviation (FE-02). Nothing found rises above Low.

Recommended order of remediation:

1. Land the working-tree fixes already queued (FE-01, FE-05, plus the ABI
   drift/live-shape CI guards and runbook fix from the companion report).
2. FE-03: execute the key-handling checklist — rotate, re-home production
   signing, commit guard.
3. FE-02 + FE-06 as **one amount-model refactor**: string-first state with
   per-asset precision/minimum.
4. FE-04 nonce-based CSP.
5. FE-07: sportsbook/legal localization, gated
   to their respective feature launches.
