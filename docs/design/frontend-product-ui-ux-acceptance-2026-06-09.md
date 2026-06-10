# Frontend Product UI/UX Acceptance Baseline

| Owner   | Product + Frontend                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Active acceptance record                                                                                                                      |
| Date    | 2026-06-09                                                                                                                                    |
| Scope   | `/`, `/casino`, `/casino/[slug]`, `/earn`, `/affiliate`, `/casino/receipt/[chainId]/[betId]`, shared mobile shell                             |
| Purpose | Freeze what is accepted, what is coded but needs screenshot/device QA, and what remains open so the same UI issues are not re-audited ad hoc. |

This document is the acceptance checkpoint for the June 2026 frontend product
polish work. It does **not** replace the roadmap or specs; it records the
current implementation state against them.

## Source Documents

Use these sources in this order for frontend product/UX questions:

1. `frontend/CLAUDE.md` and active release artifacts for runtime and money-flow
   rules.
2. `docs/strategy/go-to-market.md` for the player / provider / affiliate
   narratives.
3. `docs/design/frontend-product-ui-ux-roadmap-2026-06-07.md` for phase order
   and acceptance gates.
4. `docs/design/frontend-product-ui-ux-audit-2026-06-07.md` for page-level
   intent and first-screen hierarchy.
5. `docs/design/mobile-shell-foundation-spec.md` for header, drawer, sheet,
   modal, and sticky CTA patterns.
6. `docs/design/earn-provider-console-spec.md` for `/earn` provenance and
   provider-console requirements.

If these documents conflict with a live place-bet, settlement, receipt, keeper,
env, or release-metadata invariant, the runtime invariant wins.

## Status Legend

| Status               | Meaning                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Accepted**         | Code is in place, automated checks passed, and there is screenshot or direct browser evidence for the current shape. |
| **Coded / needs QA** | Code is in place and automated checks passed, but the final screenshot/device matrix is incomplete.                  |
| **Open**             | Required by the roadmap/spec and not yet fully implemented or verified.                                              |
| **Deferred**         | Intentionally not required for this launch slice. Reopen only with a new product decision.                           |

## Current Evidence Snapshot

Current local code gates from the latest frontend acceptance pass:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

Result on 2026-06-11: typecheck clean, `477/477` web tests passing,
production build completed with existing optional wallet-dependency warnings,
and whitespace checks clean for tracked diffs and this document.

Current uncommitted frontend diff spans the accepted product-polish slice:
game-room UX/correctness, mobile shell and receipt-shell fixes, home/lobby/earn
marketing polish, affiliate proof, status/portfolio copy cleanup, and locale
updates. Treat it as one product acceptance batch unless later split by commit.

Current 390px game-room screenshot matrix artifacts are available in
`/tmp/agf-acceptance-2026-06-09/`:

```text
/tmp/agf-acceptance-2026-06-09/dice-390x844.png
/tmp/agf-acceptance-2026-06-09/plinko-390x844.png
/tmp/agf-acceptance-2026-06-09/slots-390x844.png
/tmp/agf-acceptance-2026-06-09/baccarat-390x844.png
/tmp/agf-acceptance-2026-06-09/sic-bo-390x844.png
/tmp/agf-acceptance-2026-06-09/roulette-390x844.png
/tmp/agf-acceptance-2026-06-09/coin-toss-390x844.png
/tmp/agf-acceptance-2026-06-09/keno-390x844.png
```

All eight screenshots were captured at 390x844. The DOM width check reported
`documentElement.scrollWidth=390` on every game room, so there is no page-level
horizontal overflow. Roulette intentionally keeps the betting table as an
internally scrollable wide table: the final 390px check recorded
`tableClientWidth=298`, `tableScrollWidth=524`, and
`tableHasInternalScroll=true`. That is accepted because compressing the full
roulette felt into one mobile viewport makes the cells harder to read.

## Acceptance Matrix

### A. Shared Mobile Shell

