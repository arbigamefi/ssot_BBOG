# 10 · Design Tokens

| Owner | Frontend Lead + Design Lead |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `01-brand.md`, `11-component-library.md` |
| Supersedes | Draft v1 duplicated token spec |

Design tokens are a code contract. The source files are:

- `frontend/packages/ui/src/tokens/carbon-copy.css`: the brand (`01-brand.md`);
- `frontend/packages/ui/src/tokens/arbi-dark.css` and `arbi-light.css`: the old dark palette,
  kept only for pages not yet rebuilt;
- `frontend/packages/ui/src/styles/globals.css`: the Tailwind v4 `@theme inline` block that
  maps the CSS variables onto utilities.

## 1. Source Of Truth

CSS variables in `frontend/packages/ui/src/tokens/*` are the source of truth. The project is
CSS-first Tailwind v4: there is no `tailwind.config.ts` and no preset. `globals.css` consumes the
variables through one `@theme inline { … }` block, which generates utilities such as `bg-paper`,
`text-display` and `rounded-sheet`. Named transition durations (`duration-fast/base/slow`) are
explicit `@utility` rules in the same file.

Do not create another token system in app routes, feature folders, or TypeScript class-string
exports.

## 2. Two Palettes During The Rebuild

Pages move to Carbon copy one at a time (`01-brand.md` §11).

- A rebuilt page uses only Carbon copy utilities. Its utilities have their own names, so it
  cannot pick up `surface-*`, `fg-*`, `brand` or `accent` by accident.
- A page not yet rebuilt keeps the old palette. Fixes there may use it; new work may not.
- When the last page moves, `arbi-dark.css`, `arbi-light.css`, the old `@theme` entries and
  `THEME_TOKEN_NAMES` are deleted in the same change.

## 3. Colour

Values are HSL channels, so utilities can add alpha (`hsl(var(--ink) / 0.4)`).

| Utility           | Token               | Value     | Role                                     |
| ----------------- | ------------------- | --------- | ---------------------------------------- |
| `carbon`          | `--carbon`          | `#1B1F5E` | Dark surface; headings on paper          |
| `carbon-deep`     | `--carbon-deep`     | `#121543` | Status strips, footer                    |
| `paper`           | `--paper`           | `#F3F4F1` | Light surface; text on carbon            |
| `ink`             | `--ink`             | `#2A2FA0` | Printed objects; things you can press    |
| `ink-bright`      | `--ink-bright`      | `#2328B8` | Ink under the pointer                    |
| `faded`           | `--faded`           | `#575B93` | Secondary text and input edges on paper  |
| `thermal`         | `--thermal`         | `#B9BBC9` | Separating lines on paper; disabled text |
| `on-carbon-muted` | `--on-carbon-muted` | `#C3C6E6` | Secondary text on carbon                 |
| `rule-carbon`     | paper at 22%        |           | Separating lines on carbon               |

Contrast (WCAG 2.1), checked by `tokens/carbon-copy.test.ts`:

| Pair                      | Ratio | Use                                         |
| ------------------------- | ----- | ------------------------------------------- |
| paper on carbon           | 13.55 | body text                                   |
| on-carbon-muted on carbon | 8.93  | secondary text                              |
| carbon on paper           | 13.55 | headings, body text                         |
| ink on paper              | 9.45  | printed figures, links, buttons             |
| faded on paper            | 5.72  | secondary text, input edges                 |
| thermal on paper          | 1.73  | separating lines only, never a control edge |
| ink on carbon             | 1.43  | never used                                  |

There are no success, warning or danger colours on a rebuilt page. A failure is stated in words
above the action that fixes it (`02-voice-and-copy.md` §4).

## 4. Typography

| Utility        | Phone | From 48rem | Line height        | Use                                |
| -------------- | ----- | ---------- | ------------------ | ---------------------------------- |
| `text-note`    | 14    | 14         | 1.45               | footnotes, receipt details         |
| `text-body`    | 16    | 17         | 1.55 (Chinese 1.8) | body text                          |
| `text-lede`    | 18    | 20         | 1.5                | ledes, h3                          |
| `text-heading` | 34    | 48         | 1.05               | section headings                   |
| `text-display` | 52    | 88         | 1                  | the page's one h1                  |
| `text-price`   | 30    | 30         | 1                  | multipliers on ticket stubs (Doto) |
| `text-total`   | 52    | 52         | 1                  | the net result on a receipt (Doto) |

- `font-text` is Schibsted Grotesk (Noto Sans SC for Chinese); weights 400, 600 and 800 only
  (`font-normal`, `font-semibold`, `font-extrabold`).
- `font-print` is Doto at 800, for printed figures only.
- Amounts and hashes in text use `font-semibold tabular-nums`.
- Sizes step at one breakpoint and never scale with the viewport width.
- The fonts are self-hosted through `next/font` in `apps/web`, which sets `--font-schibsted`,
  `--font-noto-sc` (subset) and `--font-doto`. Only the weights above are loaded.

## 5. Space And Grid

- Spacing is a multiple of 8px; small components use 4 and 12 inside.
- `py-section`: 64 on phones, 96 from 48rem. `mb-head` (title to content): 32, then 48.
- `px-gutter`: 16, then 56. `max-w-page`: 1200px.
- 12 columns with a 24px gap (`gap-grid`). Every section head spans 7 columns; every list in a
  section sits on the same columns.

## 6. Radius, Lines And Elevation

- `rounded-print` (4px): inputs, stubs and small printed parts. `rounded-sheet` (8px):
  receipts, slips and buttons. `rounded-full`: stamps and dots. Nothing else.
- Lines (`01-brand.md` §5): `border` 1px solid, `border-2 border-dashed`, `border-2
border-dotted`, and a 2px ring. No other widths or styles.
- One shadow: the phone action bar while it is docked to the bottom of the screen. Everything
  else is separated by its edge or its surface, not a shadow.

## 7. Theme

Carbon copy has one fixed scheme: carbon and paper both appear on every page. There is no light
or dark toggle, and components never branch on `dark:` variants.

## 8. Do Not Do

- Do not use `bg-[#...]`, `text-[#...]`, `border-[#...]`, or `shadow-[...]`.
- Do not reintroduce `visual-system.ts` or `--ag-*` variables.
- Do not add per-game colour maps.
- Do not add `rounded-[...]` or one-off radii.
- Do not mix old palette utilities into a rebuilt page.
- Do not add third-party decorative background URLs.

## 9. Verification

```bash
pnpm -C frontend/packages/ui exec vitest run -c vitest.config.ts src/tokens
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "visual-system|--ag-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "rounded-(2xl|3xl|\\[)" frontend/apps/web/src frontend/packages/ui/src
rg -nE "\\bdark:" frontend/apps/web/src frontend/packages/ui/src
```
