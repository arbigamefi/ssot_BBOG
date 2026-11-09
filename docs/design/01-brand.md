# 01 · Brand

| Owner | Frontend Lead + Product |
| Status | Active |
| Last Updated | 2026-11-09 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `10-design-tokens.md` |
| Supersedes | The 2026-05-18 dark-dashboard direction |

The ArbiGameFi brand is **Carbon copy** (复写联). The owner adopted it on 2026-11-03 after
reviewing the home page and dice room concepts, and added the table layer on 2026-11-09 after
the receipt-only dice room "didn't feel like a game".

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
- A game room has two layers: **the table is immersion, the paper is trust.**
  - **The table** is the game: a physical object (felt, a padded rail, the layout printed on
    the felt, a ball, chips) whose motion follows the bet's chain state. The dice ball rolls
    while Chainlink VRF has not answered and stops on the number it returns.
  - **The paper** is the proof: one sheet that starts as the quote (the slip), prints into the
    receipt when the ball stops, and is torn off for the next bet.

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

The table layer has its own materials (`felt`, `rail`, `groove`, `print`, `ivory`, `lamp`,
`chip`). They are used only on a game table, never on a page surface or on paper.

Values and contrast figures are in [`10-design-tokens.md`](./10-design-tokens.md).

## 4. Type

- **Schibsted Grotesk sets every word**, at 400, 600 and 800 only. Chinese uses the system's
  own Chinese face (PingFang SC, Microsoft YaHei, Noto Sans CJK SC), with a body line height
  of 1.8.
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

On the page and on paper, only printed objects are boxed: receipts, slips, ticket stubs and
stamps. Nothing else on the site is a card. Lists sit under a 1px top line on the page grid.

A game table is the one object outside this rule. It is drawn as a thing on the page (felt in a
rail, under a lamp), and its layout is printed on the felt in paper-white ink, never as cards.

## 7. Wins and losses

On paper there are no win or lose colours. A win is printed in ink; a loss is blank paper. No
confetti and no celebration copy: the receipt states the facts, including the house edge taken
from a win.

On the table a net win is paid the way a dealer pays it: chips slide from the house onto the
bet, the net amount lights up on the felt, the winning print brightens and the lamp warms, more
for a bigger multiple. A loss, or a payout below the stake, gets nothing. The rules are in
`02-voice-and-copy.md` §11.

## 8. Logo

- Use the `ArbiGameFi` wordmark in the header.
- Use the geometric mark only for the favicon, app icon and tight spaces.
- Do not animate, gradient-fill, stretch, shadow or recolour the wordmark.

## 9. Imagery

Allowed: real receipts and chain data, diagrams drawn from the brand's lines, and the icons
already in use.

Not allowed: casino photography, coins, stadiums, AI illustrations, mascots, decorative
external image URLs and per-game visual brands. Chips appear only as table objects drawn from
the table tokens, never as pictures.

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

Moved so far: the home page (`app/(marketing)`, `features/home`), the dice room
(`features/casino/dice-room`), whose table is the reference for the other games' tables, and the
site header and footer (`app-shell/SiteHeader.tsx`, `SiteFooter.tsx`, with the one navigation of
`03-information-architecture.md` §4). The header sits on carbon above every page, including pages
that have not moved; the root layout loads the Carbon copy faces for it. `isCarbonCopyPage` in
`app-shell/AppShell.tsx` lists the moved pages. The other game rooms keep the shared room shell;
every room reads the same controller (`features/casino/room/use-game-room.ts`), so a room moves by
rendering its own table and slip.

## 12. Verification

```bash
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "game.*(purple|emerald|amber|fuchsia|rose)|--game-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "http.*(grainy|unsplash|pexels|pixabay)" frontend/apps/web/src frontend/packages/ui/src
pnpm -C frontend/packages/ui exec vitest run -c vitest.config.ts src/tokens
```