| Requirement                                                       | Source                     | Status               | Evidence / Notes                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact mobile header: logo, account/connect pill, menu button.   | Mobile shell spec §4.1     | **Accepted**         | 2026-06-10 preview pass: verified at 390px on `/`, `/casino`, `/casino/dice`, `/earn`, `/affiliate` — marketing, product, and game-rail variants all collapse to logo + connect + menu.                                                           |
| Drawer owns chain, language, wallet, and product nav controls.    | Mobile shell spec §0, §4.2 | **Accepted**         | 2026-06-10 preview pass: drawer opens with connect CTA, 8-game casino list, product/account/support nav, current chain, language (5 locales, in-place switch verified zh→en), refresh. Wallet-browser device pass still tracked separately in P2. |
| Sheet/popover breakpoint unified at `md`.                         | Mobile shell spec §5       | **Accepted**         | `SharePanel`, wallet, chain, and drawer work now use shared overlay anatomy.                                                                                                                                                                      |
| Share sheet: bottom sheet on mobile, anchored popover on desktop. | Roadmap Phase 4            | **Coded / needs QA** | Shared `SharePanel` is used by result, receipt, and affiliate surfaces. Desktop and mobile bug fixes landed, but final screenshots across all surfaces are still required.                                                                        |
| Sticky mobile bet CTA is the only primary mobile bet action path. | Roadmap Phase 1C           | **Accepted**         | Full panel no longer duplicates a second mobile place/connect CTA. Sticky action carries process state.                                                                                                                                           |
| Wallet-browser safe-area and toolbar pass.                        | Mobile shell spec §1.4     | **Open**             | Spec says mostly done, but still requires a real MetaMask/Coinbase/Trust device pass.                                                                                                                                                             |

### B. Home `/`

| Requirement                                                                                   | Source                                     | Status       | Evidence / Notes                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| First viewport sells the player promise: play on-chain, get paid to wallet, verify the round. | Audit §Home, Roadmap Phase 2A, GTM players | **Accepted** | Homepage hero has been reframed around player benefit, not protocol architecture.                                              |
| No hardcoded game-count claim.                                                                | Audit §Home                                | **Accepted** | Copy was changed away from fixed "8 games" language.                                                                           |
| Strong product visual instead of abstract protocol explanation.                               | Roadmap Phase 2A                           | **Accepted** | 2026-06-11 browser pass: flagship hero diorama verified at 1366, 1180, 1024, 430, and 390px with no horizontal overflow.       |
| Disconnected users see meaningful proof information.                                          | Audit §Home                                | **Accepted** | On-chain bankroll / total bet count / protocol-fee proof moved to chain-readable values rather than wallet-gated placeholders. |
| Marketing data cards avoid slash-composite multi-asset values.                                | Audit data-card rule                       | **Accepted** | Slash composite cards were removed from the marketing first-screen stats.                                                      |

### C. Casino Lobby `/casino`

| Requirement                                                                    | Source                                | Status       | Evidence / Notes                                                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Player can choose a game quickly; game tiles move up in mobile first viewport. | Audit §Casino Lobby, Roadmap Phase 2B | **Accepted** | F13 working-tree fix tightens the mobile hero rhythm; 390px browser check puts the first card at y≈328 while preserving the desktop card layout. |
| Category rail does not show a visible horizontal scrollbar.                    | Mobile shell + user acceptance        | **Accepted** | 2026-06-10 preview pass at 390px: rail scrolls horizontally with no visible scrollbar.                                                           |
| Game visuals are consistent with room/stage/OG primitives.                     | Roadmap Phase 2B                      | **Open**     | The current state is acceptable enough for launch polish, but a true shared game visual primitive is still a later consolidation task.           |
| No fake live-player / reserve-floor marketing numbers.                         | Audit data rule                       | **Accepted** | Lobby no longer relies on fabricated live/reserve figures.                                                                                       |

### D. Game Room `/casino/[slug]`

