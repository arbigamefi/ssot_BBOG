# ADR-029: Production Infrastructure

## Context

Phases 1-3 (PRs 1-23) delivered a feature-complete frontend: SDK, indexers, 10 pages, i18n, wallet kit (RainbowKit v2), mobile nav, and no-wallet UX. However, the app lacks production infrastructure needed for a shippable, operationally-ready product.

Audit findings:
- **No `.gitignore`** at monorepo root — risk of committing node_modules, .next, .env.local, IDE files
- **No `public/` directory** — no favicon, robots.txt, web manifest, or OG images
- **No `.env.example`** — environment variables undocumented for new developers
- **No security headers** — `next.config.mjs` is minimal (reactStrictMode + transpilePackages only)
- **No error tracking** — runtime errors invisible to operators in production
- **No analytics** — no visibility into page views, feature adoption, or user drop-off
- **No pre-commit hooks** — lint/type errors caught only by CI (slow feedback)
- **Test coverage gaps** — release loader and indexer sync paths untested

This ADR covers decisions for the P0 infrastructure items that must land before any production deployment.

## Decisions

### 1. Security Headers via `next.config.mjs` `headers()`

Add standard security headers as a Next.js async `headers()` config function:
- `X-Frame-Options: DENY` — prevent clickjacking
- `X-Content-Type-Options: nosniff` — prevent MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limit referrer leakage
- `X-DNS-Prefetch-Control: on` — improve RPC/API DNS resolution
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — enforce HTTPS
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disable unused APIs
- `Content-Security-Policy` — restrict script-src, connect-src for RPC endpoints + WalletConnect relay

Rationale: Next.js native approach, no external dependency. CSP requires careful tuning to not break wallet connections (WalletConnect relay at `*.walletconnect.com`, `*.walletconnect.org`) and RPC endpoints (Base Sepolia, Base, Arbitrum).

### 2. Error Tracking: Sentry (`@sentry/nextjs`)

Rationale:
- **Industry standard** for frontend error tracking with excellent Next.js integration
- **Source map upload** for readable stack traces in production builds
- **Client + Server + Edge** coverage via dedicated config files
- **Performance monitoring** built-in (LCP, FID, CLS metrics)
- **Free tier** sufficient for initial deployment (5K errors/month)
- `global-error.tsx` error boundary for unhandled runtime errors

Alternatives:
- **LogRocket**: Session replay is nice but expensive, heavier bundle. Overkill for v1.
- **Bugsnag**: Good but smaller ecosystem than Sentry, less Next.js integration depth.
- **Custom logging**: No dashboard, no alerting, no source maps. Not viable for production.

### 3. Static Assets: Standard `public/` Structure

Create `apps/web/public/` with:
- Favicon set (ico, 16x16, 32x32, apple-touch-icon) — generated from brand SVG
- `robots.txt` — allow all crawlers
- `manifest.json` — PWA metadata (app name, theme color, icons)
- OG image — social sharing preview

Rationale: Standard Next.js convention. Missing favicons and OG images look unprofessional. PWA manifest enables "Add to Home Screen" on mobile.

### 4. Environment Documentation: `.env.example`

Document all environment variables in `apps/web/.env.example`:
- `NEXT_PUBLIC_WC_PROJECT_ID` — WalletConnect project ID (optional, falls back to demo)
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry error tracking (optional, disabled if absent)
- `SENTRY_AUTH_TOKEN` — Sentry source map upload (CI only)
- Future: RPC override URLs, analytics keys, feature flags

Rationale: Onboarding friction reduction. New developers copy file, fill in values, and run. No guessing which vars exist.

### 5. `.gitignore`: Standard Node.js/Next.js Patterns

Cover: `node_modules/`, `.next/`, `.turbo/`, `dist/`, `out/`, `*.tsbuildinfo`, `.env*.local`, IDE files (`.idea/`, `.vscode/settings.json`), OS files (`.DS_Store`, `Thumbs.db`).

Rationale: Prevent accidental commits of build artifacts, secrets, and IDE config.

## Consequences

- 1 new dependency: `@sentry/nextjs` in `apps/web`
- `next.config.mjs` grows from 5 lines to ~60 lines (headers + Sentry wrapper)
- 3 new Sentry config files at `apps/web/` root
- `global-error.tsx` error boundary added to App Router
- `public/` directory with 7+ static files
- `.env.example` as living documentation for env vars
- `.gitignore` at monorepo root

## Status

Accepted
