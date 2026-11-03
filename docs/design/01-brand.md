# 01 · Brand

| Owner | Frontend Lead + Product |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `10-design-tokens.md` |
| Supersedes | The 2026-05-18 dark-dashboard direction |

The ArbiGameFi brand is **Carbon copy** (复写联). The owner adopted it on 2026-11-03 after
reviewing the home page and dice room concepts.

## 1. What the brand has to prove

| Reader                      | What they must be able to see                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player                      | The money stays in their wallet until they bet, the odds and the most they can win are on the slip before they sign, and every result has a receipt they can check. |
| Liquidity provider          | What their deposit funds (the house pool), what it can lose, and how and when they can take it out.                                                                 |
| Auditor, regulator, partner | The site claims only what the contracts and the release do.                                                                                                         |

The brand serves these readers. It is never a promo skin over them.

## 2. Concept

Every bet prints two copies: one goes to the player's wallet, one stays on chain. The
settlement receipt is the product's strongest asset, so it is the visual language itself, not
an illustration on a card.

- The home page shows real receipts as evidence.
- A game room is one sheet of paper. It starts as the quote (the slip), prints into the receipt
  when the bet is sent, and is torn off when the bet settles.

## 3. Colour roles

| Token             | Role                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `carbon`          | The dark surface. Headings on paper.                                                        |
| `carbon-deep`     | Status strips and the footer: quieter than anything under them.                             |
| `paper`           | The light surface, and text on carbon.                                                      |
| `ink`             | Carbon-copy ink: printed objects (receipts, slips, stubs, stamps) and things you can press. |
| `ink-bright`      | Ink under the pointer.                                                                      |
| `faded`           | Secondary text on paper; the edge of an input on paper.                                     |
| `thermal`         | Lines that separate content on paper; disabled text.                                        |
| `on-carbon-muted` | Secondary text on carbon.                                                                   |

Rules:

- Ink never sits on carbon (1.43:1). On carbon, links and buttons are paper.
- Thermal is too light (1.73:1) to mark a control's edge. Inputs on paper use faded.
- No other hue exists. Games, liquidity and portfolio get no colour families of their own.
- A page alternates carbon and paper sections. The home page puts the hero and liquidity on
  carbon, and verification, games and steps on paper.

Values and contrast figures are in [`10-design-tokens.md`](./10-design-tokens.md).

## 4. Type

- **Schibsted Grotesk sets every word**, at 400, 600 and 800 only. Chinese falls back to Noto
  Sans SC at the same weights, with a body line height of 1.8.
- **Doto 800 prints figures only**: the net result on a receipt, multipliers on ticket stubs,
  and win chances, multipliers and rolls in a game room. Doto's full stop looks like a plus, so
  the decimal point stays in Schibsted. Signs use Doto's own glyphs; minus is U+2212.
- **Small amounts and hashes** use Schibsted 600 with tabular figures. The product uses no
  monospace face.
- **Five text sizes**: note, body, lede, heading, display. Receipts and stubs add two figure
  sizes, total and price. Phones get a smaller step; nothing scales with the viewport width.
- **Chinese headings** use weight 800 and break only at punctuation (`word-break: keep-all`), so
  a word such as 每一注 never splits.
- No sentence gets one phrase in bold or a different colour to make it stand out.

## 5. Lines and edges

There are four kinds of line, and nothing else:

| Line       | Meaning                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| 1px solid  | Structure: section tops, table rows, ticket edges                                             |
| 2px dashed | A tear or cut: the divider inside a receipt, a stub's perforation, the line on the dice scale |
| 2px dotted | A leader between a label and its amount on a receipt                                          |
| 2px ring   | A stamp: the settled stamp, step numbers, the 18+ mark                                        |

A torn zigzag edge means a finished receipt. Paper still being filled in or printed has plain
edges.

## 6. Printed objects

Only printed objects are boxed: receipts, slips, ticket stubs, stamps and the dice scale strip.
Nothing else on the site is a card. Lists sit under a 1px top line on the page grid.

## 7. Wins and losses

There are no win or lose colours. A win is printed in ink; a loss is blank paper. No confetti,
no celebration copy: the receipt states the facts, including the house edge taken from a win.

## 8. Logo

- Use the `ArbiGameFi` wordmark in the header.
- Use the geometric mark only for the favicon, app icon and tight spaces.
- Do not animate, gradient-fill, stretch, shadow or recolour the wordmark.

## 9. Imagery

Allowed: real receipts and chain data, diagrams drawn from the brand's lines, and the icons
already in use.

Not allowed: casino photography, chips, coins, stadiums, AI illustrations, mascots, decorative
external image URLs and per-game visual brands.

## 10. What the brand leaves out

- all-caps labels above headings;
- metadata strings joined with middle dots;
- arrows appended to button and link text;
- numbered markers, except where the content is a real sequence (the three steps of a bet);
- gradient washes and soft shadows used as decoration.

## 11. Rollout

Pages move to Carbon copy one at a time: the home page and the dice room first, then
Liquidity, Portfolio, the receipt page, the entry card and the other game rooms. A page that has
not moved keeps the old dark tokens, and nothing new is built on them. The old tokens are
deleted with the last page.

Moved so far: the home page (`app/(marketing)`, `features/home`). The site header and footer
still use the old tokens and move with the navigation change (`03-information-architecture.md`).

## 12. Verification

```bash
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "game.*(purple|emerald|amber|fuchsia|rose)|--game-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "http.*(grainy|unsplash|pexels|pixabay)" frontend/apps/web/src frontend/packages/ui/src
pnpm -C frontend/packages/ui exec vitest run -c vitest.config.ts src/tokens
```
