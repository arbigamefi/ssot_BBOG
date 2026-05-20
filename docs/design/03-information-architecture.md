# 03 · Information Architecture

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-implementation-roadmap.md` |
| Supersedes | Draft v1 IA matrix |

The IA supports a B2C casino/sportsbook product on a protocol-grade settlement
kernel. It should make the primary betting loop obvious while keeping proof,
portfolio, LP, and ops surfaces accessible.

## 1. Primary Users

| User     | Goal                                                  | Primary routes                                  |
| -------- | ----------------------------------------------------- | ----------------------------------------------- |
| Player   | Place bets/tickets, see results, verify history       | `/`, `/casino/*`, `/sportsbook/*`, `/portfolio` |
| LP       | Understand bankroll, deposit/withdraw, monitor risk   | `/earn`, `/portfolio`, `/ops`                   |
| Referrer | Understand attribution and claimable value            | `/portfolio`, future referral surfaces          |
| Operator | Monitor release, keeper, index, sports provider, risk | `/ops`                                          |
| Auditor  | Verify release, addresses, proofs, history            | `/`, `/ops`, `/portfolio/activity`, docs        |

## 2. Canonical Routes

```text
/
/casino
/casino/dice
/casino/coin-toss
/casino/roulette
/casino/keno
/sportsbook
/sportsbook/[marketId]
/portfolio
/portfolio/activity
/portfolio/activity/[betId]
/portfolio/claims
/earn
/ops
/legal/privacy
/legal/terms
/legal/disclaimer
```

Legacy aliases such as `/dice`, `/roulette`, `/games`, `/bets`, `/account`,
`/invest`, `/liquidity`, and `/prototype/*` are not product routes.

## 3. Primary Journeys

### Player Casino

```text
/ -> /casino -> /casino/[slug]
  -> connect wallet
  -> approve if needed
  -> placeBet
  -> wait for VRF
  -> keeper finalizes
  -> result receipt
  -> portfolio/activity detail
```

### Sportsbook Ticket

```text
/sportsbook -> /sportsbook/[marketId]
  -> receive signed odds snapshot
  -> place ticket
  -> market locks
  -> result proposed/finalized or voided
  -> ticket settlement/refund
```

### LP

```text
/earn -> deposit/withdraw -> /portfolio -> /ops for deeper proof
```

## 4. Navigation

Primary navigation:

```text
Casino | Sportsbook | Portfolio | Earn
```

Right side:

```text
locale | chain/release proof | wallet
```

Ops and legal can be reachable from footer or secondary links; they should not
compete with the betting path.

## 5. State Rules

Every product page should account for:

- disconnected wallet;
- wrong chain;
- loading data;
- empty history;
- degraded index/API fallback;
- disabled or unavailable chain feature;
- terminal success/failure.

Do not show raw provider errors. Map failures to product copy and a next action.

## 6. Cross-Page Patterns

- Release proof should be accessible from product chrome.
- Wallet gate should explain the action it unlocks.
- Activity links should lead to `/portfolio/activity/[betId]`.
- Ops should link to runbooks or docs for non-obvious states.

## 7. Verification

```bash
pnpm -C frontend precheck:frontend -- --strict
test ! -d frontend/apps/web/src/app/prototype
rg -n "href=\\\"/(dice|roulette|games|bets|account|invest|liquidity)" frontend/apps/web/src
```
