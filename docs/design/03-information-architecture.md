# 03 · Information Architecture

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `02-voice-and-copy.md`, `../strategy/fullstack-product-architecture.md`, `../architecture/overview.md` |
| Supersedes | Draft v1 IA matrix |

The IA supports a B2C casino product on a protocol-grade settlement
kernel. It should make the primary betting loop obvious while keeping proof,
portfolio, liquidity, and ops surfaces accessible. Names follow the terms in
[`02-voice-and-copy.md`](./02-voice-and-copy.md) §2.

## 1. Primary Users

| User               | Goal                                                        | Primary routes                            |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------- |
| Player             | Place bets, see results, verify history                     | `/`, `/casino/*`, `/portfolio`            |
| Liquidity provider | Understand the house pool, deposit and withdraw, watch risk | `/liquidity`, `/portfolio`, `/status`     |
| Referrer           | Understand attribution and claimable rewards                | `/rewards`, `/portfolio/claims`           |
| Operator           | Monitor release, keeper, index, risk                        | `/ops`                                    |
| Auditor            | Verify release, addresses, proofs, history                  | `/`, `/status`, `/casino/receipt/*`, docs |

## 2. Routes

```text
/
/casino
/casino/[slug]
/casino/receipt/[chainId]/[betId]
/liquidity
/rewards
/portfolio
/portfolio/activity
/portfolio/activity/[betId]
/portfolio/claims
/status
/support
/ops
/legal/privacy
/legal/terms
/legal/disclaimer
```

Two routes are renamed when their pages move to Carbon copy, with no redirect from the old
path (the site is pre-launch):

| Today                               | Becomes      | Page                        |
| ----------------------------------- | ------------ | --------------------------- |
| `/earn`                             | `/liquidity` | The liquidity page          |
| `/affiliate`, `/portfolio/referral` | `/rewards`   | Referral and rebate rewards |

## 3. Primary Journeys

### Player

```text
/ -> /casino -> /casino/[slug]
  -> connect wallet
  -> approve if needed
  -> place bet
  -> wait for randomness
  -> keeper settles
  -> receipt on the slip
  -> /casino/receipt/[chainId]/[betId]
```

### Liquidity provider

```text
/liquidity -> deposit or withdraw -> /portfolio -> /status for deeper proof
```

## 4. Navigation

One navigation bar on every page, marketing and product alike:

```text
[Logo]  Casino  Liquidity  Rewards  Help        [Language] [Connect]
```

After connecting, the wallet button opens a menu with Portfolio, Bets, Claims and Disconnect.
Those are the player's own things, not top-level sections.

The footer groups links by reader: Play (Casino), Liquidity (Liquidity, Status),
Help (Support, Terms, Privacy, Disclaimer), and the official channels. Ops is linked from the
footer only.

## 5. State Rules

Every product page should account for:

- disconnected wallet;
- wrong chain;
- loading data;
- empty history;
- degraded index/API fallback;
- the site state: preview, testnet or live (`02-voice-and-copy.md` §8);
- disabled or unavailable chain feature;
- final success or failure.

Do not show raw provider errors. Map failures to product copy and a next action.

## 6. Cross-Page Patterns

- Release proof should be accessible from product chrome.
- Wallet gate should explain the action it unlocks.
- Activity links lead to the bet's receipt.
- Ops should link to runbooks or docs for non-obvious states.

## 7. Verification

```bash
pnpm -C frontend precheck:frontend -- --strict
test ! -d frontend/apps/web/src/app/prototype
rg -n "href=\\\"/(dice|roulette|games|bets|account|invest|pools|bankroll)" frontend/apps/web/src
```
