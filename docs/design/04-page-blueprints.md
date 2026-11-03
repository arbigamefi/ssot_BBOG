# 04 · Page Blueprints

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-11-03 |
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

Purpose: the betting room. The dice room is the reference; other games keep its structure and
change only the table.

Layout: the game's head and table on the left (7 of 12 columns), the slip on the right (5
columns). On a phone the slip follows the table and its main action rides along the bottom of
the screen while the slip is in view.

The slip is one sheet of paper through the whole bet, with no overlays:

1. **Quote.** Win chance, then multiplier; stake and number of rounds; the most the player can
   win; the randomness fee as "up to X ETH", the amount the wallet attaches.
2. **Print.** Once the bet is sent, the same sheet prints the receipt; waiting for randomness is
   shown as printing.
3. **Stamp.** On settlement the receipt is stamped "Paid to wallet" or "Settled" and gets a torn
   edge.
4. **Tear off.** "Bet again" or "Change bet" tears the receipt off and gives the slip a fresh
   sheet; the room's recent receipts list the bet once the bet index has it.

Rules:

- The main action stays in one place in every state. When a single action fixes a problem, the
  button becomes that action ("Lower to 1.06", "Switch to Base Sepolia", "Get test ETH") and the
  reason sits above it.
- Late randomness, manual settlement and refund follow `casino-placebet-ux.md`; they are states
  of the slip, not dialogs.
- Dice: win chance 2%–97% in the UI (under 2–97, over 3–98). The winning side of the scale is
  printed in ink dots; the losing side stays blank. Rolls are punched into the scale.
- Raw RPC/viem/contract errors never render as product copy.

## 5. `/casino/receipt/[chainId]/[betId]`

Purpose: the permanent, shareable receipt. It prints §1 in full and links back to the game.

- **On carbon:** the bet's title, one sentence on what it is, "Play {game}" and "Copy link";
  the receipt prints out of the slot beside them. Each game's draw (rolls, coin sides, numbers,
  cards) and the randomness fee are read from the chain when the bet belongs to the release the
  site runs; otherwise the fee prints `—`. The bet index records no place-bet transaction, so the
  receipt prints the bet's block and links the settling transaction.
- **On paper:** where the facts come from (player, referrers, asset and GameHub contracts, block,
  last event, index or chain logs) and the `HouseEdgeAllocated` turnover allocation.
- **States:** loading prints an empty sheet with the feed bar; a placed or randomness-ready bet
  is paper still printing (stake, request, refund time, no stamp) and the page asks again every
  10 seconds; a finished bet whose amounts are not all indexed prints the same way; a missing bet
  and an unreadable index each get their own title and action. A void, or a payout held at
  settlement, carries the claim on the receipt.

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
