# Frontend Product UI/UX Audit

| Owner | Product + Frontend |
| --- | --- |
| Status | Draft |
| Date | 2026-06-07 |
| Scope | `/`, `/casino`, `/casino/[slug]`, `/earn`, `/affiliate`, `/casino/receipt/[chainId]/[betId]` |
| Evidence | Local screenshots in `/tmp/agf-page-audit-2026-06-07/` |

This audit changes the working mode for frontend work:

1. Decide the page role before editing components.
2. Translate GTM audience intent into first-screen hierarchy.
3. Use one mobile interaction system for header, drawers, share sheets, and sticky CTAs.
4. Verify with screenshots, not only typecheck/build.

## Current Product Readiness Judgment

The frontend is functional and much more consistent than earlier builds, but it
still reads too often like a protocol UI with casino styling. The gap is not
mostly engineering. The gap is page intent:

- Player pages must sell fast confidence and fast play.
- Provider pages must sell underwriting discipline and risk clarity.
- Affiliate pages must sell earning mechanics and distribution assets.
- Receipt/OG surfaces must act as shareable proof and acquisition material.

The top priority is not adding more components. It is reducing every page to the
one decision the target user is making.

## Shared Interaction System

These patterns should be standardized before further page polish.

### Mobile Header

**Goal.** Persistent brand, connect state, and menu access without stealing the
first viewport.

**Current issue.** The mobile header is visually heavy. The wallet CTA competes
with the page hero, and page-specific nav sometimes adds a second row of chrome
before the page content.

**Target pattern.**

- Top bar: logo, compact wallet/account pill, menu button.
- Product nav for game rooms: horizontal chip rail, but keep it short and
  low-height.
- Network and language controls live inside the drawer, not repeated as loose
  dropdowns.
- Wallet browser refresh is a manual icon inside the drawer/account area, not a
  reason to add more top-level chrome.

**Acceptance.**

- Mobile first viewport still shows the page's primary product content.
- Header never causes horizontal overflow.
- Menu, chain, language, and wallet controls share the same drawer/sheet
  geometry.

### Drawers, Modals, and Share Sheets

**Goal.** Use predictable mobile app patterns.

**Target pattern.**

- Share: bottom sheet on mobile, anchored popover only on desktop.
- Network: bottom sheet on mobile, not an oversized floating popover.
- Language: icon + label row inside drawer; flag glyphs may help scan, but
  should not become a decorative grid.
- Result receipt: full-screen modal overlay with internal scroll; action buttons
  remain visible.

**Acceptance.**

- Any open sheet fits within mobile viewport.
- Long content scrolls inside the sheet/card, not behind the action buttons.
- Esc/backdrop close on desktop; close button and safe-area spacing on mobile.

### Data Cards

**Goal.** One card, one decision.

**Rule.** Do not put multiple unrelated numeric claims in one large marketing
card. If two assets must be shown, show a compact row/list inside a dedicated
asset table or segmented asset view.

**Acceptance.**

- Landing page cards are not `USDC / WETH` slash composites.
- Provider dashboards use tables or tabs for multi-asset data.
- Marketing first screens never show empty, zero, or placeholder stats.

## Page Audits

### 1. Home `/`

**Target user.** First-time player who has not connected a wallet.

**Decision.** "Do I trust this enough to enter the casino?"

**Current first-screen evidence.**

- Mobile H1: `Verifiable casino on-chain.`
- The promise is correct, but abstract.
- First screen has no strong casino/game visual or payout moment.
- It explains the protocol before it makes the product feel desirable.

**Problem.** The page sells verifiability, but not the emotional product:
playing a game, winning, and being paid to the wallet.

**Target first screen.**

- Lead with a concrete player benefit: play on-chain, win to wallet, verify the
  round.
- Use one strong casino visual moment: game glyph montage, receipt win card, or
  live room preview.
- Keep proof points visible but secondary: VRF, non-custodial, on-chain payout.
- Primary CTA: `Start playing`.
- Secondary CTA: `How it works`.

**Information hierarchy.**

1. Product promise.
2. Visual proof of casino gameplay/receipt.
3. CTA.
4. Three proof points.
5. Recent wins or verifiable stats only when real.

**Concrete changes.**

- Replace abstract protocol hero with a player-oriented hero composition.
- Add one visual product artifact in first viewport: game/receipt preview.
- Move explanatory proof cards lower.
- Remove any hardcoded game count language.
- Use on-chain counters only when they support trust without looking like filler.

**Screenshot acceptance.**

- At 390px width, the first viewport shows H1, concise copy, CTA, and a product
  visual, not just text.
