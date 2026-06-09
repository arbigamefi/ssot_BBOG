# Frontend Product UI/UX Acceptance Baseline

| Owner | Product + Frontend |
| --- | --- |
| Status | Active acceptance record |
| Date | 2026-06-09 |
| Scope | `/`, `/casino`, `/casino/[slug]`, `/earn`, `/affiliate`, `/casino/receipt/[chainId]/[betId]`, shared mobile shell |
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

| Status | Meaning |
| --- | --- |
| **Accepted** | Code is in place, automated checks passed, and there is screenshot or direct browser evidence for the current shape. |
| **Coded / needs QA** | Code is in place and automated checks passed, but the final screenshot/device matrix is incomplete. |
| **Open** | Required by the roadmap/spec and not yet fully implemented or verified. |
| **Deferred** | Intentionally not required for this launch slice. Reopen only with a new product decision. |

## Current Evidence Snapshot

Current local code gates from the latest casino-stage pass:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

Result on 2026-06-09: typecheck clean, `464/464` web tests passing,
production build completed with existing optional wallet-dependency warnings,
and whitespace checks clean for tracked diffs and this document.

Current uncommitted frontend diff is limited to the game-room stage polish:

```text
frontend/apps/web/src/app/(product)/casino/[slug]/pageClient.tsx
frontend/apps/web/src/features/casino/modules/coin-toss/stage.tsx
frontend/apps/web/src/features/casino/modules/dice/stage.tsx
frontend/apps/web/src/features/casino/modules/plinko/stage.tsx
frontend/apps/web/src/features/casino/modules/stages.test.tsx
frontend/apps/web/src/features/casino/room/right-pane.tsx
```

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

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| Compact mobile header: logo, account/connect pill, menu button. | Mobile shell spec §4.1 | **Coded / needs QA** | Implemented in `AppHeader`. Needs one final route matrix because product and game pages use different nav rails. |
| Drawer owns chain, language, wallet, and product nav controls. | Mobile shell spec §0, §4.2 | **Coded / needs QA** | Shared drawer/sheet primitives exist. Recent screenshots showed improvements, but wallet-browser device pass remains. |
| Sheet/popover breakpoint unified at `md`. | Mobile shell spec §5 | **Accepted** | `SharePanel`, wallet, chain, and drawer work now use shared overlay anatomy. |
| Share sheet: bottom sheet on mobile, anchored popover on desktop. | Roadmap Phase 4 | **Coded / needs QA** | Shared `SharePanel` is used by result, receipt, and affiliate surfaces. Desktop and mobile bug fixes landed, but final screenshots across all surfaces are still required. |
| Sticky mobile bet CTA is the only primary mobile bet action path. | Roadmap Phase 1C | **Accepted** | Full panel no longer duplicates a second mobile place/connect CTA. Sticky action carries process state. |
| Wallet-browser safe-area and toolbar pass. | Mobile shell spec §1.4 | **Open** | Spec says mostly done, but still requires a real MetaMask/Coinbase/Trust device pass. |

### B. Home `/`

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| First viewport sells the player promise: play on-chain, get paid to wallet, verify the round. | Audit §Home, Roadmap Phase 2A, GTM players | **Accepted** | Homepage hero has been reframed around player benefit, not protocol architecture. |
| No hardcoded game-count claim. | Audit §Home | **Accepted** | Copy was changed away from fixed "8 games" language. |
| Strong product visual instead of abstract protocol explanation. | Roadmap Phase 2A | **Coded / needs QA** | Flagship hero diorama uses roulette + public receipt scene. Needs final desktop/mobile screenshot record after latest spacing edits. |
| Disconnected users see meaningful proof information. | Audit §Home | **Accepted** | On-chain bankroll / total bet count / protocol-fee proof moved to chain-readable values rather than wallet-gated placeholders. |
| Marketing data cards avoid slash-composite multi-asset values. | Audit data-card rule | **Accepted** | Slash composite cards were removed from the marketing first-screen stats. |

### C. Casino Lobby `/casino`

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| Player can choose a game quickly; game tiles move up in mobile first viewport. | Audit §Casino Lobby, Roadmap Phase 2B | **Coded / needs QA** | Layout has been compressed and recent card overlap fixes landed. Needs final 390px and 430px screenshots. |
| Category rail does not show a visible horizontal scrollbar. | Mobile shell + user acceptance | **Coded / needs QA** | Recent CSS/layout changes targeted this. Must be checked on 390px. |
| Game visuals are consistent with room/stage/OG primitives. | Roadmap Phase 2B | **Open** | The current state is acceptable enough for launch polish, but a true shared game visual primitive is still a later consolidation task. |
| No fake live-player / reserve-floor marketing numbers. | Audit data rule | **Accepted** | Lobby no longer relies on fabricated live/reserve figures. |

