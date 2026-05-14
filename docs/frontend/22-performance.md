# 22 · Performance Budget

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `../design/10-design-tokens.md`, `../design/14-data-and-state.md` |
| Supersedes | — |

ArbiGameFi treats performance as a **product feature**. Targets are
non-negotiable; regressions are bugs.

## 1. Core Web Vitals (production p75 RUM)

| Metric                          | Target                  | Hard ceiling |
| ------------------------------- | ----------------------- | ------------ |
| LCP (largest contentful paint)  | < 2.0 s                 | 2.5 s        |
| INP (interaction to next paint) | < 200 ms                | 300 ms       |
| CLS (cumulative layout shift)   | < 0.05                  | 0.1          |
| FID legacy                      | n/a (deprecated by INP) | —            |
| TTFB                            | < 600 ms                | 1.0 s        |

Measured per route. Sentry RUM (`25-observability.md`) reports per-route p75
and alerts on regression > 10%.

## 2. Lighthouse Targets (CI)

Lighthouse CI runs on each PR against the preview deployment for these routes:

| Route          | Performance               | Accessibility | Best Practices | SEO  |
| -------------- | ------------------------- | ------------- | -------------- | ---- |
| `/`            | ≥ 95 mobile, ≥ 98 desktop | 100           | ≥ 95           | ≥ 95 |
| `/casino`      | ≥ 90 mobile, ≥ 95 desktop | 100           | ≥ 95           | ≥ 90 |
| `/casino/dice` | ≥ 90 mobile, ≥ 95 desktop | 100           | ≥ 95           | ≥ 85 |
| `/sportsbook`  | ≥ 90 mobile, ≥ 95 desktop | 100           | ≥ 95           | ≥ 85 |
| `/portfolio`   | ≥ 90 mobile, ≥ 95 desktop | 100           | ≥ 95           | n/a  |
| `/earn`        | ≥ 90 mobile, ≥ 95 desktop | 100           | ≥ 95           | ≥ 85 |
| `/ops`         | ≥ 85 mobile, ≥ 90 desktop | 100           | ≥ 95           | n/a  |

Failures block merge.

## 3. Bundle Budgets

Measured by `@next/bundle-analyzer` on production build.

| Route                    | Initial JS (gz) | Initial CSS (gz) | Initial total |
| ------------------------ | --------------- | ---------------- | ------------- |
| `/`                      | ≤ 90 KB         | ≤ 18 KB          | ≤ 110 KB      |
| `/casino`                | ≤ 110 KB        | ≤ 18 KB          | ≤ 130 KB      |
| `/casino/[slug]`         | ≤ 130 KB        | ≤ 20 KB          | ≤ 150 KB      |
| `/sportsbook`            | ≤ 110 KB        | ≤ 18 KB          | ≤ 130 KB      |
| `/sportsbook/[marketId]` | ≤ 140 KB        | ≤ 20 KB          | ≤ 160 KB      |
| `/portfolio`             | ≤ 110 KB        | ≤ 18 KB          | ≤ 130 KB      |
| `/earn`                  | ≤ 110 KB        | ≤ 18 KB          | ≤ 130 KB      |
| `/ops`                   | ≤ 130 KB        | ≤ 18 KB          | ≤ 150 KB      |

Shared first-party + framework chunks count toward the "initial JS" total.
RainbowKit + wagmi are loaded **only inside the provider island**, mounted
in the product route group. Marketing (`/`) does not pay this cost.

## 4. Image Budget

| Surface              | Format          | Max payload               |
| -------------------- | --------------- | ------------------------- |
| Hero illustrations   | SVG             | 30 KB inline / referenced |
| Game icons           | SVG             | 6 KB each                 |
| Marketing photos     | (none in v1)    | —                         |
| OG images            | PNG (generated) | 200 KB                    |
| Favicons / app icons | PNG             | 20 KB each                |
| Brand wordmark       | SVG             | 8 KB                      |

All raster images use `next/image` with explicit `width` / `height` to avoid
CLS. AVIF + WebP fallbacks served automatically by Next.js.

## 5. Font Loading

- `next/font/google` for `Inter` and `JetBrains Mono` with
  `display: 'swap'`.
- Subset to `latin` for v1; extend per locale.
- `preload: true` for `Inter` (body); `preload: false` for mono.
- Variable fonts.
- Self-host via `next/font` (no Google Fonts CDN runtime).

CSS contains a `font-display: swap` fallback chain to system sans before
`Inter` lands. No FOIT (flash of invisible text).

## 6. Code Splitting

