# Frontend Product UI/UX Roadmap

| Owner      | Product + Frontend                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | Active                                                                                                                                                                                                                                                              |
| Date       | 2026-06-07                                                                                                                                                                                                                                                          |
| Depends on | `docs/design/frontend-product-ui-ux-audit-2026-06-07.md`, `docs/design/mobile-shell-foundation-spec.md`, `docs/design/frontend-implementation-roadmap.md`, `docs/strategy/fullstack-product-architecture.md`, `docs/strategy/go-to-market.md`, `frontend/CLAUDE.md` |
| Scope      | Player, provider, affiliate, receipt/share, and mobile shell UX. This is not a contract roadmap.                                                                                                                                                                    |

This roadmap turns the product UI/UX audit into an execution plan. It does not
replace `docs/design/frontend-implementation-roadmap.md`: runtime correctness,
i18n, security, release hygiene, keeper behavior, and durable index boundaries
still win whenever they conflict with page polish.

The purpose is to stop patching frontend symptoms and move in deliberate slices:
each slice names the user, the page decision, the visual thesis, the interaction
pattern, the files likely touched, and the screenshot gate.

## 1. Operating Contract

### 1.1 Sources of truth

Use this precedence for frontend product work:

1. `frontend/CLAUDE.md` and active release/contract artifacts for hard runtime
   rules.
2. `docs/strategy/fullstack-product-architecture.md` for the product boundary:
   protocol-grade contracts, lean B2C product, optional future infrastructure.
3. `docs/strategy/go-to-market.md` for the three audience narratives:
   players, bankroll providers, affiliates.
4. `docs/design/frontend-product-ui-ux-audit-2026-06-07.md` for page-level
   intent and acceptance criteria.
5. `docs/design/mobile-shell-foundation-spec.md` for the first interaction
   foundation slice.

### 1.2 Product principles

- **Runtime truth first.** Never trade off result receipts, keeper settlement,
  SDK encoding, or release metadata for visual polish.
- **One page, one decision.** Each page must make one target user's next action
  obvious.
- **Do not fake data.** Chain-read values may say verifiable; index-derived
  values say indexed or may lag; missing values are not replaced with decorative
  placeholders.
- **Mobile is a product surface, not a shrink wrap.** Header, drawer, share
  sheet, result modal, and sticky bet CTA must behave like one mobile app.
- **No generic card mosaics.** Cards are for repeated items, receipts, modals,
  and genuine tools. Landing pages and dashboards use layout, hierarchy, tabs,
  tables, and media before adding more cards.
- **Screenshot verification is mandatory.** Typecheck/build passing is not
  enough for visual work.

## 2. Product Theses

### 2.1 Visual thesis

ArbiGameFi should feel like a restrained on-chain casino: dark, focused, high
contrast, and evidence-led, with game visuals used as product artifacts rather
than decoration. The emotional moment is simple: play, reveal, get paid, prove
it.

### 2.2 Content plan

1. **Players:** concrete casino promise first: play on-chain, win to wallet,
   verify the round.
2. **Providers:** underwriting dashboard first: share price, reserve, turnover
   velocity, drawdown, and risk limits.
3. **Affiliates:** earning mechanics first: link, tracking, commission, payout
   proof.
4. **Receipts/share:** proof and acquisition first: result, amount, game,
   one-tap share, one-tap play.

### 2.3 Interaction thesis

1. Mobile uses one drawer/sheet/modal language with safe-area handling.
2. Game rooms give the stage the screen; betting money controls live in one
   thumb-zone control path.
3. Share surfaces are reusable acquisition tools, not small desktop popovers
   stretched onto phones.

## 3. Roadmap Overview

