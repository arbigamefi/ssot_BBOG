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
paper is trust.** The dice room is the reference; every other game keeps its structure and
draws its own table: roulette, slots, keno, plinko, coin toss, baccarat and sic bo. A slug with no
table shows "Game not found".

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

### The table (keno)

- The same felt, rail and lamp. The hero is a glass blower: a round globe with a chrome rim, two
  collars and a stand, holding fifteen ivory balls; a glass tube rises from its top and runs over
  to a rack of five slots beside it. On a wide felt it takes about 60% of the width and spans two
  rows; at 620px it moves under the figures (at most 420px wide), on a phone it is at most 284px.
- Beside it: Picked, Win chance (at least one hit that pays more than the stake: 24.2% for three
  picks with a 2% edge) and All hit pays in Doto, then the net amount of a win and the status
  line (hidden on a phone). Under them the board: fifteen numbers in three rows of five, each a
  48px spot (40px on a phone) that takes a chip when picked. A sixth pick is refused with a hint.
  Clear picks, the sound switch and the last 10 results ("2/3") share one row.
- Under both the pay strip is printed on the felt: a column for each number of hits from 0 to the
  numbers picked, with what it pays per round (stake included, house edge taken, rounded down)
  and how often it comes up ("26.4%", or "1 in 3003"). A pay below the stake is printed soft, so
  a partial refund never reads as a win.
- **The balls follow the bet's chain state** (`12-motion.md` §5): they tumble on the air jet until
  the number arrives, then the round's five go up the tube one by one into the rack. Each marks
  the board as it lands: a dashed ring on a drawn number, a red chip on one of the player's.
- The hit column of the pay strip lights; with several rounds the status reads "Round k of n" and
  each round's marks clear before the next is drawn. On a phone the felt scrolls to the top after
  the bet, so the blower, the board and the pay strip sit above the docked slip.
- Results are the drawn numbers as small ivory balls, the player's in red, in the status line, the
  slip's head and the receipt; screen readers hear "Drew 1, 4, 7, 9, 12. 2 of 3 hit." The slip's
  quote gives what all hit pays for the stake.
- Only a net win is paid in chips, onto the column that was hit. A pay below the stake gets
  nothing, like a loss.

### The table (plinko)

- The same felt, rail and lamp. The hero is a pin board set into the felt like the slots window: a
  recessed well with eight rows of ivory pins, the outer pins making the triangle and the last
  row's pins standing on the walls of nine cups. A chrome cradle at the top holds the lacquer-red
  ball over a gate. On a wide felt the board takes the left column (1.9 to 1) and spans two rows;
  at 620px it moves under the figures (at most 440px wide), on a phone it takes the full width.
- Under the well, a column under each cup, the pays are printed on the felt: what the cup pays per
  ball (stake included, house edge taken, rounded down to three figures: 24.12 prints as 24.1) and
  how often a ball lands there (0.4%, 3.1%, 10.9%, 21.9%, 27.3%). A pay below the stake is printed
  soft, so a partial refund never reads as a win.
- Beside it: Win chance (28.9% at every risk with a 2% edge: the outer six cups win), Outer cups
  and Middle cup in Doto, then the risk as three tabs (Low, Medium, High; the chosen one is a
  paper tab, and they lock while a bet is out), the net amount of a win and the status line
  (hidden on a phone), and the sound switch beside the last 10 results ("8.10×"). On a phone the
  figures sit in one row and the risk tabs beside their label. The felt rule says risk changes
  what the cups pay, never where the ball goes.
- **The ball follows the bet's chain state** (`12-motion.md` §5): it rocks in its cradle until the
  number arrives, then falls along the eight bounces the number chose, lighting each pin it hits
  and leaving a dotted trace, and bounces to rest in its cup. With several balls they drop about
  0.4s apart; one ball rests in each cup and a tag over it counts the rest ("×3"), and the status
  reads "Ball k of n". On a phone the felt scrolls to the top after the bet, so the board and the
  pays sit above the docked slip.
- Results are the path as eight printed ticks (\ for a left, / for a right) with the cup's pay, in
  the status line, the slip's head and the receipt; screen readers hear "Bounced left, right, …
  into the 8.10× cup." The slip's quote gives what an outer cup pays for the stake.
- Every cup a ball landed in lights. Only a net win glows and is paid in chips, onto the label of
  the best cup the balls reached, under the ball and never over it. A pay below the stake gets
  nothing, like a loss.

### The table (coin toss)

- The same felt, rail and lamp, seen from above. The hero is the coin over a ring printed on the
  felt: a thick token with a reeded edge, heads ivory with a navy sun, tails lacquer red with an
  ivory moon, with no words on either face. The coin is 184px (140px on a phone); on a wide felt
  it takes the left column (1.25 to 1) and spans two rows, and at 620px it moves under the
  figures.
- Beside it: Win chance (50.0%) and "A match pays" (1.96× at a 2% edge) in Doto, the net amount of
  a win and the status line (hidden on a phone), and the sound switch beside the last 12 results
  as small coins, the ones that matched your call ringed.
