# SSOT Frontend — Phase 4+ Backlog: Production Readiness

> From "feature-complete" to "production-grade, operationally-ready".

## Pre-Conditions (Phases 1-3 completed)

- Phase 1 (PRs 1-9): Foundation — SDK, UI package, provider chain, ESLint boundaries
- Phase 2 (PRs 10-19): SDK completion, indexers, all 10 pages, i18n, error mappings, tx pipeline
- Phase 3 (PRs 20-23): Wallet kit (RainbowKit v2), games listing, mobile nav, no-wallet UX
- 105 tests passing across 10 test files
- All pages functional with wallet connect/disconnect/chain-switch
- Toast notifications, error boundaries, skeleton loading all wired

---

## Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Ship blocker — cannot deploy to production without this |
| **P1** | Must-have for operational quality and confidence |
| **P2** | UX polish — improves user experience significantly |
| **P3** | Developer experience — improves velocity and code quality |
| **P4** | Operations — deployment, monitoring, analytics |

---

## Backlog Items

### P0 — Infrastructure (Ship Blockers)

#### 1. `.gitignore` + `.env.example` — P0

**Why**: No `.gitignore` at `ssot_frontend/` root. Risk of committing `node_modules/`, `.next/`, `.env.local`, IDE files. No env var documentation for developer onboarding.

**Files**:
- `ssot_frontend/.gitignore` — NEW
- `apps/web/.env.example` — NEW

**Acceptance**: `git status` clean of build artifacts. New dev copies `.env.example` → `.env.local` and runs.

---

#### 2. Static Assets (`public/` directory) — P0

**Why**: No favicon, robots.txt, web manifest, OG image. Browser tab shows default icon. Social sharing previews are blank.

**Files**:
- `apps/web/public/favicon.ico` — NEW
- `apps/web/public/favicon-16x16.png` — NEW
- `apps/web/public/favicon-32x32.png` — NEW
- `apps/web/public/apple-touch-icon.png` — NEW
- `apps/web/public/robots.txt` — NEW
- `apps/web/public/manifest.json` — NEW
- `apps/web/public/og-image.png` — NEW
- `apps/web/src/app/layout.tsx` — update metadata

**Acceptance**: Favicon in browser tab. `curl /robots.txt` returns directives. OG preview renders on social platforms.

---

#### 3. Next.js Security Headers — P0

**Why**: `next.config.mjs` has zero security headers. Vulnerable to clickjacking (no X-Frame-Options), XSS amplification (no CSP), MIME sniffing (no X-Content-Type-Options).

**Files**:
- `apps/web/next.config.mjs` — add `headers()` async function

**Headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-DNS-Prefetch-Control, Strict-Transport-Security, Permissions-Policy, Content-Security-Policy.

**Acceptance**: `curl -I localhost:3000` shows all headers. CSP doesn't break wallet connections or RPC calls.

See: ADR-029-PRODUCTION-INFRA.md

---

#### 4. Error Tracking (Sentry) — P0

**Why**: No production error visibility. Runtime errors, failed transactions, network issues completely invisible to operators.

**Files**:
- `apps/web/package.json` — add `@sentry/nextjs`
- `apps/web/sentry.client.config.ts` — NEW
- `apps/web/sentry.server.config.ts` — NEW
- `apps/web/sentry.edge.config.ts` — NEW
- `apps/web/next.config.mjs` — wrap with `withSentryConfig()`
- `apps/web/src/app/global-error.tsx` — NEW

**Acceptance**: Test error → Sentry dashboard. Source maps uploaded. `global-error.tsx` catches unhandled errors.

See: ADR-029-PRODUCTION-INFRA.md

---

### P1 — SDK & Testing Hardening

#### 5. Release Loader Tests — P1

**Why**: `loader.ts` has critical `deriveGamesMeta()` defensive fallback with zero test coverage. If release bundle format changes, breakage is silent.

**Files**:
- `packages/ssot/src/release/loader.test.ts` — NEW (8+ tests)

**Test cases**: happy path, deriveGamesMeta fallback, malformed input, schema validation reject, gamesMeta pass-through.

---

#### 6. Indexer Sync Tests — P1

**Why**: `hubIndexer.syncOnce()` and `bankIndexer.syncOnce()` have no direct tests. Only `reduce.test.ts` covers state transitions.

**Files**:
- `packages/ssot/src/indexer/hubIndexer.test.ts` — NEW
- `packages/ssot/src/indexer/bankIndexer.test.ts` — NEW

**Test cases**: syncOnce with logs, cursor advancement, empty batches, duplicate idempotency.

---

#### 7. UI Component Tests — P1

**Why**: `apps/web` has only 15 tests across 2 files. Key components (AppShell, ConnectWalletPrompt, games listing) untested.

**Files**:
- `apps/web/src/components/AppShell.test.tsx` — NEW
- `apps/web/src/components/ConnectWalletPrompt.test.tsx` — NEW
- `apps/web/src/app/games/pageClient_list.test.tsx` — NEW

**Acceptance**: 12+ new component tests. `pnpm test` passes.

---

#### 8. Encoder Registry Pattern — P1

**Why**: Game detail `pageClient.tsx` uses hardcoded `switch(game.slug)` for param encoding dispatch. Adding a game requires editing multiple switch statements.

**Files**:
- `packages/ssot/src/encoding/registry.ts` — NEW
- `packages/ssot/src/encoding/registry.test.ts` — NEW
- `apps/web/src/app/games/[slug]/pageClient.tsx` — refactor

