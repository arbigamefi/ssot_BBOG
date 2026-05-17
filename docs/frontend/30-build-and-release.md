# 30 · Build, CI & Release

| Owner | Frontend Lead + SRE |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `23-security.md`, `24-testing.md`, `25-observability.md` |
| Supersedes | — |

This document specifies how the frontend is built, tested, previewed,
released, and rolled back. Everything is **reproducible from a tag**, no
manual surgery.

## 1. Stack

| Concern         | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Framework       | Next.js 15.x App Router                                                 |
| Runtime         | Node 24 LTS                                                             |
| Package manager | pnpm 9.x with workspace                                                 |
| Bundler         | Next.js (Turbopack in dev, webpack in prod until Turbopack-prod stable) |
| Deploy target   | Vercel (primary) + IPFS pin (fallback)                                  |
| CI              | GitHub Actions                                                          |
| Visual QA       | Chromatic                                                               |
| Status page     | Statuspage.io                                                           |

Pin versions in `package.json` `engines` and `packageManager`.

## 2. Repo & Branch Model

```
main          ← protected; ships to production via tag
release/*     ← release candidates pinned to a contract digest
feat/*        ← feature branches; preview deployments
fix/*         ← bugfix branches
chore/*       ← non-product changes (deps, docs, CI)
```

- `main` always deployable.
- Direct push to `main` blocked. PRs only.
- Branch naming enforced in CI.

### 2.1 Commit messages

Conventional Commits required:

```
feat(casino): add plinko module
fix(portfolio): correct withdraw cap rounding
chore(deps): bump wagmi to 2.14.1
docs(design): accept ADR 0004
```

Scope is one of: `casino|sportsbook|portfolio|earn|ops|shell|ui|build|deps|docs|test|ci`.

## 3. Environments

| Env         | URL                                        | Deploy trigger       | Sentry env  |
| ----------- | ------------------------------------------ | -------------------- | ----------- |
| development | local                                      | `pnpm dev`           | development |
| preview     | `<branch>.arbigamefi-preview.com` (Vercel) | every PR             | preview     |
| staging     | `staging.arbigamefi.com`                   | merge to `main`      | staging     |
| production  | `arbigamefi.com`                           | release tag `vN.M.P` | production  |

Each env loads its own `.env.<env>` file. No env mutation at runtime.

## 4. Required CI Checks (per PR)

```yaml
# .github/workflows/frontend-ci.yml (excerpt)
jobs:
  install: # pnpm install --frozen-lockfile
  typecheck: # tsc --noEmit across packages
  lint: # eslint + prettier --check
  unit: # vitest run
  components: # storybook test-runner
  integration: # vitest in features/*
  contract: # golden-vector equality
  bundle-budget: # ANALYZE=true next build + scripts/check-bundle-budget
  visual: # Chromatic (UI-touching PRs only)
  e2e: # Playwright (UI-touching PRs only, against preview)
  a11y: # axe-playwright
  lighthouse: # Lighthouse CI against preview
  secrets: # secretlint + gitleaks
  license: # pnpm licenses ls allowlist check
  doc-coverage: # ensure every changed feature has updated SSOT links
```

Required: `install`, `typecheck`, `lint`, `unit`, `components`,
`integration`, `contract`, `secrets`, `license`.

Required for UI PRs (paths matching `frontend/apps/web/**` or
`frontend/packages/ui/**`): `bundle-budget`, `visual`, `e2e`, `a11y`,
`lighthouse`.

Required for docs PRs (paths matching `docs/**`): `doc-coverage`.

PRs without all required checks cannot be merged.

## 5. Preview Deployments

- Every PR receives a Vercel preview URL.
- Preview URLs follow `<pr-number>.arbigamefi-preview.com`.
- Sentry environment = `preview`; release tag = git SHA.
- Preview deployments have `noindex,nofollow` meta tags by default.
- A `prototype` query parameter (`?prototype=1`) is **not** supported in
  preview. Prototype routes live in `apps/web/src/sandbox/` and aren't
  routable.

## 6. Release Pipeline

### 6.1 Release commit

A release is a signed commit on `main` tagging:

```
release-frontend-v<MAJOR>.<MINOR>.<PATCH>
```

Tag annotation includes:

- contract `release_digest`
- minimum compatible contract version
- changelog excerpt

### 6.2 Frontend / Contract version pairing

Frontend major versions are independent of contract releases, but a frontend
release **pins** to a specific `release_digest`. At runtime, the manifest's
`release_digest` must match `NEXT_PUBLIC_RELEASE_DIGEST`; mismatch shows the
domain-pill anti-phishing banner.

### 6.3 Build steps

```bash
# 1. install
pnpm install --frozen-lockfile

# 2. precheck
pnpm typecheck
pnpm lint
pnpm test
pnpm test:contract

# 3. build with release env
NEXT_PUBLIC_BUILD_SHA=$GITHUB_SHA \
NEXT_PUBLIC_RELEASE_DIGEST=$(jq -r .release_digest deployments/release-latest.json) \
  pnpm -C frontend/apps/web build

# 4. upload sourcemap (private)
pnpm sentry:release-upload

# 5. deploy
vercel deploy --prod --token=$VERCEL_TOKEN
```

### 6.4 Post-deploy

- Smoke test: hit `/api/healthz` + `/api/release` + 3 representative routes.
- Visual regression baseline updated (only on production release).
- Statuspage announcement.

## 7. Rollback

Rollback is a Vercel UI action against the previous deployment. Procedure:

