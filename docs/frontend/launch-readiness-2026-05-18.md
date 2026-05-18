# Frontend Launch Readiness Pass

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `docs/strategy/fullstack-product-architecture.md`, `docs/frontend/INDEX.md` |

## 1. Purpose

This pass decides whether the current frontend is ready for public B2C launch.
It is intentionally product-facing: a green build is necessary, but it is not
enough.

## 2. Launch Standard

A page is production-ready only when all applicable checks pass:

1. **Meaningful first screen**: the first viewport explains the route without a
   manual or hidden context.
2. **Primary action works**: the main action is visible, named clearly, and
   either executes or fails closed with actionable copy.
3. **Wallet states are clear**: disconnected, connected, wrong-chain, read-only,
   and pending transaction states do not look broken.
4. **Data states are honest**: loading, empty, stale, indexed, and fallback data
   are visually distinct and do not masquerade as final truth.
5. **Mobile is usable**: no horizontal clipping, overlapping controls, or
   unreachable primary action at mobile width.
6. **No runtime noise**: route renders without framework overlays or relevant
   console errors/warnings.
7. **Localized copy is complete**: English and Simplified Chinese keys exist for
   visible production copy.
8. **Chain proof remains available**: betting, LP, claims, affiliate, and ops
   surfaces expose the relevant on-chain or indexed proof instead of mock
   summaries.

## 3. Route Scorecard

| Route | Launch target | Current status | Notes |
| --- | --- | --- | --- |
| `/` | Marketing conversion | Pass with follow-up | Browser smoke passed. Fixed missing eight-game card copy and mobile horizontal overflow. Still needs final founder/legal copy review. |
| `/casino` | Game discovery | Pass with follow-up | Shows live game directory and filters without runtime errors. |
| `/casino/[slug]` | Primary casino play | Pass with follow-up | Dice and Sic Bo smoke passed at desktop and mobile widths. Opened-number receipt behavior still depends on live wallet canaries. |
| `/affiliate` | Growth acquisition | Pass with follow-up | Landing page renders and explains the loop. Connected-wallet link generation still needs a wallet canary. |
| `/portfolio/referral` | Affiliate dashboard | Pass with follow-up | Fixed disconnected wallet copy. Shows link, binding, XP buckets, and referred-bet empty/indexed states. |
| `/portfolio` | User account summary | Not sampled in this pass | Covered by existing tests, but still needs rendered wallet-state QA before public launch. |
| `/portfolio/activity` | Bet history | Not sampled in this pass | Covered by existing tests, but still needs rendered wallet-state QA before public launch. |
| `/portfolio/claims` | Claim execution | Not sampled in this pass | Covered by existing tests, but still needs rendered wallet-state QA before public launch. |
| `/earn` | LP funnel | Pass with follow-up | Renders honest bank-sync state while disconnected. Mainnet copy must be reviewed before accepting real LP deposits. |
| `/sportsbook` | Sports MVP entry | Pass with follow-up | Discloses read-only/MVP state clearly. Provider-enabled ticket flow remains canary-gated. |
| `/sportsbook/[marketId]` | Ticket detail | Not sampled in this pass | Needs a provider-backed market URL during sportsbook canary. |
| `/ops` | Internal operations | Pass with follow-up | Renders health surface without route errors. Health values depend on local/production worker wiring. |
| `/legal/*` | Legal disclosure | Pass with follow-up | Terms route renders; legal owner sign-off is still required before public launch. |

## 4. QA Evidence

Rendered smoke testing on `http://localhost:3003` covered:

- desktop routes: `/`, `/casino`, `/casino/dice`, `/casino/sic-bo`,
  `/affiliate`, `/portfolio/referral`, `/earn`, `/sportsbook`, `/ops`,
  `/legal/terms`;
- mobile viewport `390x844`: `/`, `/casino`, `/casino/dice`,
  `/portfolio/referral`, `/earn`, `/sportsbook`, `/ops`;
- runtime noise: no route-level console errors were observed in the sampled
  routes after the fixes;
- mobile overflow: `/` initially overflowed horizontally because missing
  marketing translations rendered raw key strings; after fixing the keys and
  applying root horizontal clipping, sampled routes had no horizontal overflow.

## 5. Fixes Applied In This Pass

- Added missing marketing room-card translations for Plinko, Slots, Baccarat,
  and Sic Bo in English and Simplified Chinese.
- Updated marketing copy from "four" rooms to "eight" rooms.
- Changed disconnected casino wallet balance from indefinite "Syncing..." to
  explicit "Not connected".
- Reset cached casino wallet balance when the wallet disconnects or asset
  metadata is unavailable.
- Changed referral dashboard disconnected state from "Connected wallet /
  Pending" to "Wallet / Not connected".
- Added global root horizontal clipping while preserving local horizontal
  scrolling for tables and audit surfaces.

## 6. Blocker Definition

Fix before launch when:

- a route has a blank, broken, or misleading first screen;
- a player cannot understand how to play or what happened after a bet;
- a user sees stale loading or "indexing" as if it were a final result;
- an API failure produces repeated noisy console errors;
- a mobile viewport hides the primary action or clips critical data;
- a production route still depends on prototype, mock, or compatibility copy.

## 7. Operating Rule

Do not add new product scope during this pass. Fix concrete launch blockers,
record non-blocking polish items, then move on.