**Acceptance**: New game = one registry entry. Golden vectors still pass.

---

### P2 — UX Polish

#### 9. Dark Mode Toggle — P2

**Why**: Tailwind dark mode fully configured (`:root` + `.dark` CSS vars), all UI components have `dark:` classes, but no user-facing toggle.

**Files**:
- `packages/ui/src/components/ui/theme-toggle.tsx` — NEW
- `apps/web/src/components/AppShell.tsx` — add toggle in header

**Acceptance**: Toggle switches light/dark. Persists in localStorage. No FOUC.

---

#### 10. Pagination for Tables — P2

**Why**: Bets page and Account page render all items. Poor performance with many entries.

**Files**:
- `packages/ui/src/components/ui/pagination.tsx` — NEW
- `apps/web/src/app/bets/pageClient.tsx` — paginate
- `apps/web/src/app/account/pageClient.tsx` — paginate

**Acceptance**: 20 items per page with navigation controls.

---

#### 11. Copy Buttons for Addresses/Hashes — P2

**Why**: Users must manually select text to copy addresses, tx hashes, bet IDs.

**Files**:
- `packages/ui/src/components/ui/copy-button.tsx` — NEW
- Apply across: bet detail, games list, account page, liquidity page

**Acceptance**: Click → clipboard + "Copied!" tooltip.

---

#### 12. Bet Result Display Enhancement — P2

**Why**: Bet detail shows raw data without clear win/loss outcome or payout amounts.

**Files**:
- `apps/web/src/app/bets/[betId]/pageClient.tsx` — add win/loss badge, payout, profit/loss, randomness reveal

**Acceptance**: Finalized bets show clear outcome. Pending bets show waiting state.

---

### P3 — Developer Experience

#### 13. Pre-commit Hooks (Husky + lint-staged) — P3

**Why**: No local validation. Lint/type errors caught only by CI.

**Files**:
- `ssot_frontend/package.json` — husky + lint-staged
- `ssot_frontend/.husky/pre-commit` — NEW
- `ssot_frontend/.lintstagedrc.json` — NEW

**Acceptance**: Commit with lint error → rejected. Fix → succeeds.

---

#### 14. Storybook Enhancements — P3

**Why**: Storybook builds but no a11y addon, no dark mode, limited stories.

**Files**:
- `packages/ui/package.json` — add `@storybook/addon-a11y`
- `packages/ui/.storybook/main.ts` — register addon
- `packages/ui/.storybook/preview.ts` — dark mode decorator
- Stories for new components

**Acceptance**: A11y panel visible. Dark mode in toolbar.

---

#### 15. E2E Testing Setup (Playwright) — P3

**Why**: Only unit tests. No smoke test for user flows.

**Files**:
- `apps/web/playwright.config.ts` — NEW
- `apps/web/e2e/smoke.spec.ts` — NEW

**Acceptance**: `pnpm e2e` runs headless smoke tests.

---

### P4 — Operations & Deployment

#### 16. Analytics Integration — P4

**Why**: No usage data for operators.

**Files**:
- `apps/web/src/app/providers/AnalyticsProvider.tsx` — NEW
- `apps/web/src/app/layout.tsx` — include provider

**Acceptance**: Page views tracked in dashboard.

---

#### 17. Deployment Configuration — P4

**Why**: No deployment config or documentation.

**Files**:
- `docs/frontend/DEPLOY.md` — NEW
- `apps/web/vercel.json` or `Dockerfile` — NEW

**Acceptance**: One-click deploy with documented env vars.

---

#### 18. CI Deploy Preview — P4

**Why**: PRs have no preview URL for reviewers.

**Files**:
- `.github/workflows/preview.yml` — NEW
- `docs/frontend/adr/ADR-030-DEPLOY-PREVIEW.md` — NEW

**Acceptance**: PR comment includes preview URL.

---

## Execution Order (PR-by-PR)

```
PR 24: ADR-029 Production Infrastructure doc       (doc-first)
PR 25: .gitignore + .env.example + public/ assets  (#1 + #2)
PR 26: Security headers in next.config.mjs         (#3)
PR 27: Sentry error tracking                       (#4)
PR 28: Release loader + indexer sync tests          (#5 + #6)
PR 29: UI component tests                          (#7)
PR 30: Encoder registry refactor                   (#8)
PR 31: Dark mode toggle                            (#9)
PR 32: Pagination + copy buttons                   (#10 + #11)
PR 33: Bet result display enhancement              (#12)
PR 34: Husky + lint-staged                         (#13)
PR 35: Storybook a11y + dark mode + stories        (#14)
PR 36: E2E testing setup (Playwright)              (#15)
PR 37: Analytics integration                       (#16)
PR 38: Deployment config + guide                   (#17)
PR 39: CI deploy preview                           (#18)
```

**Batches**:
- PRs 24-27: Ship-blocker infrastructure (must land before production deploy)
- PRs 28-30: SDK/test hardening (reduces production risk)
- PRs 31-33: UX polish (user-facing improvements)
- PRs 34-36: DX improvements (developer productivity)
- PRs 37-39: Operations (deployment + monitoring)

---

## Verification (every PR)

1. `pnpm typecheck` — zero errors
2. `pnpm test` — all tests pass (target: 130+ by PR 29)
3. `pnpm lint` — ESLint boundaries enforced
4. `pnpm build` — production build succeeds
5. `pnpm storybook:build` — Storybook builds
6. Manual: localhost:3000 smoke test on affected pages