1. Identify last-known-good deployment in Vercel dashboard.
2. Promote it to production.
3. Confirm `/api/healthz` shows the previous `build`.
4. Sentry release dashboard adjusted.

Rollback target time: **≤ 5 minutes** from page on-call to live recovery.

The frontend never has database migrations; rollback is risk-free at the
frontend layer.

## 8. Feature Flags

### 8.1 Source

Environment-config-driven flags via `NEXT_PUBLIC_FLAG_*` plus an optional
cookie override for dev/preview:

```ts
type FlagDef = { key: string; default: boolean; description: string };

const flags: FlagDef[] = [
  {
    key: "sportsbook_enabled",
    default: false,
    description: "Public sportsbook gating",
  },
  {
    key: "pwa_install_prompt",
    default: true,
    description: "Show PWA install affordance",
  },
  {
    key: "permit2_first",
    default: true,
    description: "Prefer Permit2 over classic approve",
  },
];
```

### 8.2 Cookie override (dev / preview only)

`arbi-flags-<key>=true|false` cookies override on preview / staging only.
Cookies in production are stripped at the edge.

### 8.3 Activation gates

A flag flip from `default: false` → `default: true` requires:

- ADR documenting the rollout.
- Updated `25-observability.md` event schema if the feature emits events.
- Updated `04-page-blueprints.md` state matrix if the feature affects a
  primary route.

## 9. Release Cadence

- **Weekly minor releases** during active development.
- **Patch releases** anytime for hotfixes.
- **Major releases** when token systems, route taxonomy, or contract pairing
  changes — preceded by ADR + migration notes.

Avoid releasing on Fridays (industry-standard friendly heuristic).

## 10. Changelog

`frontend/CHANGELOG.md` follows Keep a Changelog. Sections per release:

- Added
- Changed
- Deprecated
- Removed
- Fixed
- Security

Every PR updates the changelog in the same commit. CI checks that
UI-touching PRs include a changelog entry.

## 11. IPFS Pin Fallback

For censorship resilience the production build is also pinned to IPFS via
`web3.storage` (or `Pinata`). The pinned build is **static export** (no
RSC, no API routes). It serves only:

- read-only release verification (`/release-proof.html`)
- legal pages
- a fallback "service degraded" landing

Pinning is triggered after a successful production release.

## 12. Source Maps

Uploaded to Sentry, **not served publicly**. The Next.js build configures:

```ts
// next.config.ts
const nextConfig = {
  productionBrowserSourceMaps: false, // public maps disabled
};
```

Sentry's webpack plugin uploads private maps during the build.

## 13. Environment Variable Inventory

Per env:

| Var                                    | Visibility  | Required                |
| -------------------------------------- | ----------- | ----------------------- |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID`         | public      | yes                     |
| `NEXT_PUBLIC_RPC_FALLBACK_URL`         | public      | yes (read RPC fallback) |
| `NEXT_PUBLIC_INDEXER_BASE_URL`         | public      | yes                     |
| `NEXT_PUBLIC_RELEASE_DIGEST`           | public      | yes (per release)       |
| `NEXT_PUBLIC_BUILD_SHA`                | public      | auto from CI            |
| `NEXT_PUBLIC_SENTRY_DSN`               | public      | yes                     |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | public      | yes                     |
| `NEXT_PUBLIC_ENV`                      | public      | yes                     |
| `NEXT_PUBLIC_FLAG_<name>`              | public      | as needed               |
| `SENTRY_AUTH_TOKEN`                    | secret (CI) | yes                     |
| `VERCEL_TOKEN`                         | secret (CI) | yes                     |
| `CHROMATIC_PROJECT_TOKEN`              | secret (CI) | yes                     |
| `IPFS_PIN_TOKEN`                       | secret (CI) | yes                     |

Variables not in this table cannot be referenced from code. ESLint rule
enforces.

## 14. Vercel Configuration

`vercel.json`:

```json
{
  "framework": "nextjs",
  "regions": ["sfo1", "fra1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        /* CSP & COOP from 23-security.md */
      ]
    }
  ],
  "redirects": [
    /* legacy route redirects from 03-information-architecture.md §3 */
  ]
}
```

Regions cover Americas + EU. Asia covered by Vercel global edge.

## 15. Don'ts

- No releases without a tag.
- No deployments without sourcemap upload.
- No CI bypass (`--no-verify`) on protected branches.
- No env var without an entry in §13.
- No vendored RPC keys in client code.
- No "skip CI" commits on `main`.
- No mass releases on Fridays (humans need weekends).
- No prod release without prior preview + visual diff approval.

## 16. How To Enforce

```bash
# Conventional commit lint
pnpm commitlint --from origin/main

# Branch naming
node scripts/check-branch-name.mjs

# Required CI checks defined in repo settings (codified):
# .github/branch-protection-frontend.yaml

# Env var presence at build
node scripts/check-env-vars.mjs

# Tag format
git tag --list "release-frontend-v*" | grep -E "release-frontend-v[0-9]+\\.[0-9]+\\.[0-9]+" || exit 1
```

## 17. Glossary

| Term                 | Meaning                                      |
| -------------------- | -------------------------------------------- |
| Conventional Commits | https://www.conventionalcommits.org          |
| Vercel               | Hosting provider                             |
| Statuspage           | Atlassian incident communication tool        |
| Source map           | Map from minified to source code             |
| IPFS pin             | Permanent IPFS hosting of a static snapshot  |
| Branch protection    | GitHub feature requiring checks before merge |