- A non-crypto player can explain the product from the first viewport.

### 2. Casino Lobby `/casino`

**Target user.** Player choosing what to play.

**Decision.** "Which game should I open now?"

**Current first-screen evidence.**

- Mobile H1: `Pick a game.`
- Filters and search consume a lot of first-screen height.
- The first game card is only partially visible.
- Game cards still carry protocol-ish labels such as house edge before play
  appeal.

**Problem.** The lobby is clean but too slow. It acts like a catalog page, not a
game picker.

**Target first screen.**

- Immediate room selection with visually distinct game tiles.
- Short filter rail; search can be secondary or collapsed.
- Game visuals should match in-room stage style and OG/share glyphs.
- Card emphasis: game type, volatility/multiplier, "Play" affordance.

**Information hierarchy.**

1. Game tiles.
2. Category rail.
3. Search/filter.
4. Trust/proof summary.

**Concrete changes.**

- Reduce lobby hero height.
- Bring game grid up into the first viewport.
- Use unified game visual primitives for lobby, OG, and share/receipt.
- Replace house-edge-first card badges with player-facing attributes.

**Screenshot acceptance.**

- At 390px width, at least one full game card and part of a second card are
  visible without scrolling.
- Tile art is visually consistent across games.

### 3. Game Room `/casino/[slug]`

**Target user.** Player ready to configure a bet and place it.

**Decision.** "Do I understand this game and can I safely place the bet?"

**Current first-screen evidence.**

- Mobile Keno shows header, horizontal game rail, large page title, two metric
  cards, then the stage.
- Sticky bottom bet CTA is useful.
- `Max bet` and `Max payout` now use state copy rather than `—` / `0 USDC`,
  which is better, but the two cards still take first-screen space.

**Problem.** The room still over-prioritizes room chrome. The game stage should
own the screen; the bet panel should own money and transaction state.

**Target first screen.**

- Stage first, with game-specific selection directly in the stage.
- Compact room header: game name + asset + chain state, not large stats.
- Bet controls stay in sticky bottom/mobile sheet.
- Risk/limit details are available but not first-screen dominant.

**Information hierarchy.**

1. Game stage and selection state.
2. Bet amount + asset + place CTA.
3. Round state.
4. Limits/risk/proof as secondary drawers.

**Concrete changes.**

- Collapse large room title metrics on mobile into a compact stage header or
  "Limits" drawer.
- Keep horizontal game rail, but reduce height and avoid duplicating casino
  navigation.
- Move max bet/max payout into bet panel or an info drawer unless they are
  directly actionable.
- Standardize all result/share flows through full-screen modal + mobile share
  sheet.

**Screenshot acceptance.**

- At 390px width, the stage is visible in the first viewport without the user
  scrolling past large metadata.
- Sticky CTA is visible and never blocks required stage controls.
- No game room route shows placeholder metrics as product facts.

### 4. Earn `/earn`

**Target user.** Bankroll provider / DeFi capital allocator.

**Decision.** "Is this vault worth underwriting, and what risk am I taking?"

**Current first-screen evidence.**

- Mobile H1: `Be the house in USDC.`
- The concept is correct.
- First screen reads like an explainer.
- Share price appears, but below lengthy copy and framed as a static bank card.

**Problem.** The page explains underwriting but does not yet feel like a
provider-grade due diligence dashboard.

**Target first screen.**

- Calm, investor-grade dashboard.
- Above fold: share price, total reserve, turnover velocity, drawdown/risk
  status.
- Clear distinction: on-chain verifiable vs indexed estimate.
- Primary CTA: deposit/withdraw or connect to inspect position.

**Information hierarchy.**

1. Provider thesis in one sentence.
2. Core metrics row: share price, reserve, turnover velocity, drawdown/risk.
3. Action panel.
4. Performance chart.
5. Ledger/proof/risk tabs.

**Concrete changes.**

- Reduce hero title height.
- Replace explanatory paragraphs with a compact thesis + metric dashboard.
- Move reserve ledger and risk checks into tabs, as already discussed.
- Use share price and total shares as first-class, not buried details.
- Present deposit/withdraw as a professional two-tab control with asset/share
  modes and toast-based transaction feedback.

**Screenshot acceptance.**

- At 390px width, first viewport shows the investment decision metrics, not only
  copy.
- No more loose card stack. Dashboard sections should feel like one console.

### 5. Affiliate `/affiliate`

**Target user.** KOL, streamer, affiliate operator.

**Decision.** "Can I make money by sending traffic here, and can I track it?"

**Current first-screen evidence.**