- **The call is two spots printed on the felt** under the coin: Heads and Tails, each with a small
  coin and "Pays 1.96×". Your chip sits on the chosen spot (on a phone, on its top-right corner);
  the spots lock while a bet is out.
- **The coin follows the bet's chain state** (`12-motion.md` §5): placing the bet tosses it, and
  it spins over the felt until the number arrives. Then it comes down still turning, ends exactly
  on the side the number chose, touches the ring, rattles and lies flat. For several flips it is
  tossed again from there, and the status reads "Flip k of n". On a phone the felt scrolls to the
  top after the bet, so the coin and the spots sit above the docked slip.
- The side that came up lights its spot. Results read "Landed Tails. You called Tails." (or "Last
  flip landed Tails. 2 of 3 flips matched your call.") after a printed mark of the side, in the
  status line, the slip's head and the receipt. The slip's quote gives what a match pays for the
  stake.
- Only a net win turns your chip red and is paid in chips, stacked beside your chip.

### The table (baccarat)

- The same felt, rail and lamp, seen from above with the dealer's side at the top: a dark shoe at
  the top right showing the next card's back, Win chance and "A win pays" in Doto for your side
  beside it, then the Player and Banker hands, each a frame printed on the felt with its name, its
  total in Doto and dashed card spots. The third spot lies sideways, outside the first two; on a
  felt of 620px or less it goes under them.
- The cards are ivory with navy and lacquer-red ink and a navy lattice back with a paper border;
  pictures show only their letter in a printed frame. They are 72 × 100px, 56 × 78px on a narrow
  felt and 46 × 64px on a phone.
- **Your bet is three spots printed on the felt** under the hands: Player, Tie and Banker, each
  with "Pays 2.19×", "Pays 10.26×" or "Pays 2.13×" (at a 2% edge). Your chip sits on the chosen
  spot's top-right corner; the spots lock while a bet is out.
- **The cards follow the bet's chain state** (`12-motion.md` §5): placing the bet deals four blank
  cards face down, P, B, P, B; they stay down until the number arrives. Then they turn over in
  dealing order and each side's total counts up; the status says "Banker has a natural 9." or
  "Player draws a third card.", and a third card slides out of the shoe and turns only when the
  rule says so. For several hands the cards are swept and the next hand is dealt, faster, and the
  status reads "Hand k of n". On a phone the felt scrolls to the top after the bet.
- The winning hand's frame and its spot light; the other hand dims, and a tie lights both. A tie
  loses Player and Banker bets, and the rule printed on the felt says so, with the card values and
  that suits are for show (the contract draws ranks only; suits are random in the browser, the
  same on the felt and the receipt).
- Beside the sound switch, a bead road of the last results: six beads a column, twelve columns,
  Player a blue bead, Banker red, a tie paper, the newest ringed.
- Results read "Banker wins, 9 to 6. You backed Banker." (or "Last hand: Banker wins, 9 to 6. 2 of
  3 hands won."). The receipt prints the last hand under it, card by card, red for hearts and
  diamonds.
- Only a net win turns your chip red and is paid in chips, stacked half over your chip and
  leaning left.

### The table (sic bo)

- The same felt, rail and lamp. At the top left a dark dish under a glass dome with a highlight, a
  rim and a knob, 212px across (148px on a phone); three ivory dice of 40px (30px) lie in it, navy
  pips with the one and the four in lacquer red. Beside it your bet's name, Win chance and "A win
  pays" in Doto; for a single face it reads "1.96× a die".
- **The layout is printed on the felt below**, as at a real table, in four rows: Small (4 to 10),
  Any triple and Big (11 to 17); the six doubles and six triples as small dice; the totals 4 to 17
  (two rows of seven on a felt of 620px or less); the single faces 1 to 6. Each area prints its
  pays at a 2% edge: Small and Big 2.01×, any triple 35.28×, a triple 211.68×, a double 13.23×, a
  total 70.56× to 7.84×, a single face 1.96× a die. Your chip sits on the chosen area's top-right
  corner; the layout locks while a bet is out. One area is one bet, as the contract takes it.
- **The dice follow the bet's chain state** (`12-motion.md` §5): placing the bet brings the dome
  down and shakes it, the dice tumbling and bouncing off the glass, until the number arrives. Then
  the dice settle on their faces in a loose triangle and the dome lifts up and to the right. For
  several rolls the dome comes down again, shakes and lifts on the next roll, and the status reads
  "Roll k of n". On a phone the felt scrolls to the top after the bet.
- Every area the dice make true lights, whatever you bet on; your chip turns red only on a net
  win. The rule printed under the layout says the dice are fair VRF dice, that Small and Big lose
  on any triple, and what a single face pays for one, two and three dice.
- Beside the sound switch, the last results as three small dice each, a paid roll ringed: eight on
  a wide felt, two on a phone, this visit only.
- Results read "Total 14. You bet Big." after three small dice (or "Last roll, total 6. 1 of 3
  rolls paid."). The slip's line for a single face lists what one, two and three dice pay.
- Only a net win is paid in chips, stacked on your chip at its own size.

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
