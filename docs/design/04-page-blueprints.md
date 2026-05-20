# 04 · Page Blueprints

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `03-information-architecture.md`, `frontend-implementation-roadmap.md` |
| Supersedes | Draft v1 pre-implementation wireframes |

This file now records the page responsibilities that still matter after the
frontend rewrite. It is not a gate before code changes.

## 1. `/`

Purpose: acquisition and trust.

Must show:

- what ArbiGameFi is: non-custodial casino/sportsbook with verifiable
  settlement;
- casino/sportsbook entry points;
- release/proof signal;
- bankroll or activity proof where available;
- clear CTA to `/casino` or `/sportsbook`.

Failure behavior: proof/live data may degrade to `—`; the page still renders.

## 2. `/casino`

Purpose: game discovery.

Must show:

- available casino games from the current release/catalog;
- unavailable games as disabled, not broken;
- recent settlements if index data is available;
- no per-game brand hue families.

## 3. `/casino/[slug]`

Purpose: primary casino betting room.

Must support:

- wallet connect and chain gating;
- amount/params configuration;
- allowance approval if needed;
- `placeBet`;
- VRF waiting state;
- keeper-driven settlement state;
- manual settle only as fallback;
- refund path after timeout;
- terminal result receipt from chain-derived facts.

Result receipt must show:

- win/loss/refund state;
- net payout;
- bet id;
- request id;
- random hash;
- settlement transaction when available.

Raw RPC/viem/contract errors must never render as product copy.

## 4. `/sportsbook` and `/sportsbook/[marketId]`

Purpose: fixed-odds market discovery and ticket placement.

Must support:

- market list and lock/status information;
- signed odds snapshot before ticket placement;
- market detail and ticket preview;
- result/finality/void/challenge states;
- clear disabled states when sportsbook feature gates or provider readiness
  are not satisfied.

## 5. `/portfolio`

Purpose: user account overview without becoming a second home page.

Must show:

- wallet-scoped balances and claimables;
- recent activity;
- LP position summary if any;
- links to full activity and claims.

## 6. `/portfolio/activity` and `/portfolio/activity/[betId]`

Purpose: ledger and detail proof.

Must show:

- player-scoped history;
- chain/index fallback state;
- bet/ticket lifecycle;
- transaction links;
- release/chain context.

The detail page is the right place for dense proof data that would overload the
game room.

## 7. `/portfolio/claims`

Purpose: XP/refund credit claimability.

Must show:

- accrued/locked/holdback or equivalent buckets when available;
- claimable amounts;
- disabled state with reason;
- transaction result.

## 8. `/earn`

Purpose: LP bankroll entry.

Must show:

- active pools/assets;
- NAV/reserves/liabilities/free-liquidity summary;
- deposit/withdraw actions;
- clear explanation when risk or free-liquidity rules block an action.

## 9. `/ops`

Purpose: operator and auditor control room.

Must show:

- release and chain context;
- keeper health;
- bet-index/API health;
- sportsbook provider/readiness state;
- recent operational events or links to runbooks.

Ops pages may use denser terminology than player pages.

## 10. `/legal/*`

Purpose: static legal disclosure.

Must:

- use a simple legal layout;
- avoid wallet requirements;
- avoid marketing claims not supported by the protocol.

## 11. Cross-Page Requirements

- Every CTA points to a real current route.
- Every page has a loading and degraded state.
- Product copy is localized.
- Chain/release facts come from release artifacts or SDK reads, not guesses.
- Error states tell the user what to do next.

## 12. Verification

```bash
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
rg -n "BetNotFound|readContract|Contract Call|viem@" frontend/apps/web/src
rg -n "href=\\\"/(dice|roulette|games|bets|account|invest|liquidity)" frontend/apps/web/src
```
