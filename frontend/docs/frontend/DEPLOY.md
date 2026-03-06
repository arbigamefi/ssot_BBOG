# SSOT v2 Frontend — Deployment Guide

## Overview

The SSOT v2 frontend is a Next.js 15 app in `apps/web/`. It is deployed as a static-ish site (SSG + client-side rendering) since all blockchain data is read client-side from RPC and the local IndexedDB store.

## Recommended: Vercel

Vercel is the recommended deployment target for Next.js apps.

### Setup

1. Import the repo in [Vercel Dashboard](https://vercel.com/new)
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to `Next.js`
4. Set **Build Command** to `pnpm build` (Vercel detects pnpm from `packageManager` field)
5. Set **Output Directory** to `apps/web/.next` (auto-detected)
6. Set **Install Command** to `pnpm install --frozen-lockfile`

### Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WC_PROJECT_ID` | Recommended | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry error tracking DSN |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry auth token (source maps, CI only) |
| `NEXT_PUBLIC_ANALYTICS_ID` | Optional | Plausible domain / analytics site ID |
| `NEXT_PUBLIC_ANALYTICS_HOST` | Optional | Custom analytics host (default: plausible.io) |

### Monorepo Configuration

Since `frontend/` is a subdirectory of a larger repo, configure Vercel:

- **Root Directory**: `frontend`
- **Ignored Build Step**: Use the default (Vercel auto-detects changes in the root directory)

### Build Settings

The `vercel.json` file (if needed) should be placed at `frontend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm -C apps/web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

## Alternative: Docker

For self-hosted deployments, use a multi-stage Docker build.

### Dockerfile

Place at `frontend/Dockerfile`:

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/ssot/package.json packages/ssot/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm -C apps/web build

# Stage 3: Run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Note: Requires `output: "standalone"` in `next.config.mjs`.

### Build & Run

```bash
docker build -t ssot-frontend -f frontend/Dockerfile frontend/
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WC_PROJECT_ID=xxx \
  ssot-frontend
```

## Alternative: Static Export

For hosting on any static file server (S3, Cloudflare Pages, etc.):

1. Add `output: "export"` to `next.config.mjs`
2. Run `pnpm -C apps/web build`
3. Deploy the `apps/web/out/` directory

Note: Static export does not support API routes or server-side features.

## Post-Deployment Checklist

- [ ] Verify favicon and OG image appear correctly
- [ ] Test wallet connection flow (WalletConnect, MetaMask)
- [ ] Verify security headers via `curl -I https://your-domain.com`
- [ ] Check Sentry receives test errors (if configured)
- [ ] Verify analytics events fire (if configured)
- [ ] Test dark mode toggle persists across page reloads
- [ ] Run E2E smoke tests against production URL