| Phase | Slice                        | Audience           | Goal                                                     | Status                             |
| ----- | ---------------------------- | ------------------ | -------------------------------------------------------- | ---------------------------------- |
| 0     | Planning + spec alignment    | Team               | Make the roadmap and shell spec current                  | Current                            |
| 1     | Mobile shell foundation      | All                | One header/drawer/sheet/modal/sticky CTA system          | Mostly implemented                 |
| 2     | Player first screen          | Players            | Homepage and casino lobby sell trust + play quickly      | Implemented with local screenshots |
| 3     | Game room conversion         | Players            | Stage-first gameplay and one mobile bet path             | Partially implemented              |
| 4     | Receipt/share/OG acquisition | Players + viewers  | One receipt model, shareable proof, referral-aware links | Mostly implemented                 |
| 5     | Earn provider console        | Bankroll providers | Professional underwriting dashboard, not card clutter    | Partially implemented              |
| 6     | Affiliate growth console     | Affiliates         | Link generation, earning mechanics, campaign assets      | Partially implemented              |
| 7     | Launch hardening             | All                | i18n, a11y, performance, wallet-browser screenshots      | Ongoing                            |

## 4. Phase 0 — Planning + Spec Alignment

**Objective.** Make the planning documents reflect what has already shipped and
what remains. This prevents the team from executing stale "draft/no code yet"
guidance.

**Tasks.**

- Update `mobile-shell-foundation-spec.md` from draft/no-code to partially
  implemented.
- Record which mobile shell pieces are done and which are still outstanding.
- Keep this roadmap separate from old runtime closeout work, but link it to the
  active frontend roadmap.

**Acceptance.**

- Docs state the current implementation status without overstating completion.
- The next code slice is named and verifiable.

## 5. Phase 1 — Mobile Shell Foundation

**Target user.** Any mobile visitor, especially wallet-browser users.

**Decision.** "Can I navigate, connect, switch network/language, share, and place
a bet without fighting the UI?"

**Visual thesis.** Mobile chrome is quiet. The header is compact; overlays feel
like one app; bottom actions respect thumb zones and wallet browser toolbars.

**Implementation slices.**

### 1A. Current partial work to preserve

- Compact mobile header CTA hierarchy.
- Mobile drawer contains wallet, chain, language, and product navigation.
- Share panel uses a mobile sheet-style pattern with copy/social intents.
- Game nav chip rail is compressed compared with earlier versions.
- Dev switches can disable onboarding and age gate during local review.
- Mobile game-room sticky bet path has been de-duplicated: the sticky action
  bar is the primary mobile CTA, while the full panel no longer exposes a
  second mobile action path.

### 1B. Overlay primitive consolidation

Create app-local primitives:

- `useOverlayController`
- `Sheet`
- `Drawer`
- `Popover`
- `Modal`
- `StickyActionBar`

Then migrate wallet, chain, nav drawer, share, and result modal to one z-scale
and one safe-area/backdrop language.

**Do not do.**

- Do not create a new shell that bypasses `AppShell`.
- Do not move overlay primitives into `@ssot/ui` before the app-local API is
  proven.

**Screenshot acceptance.**

- 390px mobile: header, drawer, chain sheet, language sheet, share sheet, result
  modal, and sticky CTA fit without horizontal overflow.
- Wallet-browser mode: no sticky action is hidden by the browser toolbar.
- Desktop: popovers anchor to triggers and do not show mobile backdrops.

### 1C. Game-room mobile bet path

Resolve the duplicate control issue by making the mobile sticky bet area the
single primary bet action path. The in-panel bet editor may remain for context
or advanced settings, but mobile should never show two amount editors and two
place/connect actions.

**Acceptance.**

- At 390px there is exactly one primary bet amount editor and one place/connect
  CTA visible in the actionable zone.
- Round state remains visible after signing and after settlement.

## 6. Phase 2 — Player First Screen

### 2A. Homepage `/`

**Target user.** First-time player who has not connected a wallet.

**Decision.** "Do I trust this enough to enter the casino?"

**Visual thesis.** Poster-like first viewport: product promise, a strong casino
artifact, two proof points, one CTA. No stat-strip clutter.

**Tasks.**

- Rewrite the first viewport around "play on-chain, get paid to wallet, verify
  the round."
