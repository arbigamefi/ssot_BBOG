# 22 · Performance Budget

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../design/14-data-and-state.md`, `25-observability.md` |
| Supersedes | Draft v1 exhaustive performance spec |

Performance is product quality. Budgets should guide decisions without blocking
small MVP iterations on unrealistic lab-perfect numbers.

## 1. Runtime Targets

Production p75 targets:

| Metric | Target  | Investigate at |
| ------ | ------- | -------------- |
| LCP    | < 2.5s  | > 3.0s         |
| INP    | < 200ms | > 300ms        |
| CLS    | < 0.1   | > 0.15         |
| TTFB   | < 1.0s  | > 1.5s         |

Use RUM from `25-observability.md` when available. Lab checks are useful, but
real route behavior wins.

## 2. Bundle Budgets

Initial route budgets are targets, not aesthetic goals:

| Route                    | Target first load |
| ------------------------ | ----------------- |
| `/`                      | <= 160 KB         |
| `/casino`                | <= 180 KB         |
| `/casino/[slug]`         | <= 200 KB         |
| `/sportsbook`            | <= 180 KB         |
| `/sportsbook/[marketId]` | <= 200 KB         |
| `/portfolio`             | <= 190 KB         |
| `/earn`                  | <= 180 KB         |
| `/ops`                   | <= 220 KB         |
| `/legal/privacy`         | <= 140 KB         |

Investigate when a route grows by more than 20 KB or crosses its target.
Wallet/RainbowKit cost belongs in product routes, not marketing routes.

## 3. Code Splitting

Lazy-load:

- wallet provider where practical;
- heavy proof drawers;
- charts;
- rarely opened admin panels;
- game-specific heavy visual modules.

Do not lazy-load small components only to satisfy a number. Latency and
maintainability count.

## 4. Data Performance

- Active casino round polling must be direct and bounded.
- Recent feeds use `/api/bets/*` with Postgres or RPC fallback.
- Avoid request waterfalls on page load.
- Cache non-personalized release and feed data briefly.
- Do not block final result display on recent-feed refresh.

## 5. Images And Fonts

- Use `next/font`.
- Use `next/image` or explicit dimensions for raster media.
- Keep decorative assets local.
- Do not add third-party decorative resources.

## 6. Do Not Do

- Do not mount wallet providers on marketing-only pages.
- Do not add third-party scripts without explicit approval.
- Do not use `transition-all` for large surfaces.
- Do not fetch critical data only in `useEffect` when server/API prefetch is
  available.
- Do not optimize by removing wallet UX that users need.

## 7. Verification

```bash
pnpm -C frontend/apps/web build
pnpm -C frontend/apps/web test
ANALYZE=true pnpm -C frontend/apps/web build
```

Use bundle-budget CI as a regression signal. Do not treat a small overage as a
reason to remove core wallet or receipt UX.
