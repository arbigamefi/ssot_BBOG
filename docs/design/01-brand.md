# 01 · Brand

| Owner | Frontend Lead + Product |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `10-design-tokens.md` |
| Supersedes | Draft v1 brand book |

ArbiGameFi should look like a serious, verifiable casino/sportsbook product,
not a promo-heavy casino skin.

## 1. Position

The brand communicates:

1. **Non-custodial play** — players do not deposit into an opaque platform
   wallet before betting.
2. **Verifiable settlement** — results, payouts, release artifacts, and
   bankroll state are inspectable.
3. **Bankroll seriousness** — LPs and operators can reason about reserves,
   liabilities, and risk.
4. **B2C clarity** — users should understand how to play without reading
   contract docs.

## 2. Visual Direction

Use these references:

- Polymarket: neutral, event/proof-forward surfaces.
- Hyperliquid: dense data and restrained visual hierarchy.
- Linear/Vercel dashboards: calm dark UI and precise typography.

Avoid these references:

- promo-heavy casino pages;
- high-saturation slot-machine UI;
- mascot/character branding;
- coin-stack, chip-stack, or stadium stock imagery.

## 3. Logo

- Use the `ArbiGameFi` wordmark in the header.
- Use the geometric mark only for favicon/app icon/tight spaces.
- Do not animate, gradient-fill, stretch, shadow, or recolor the wordmark.

## 4. Color

- Use the token palette from [`10-design-tokens.md`](./10-design-tokens.md).
- One product, one brand color.
- Casino, sportsbook, portfolio, earn, and ops do not receive separate hue
  families.
- Semantic colors are for state only: success, warning, danger.

## 5. Typography

- Use the project sans for display/body.
- Use mono only for hashes, addresses, digests, and numeric readouts.
- Do not add a third display font.
- Do not use mono for body copy.

## 6. Visual Assets

Allowed:

- geometric diagrams;
- data visualizations;
- Heroicons/lucide icons where already used;
- local textures/assets only.

Not allowed:

- stock casino photography;
- AI casino illustrations;
- mascot art;
- decorative external image URLs;
- per-game visual brands.

## 7. Product Surface Rules

- `/casino` and `/sportsbook` should feel like the same product.
- Game variety comes from rules, layout, and module visuals, not hue changes.
- Marketing pages may be more expressive, but still must show the actual
  product and proof surfaces.
- Ops pages prioritize density and scanability over visual flourish.

## 8. Verification

```bash
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "game.*(purple|emerald|amber|fuchsia|rose)|--game-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "http.*(grainy|unsplash|pexels|pixabay)" frontend/apps/web/src frontend/packages/ui/src
```