- Use one dominant product visual: receipt win card, game montage, or live room
  preview.
- Keep chain-verifiable stats only if they are real and not visually dominant.
- Remove hardcoded game-count claims; the architecture supports expansion.

**Acceptance.**

- At 390px the first viewport shows H1, concise copy, CTA, and product visual.
- No "8 games" copy.
- A disconnected user sees meaningful chain/proof information without needing
  to connect first.

**Current state.** Implemented. Local screenshot gates at 390px and 1440px show
the promise, CTA, and product visual in the first viewport without horizontal
overflow.

### 2B. Casino lobby `/casino`

**Target user.** Player choosing a game.

**Decision.** "Which game should I open now?"

**Visual thesis.** Game tiles are the product. Filters are secondary. Tile art
matches game-room stage/share/OG primitives.

**Tasks.**

- Reduce lobby hero/filter height.
- Move the grid into the first viewport.
- Replace house-edge-first card labels with player-facing attributes: volatility,
  multiplier, speed, or game type.
- Build a shared game visual primitive used by lobby, OG, receipt background,
  and game room where practical.

**Acceptance.**

- At 390px at least one full game card and part of a second card are visible.
- Game visuals look like one system, not eight unrelated icons.

**Current state.** Implemented enough for launch polish. Local screenshots show
one full mobile game card in the first viewport and four full desktop cards.
The remaining work is asset-system consolidation, not a layout blocker.

## 7. Phase 3 — Game Room Conversion

**Target user.** Player ready to configure a bet.

**Decision.** "Do I understand this game and can I safely place the bet?"

**Visual thesis.** Stage owns gameplay. Bet panel owns money. Proof and limits
are available but not first-screen dominant.

**Tasks.**

- Keep stage visible above fold on mobile.
- Move large max-bet/max-payout cards into compact limit rows or a limits
  drawer when they are not immediately actionable.
- Ensure Max amount uses the minimum of wallet balance and max bet.
- Lock inputs after signing/placing and unlock after terminal result.
- Keep result modal full-screen, internally scrollable, and share-ready.

**Acceptance.**

- Stage visible in first viewport on 390px.
- Sticky CTA visible and never blocking required game controls.
- No placeholder room metrics disappear merely because no bet is selected; empty
  means "not selected" when that is the actual state.

**Current state.** Partially implemented. The 390px game-room screenshot shows
the stage and sticky CTA in the first viewport with no horizontal overflow.
Remaining verification is wallet-connected gameplay in an in-wallet browser and
the full signing-to-settlement path.

## 8. Phase 4 — Receipt, Share, and OG Acquisition

**Target user.** A viewer arriving from Telegram, X, WhatsApp, or a player
sharing a result.

**Decision.** "Is this real, and do I want to play?"

**Visual thesis.** Receipt is a share landing page. It should feel like public
proof plus an invitation, not an internal app panel.

**Current partial state.**

- Receipt route uses `/casino/receipt/[chainId]/[betId]`.
- Share links carry referral attribution.
- Receipt and OG work from a shared view model.
- OG copy has moved away from hardcoded game-count claims.
- Share panel uses bottom-sheet behavior on mobile and anchored popover
  behavior on desktop; local screenshots confirm it no longer clips the receipt
  or result surfaces.

**Remaining tasks.**

- Keep receipt page chrome minimal: logo/account/CTA, no game room rail.
- Keep proof details collapsed with internal scroll, actions pinned.
- Make share panel a reusable acquisition component with mobile sheet behavior.
- Align OG visuals with the same game/share primitive used by lobby.
- Validate real production OG URLs after deployment and cache rules.

**Acceptance.**

- Real public URLs render correct OG images for home, casino, game room, earn,
  affiliate, and receipt.
- Receipt page at 390px has no horizontal overflow when proof details expand.
- Share sheet works when `navigator.share` is absent.

## 9. Phase 5 — Earn Provider Console

**Target user.** Bankroll provider / DeFi capital allocator.