- H1: `Share the casino. Keep the proof on-chain.`
- Strong trust idea.
- Primary CTA is `Open Dice`, which is wrong for the affiliate user.
- Copy mentions first-touch and XP buckets, but not earning mechanics first.

**Problem.** The page uses affiliate words but still routes the user as a
player.

**Target first screen.**

- Primary CTA: `Generate referral link` or `Open referral console`.
- Secondary CTA: `Preview player experience`.
- Show what affiliates earn, how tracking works, and payout visibility.
- Provide share assets and link copy earlier.

**Information hierarchy.**

1. Earning promise.
2. Referral link generator / connect wallet.
3. Tracking proof.
4. Commission mechanics.
5. Campaign assets.

**Concrete changes.**

- Replace `Open Dice` as primary CTA.
- Move referral link module above player-game CTA.
- Add "how you get paid" summary before technical proof.
- Make share assets/OG preview part of the page.

**Screenshot acceptance.**

- First viewport contains a clear affiliate action, not a casino play action.
- A traffic partner can understand how to start without reading protocol copy.

### 6. Receipt / Share / OG

**Target user.** External viewer from Telegram/X/WhatsApp or player sharing a
result.

**Decision.** "Is this result real, and do I want to play?"

**Current first-screen evidence.**

- Receipt card is visually coherent and focused.
- Result, stake, payout, net, and chain/index metadata are readable.
- It still inherits casino room navigation chrome.

**Problem.** The receipt should be a share landing surface, not an app-internal
game room view.

**Target first screen.**

- Receipt card centered.
- Minimal top chrome: logo + optional CTA.
- No horizontal game room nav.
- Share action uses mobile bottom sheet.
- OG image uses the same visual hierarchy as receipt.

**Information hierarchy.**

1. Result amount and status.
2. Game and bet id.
3. Stake/payout/net.
4. Proof details collapsed.
5. CTA: play this game / share / view transaction.

**Concrete changes.**

- Remove game-room chip nav from receipt route.
- Keep receipt as standalone share artifact.
- Ensure share URL path is canonical: `/casino/receipt/{chainId}/{betId}`.
- Use one shared visual primitive for receipt page, result modal, and OG card.

**Screenshot acceptance.**

- A shared receipt at 390px width looks intentional without app nav clutter.
- Open share panel never clips or covers primary receipt actions.

## Priority Roadmap

### P0 — Stop Leaking Product Quality

1. Remove receipt route game-room nav.
2. Standardize mobile share sheet and network/language sheets.
3. Make affiliate first CTA affiliate-native, not player-native.
4. Reduce game-room mobile chrome so the stage owns the first viewport.
5. Keep empty/zero stats out of marketing first screens.

### P1 — Reframe First Viewports Around GTM

1. Home: add a real product visual and player benefit first.
2. Casino lobby: make game selection immediate.
3. Earn: convert explainer into provider dashboard.
4. Affiliate: surface referral link and earning mechanics.

### P2 — Visual System Consolidation

1. Shared game visual primitive for lobby, OG, receipt, and share cards.
2. Shared data-card rules for marketing vs dashboards.
3. Shared modal/drawer anatomy.
4. Mobile header variant matrix: marketing, product, game room, receipt.

## Work Sequence Recommendation

Do not start with a full-site redesign. Start with one vertical slice that proves
the new method:

1. **Receipt/share slice** — contained, high visibility, low business risk.
2. **Mobile header/drawer/share system** — reused everywhere.
3. **Game room mobile first viewport** — most important conversion surface.
4. **Home first viewport** — acquisition surface.
5. **Earn provider dashboard** — hard-side GTM surface.
6. **Affiliate growth page** — distribution surface.

Each slice must include:

- desktop screenshot,
- mobile screenshot,
- wallet-browser/mobile safe-area check when relevant,
- no horizontal overflow,
- primary CTA visible,
- no placeholder stats,
- no clipped drawer/modal/share sheet.

## Evidence Captured

Screenshots were captured from `http://localhost:3002`:

- `/tmp/agf-page-audit-2026-06-07/mobile-home.png`
- `/tmp/agf-page-audit-2026-06-07/mobile-casino.png`
- `/tmp/agf-page-audit-2026-06-07/mobile-game-keno.png`
- `/tmp/agf-page-audit-2026-06-07/mobile-earn.png`
- `/tmp/agf-page-audit-2026-06-07/mobile-affiliate.png`
- `/tmp/agf-page-audit-2026-06-07/mobile-receipt.png`
- matching desktop captures in the same folder.

All sampled routes returned `200` and had no horizontal overflow at `390px`.
That is necessary, but not sufficient. The main issues are hierarchy, page role,
and conversion intent.