### D. Game Room `/casino/[slug]`

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| Stage owns gameplay; bet panel owns money. | Audit §Game Room | **Coded / needs QA** | Stage selection has moved into stages; recent diff removes duplicate stage odds from Dice and simplifies Coin Toss. |
| Mobile room chrome is compact; game name can be expressed by the active rail, not a large repeated title. | Roadmap Phase 3 | **Accepted** | 390px 8-room matrix captured in `/tmp/agf-acceptance-2026-06-09/`; active game rail plus compact stage area passes the current launch slice. |
| Max amount uses min(wallet balance, max bet). | Roadmap Phase 3 | **Accepted** | Bet panel and mobile action bar use `resolveBetMaxAmount`. |
| Max bet and max payout are shown as limits, not as first-screen marketing cards. | Audit §Game Room | **Accepted** | Limits now live in the compact bet-panel context on mobile; screenshots confirm they no longer consume the mobile room hero. |
| Place-bet button carries user-facing flow status and does not show amount-reduction hints mid-flow. | Recent UX decision | **Accepted by manual wallet QA** | User reported wallet-connected Roulette multi-select, earn withdraw/redeem, and result-overlay share are working after the latest fixes. |
| Round status / VRF fee / bet id / request id remains visible. | Recent UX decision | **Accepted** | Stepper was removed, but round status and chain data remain in the bet panel. |
| Odds standard: win chance = event probability; displayed odds/payout = gross payout after house edge. | Recent correctness decision | **Accepted** | Bet panel, Plinko bucket labels, Keno/Sic Bo/Baccarat stage labels, and result overlay paths apply house edge. Roulette multi-select and Plinko payout mismatch were fixed and covered by tests. |
| Result reveal timing: no winner/highlight before reveal animation completes. | Casino animation UX | **Accepted** | Baccarat and Sic Bo reveal timing were adjusted; result labels/highlights are no longer shown before the reveal completes. |
| Coin Toss selector does not overflow in long locales. | Recent mobile bug | **Accepted** | Coin selection now toggles by clicking the coin; bottom choice tiles were removed. |
| Dice stage does not duplicate odds/win chance already in the bet panel. | Recent mobile bug | **Accepted** | Dice stage no longer receives or renders `multiplier` / `winChance`. |
| Plinko risk header removed; bucket labels keep two decimals and remain readable. | Recent mobile bug | **Accepted** | Screenshot `/tmp/agf-plinko-2dp-taller-buckets.png` confirms taller bucket tray with two-decimal labels. |
| Roulette multi-select does not revert. | Runtime QA | **Accepted by manual wallet QA** | User reported wallet verification passed after fixes. Keep as accepted unless regression evidence appears. |
| Earn withdraw/redeem and result overlay share work in wallet-connected flows. | Runtime QA | **Accepted by manual wallet QA** | User reported wallet verification passed. |

### E. Receipt / Share / OG

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| Canonical receipt route is `/casino/receipt/[chainId]/[betId]`. | Roadmap Phase 4 | **Accepted** | Old query-based route was removed/reworked. |
| Receipt and result modal share one receipt model. | Roadmap Phase 4 | **Accepted** | `features/casino/receipt/view-model.ts` is the shared model. |
| Share links carry referral attribution. | GTM affiliates, Roadmap Phase 4/6 | **Accepted** | Share/referral helpers add `?ref=` where relevant. |
| OG images do not show stale "not indexed" state for freshly shared settled receipts. | Receipt/OG acceptance | **Accepted** | Receipt OG now uses share preview hints/hydration path. Production spot checks were performed earlier; keep cache rules documented separately. |
| Receipt page has minimal share-landing chrome, not game-room rail. | Audit §Receipt | **Coded / needs QA** | Current route is standalone, but final 390px proof-expanded screenshot should be captured. |
| Share panel works inside result modal and receipt page on mobile and desktop. | Mobile shell + Roadmap Phase 4 | **Coded / needs QA** | Shared `SharePanel` is wired into both; desktop/mobile clipping bugs were fixed. Needs final cross-surface screenshot set. |