**Decision.** "Is this vault worth underwriting, and what risk am I taking?"

**Visual thesis.** Calm due-diligence console. The page leads with share price,
reserve, turnover velocity, drawdown, and risk. It does not look like a stack of
marketing cards.

**Data rule.**

- Share price, total shares, reserve, protocol fees, and contract config are
  chain-verifiable when available.
- Turnover velocity, hold%, drawdown, and P&L are indexed or contract-counter
  derived depending on the active release. Label them honestly.

**Tasks.**

- Put share price and total shares above explanatory copy.
- Put velocity and drawdown near reserve/risk, not buried below.
- Keep reserve ledger and risk checks in tabs to reduce page height.
- Make deposit/withdraw a two-tab professional control with assets/shares modes.
- Use toast-based transaction feedback; no inline error blocks that deform the
  layout.
- Use a durable provider ledger; avoid slow ad hoc log scans in the UI.

**Acceptance.**

- At 390px the first viewport shows investment decision metrics, not only copy.
- No slash-composite cards such as `USDC / WETH` as the primary presentation.
- Deposit and withdraw show wallet balance, available shares, preview shares or
  assets, and explicit disabled reasons.

## 10. Phase 6 — Affiliate Growth Console

**Target user.** KOL, streamer, affiliate operator.

**Decision.** "Can I make money by sending traffic here, and can I track it?"

**Visual thesis.** B2B acquisition console: link, earnings, proof, campaign
assets. The page must not route the affiliate as if they are just a player.

**Tasks.**

- Make `Generate referral link` or `Open referral console` the primary CTA.
- Show first-touch attribution, earning mechanics, and payout visibility above
  player-game CTAs.
- Provide campaign/share assets and preview cards.
- Ensure `?ref=` capture persists in local storage and bet placement reads it.

**Acceptance.**

- First viewport contains a clear affiliate action.
- Link generation and copy are available without hunting.
- Referral attribution is visible and testable from landing through bet.

**Current state.** Partially implemented. Mobile screenshots show the first
viewport no longer overflows on long referral links. Remaining work is campaign
asset packaging and stronger affiliate-native proof/earning presentation.

## 11. Phase 7 — Launch Hardening

**Runs after every visual slice.**

### Required local gates

Docs only:

```bash
pnpm -C frontend exec prettier --write <changed-docs>
git diff --check
```

Web app code:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

Shared runtime boundary:

```bash
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
git diff --check
```

### Screenshot gates

Each UI slice needs before/after screenshots for:

- Desktop 1440px.
- Mobile 390px.
- At least one game room.
- One wallet-browser or wallet-browser-equivalent safe-area pass when sticky
  actions/share sheets are touched.

### Hard-rule scans

```bash
rg -n "transition-all|dark:|visual-system|cyber-|--ag-" frontend/apps/web/src frontend/packages
rg -n "parseFloat|Number\\(" frontend/apps/web/src/features frontend/apps/web/src/components
rg -n "Receipt not indexed|not indexed yet|raw RPC|viem" frontend/apps/web/src
```

Investigate results; do not blindly delete legitimate test or parser code.

## 12. Immediate Next Sequence

Execute in this order:

1. Keep Phase 0 docs current after each slice.
2. Finish Phase 1B by migrating the remaining private overlays
   (wallet/nav/result modal) to the shared z-scale and sheet/modal anatomy.
3. Complete Phase 3 with a wallet-connected game-room QA pass in a wallet
   browser or equivalent mobile browser session.
4. Phase 5: earn provider console pass, focused on share price, turnover
   velocity, drawdown/risk, and the deposit/withdraw control.
5. Phase 6: affiliate console pass, focused on campaign assets and proof of
   earning mechanics.
6. Phase 4 production loop: validate deployed OG URLs and Cloudflare cache
   behavior after deployment.

Do not start a broad page redesign while a P0 runtime regression exists in
place-bet, VRF, settlement, receipt, keeper, env, or release metadata.