| Requirement                                                                                               | Source                      | Status                           | Evidence / Notes                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stage owns gameplay; bet panel owns money.                                                                | Audit §Game Room            | **Coded / needs QA**             | Stage selection has moved into stages; recent diff removes duplicate stage odds from Dice and simplifies Coin Toss.                                                                              |
| Mobile room chrome is compact; game name can be expressed by the active rail, not a large repeated title. | Roadmap Phase 3             | **Accepted**                     | 390px 8-room matrix captured in `/tmp/agf-acceptance-2026-06-09/`; active game rail plus compact stage area passes the current launch slice.                                                     |
| Max amount uses min(wallet balance, max bet).                                                             | Roadmap Phase 3             | **Accepted**                     | Bet panel and mobile action bar use `resolveBetMaxAmount`.                                                                                                                                       |
| Max bet and max payout are shown as limits, not as first-screen marketing cards.                          | Audit §Game Room            | **Accepted**                     | Limits now live in the compact bet-panel context on mobile; screenshots confirm they no longer consume the mobile room hero.                                                                     |
| Place-bet button carries user-facing flow status and does not show amount-reduction hints mid-flow.       | Recent UX decision          | **Accepted by manual wallet QA** | User reported wallet-connected Roulette multi-select, earn withdraw/redeem, and result-overlay share are working after the latest fixes.                                                         |
| Round status / VRF fee / bet id / request id remains visible.                                             | Recent UX decision          | **Accepted**                     | Stepper was removed, but round status and chain data remain in the bet panel.                                                                                                                    |
| Odds standard: win chance = event probability; displayed odds/payout = gross payout after house edge.     | Recent correctness decision | **Accepted**                     | Bet panel, Plinko bucket labels, Keno/Sic Bo/Baccarat stage labels, and result overlay paths apply house edge. Roulette multi-select and Plinko payout mismatch were fixed and covered by tests. |
| Result reveal timing: no winner/highlight before reveal animation completes.                              | Casino animation UX         | **Accepted**                     | Baccarat and Sic Bo reveal timing were adjusted; result labels/highlights are no longer shown before the reveal completes.                                                                       |
| Coin Toss selector does not overflow in long locales.                                                     | Recent mobile bug           | **Accepted**                     | Coin selection now toggles by clicking the coin; bottom choice tiles were removed.                                                                                                               |
| Dice stage does not duplicate odds/win chance already in the bet panel.                                   | Recent mobile bug           | **Accepted**                     | Dice stage no longer receives or renders `multiplier` / `winChance`.                                                                                                                             |
| Plinko risk header removed; bucket labels keep two decimals and remain readable.                          | Recent mobile bug           | **Accepted**                     | Screenshot `/tmp/agf-plinko-2dp-taller-buckets.png` confirms taller bucket tray with two-decimal labels.                                                                                         |
| Roulette multi-select does not revert.                                                                    | Runtime QA                  | **Accepted by manual wallet QA** | User reported wallet verification passed after fixes. Keep as accepted unless regression evidence appears.                                                                                       |
| Earn withdraw/redeem and result overlay share work in wallet-connected flows.                             | Runtime QA                  | **Accepted by manual wallet QA** | User reported wallet verification passed.                                                                                                                                                        |

### E. Receipt / Share / OG

| Requirement                                                                          | Source                            | Status               | Evidence / Notes                                                                                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical receipt route is `/casino/receipt/[chainId]/[betId]`.                      | Roadmap Phase 4                   | **Accepted**         | Old query-based route was removed/reworked.                                                                                                                 |
| Receipt and result modal share one receipt model.                                    | Roadmap Phase 4                   | **Accepted**         | `features/casino/receipt/view-model.ts` is the shared model.                                                                                                |
| Share links carry referral attribution.                                              | GTM affiliates, Roadmap Phase 4/6 | **Accepted**         | Share/referral helpers add `?ref=` where relevant.                                                                                                          |
| OG images do not show stale "not indexed" state for freshly shared settled receipts. | Receipt/OG acceptance             | **Accepted**         | Receipt OG now uses share preview hints/hydration path. Production spot checks were performed earlier; keep cache rules documented separately.              |
| Receipt page has minimal share-landing chrome, not game-room rail.                   | Audit §Receipt                    | **Accepted**         | 2026-06-11 shell fix: only exact `/casino/[gameSlug]` routes use the game-room rail; receipt routes stay in product chrome. Covered by `AppShell.test.tsx`. |
| Share panel works inside result modal and receipt page on mobile and desktop.        | Mobile shell + Roadmap Phase 4    | **Coded / needs QA** | Shared `SharePanel` is wired into both; desktop/mobile clipping bugs were fixed. Needs final cross-surface screenshot set.                                  |