- Each route is its own chunk.
- Each casino module (`Dice`, `Plinko`, etc.) is dynamically imported via
  the registry: `() => import('./modules/dice')`. Only the active module
  loads.
- Charts (`visx`) lazy-load via `next/dynamic` with a skeleton.
- The release-proof drawer lazy-loads when first opened.
- Confetti / motion-heavy modules (none in v1) would be lazy too.

## 7. Caching

| Asset                       | Cache strategy                            |
| --------------------------- | ----------------------------------------- |
| HTML                        | `s-maxage=60, stale-while-revalidate=300` |
| RSC payload                 | per Next.js defaults                      |
| Static `_next/static/*`     | `public, max-age=31536000, immutable`     |
| Fonts                       | `public, max-age=31536000, immutable`     |
| `public/textures/noise.svg` | `public, max-age=31536000, immutable`     |
| `public/og/*`               | `public, max-age=86400`                   |

API routes that return release data use `Cache-Control: public, max-age=15,
stale-while-revalidate=60`.

## 8. Data Performance

From `14-data-and-state.md`:

- staleTime > 0 for every query (no thrashing).
- WebSocket for live indicators when available; polling only as fallback.
- No request waterfalls in initial render (RSC pre-fetches in parallel).
- Streaming RSC: stream the page shell + skeletons first, hydrate heavy
  data progressively.

## 9. Animation Performance

Per `../design/12-motion.md §9`:

- Compositor-only properties.
- ≤ 2 concurrent animations per page.
- Long-task budget = 0 introduced by motion.

## 10. Third-party Scripts

**Default: zero third-party scripts.** Each addition requires ADR.

Permitted today: none.

If analytics requires a runtime tag (we prefer Vercel Analytics — no script
shipped), the tag loads with `defer` + `data-domain` attribution and never
blocks LCP.

## 11. RPC / Indexer Latency

| Surface                         | Target time-to-first-data |
| ------------------------------- | ------------------------- |
| `/` reserve ticker              | ≤ 600 ms (edge cache)     |
| `/casino` directory             | ≤ 600 ms                  |
| `/casino/[slug]` initial render | ≤ 800 ms                  |
| `/portfolio` overview           | ≤ 1.0 s                   |
| `/ops`                          | ≤ 1.0 s                   |

If chain RPC is the bottleneck, prefer server-side pre-fetch via RPC
provider with high availability (Alchemy / QuickNode / Infura primary +
backup), and a 30s edge cache for non-personalized reads.

## 12. Monitoring & Alerting

- Sentry RUM dashboard per route.
- Alert: p75 LCP rises above hard ceiling for ≥ 1 hour → page on-call.
- Weekly performance digest emailed to Frontend Lead.

See `25-observability.md`.

## 13. Don'ts

- No `transition: all` (banned in `12-motion.md`).
- No synchronous `localStorage` reads on initial render.
- No large image format mismatches (raw JPG over 100 KB without WebP/AVIF).
- No `useEffect`-only-on-mount data fetches blocking LCP.
- No wallet provider on marketing routes.
- No `dangerouslySetInnerHTML` from runtime data.
- No 3rd-party script without ADR.
- No font weights / styles unused by the design system (each weight adds
  to FOUT risk).

## 14. How To Enforce

```bash
# Lighthouse CI configured in GH Actions; fails on threshold miss
pnpm lighthouse:ci

# Bundle analyzer fails over budget
ANALYZE=true pnpm -C frontend/apps/web build && node scripts/check-bundle-budget.mjs

# next/image enforcement
rg -nE "<img " frontend/apps/web/src \
  | rg -v "// allow-img"
```

## 15. Migration Notes

Current frontend has:

- Multiple body-layer gradients and `bg-[url(...)]` external textures — drop
  to single radial + local noise. (`01-brand.md §7`)
- `Space Grotesk` font without subsetting — replaced by Inter via
  `next/font` per §5.
- 2030-line `pageClient.tsx` for casino — split into modules per
  `../design/04-page-blueprints.md §3.4`. Affects route-level bundle size
  significantly.
- No Lighthouse CI yet — added during rewrite.

## 16. Glossary

| Term      | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| LCP       | Largest Contentful Paint — when the largest text/image renders |
| INP       | Interaction to Next Paint — response latency to user input     |
| CLS       | Cumulative Layout Shift — visual stability score               |
| TTFB      | Time to First Byte                                             |
| RSC       | React Server Component                                         |
| FOIT/FOUT | Flash of Invisible/Unstyled Text                               |
