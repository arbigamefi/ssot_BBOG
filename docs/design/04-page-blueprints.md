# 04 · Page Blueprints

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-11-12 |
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

- one small felt table per game the current release ships, simplest first (coin toss, dice,
  roulette, baccarat, sic bo, slots, plinko, keno): the room's rail, felt and lamp with the game's
  piece drawn at rest, and printed on the felt its name, one line on how to play, its win chance
  range as its room counts it and the most one bet can return after the release's house edge,
  rounded down ("Pays" for coin toss, "Up to" for the rest). Four to a row on wide screens, two
  from 1100 px down, with the two figures stacked from 560 px down. Each table is one link whose
  name reads the name, the line, the win chance and the pay. No paper on the page: paper is for
  the slip and the receipt in the rooms;
- nothing for a game GameHub has disabled: it takes no new bets, and its room shows the closed
  state;
- the site state above the games: in preview the official Telegram channel is the only action,
  on a test chain the copy says the USDC has no value and links the faucet, and live prints no
  state;
- what the bet index has counted so far (bets, players, total staked), once it has counted a bet.

## 4. `/casino/[slug]`

Purpose: the betting room. It has two layers (`01-brand.md` §2): **the table is immersion, the
paper is trust.** The dice room is the reference; other games keep its structure and draw their
own table.

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