### F. Earn `/earn`

| Requirement                                                                                                                         | Source                 | Status       | Evidence / Notes                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------------- |
| Provider console is not a loose card stack; reserve/risk live in tabs.                                                              | Earn spec, Audit §Earn | **Accepted** | Structure is a provider console with performance, diligence tabs, action panel, ledger. |
| Provenance labels are honest after V14: lifetime turnover/P&L/hold/velocity are chain-verifiable; daily trend/drawdown are indexed. | Earn spec §6           | **Accepted** | Disclosure, lifetime tag, chart-scoped toggle, drawdown, and empty state were updated.  |
| Drawdown is surfaced.                                                                                                               | Earn spec §2.3         | **Accepted** | Max drawdown is computed from indexed equity series and displayed when points exist.    |
| Empty/pre-launch state looks intentional.                                                                                           | Earn spec §2.4         | **Accepted** | Empty state now says no vault activity instead of broken-looking placeholder rows.      |
| Deposit/withdraw action reachability on mobile.                                                                                     | Earn spec §5 / §10     | **Accepted** | Shared sticky action bar is implemented for mobile deposit/withdraw access.             |
| Provider ledger is durable, not slow ad hoc log scan.                                                                               | Earn spec §1           | **Accepted** | Ledger is wired to durable provider ledger rather than direct UI log scanning.          |

### G. Affiliate `/affiliate`

| Requirement                                                                                            | Source                            | Status       | Evidence / Notes                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First viewport is affiliate-native: generate/share referral link, not "open dice" as the primary path. | Audit §Affiliate, Roadmap Phase 6 | **Accepted** | 2026-06-10 preview pass at 390px: full-width 生成推广链接 primary CTA in first viewport, dashed empty link state + connect CTA, no horizontal overflow. Copy jargon finding tracked as F7. |
| Long referral URLs never create horizontal overflow.                                                   | Roadmap Phase 6                   | **Accepted** | Recent mobile overflow fix addressed long `?ref=` links.                                                                                                                                   |
| Affiliate page uses reusable `SharePanel`, not copy-only link UX.                                      | Roadmap Phase 6                   | **Accepted** | `SharePanel` is imported by the affiliate page.                                                                                                                                            |
| Campaign assets and stronger earning proof presentation.                                               | Roadmap Phase 6                   | **Accepted** | 2026-06-11 browser pass: tracking-proof block added with connected/disconnected states, indexed ledger source, referred-bet count, and no 390px horizontal overflow.                       |

## Do Not Reopen Without Regression Evidence

These items have been checked enough for this baseline. Do not keep re-auditing
them unless screenshots, tests, or wallet behavior show a regression:

- Casino result/receipt route identity: `[chainId]/[betId]`.
- Receipt OG "not indexed" stale preview issue.
- Coin Toss bottom selector overflow.
- Dice duplicate stage odds/win-chance cards.
- Plinko one-decimal bucket labels.
- Round status removal misunderstanding: only the multi-step place-bet stepper
  was removed; chain round data remains.
- Max button should use min(wallet balance, max bet).
- Roulette multi-select wallet flow, earn withdraw/redeem, and result overlay
  share, because the latest manual wallet QA reported them working.

## Remaining Acceptance Work

### P0 — Before the next commit

