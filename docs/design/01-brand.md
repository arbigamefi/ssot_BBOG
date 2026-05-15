# 01 · Brand

| Owner | Design Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md` |
| Supersedes | — |

This is the brand identity SSOT. Every visual treatment, illustration,
photograph, color name, or surface texture in production must trace back here.

## 1. Brand Position

ArbiGameFi is a **non-custodial, fully on-chain casino + sportsbook** with
visible bankroll, signed odds, and proof-anchored release artifacts. The brand
must communicate three things simultaneously:

1. **Mechanical certainty** — "verifiable" is a property, not a slogan.
2. **Capital seriousness** — LP, ops, and audit roles are first-class users.
3. **Composed confidence** — restrained, never carnival.

| Reference brands (yes)                        | Reference brands (no)                      |
| --------------------------------------------- | ------------------------------------------ |
| Polymarket — neutral surfaces, oracle-forward | Stake.com — promo-heavy, casino-pizza      |
| Hyperliquid — dense data, mono accents        | BC.Game — high-saturation slot vibe        |
| Linear — typographic hierarchy, restraint     | Roobet — neon-overload, mascot-driven      |
| Vercel Dashboard — informational density      | Daily.dev — feed/social-network feel       |
| Phantom Wallet — calm dark mode               | Trust Wallet — branded gradients per asset |
| Squads — institutional governance             | Pancake Swap — game-illustration heavy     |

## 2. Logo

> The logo is a **wordmark**. ArbiGameFi does not use a mascot or pictographic
> mark in primary brand surfaces.

### 2.1 Wordmark

`ArbiGameFi` set in the brand display face (see `10-design-tokens.md`),
letter-spacing `-0.02em`, weight 600. No abbreviation, no all-caps, no italic.

When space is critical (favicon, app icon, terminal corner), use the geometric
mark from `frontend/apps/web/public/brand/arbigamefi-mark.svg`. The mark is the
only stylized brand artwork that ships to production.

### 2.2 Clear space

Minimum clear space around the wordmark = the cap-height of the wordmark
itself. Nothing else (icons, badges, navigation, photography) may enter this
zone.

### 2.3 Sizing

| Context            | Min height | Max height |
| ------------------ | ---------- | ---------- |
| Web header         | 18 px      | 28 px      |
| Marketing hero     | 32 px      | 56 px      |
| Favicon (monogram) | 16 px      | 64 px      |
| Social meta image  | 48 px      | 96 px      |
| Email signature    | 16 px      | 24 px      |

### 2.4 Color

| Context               | Wordmark color                     |
| --------------------- | ---------------------------------- |
| Default (dark theme)  | `--fg`                             |
| Light theme           | `--fg` (same token; resolves dark) |
| Inverted button label | `--surface-0`                      |
| Disabled state        | `--fg-muted`                       |

Never apply gradients, drop shadows, glow, or rotation to the wordmark.

### 2.5 Don'ts

- Do not stretch.
- Do not recolor to brand or accent.
- Do not place over a high-frequency photo, gradient, or noise layer with
  contrast below 4.5 : 1.
- Do not add a tagline beside or under the wordmark in the header. Taglines
  belong in body copy.
- Do not animate the wordmark on page load. It is not a marketing surface.

## 3. Brand Palette

Brand colors are **tokens**, not raw values. The token-to-value mapping lives
in `10-design-tokens.md`. This section defines the _role_ of each color.

| Role              | Token           | Use                                                   |
| ----------------- | --------------- | ----------------------------------------------------- |
| Primary brand     | `--brand`       | CTA, link, focus ring, active tab, primary progress   |
| Accent            | `--accent`      | Live data dot, winning highlight, key-metric emphasis |
| Surface 0         | `--surface-0`   | Page background                                       |
| Surface 1         | `--surface-1`   | Raised app shell, header                              |
| Surface 2         | `--surface-2`   | Cards, panels, modals                                 |
| Surface 3         | `--surface-3`   | Hover, active selection fill                          |
| Border            | `--border`      | Standard dividers                                     |
| Border soft       | `--border-soft` | Subtle inner divisions                                |
| Foreground        | `--fg`          | Default text                                          |
| Foreground muted  | `--fg-muted`    | Secondary text, label, caption                        |
| Foreground subtle | `--fg-subtle`   | Disabled, deemphasized                                |
| Success           | `--success`     | Won, confirmed, deposited                             |
| Warning           | `--warn`        | Pending, requires attention                           |
| Danger            | `--danger`      | Failed, refunded, error                               |

### Rules

- One product, one brand color. Casino, sportsbook, earn, portfolio, and ops
  all use the same `--brand`. They never differentiate by hue.
- One accent. Reserved for "look here right now" moments — live indicator,
  jackpot-flash, just-confirmed-bet.
- Semantic colors are not decorations. They are reserved for **state**, not
  category.
- No additional brand tints (no `--brand-2`, `--secondary-brand`, `--vip`).
- No per-feature accent. Sportsbook does not get its own teal; casino does
  not get its own violet.

## 4. Typography

Two faces:

| Face                  | Use                                                                  |
| --------------------- | -------------------------------------------------------------------- |
| Sans (display + body) | Inter or Geist Sans, selected once in `10-design-tokens.md`          |
| Mono                  | JetBrains Mono — exclusively for addresses, digests, hashes, amounts |

Eight text roles (locked):

| Token             | Use                                  |
| ----------------- | ------------------------------------ |
| `text-display-xl` | Marketing hero on `/` only           |
| `text-display-lg` | Top of marketing section / page hero |
| `text-display-md` | Page H1 in product routes            |
| `text-title-lg`   | Panel / card H2                      |
| `text-title-md`   | List / row title                     |
| `text-body`       | Default body text                    |
| `text-caption`    | Metadata, label, helper              |
| `text-mono`       | Address, hash, big number readout    |

Don't:

- Don't introduce a third face for "display" purposes. Display weight comes
  from the sans face at weight 600–700, not from a separate face.
- Don't use mono for body copy. It reads as "code" and weakens the brand.
- Don't outline letters, drop-shadow them, or stroke them.
- Don't mix font-weights ad hoc. Stick to the role.

## 5. Illustration

The brand has no illustrated mascot, no character art, no painterly
backgrounds.

Allowed visual artifacts:

1. **Geometric SVG diagrams** — system architecture, payout flow, NAV ladder.
   Stroke `1.25 px`, single-color (`--fg-muted` or `--brand`), no shading.
2. **Data visualizations** — charts, tickers, exposure bars. Use one color
   family at a time. Use `--brand` or `--accent` for highlight series; greys
   for the rest.
3. **Iconography** — Heroicons (24px outline) is the production icon set. Mix
   solid + outline only when their semantic contract is documented in
   `11-component-library.md`.

Disallowed:

- Coin stacks, dollar bills, slot machines, dice with motion lines.
- 3D renders of chips, cards, or wheels.
- Photorealistic poker tables, sports stadiums, or arena crowds.
- AI-generated illustrations that resemble any of the above.

> If a casino room needs a "shape" identity, prefer **geometric primitives**
> (circle for Roulette, hexagon for Keno, square for Coin Toss, triangle for
> Dice) — single-stroke, brand-colored.

## 6. Photography

ArbiGameFi does not use stock photography in production. Photographs are
acceptable only in:

- Team / press / about pages (out of scope until launched).
- Blog headers (out of scope until launched).

Photographs must never appear:

- Inside the App Shell of a product route.
- Behind hero copy.
- As decorative backgrounds for cards or panels.

If a future product surface requires imagery, the rule is: **architectural
photography, monochrome, low-contrast**. Never people in casinos, never
gambling props, never sports memorabilia.

## 7. Surfaces and Texture

Allowed background treatments (one per page max):

1. **Solid surface** (`--surface-0`).
2. **Single subtle gradient**: `radial-gradient(at top, hsl(var(--brand) / 0.08), transparent 40%)`.
3. **Local noise texture** at ≤ 6 % opacity, served from
   `frontend/apps/web/public/textures/noise.svg`.

Disallowed:

- Multiple stacked gradients (the current `globals.css` has 5; the rewrite
  has 1 max).
- External texture URLs (`grainy-gradients.vercel.app`, etc.).
- Animated background.
- Glow layers behind individual cards.
- "Mesh" gradients with > 2 color stops.

## 8. Brand Surfaces Inventory

These are the only brand-bearing surfaces in production:

| Surface           | Owner    | File                                                   |
| ----------------- | -------- | ------------------------------------------------------ |
| Lockup SVG        | Design   | `frontend/apps/web/public/brand/arbigamefi-lockup.svg` |
| Mark SVG          | Design   | `frontend/apps/web/public/brand/arbigamefi-mark.svg`   |
| Favicon           | Design   | `frontend/apps/web/public/favicon.svg`                 |
| Apple touch icon  | Design   | `frontend/apps/web/public/apple-touch-icon.png`        |
| Social meta image | Design   | `frontend/apps/web/public/og/default.png` (target)     |
| App manifest      | Frontend | `frontend/apps/web/public/manifest.json`               |
| Noise texture     | Frontend | `frontend/apps/web/public/textures/noise.svg` (target) |

Every other "brand artifact" is generated from tokens or composed at runtime.

## 9. Voice Adjacency

This document defines what the brand **looks like**. The brand **sounds like**
is in `02-voice-and-copy.md`. Brand looking calm but writing breathless
("HUGE WIN!! 💸") breaks the brand harder than any visual misstep.

## 10. Don'ts (consolidated)

- No mascots, characters, or anthropomorphized brand artifacts.
- No per-game color family. Differentiate games by icon + shape, not hue.
- No gradients on the wordmark.
- No coin / chip / slot illustrations anywhere.
- No external image hosts.
- No additional faces beyond sans + mono.
- No multi-color "celebration" backgrounds on win states. A single accent
  glow + a number is enough.
- No promotional banner system, daily-spin wheels, or streak counters.
- No animation on the wordmark, ever.
- No "AG" + "ArbiGameFi" duplication in the same header.

## 11. How To Enforce

```bash
# No legacy brand asset URLs in product UI
rg -nE "grainy-gradients|stake\.com|roobet|pancakeswap" frontend/apps/web/src

# No multi-gradient brand backgrounds (heuristic — flag for review)
rg -nE "linear-gradient.*linear-gradient" frontend/apps/web/src

# No per-game brand color tokens
rg -nE "--game-(dice|roulette|coin|keno|slots|sicbo|baccarat|plinko)-" \
   frontend/packages/ui/src frontend/apps/web/src

# Only the two declared font families are imported
rg -nE "next/font/google|@font-face" frontend/apps/web frontend/packages/ui \
  | rg -vE "Inter|JetBrains_Mono|Geist"
```

## 12. Approval

A new brand asset enters production only after:

1. ADR exists describing why it is needed.
2. SVG / PNG checked into `frontend/apps/web/public/brand/` (no remote hosting).
3. The asset appears in the Storybook brand section.
4. Visual regression baseline updated.
