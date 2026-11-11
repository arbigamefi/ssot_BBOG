# 10 · Design Tokens

| Owner | Frontend Lead + Design Lead |
| Status | Active |
| Last Updated | 2026-11-09 |
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

### The table layer

A game table (`01-brand.md` §2) has its own materials. They are used only on a table, never on a
page surface or on paper.

| Utility / token      | Token                                 | Value                           | Role                                             |
| -------------------- | ------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `felt`               | `--felt`                              | `#2A2F82`                       | Felt under the lamp                              |
| `felt-edge`          | `--felt-edge`                         | `#161950`                       | Felt away from the lamp                          |
| `rail`               | `--rail`                              | `#0C0E30`                       | The padded rail                                  |
| (in `table-felt`)    | `--rail-hi`, `--rail-lo`              | `#262A66`, `#06071F`            | The rail's top edge and underside                |
| (in `table-groove`)  | `--groove-hi`, `--groove-lo`          | `#1E2268`, `#0F1244`            | The lane's lit and shaded sides                  |
| `print`              | paper at 92%                          |                                 | Figures and print on the felt                    |
| `print-soft`         | paper at 60%                          |                                 | Labels, the scale, the rule, spot edges          |
| `print-faint`        | paper at 24%                          |                                 | Minor ticks and empty chip rings only, no text   |
| (in `table-ball`)    | `--ivory-hi`, `--ivory`, `--ivory-lo` | `#FFFDF7`, `#E9E2D0`, `#B3A88E` | The ball's highlight, body and shade             |
| `lamp`               | `--lamp` at 17%                       | `#FFEECE`                       | The lamp's pool of light; the warm glow of a win |
| `chip`, `chip-inlay` | ink, paper                            |                                 | A chip's segments and inlay                      |
| (shadows only)       | `--table-shade`, `--table-sheen`      | black, white                    | Shadows on the table; light on the rail and lip  |
| `pocket-red`         | `--pocket-red`                        | `#A8333A`                       | Roulette's red pockets; slots' red; keno's hits  |
| `pocket-black`       | `--pocket-black`                      | `#0D0F2E`                       | Roulette's black pockets; the slots' navy ink    |
| `pocket-green`       | `--pocket-green`                      | `#1E6A4F`                       | Roulette's zero                                  |

Print on the felt (checked by `tokens/carbon-copy.test.ts`): `print` 7:1 or more on felt and
felt-edge, `print-soft` 4.5:1 or more; `print-faint` is under 3:1 and never sets text. Paper on
each pocket colour is 4.5:1 or more. The pocket colours are the game's own (red, black, zero),
not win or lose colours, and appear only on the roulette, slots and keno tables and in their
results.

The materials are `@utility` rules in `globals.css`: `table-felt` (felt, rail, its sizes),
`table-lamp`, `table-groove`, `table-zone`, `table-ball`, `table-ball-mark`, `table-readout`,
`table-puck`, `table-ticks`, `table-chip`, `table-pay-glow`, `table-led`, `table-sheet` (the
phone's docked slip), and for roulette `table-wheel` (the SVG wheel, styled through `data-w`,
`data-s` and `data-c` attributes), `table-spot` (a betting spot on the layout) and
`pocket-ball` (a result as a coloured number ball, flat with `data-on="paper"`), and for slots
`table-machine` (the recessed window and its sizes), `table-reel` (an ivory drum; its strip is
moved by `--m` and lit with `data-lit`), `table-payline` (the two pointers), `slot-glyph` (a
symbol in the two inks), `slot-trio` (a result as a three-symbol strip, red-edged with
`data-paid`, flat with `data-on="paper"`) and `slot-tile` (a pay-table tile), and for keno
`table-blower` (the SVG blower, styled through `data-b` and `data-s` attributes; the air moves
with `data-mixing`), `table-pick` (a board spot, its chip with `aria-pressed`, a dashed ring with
`data-drawn`, a red chip with `data-hit`), `keno-ball` (a drawn number as a small ball, red with
`data-hit`, flat with `data-on="paper"`), `keno-tile` (a result in the history) and
`table-paystrip` (the pay strip; a pay below the stake is `data-under` and printed in paper at
60%, never `print-faint`, which sets no text). Product UI uses these and the tokens, never hex.