1. Capture the final 8-game mobile screenshot matrix at 390px:
   - **Done** for Dice, Plinko, Slots, Baccarat, Sic Bo, Roulette, Coin Toss,
     and Keno.
   - All eight pages have no page-level horizontal overflow at 390px. Roulette
     deliberately uses internal table scrolling.
2. Web gate after the current uncommitted stage changes:

```bash
pnpm -C frontend/apps/web typecheck   # passed, 2026-06-10
pnpm -C frontend/apps/web test        # passed, 99 files / 476 tests
pnpm -C frontend/apps/web build       # passed
git diff --check                      # passed
```

3. Commit the current stage/room polish as one scoped commit if the screenshot
   matrix and remaining F2 decision are acceptable.

### P1 — Next product slice

1. Final production OG URL + Cloudflare cache rule verification after deploy.

### P2 — Later consolidation

1. Shared game visual primitive for lobby, receipt/share, OG, and game-card art.
2. Full wallet-browser device pass: MetaMask, Coinbase Wallet, Trust Wallet.
3. International SEO locale-path evaluation if international SEO becomes a
   launch goal. This is intentionally separate from the current cookie-based
   locale system.

## Screenshot Matrix Template

Use this table for future visual QA updates rather than starting a new audit
thread.

| Surface                | 390px                                                       | 430px                                                        | 1024px                                             | 1366px+                                             | Wallet browser | Status / notes                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/`               | `/tmp/agf-acceptance-2026-06-09/home-390x844.png`           | `/tmp/agf-acceptance-2026-06-09/home-430x932.png`            | `/tmp/agf-acceptance-2026-06-09/home-1024x768.png` | `/tmp/agf-acceptance-2026-06-09/home-1366x1024.png` | n/a            | Accepted: 2026-06-11 hero diorama pass covers 1366/1180/1024/430/390; all measured `overflowX=false`.                                                                       |
| Casino `/casino`       | 2026-06-10 preview pass                                     |                                                              |                                                    | 2026-06-10 preview pass                             | n/a            | Pass; rail has no visible scrollbar at 390. F13 adds compact mobile hero spacing and mobile badge parity for game rows; first card y≈328.                                   |
| Dice                   | `/tmp/agf-acceptance-2026-06-09/dice-390x844.png`           |                                                              |                                                    |                                                     |                | Accepted: no duplicate stage odds; sticky CTA visible.                                                                                                                      |
| Plinko                 | `/tmp/agf-acceptance-2026-06-09/plinko-390x844.png`         |                                                              |                                                    |                                                     |                | Accepted: no risk-profile header; two-decimal bucket labels remain readable.                                                                                                |
| Slots                  | `/tmp/agf-acceptance-2026-06-09/slots-390x844.png`          |                                                              |                                                    |                                                     |                | Accepted: centered stage and sticky CTA visible.                                                                                                                            |
| Baccarat               | `/tmp/agf-acceptance-2026-06-09/baccarat-390x844.png`       |                                                              |                                                    |                                                     |                | Accepted: stage fits the mobile shell without page overflow.                                                                                                                |
| Sic Bo                 | `/tmp/agf-acceptance-2026-06-09/sic-bo-390x844.png`         |                                                              |                                                    |                                                     |                | Accepted: content naturally continues below fold; no broken horizontal layout.                                                                                              |
| Roulette               | `/tmp/agf-acceptance-2026-06-09/roulette-390x844.png`       |                                                              |                                                    |                                                     |                | Accepted: betting table intentionally scrolls internally; page-level overflow is false.                                                                                     |
| Coin Toss              | `/tmp/agf-acceptance-2026-06-09/coin-toss-390x844.png`      |                                                              |                                                    |                                                     |                | Accepted: coin itself is the selector; bottom choice tiles removed.                                                                                                         |
| Keno                   | `/tmp/agf-acceptance-2026-06-09/keno-390x844.png`           |                                                              |                                                    |                                                     |                | Accepted: compact grid and sticky CTA visible.                                                                                                                              |
| Earn `/earn`           | 2026-06-10 preview pass                                     |                                                              |                                                    | 2026-06-10 preview pass                             |                | Working-tree copy pass clarifies selected-pool scope and mobile sticky action reachability. F12 remains polish.                                                             |
| Affiliate `/affiliate` | `/tmp/agf-acceptance-2026-06-09/affiliate-proof-mobile.png` | `/tmp/agf-acceptance-2026-06-09/affiliate-proof-desktop.png` |                                                    | 2026-06-11 browser pass                             |                | Layout pass both breakpoints; working-tree copy pass removes public-route protocol jargon; tracking-proof block verified with no 390px horizontal overflow.                 |
| Receipt collapsed      | 2026-06-10 recheck                                          |                                                              |                                                    |                                                     | n/a            | F1 invalidated: initial failure was caused by local Postgres being down during the pass. 2026-06-11 shell test confirms receipt routes no longer render the game-room rail. |
| Receipt proof expanded |                                                             |                                                              |                                                    |                                                     | n/a            | Still needs a final screenshot after the next receipt visual QA pass; browser automation was blocked by URL policy during this pass.                                        |
| Result modal + share   |                                                             |                                                              |                                                    |                                                     |                | Not exercised (requires wallet round).                                                                                                                                      |

---

## Addendum — 2026-06-10 Full Product Acceptance Pass (VI / UI / UX)

| Field          | Value                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method         | Live preview against `next dev`; initial receipt pass had local Postgres stopped, then receipt was rechecked after bet-index Postgres was started. Keeper health file present, disconnected wallet, Base Sepolia selected via in-app chain switcher |
| Viewports      | 1366×900 desktop, 390×844 mobile                                                                                                                                                                                                                    |
| Locales        | zh-Hans (primary pass), en (in-place switch verified on game room)                                                                                                                                                                                  |
| Routes covered | `/`, `/casino`, `/casino/dice` (+玩法说明 tab), `/earn` (+diligence tab), `/affiliate`, `/portfolio`, `/portfolio/activity`, `/status`, `/support`, `/casino/receipt/[chainId]/[betId]` (not-indexed path), 404                                     |
| Not exercised  | Wallet-connected flows (place bet, result modal, share), sportsbook, 430px, wallet browsers                                                                                                                                                         |

This pass closes most of the 2026-06-09 "Coded / needs QA" rows (statuses updated
in the matrices above) and records the findings below. Severity is product
acceptance severity, not security severity.

### Verified working (beyond the matrix flips)

- Disconnected chain switch (header menu, mainnet/testnet env tags) reloads the
  release and re-hydrates limits/VRF fee on the new chain.
- Game-room limits hydrate on Base Sepolia: desktop header `最大下注 73.9 USDC /
最高赔付 147.79 USDC`; mobile inline asset row `最大下注 80.26 / 池子赔付 160.51`.
- Mobile sticky action bar: amount + token logo + ½ / 2× / 最大 quick controls +
  full-width connect/bet CTA, all inside the thumb zone.
- 庄家优势 lives in 玩法说明 tab (2.00% for Dice) with bet-type coverage table.
- Multi-asset proof on home (USDC/WETH toggle, 链上可验证 tags); honest negative
  vault P&L on `/earn` (−30.56 USDC in red, lifetime tag).
- Language switcher: 5 locales, in-place re-render (zh→en verified, `lang`
  attribute updates).
- Localized 404 with recovery CTAs; localized error boundary with error ID and
  retry; `/support` FAQ fully localized including responsible-gaming entry.
- No page-level horizontal overflow on any covered route at 390px.

### Findings — Invalidated / environment note

**F1 — Invalidated: receipt page did not have a product crash.**
The initial receipt pass was run while the local bet-index Postgres process was
not running, so the page showed the error boundary from an environment setup
failure. After starting Postgres, the receipt page rendered normally. This is
not a launch-blocking product issue. Keep it as a local-dev runbook note only:
receipt QA must start the same durable index stack used by the page.

### Findings — P0 (launch blocking)

**F2 — Base mainnet shows 暂无额度 for max bet / max payout.**
On chain 8453 the game-room header limits never hydrate (VRF fee does, so RPC
works); on 84532 they hydrate correctly. Either the mainnet bank is unseeded
(honest-empty, but then mainnet visitors see a casino that cannot accept bets)
or the mainnet bank read fails. Must be resolved/verified before mainnet is the
default chain — pairs with contract-report AGF-04 (live `getSSOT` shape smoke).

### Findings — P1 (fix before public launch)

**F3 — Resolved in working tree: asset/pool scope labels are explicit.** Home
proof cards now label values as selected-asset bankroll/turnover/fees; `/earn`
uses Pool NAV and current-pool copy for the provider diligence surface. The
numbers can still differ legitimately, but the labels no longer imply one
global vault.

**F4 — Resolved in working tree: hardcoded house-edge claims removed from
marketing copy.** Dice OG no longer says "1% house edge", and support FAQ copy
no longer hardcodes roulette/dice example percentages. Remaining rule: do not
hardcode chain-configurable house-edge values in marketing copy; point users to
the live Game Info / release configuration instead.

**F5 — Resolved in working tree: public terminology converged.** The casino,
home, earn, portfolio, affiliate, and support locale keys now use one public
vocabulary for dice, max payout, bankroll/vault, capital velocity, bet/refund
language, and selected-asset/pool scope. Follow-up: keep future copy changes
against this glossary rather than creating one-off labels.

**F6 — Resolved in working tree: `/portfolio` copy moved away from ops-console
language.** The account surface now uses wallet/profile, current connection,
vault position, refund balance, and ready/browser language instead of registry,
execution-context, and mixed internal labels.

**F7 — Resolved in working tree: `/affiliate` copy is affiliate-plain.** Public
copy now explains sharing a room, attributing players, and claiming rewards
without B2C/MVP/GameHub/ref-hint/XP-bucket phrasing.

**F8 — Resolved in working tree: `/status` is localized.** The status page now
uses the shared locale system for metadata, headline, chain summaries, status
badges, card labels, and development diagnostics.

**F9 — Resolved in working tree: Earn mobile action reachability.** `/earn`
uses the shared mobile sticky action pattern for deposit/withdraw entry, so the
provider action is reachable without scrolling three screens to the console.

### Findings — P2 (polish)

- **F10 — Resolved in working tree: zh marketing/game-card copy pass.**
  Removed the machine-translated "最干净的房间入口 / 开奖保持在房间中心 /
  桌台房间 / 前端用于" phrasing and the support FAQ's untranslated "pending";
  the remaining sportsbook "票据" terminology is intentionally scoped to
  sportsbook tickets.
- **F11 — Resolved in working tree: Keno number adjacency.**
  The featured hero now says "match all for 500.5×" / "全中赔 500.5×",
  matching the lobby badge and detail copy instead of mixing 500× and 500.5×.
- **F12 — Resolved in working tree: `/earn` stat tile clipping + share price
  legibility.** The hero snapshot now uses a stable 2x2 metric grid and presents
  share value as "per 1k shares"; the precise one-share price remains in the
  verifiable reserve ledger.
- **F13 — Resolved in working tree: Lobby density/parity.** The mobile lobby
  hero spacing was tightened, game-row art was slightly reduced, and mobile
  rows now carry compact badges so the desktop "highest payout / play type"
  cue is not lost on phones.
- **F14 — Resolved in working tree: Home desktop dead band.** The global footer
  no longer injects a fixed `mt-16` gap after the final page section, so the
  homepage final CTA hands directly into the footer instead of showing an empty
  black band at 1366×900.

### Decisions requested

1. F2: confirm whether mainnet bank is intentionally unseeded pre-launch; if
   so, design the pre-launch mainnet empty state (现在的 暂无额度 looks broken
   rather than "not yet open").