### F. Earn `/earn`

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| Provider console is not a loose card stack; reserve/risk live in tabs. | Earn spec, Audit §Earn | **Accepted** | Structure is a provider console with performance, diligence tabs, action panel, ledger. |
| Provenance labels are honest after V14: lifetime turnover/P&L/hold/velocity are chain-verifiable; daily trend/drawdown are indexed. | Earn spec §6 | **Accepted** | Disclosure, lifetime tag, chart-scoped toggle, drawdown, and empty state were updated. |
| Drawdown is surfaced. | Earn spec §2.3 | **Accepted** | Max drawdown is computed from indexed equity series and displayed when points exist. |
| Empty/pre-launch state looks intentional. | Earn spec §2.4 | **Accepted** | Empty state now says no vault activity instead of broken-looking placeholder rows. |
| Deposit/withdraw action reachability on mobile. | Earn spec §5 / §10 | **Open** | The unresolved A/B choice remains: shared sticky action bar vs hero anchor to the console. |
| Provider ledger is durable, not slow ad hoc log scan. | Earn spec §1 | **Accepted** | Ledger is wired to durable provider ledger rather than direct UI log scanning. |

### G. Affiliate `/affiliate`

| Requirement | Source | Status | Evidence / Notes |
| --- | --- | --- | --- |
| First viewport is affiliate-native: generate/share referral link, not "open dice" as the primary path. | Audit §Affiliate, Roadmap Phase 6 | **Coded / needs QA** | CTA and link generation have moved forward. Needs final mobile screenshot after long-ref overflow fixes. |
| Long referral URLs never create horizontal overflow. | Roadmap Phase 6 | **Accepted** | Recent mobile overflow fix addressed long `?ref=` links. |
| Affiliate page uses reusable `SharePanel`, not copy-only link UX. | Roadmap Phase 6 | **Accepted** | `SharePanel` is imported by the affiliate page. |
| Campaign assets and stronger earning proof presentation. | Roadmap Phase 6 | **Open** | Still listed as remaining work in the roadmap. |

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
2. Run the web gate again after the current uncommitted stage changes:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

3. Commit the current stage/room polish as one scoped commit if the screenshot
   matrix is acceptable.

### P1 — Next product slice

1. `/earn` mobile action reachability decision:
   - Option A: shared `StickyActionBar` for `Deposit / Withdraw`.
   - Option B: hero anchor button that scrolls/focuses the action console.
2. Affiliate campaign assets and stronger earning proof block.
3. Final production OG URL + Cloudflare cache rule verification after deploy.

### P2 — Later consolidation

1. Shared game visual primitive for lobby, receipt/share, OG, and game-card art.
2. Full wallet-browser device pass: MetaMask, Coinbase Wallet, Trust Wallet.
3. International SEO locale-path evaluation if international SEO becomes a
   launch goal. This is intentionally separate from the current cookie-based
   locale system.

## Screenshot Matrix Template

Use this table for future visual QA updates rather than starting a new audit
thread.

| Surface | 390px | 430px | 1024px | 1366px+ | Wallet browser | Status / notes |
| --- | --- | --- | --- | --- | --- | --- |
| Home `/` |  |  |  |  | n/a |  |
| Casino `/casino` |  |  |  |  | n/a |  |
| Dice | `/tmp/agf-acceptance-2026-06-09/dice-390x844.png` |  |  |  |  | Accepted: no duplicate stage odds; sticky CTA visible. |
| Plinko | `/tmp/agf-acceptance-2026-06-09/plinko-390x844.png` |  |  |  |  | Accepted: no risk-profile header; two-decimal bucket labels remain readable. |
| Slots | `/tmp/agf-acceptance-2026-06-09/slots-390x844.png` |  |  |  |  | Accepted: centered stage and sticky CTA visible. |
| Baccarat | `/tmp/agf-acceptance-2026-06-09/baccarat-390x844.png` |  |  |  |  | Accepted: stage fits the mobile shell without page overflow. |
| Sic Bo | `/tmp/agf-acceptance-2026-06-09/sic-bo-390x844.png` |  |  |  |  | Accepted: content naturally continues below fold; no broken horizontal layout. |
| Roulette | `/tmp/agf-acceptance-2026-06-09/roulette-390x844.png` |  |  |  |  | Accepted: betting table intentionally scrolls internally; page-level overflow is false. |
| Coin Toss | `/tmp/agf-acceptance-2026-06-09/coin-toss-390x844.png` |  |  |  |  | Accepted: coin itself is the selector; bottom choice tiles removed. |
| Keno | `/tmp/agf-acceptance-2026-06-09/keno-390x844.png` |  |  |  |  | Accepted: compact grid and sticky CTA visible. |
| Earn `/earn` |  |  |  |  |  |  |
| Affiliate `/affiliate` |  |  |  |  |  |  |
| Receipt collapsed |  |  |  |  | n/a |  |
| Receipt proof expanded |  |  |  |  | n/a |  |
| Result modal + share |  |  |  |  |  |  |
