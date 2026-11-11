# 04 · Page Blueprints

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-11-09 |
| Depends on | `01-brand.md`, `03-information-architecture.md`, `casino-placebet-ux.md` |
| Supersedes | Draft v1 pre-implementation wireframes |

This file records what each page is for and what it must show. It is not a gate before code
changes. Pages are rebuilt in Carbon copy in the order of `01-brand.md` §11; every figure on a
rebuilt page comes from the release manifest, a chain read or the bet index, never from copy.

## 1. Shared: the receipt

The home page, the game room and the receipt page print the same receipt.

Rows, with exact amounts (the token's full decimals, never rounded):

1. stake;
2. won: the gross payout, before the house edge;
3. house edge: the amount and its rate ("2% of the win", ADR-0007 fee on payout);
4. paid to wallet: the net payout;
5. unused stake returned, when there is one;
6. the result: the game's line and side, and the roll of every round.

Under a dashed tear line: bet id, request id, random hash, the place-bet and settlement
transactions, and the randomness fee actually charged (`vrfFeeCharged`), each with an explorer
link. A settled receipt carries the settled stamp and a torn edge. `HouseEdgeAllocated` is the
turnover allocation, not the fee taken from a win, and is labelled as such.

## 2. `/`

Purpose: show what ArbiGameFi is and let a visitor check it.

Must show, in this order:

- **Hero, on carbon.** What the product is in one sentence, the site state
  (`02-voice-and-copy.md` §8) and its one action, and a real receipt beside it. The receipt
  rotates through the latest settled bets, wins and losses alike, never only wins. On a phone the
  receipt's net result is inside the first screen.
- **Verify, on paper.** A table of what the player can check and where: randomness, contract
  source, the house edge, the governance timelock, system status and the audit report. The
  guardian joins it when the release manifest carries the guardian's address; the licence when
  the operator's licence number is published.
- **Games, on paper.** One ticket stub per enabled game: its name, its multiplier range and a
  link. Minimum stake and the round limit appear once, in a footnote.
- **How a bet works, on paper.** Three numbered steps, the only numbered list on the page, plus
  what happens if randomness is late.
- **Liquidity, on carbon.** What a deposit funds, the worst case, and how and when it can be
  withdrawn. No promised returns.
- **Footer, on carbon-deep.** Official channels, legal pages, restricted regions.

Failure behaviour: a figure that cannot be read shows `—`; the page still renders.

## 3. `/casino`

Purpose: game discovery.

Must show:

- available games from the current release/catalog;
- unavailable games as disabled, not broken;
- the site state on each game: preview, testnet or live;
- recent settlements if index data is available.

## 4. `/casino/[slug]`

Purpose: the betting room. It has two layers (`01-brand.md` §2): **the table is immersion, the
paper is trust.** The dice room is the reference; other games keep its structure and draw their
own table. Dice, roulette and slots are rebuilt; the other games still use the shared room shell
until their tables are drawn.

### Layout

- **Desktop.** The game's head above the table on the left; the table takes the rest of the
  width. On the right a paper column of 360–400px: a thin paper slot level with the top of the
  felt, one status line above the slot (a 7px light and its text), and the slip and receipt
  hanging from the slot, top-aligned with the felt. Only the slot of the printer is drawn.
- **Tablet (up to 1080px).** The table first, then the slot and the slip under it.
- **Phone (up to 720px).** No slot. The slip is a sheet docked to the bottom of the screen.
  Closed, it shows one summary line, the stake input and the main button, so the table and the
  button share the screen; after a result it shows the rolled number, the net result, and Bet
  again and Change bet. Tapping the summary opens the full slip or receipt. The page leaves room
  at the bottom for the sheet.

### The table (dice)

- Indigo felt with a fine noise under one overhead lamp, a padded dark rail, and a carved lane.
- Printed on the felt in paper-white ink: the 1–100 scale, Win chance and Pays in Doto, two
  betting spots ("Roll under, 1 to N" and "Roll over, N+1 to 100") with a chip on the chosen
  one, and a small rule along the bottom edge ("Pays 100 ÷ the winning numbers, less a 2% house
  edge. The ball stops on the number Chainlink VRF rolls."). The winning numbers are a field of
  printed dots in the lane.
- A paper puck on a dashed cut sets the line; it is dragged, and a keyboard range carries the
  same value. Win chance is 2%–97% (under 2–97, over 3–98).
- The top right holds the sound switch (off by default), the net amount of a win, and one status
  line. Under a 640px felt that group wraps under the figures.
- **The ball follows the bet's chain state.** While the random number is awaited it rolls back
  and forth along the whole scale and the readout above it shows only the number under it. When
  the number arrives it rolls on from where it is, at the speed it has, straight to the number,
  and stops with a small settle; the readout becomes a paper tag. It never reverses, never
  overshoots and never slows down for the line. With several rounds each later round rolls from
  rest, a pin marks each landing (filled when that round won) and the status reads "Round k of
  n". The ball is on the number 4s after the number arrives even when the tab gets no frames.
- A net win is paid on the table (`02-voice-and-copy.md` §11). A loss gets nothing.

### The table (roulette)

- The same felt, rail and lamp. The felt holds a tilted single-zero wheel (red and black pockets,
  a green zero, deflectors and a four-armed turret), and under it the horizontal layout printed
  in paper-white ink, on every screen size: 0, the 3 × 12 numbers, the three columns, the dozens
  and the six outside bets (1–18, Even, red, black, Odd, 19–36).
- **One bet is the union of the chips.** Each spot the player taps gets a chip; the numbers under
  all chips are one bet that pays `floor(stake × 37 ÷ k)` on any of its `k` numbers, less the
  release's house edge. Win chance is printed to one decimal; the figures (Numbers, Win chance,
  Pays) sit between the wheel and the layout. The table opens with a chip on red.
- Hover, keyboard focus or a 380ms long press previews the numbers a spot covers; a long press
  places no chip. Clear chips empties the layout. An empty layout or one that covers all 37
  numbers cannot be bet, and the slip says why.
- While the bet is placed "No more bets" lies across the layout for 1.5s. On a phone the felt
  scrolls into view after the bet, so the wheel is on screen when the number arrives.
- **The ball follows the bet's chain state** (`12-motion.md` §5): it circles the track until the
  number arrives, then drops into that pocket. The pocket lights, the other pockets dim, a dolly
  marks the winning number on the layout and a big result ball (68px, 52px on a phone) sits at
  the wheel's top right.
- Results are coloured number balls (red, black, green) in the status line, the last 12 results,
  the slip's head and the receipt; screen readers hear "17, black".
- A net win is paid in chips onto the winning spot. A loss gets nothing.

### The table (slots)

- The same felt, rail and lamp. A machine is set into the felt like the dice lane: a recessed
  window holding three ivory drums with curved shading top and bottom, and two paper pointers at
  the pay line. The eight symbols (cherry, lemon, bell, diamond, crown, star, BAR, 7) are drawn
  in the table's two inks, navy and lacquer red, like an old reel strip.
- Under the machine the pay table is printed on the felt: three lines, each with its tiles, its
  name, how often it comes up ("1 in 512", "7 in 512", "168 in 512") and what it pays, the stake
  included and the release's house edge taken (64×, 16× and 2× gross). On a phone the odds sit
  under the name. A rule along the bottom gives the house edge and the average return.
- Top prize and Win chance (34.4%, 176 in 512) sit in Doto beside the sound switch, the net
  amount of a win and the status line. A pair is a net win.
- **The reels follow the bet's chain state** (`12-motion.md` §5): they spin at full speed until
  the number arrives, then stop left to right on their symbols, each with a small bounce.
- The line a result hits lights up and so do the reels that make it. With several rounds the
  status reads "Round k of n" and each later round spins faster. On a phone the felt scrolls to
  the top after the bet, so the reels and the pay table sit above the docked slip.
- Results are three-symbol strips in the status line, the last 12 results, the slip's head and
  the receipt, with a red edge when that spin paid; screen readers hear "seven, seven, seven".
  The slip's quote lists what each line pays for the stake.
- A net win is paid in chips onto the line that was hit; three alike or better warms the lamp
  further. A loss gets nothing.

### The paper

The slip is one sheet through the whole bet, with no overlays:

1. **Quote.** The game line, the most the player can win, the total stake for several rounds,
   the randomness fee as "up to X ETH" (the amount the wallet attaches), rounds, stake and the
   main button.
2. **Wait.** Once the bet is placed a short waiting slip feeds out of the slot. The status line
   reads "Waiting for the random number, N s" with a slow blink, then "Number received" while
   the ball rolls.
3. **Print.** When the ball stops the receipt prints out of the slot ("Printing receipt", fast
   blink, then "Receipt printed"), is stamped "Paid to wallet" or "Settled" and has a torn edge.
4. **Tear off.** "Bet again" or "Change bet" tears the receipt off first; the room's recent
   receipts list the bet once the bet index has it.

Rules:

- The main action stays in one place in every state. When a single action fixes a problem, the
  button becomes that action ("Lower to 1.06", "Switch to Base Sepolia", "Get test ETH") and the
  reason sits above it.
- Late randomness, manual settlement and refund follow `casino-placebet-ux.md`; they are states
  of the slip, not dialogs. The ball stops rolling when a refund is offered.
- The receipt states the facts; the table never contradicts it. Every figure comes from the
  chain read the receipt uses.
- Raw RPC/viem/contract errors never render as product copy.

## 5. `/casino/receipt/[chainId]/[betId]`

Purpose: the permanent, shareable receipt. It prints §1 in full and links back to the game.

## 6. `/portfolio`

Purpose: the player's own overview, reached from the wallet menu.

Must show:

- wallet-scoped balances and claimable balance;
- recent activity, each linking to its receipt;
- deposit NFTs, if any;
- links to full activity and claims.

## 7. `/portfolio/activity`

Purpose: the player's ledger.

Must show player-scoped history, the chain/index fallback state, each bet's lifecycle and
transaction links, and the release and chain context.

## 8. `/portfolio/claims`

Purpose: claim rewards and refund credit.

Must show:

- accrued, locked and claimable amounts in USDC;
- disabled state with reason;
- transaction result.

## 9. `/liquidity`

Purpose: the entry for liquidity providers. Details in
[`earn-provider-console-spec.md`](./earn-provider-console-spec.md).

Must show:

- the house pool per asset: cash, reserved payouts and free capital;
- what a deposit funds and the worst case, before the deposit form;
- deposit and withdraw, with the 24-hour lock and its deadline;
- a clear reason when a rule blocks an action.

## 10. `/rewards`

Purpose: referral and rebate rewards, paid in USDC. Shows how attribution works, the player's
referral link and what they have earned, and links to claims.

## 11. `/status` and `/ops`

`/status` is public proof: release, contracts, keeper and index health, governance queue.
`/ops` is the operator's control room and may use denser terminology.

## 12. `/legal/*` and `/support`

Static pages: a simple text layout, no wallet requirement, no marketing claims the protocol does
not support. Support links the official channels.

## 13. Cross-Page Requirements

- Every CTA points to a real current route.
- Every page has a loading and degraded state.
- Product copy is localized.
- Chain/release facts come from release artifacts or SDK reads, not guesses.
- Error states tell the user what to do next.

## 14. Verification

```bash
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
rg -n "BetNotFound|readContract|Contract Call|viem@" frontend/apps/web/src
rg -n "href=\\\"/(dice|roulette|games|bets|account|invest|pools|bankroll)" frontend/apps/web/src
```