## 4. Typography

| Utility        | Phone | From 48rem | Line height         | Use                                |
| -------------- | ----- | ---------- | ------------------- | ---------------------------------- |
| `text-note`    | 14    | 14         | 1.45                | footnotes, receipt details         |
| `text-body`    | 16    | 17         | 1.55 (Chinese 1.8)  | body text                          |
| `text-lede`    | 18    | 20         | 1.5 (Chinese 1.8)   | ledes, h3                          |
| `text-heading` | 34    | 48         | 1.05 (Chinese 1.25) | section headings                   |
| `text-display` | 52    | 88         | 0.95 (Chinese 1.15) | the page's one h1; Chinese 40 / 60 |
| `text-price`   | 26    | 30         | 1                   | multipliers on ticket stubs (Doto) |
| `text-total`   | 44    | 52         | 1                   | the net result on a receipt (Doto) |

- `font-text` is Schibsted Grotesk (the system's Chinese face for Chinese, Inter for Cyrillic,
  which Schibsted lacks); weights 400, 600 and 800 only (`font-normal`, `font-semibold`,
  `font-extrabold`).
- Headings and the display size track tighter (−0.025em, −0.035em) except in Chinese, which
  keeps 0. Line heights and tracking are tokens (`--line-*`, `--track-*`) that
  `:root:lang(zh-Hans)` overrides; headings use `break-keep` so Chinese breaks at punctuation.
- `font-print` is Doto at 800, for printed figures only.
- Amounts and hashes in text use `font-semibold tabular-nums`.
- Sizes step at one breakpoint and never scale with the viewport width.
- The fonts are files in the repo (`apps/web/src/features/home/fonts/`, SIL OFL 1.1 with
  their licences), loaded through `next/font/local` in `features/home/fonts.ts`, which sets
  `--font-schibsted` and `--font-doto`. Schibsted is one variable file (400–800, Latin and Latin
  Extended, 58 kB); Doto is Latin at 800 (4 kB). A build never fetches fonts from Google, and
  Chinese loads no web font: a CJK web font costs megabytes, and every platform ships one.

## 5. Space And Grid

- Spacing is a multiple of 8px; small components use 4 and 12 inside.
- `py-section`: 64 on phones, 96 from 48rem. `mb-head` (title to content): 32, then 48.
- `px-gutter`: 16, then 56. `max-w-page`: 1200px.
- 12 columns with a 24px gap (`gap-columns`). Every section head spans 7 columns; every list in a
  section sits on the same columns. A spacing token is never named after a display value: Tailwind
  makes `inline-<token>` an inline size, so a token named `grid` would size every `inline-grid`.

## 6. Radius, Lines And Elevation

- `rounded-print` (4px): inputs, stubs and small printed parts. `rounded-sheet` (8px):
  receipts, slips and buttons. `rounded-spot` (16px): a betting spot printed on a table's felt.
  `rounded-full`: stamps, dots, chips and switches. A table's felt, lane and readout carry their
  own radii inside their `table-*` utilities. Nothing else.
- Lines (`01-brand.md` §5): `border` 1px solid, `border-2 border-dashed`, `border-2
border-dotted`, and a 2px ring. No other widths or styles.
- On a page and on paper there are no shadows except the printer slot's recess
  (`print-slot`): things are separated by their edge or their surface.
- A game table is a physical object and casts and holds real shadows (the rail, the lane, the
  ball, the puck, chips, the docked phone slip). They live only in the `table-*` utilities.

## 7. Theme

Carbon copy has one fixed scheme: carbon and paper both appear on every page. There is no light
or dark toggle, and components never branch on `dark:` variants.

## 8. Do Not Do

- Do not use `bg-[#...]`, `text-[#...]`, `border-[#...]`, or `shadow-[...]`; a table's
  shadows are `table-*` utilities.
- Do not use the table tokens off a game table.
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
