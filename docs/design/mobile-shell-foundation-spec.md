# Mobile Shell Foundation Spec — Header / Drawer / Sheet / Sticky CTA

| Owner    | Product + Frontend                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Partially implemented — foundation spec + remaining work                                                                                                                          |
| Date     | 2026-06-07                                                                                                                                                                        |
| Priority | Slice #1 (foundation layer reused by every later slice)                                                                                                                           |
| Extends  | `docs/design/frontend-product-ui-ux-audit-2026-06-07.md` → "Shared Interaction System"; `16-mobile.md`                                                                            |
| Scope    | The mobile interaction primitives only: header, nav drawer, bottom sheets, anchored popovers, share sheet, sticky bet CTA. **Not** page-level redesigns (those are slices #2–#6). |

This document turns the audit's _Shared Interaction System_ prose into a
**build-ready pattern contract**. The rule for this slice: no page gets polished
until every overlay on mobile shares one anatomy, one breakpoint, one z-scale,
and one set of backdrop/safe-area tokens.

Implementation has started. Treat this document as the remaining contract for
the mobile shell foundation, not as a historical proposal.

## 0. Implementation Status

| Item                                             | Status       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile header CTA hierarchy                      | Done         | The disconnected mobile header is compact and no longer competes with the hero.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Mobile nav drawer owns chain/language controls   | Done         | Drawer chain and language controls now use shared sheet/popover/listbox anatomy.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Share panel mobile sheet                         | Done locally | Share uses shared sheet/popover; local 390px and desktop screenshots confirm no clipping. Wallet-browser QA remains.                                                                                                                                                                                                                                                                                                                                                                                  |
| Game nav chip rail compression                   | Done         | Product/game route nav is shorter and centers the active mobile game chip.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dev review flags for onboarding/age gate         | Done         | Local review can disable those gates without changing product code.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Shared overlay primitives                        | Done         | `Sheet`, `Drawer`, `Popover`, `Modal`, `StickyActionBar`, z tokens, and `useOverlayController` exist.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Unified z-index scale                            | Done         | All layered surfaces use `overlayZ`. Scale: stickyAction 40, bottomBanner 50, popover 60, drawer 70, sheet 80, onboarding 85, modal 90, modalPopover 95, toast 100, gate 110.                                                                                                                                                                                                                                                                                                                         |
| Focus trap and focus return                      | Done         | Shared `Sheet`, `Drawer`, and `Modal` cover focus trap/return for migrated surfaces; StickyActionBar is non-modal.                                                                                                                                                                                                                                                                                                                                                                                    |
| Sticky bet CTA de-duplication                    | Done         | Mobile now has one primary sticky bet CTA path wrapped by `StickyActionBar`; the full panel no longer duplicates it.                                                                                                                                                                                                                                                                                                                                                                                  |
| Compliance / PWA / onboarding overlays on system | Done         | Legal gates (`AgeTermsGate`, `ResponsibleGamblingDialog`) now use `overlayZ.gate` (above toast); `OnboardingTour` uses `overlayZ.onboarding`; `CookieConsentBanner` + `InstallPrompt` use `overlayZ.bottomBanner` and offset their `bottom` above the sticky CTA via the height var `StickyActionBar` publishes. PWA install waits until the cookie choice resolves (one nag at a time). Verified at 390px: banners stack above the bet/connect CTA, never cover it.                                  |
| Wallet-browser safe-area QA                      | Mostly done  | Root cause fixed: `app/layout.tsx` now exports `viewport-fit=cover`, so the `env(safe-area-inset-*)` padding on the sticky bar, sheets, and banners actually resolves (it was a no-op before). Drawer gained a bottom safe-area inset. Verified at 390px: share sheet degrades gracefully when `navigator.share` is absent (copy + X/Telegram/WhatsApp). Residual: standalone-PWA top-notch header inset needs `@ssot/ui` `ShellHeader` coordination, and a real MetaMask/Coinbase/Trust device pass. |

---

## 1. Current Problems (evidence-based)

The mobile shell works, but it is **five independent re-implementations of the
same idea**. Each overlay re-derives portal mounting, scroll-lock, Escape,
outside-click, and backdrop styling on its own, and they disagree with each
other. A user who resizes, stacks two overlays, or opens a sheet inside a modal
feels the seams.

### 1.1 Overlay fragmentation (measured in source)

| Surface                          | File                   | z-index            | mobile↔desktop switch | backdrop token         | drag handle | close affordance |
| -------------------------------- | ---------------------- | ------------------ | --------------------- | ---------------------- | ----------- | ---------------- |
| Wallet menu — desktop popover    | `WalletHeaderMenu.tsx` | `overlayZ.popover` | —                     | none                   | —           | outside-click    |
| Wallet menu — mobile sheet       | `WalletHeaderMenu.tsx` | `overlayZ.sheet`   | `md` (768)            | shared sheet backdrop  | ✅          | X + backdrop     |
| Chain switcher — desktop popover | `ChainSwitcher.tsx`    | `overlayZ.popover` | —                     | none                   | —           | outside-click    |
| Chain switcher — mobile sheet    | `ChainSwitcher.tsx`    | `overlayZ.sheet`   | `md` (768)            | shared sheet backdrop  | ✅          | X + backdrop     |
| Nav drawer                       | `AppHeader.tsx`        | `overlayZ.drawer`  | `md` (768)            | shared drawer backdrop | —           | X + backdrop     |
| Share — desktop popover          | `SharePanel.tsx`       | `overlayZ.popover` | `md` (768)            | none                   | —           | outside-click    |
| Share — mobile sheet             | `SharePanel.tsx`       | `overlayZ.sheet`   | `md` (768)            | shared sheet backdrop  | ✅          | X + backdrop     |
| Result overlay (modal)           | `result-overlay.tsx`   | `overlayZ.modal`   | all                   | shared modal backdrop  | —           | (in-content)     |

Concrete defects this table proves:

1. **The z-index scale is mostly adopted.** Share, chain, wallet, nav, and the
   result modal now use `overlayZ`; toasts still need a final stacking audit.
2. **The breakpoint disagreement has been fixed for share/chain/wallet**, all
   now use the header's **`md` (768px)** sheet↔popover boundary where relevant.
3. **Backdrop drift has been reduced to final audit work.** Share, chain, wallet,
   nav, and result modal now use shared overlay backdrops; toast and future
   confirmation surfaces still need review.
4. **Anatomy drift is reduced to follow-up QA.** Migrated sheets/drawers/modal now
   share close handling, internal scroll, safe-area padding, and backdrop
   behavior. StickyActionBar owns the mobile thumb-zone container.
5. **Effect duplication is mostly removed from shell surfaces.** Share, chain,
   wallet, nav, and result modal no longer hand-roll portal, scroll-lock, Escape,
   and focus handling.

### 1.2 Header — chain pill is cryptic on mobile

`ChainSwitcher.tsx` popover trigger hides the chain name below `sm`:

```
<span className="hidden truncate sm:inline">{selectedChain?.shortName ...}</span>
```

On a phone the standalone header chain control collapses to a bare colored
dot + chevron with no label. A new visitor cannot tell which network they are
browsing. The chain name ("Base", "Base Sepolia") is short and should always show.

### 1.3 Game room — duplicate bet controls on mobile

This was the largest mobile-room defect and has been addressed locally. The
sticky bar is now the primary mobile action path; the full panel no longer
shows a second mobile place/connect CTA. The remaining risk is not the static
layout but the connected-wallet flow: after signing, during VRF wait, and after
terminal settlement, the sticky bar and round state must stay readable in a
wallet browser.

### 1.4 Wallet-browser blind spot

Nothing above was verified inside an in-app dApp browser (MetaMask / Coinbase
Wallet / Trust). Those environments have: no URL bar, custom bottom toolbars that
can overlap a `fixed bottom-0` bar, frequently **no `navigator.share`**, and
sometimes restricted clipboard / blocked `window.open`. The sticky bet bar and
the share sheet are exactly the two surfaces most exposed to this.

---

## 2. Component Goals

| Component         | One-line goal                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Mobile header** | Persistent brand + connect state + menu, without stealing the first viewport.              |
| **Nav drawer**    | One home for secondary nav, network, language, wallet-browser refresh.                     |
| **Bottom sheet**  | The single mobile pattern for chain, wallet, share, and any list/choice surface.           |
| **Popover**       | The single desktop pattern for the same anchored menus.                                    |
| **Modal**         | Full-attention surfaces (result, confirmations) with internal scroll, pinned actions.      |
| **Sticky CTA**    | The single mobile thumb-zone action container — the only place a primary mobile CTA lives. |

---

## 3. Target Users & GTM Mapping

Per the GTM three-sided flywheel, each shell surface serves a specific audience
decision. The foundation must not blur these.

| Surface               | Primary audience          | The decision it must not get in the way of                                                     |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Header (connect pill) | New player                | "Can I start without friction?" → connect is one tap, never competes with the hero.            |
| Nav drawer            | All                       | "Where do I go / how do I switch chain or language?" → predictable, one place.                 |
| Chain sheet           | Player + provider         | "Which network's house am I touching?" → name always visible; mainnet vs testnet unmistakable. |
| Share sheet           | Player → acquisition loop | "Send this win to my group." → fewest taps; works in wallet browsers.                          |
| Sticky bet CTA        | Player mid-play           | "Size the bet, place it." → thumb zone, one amount, one button.                                |
| Result modal          | Player + future viewer    | "Did I win, and is it real?" → result dominant, share one tap away.                            |

**Integrity red line (carried from GTM):** any number shown in these surfaces
keeps its provenance label — chain-read = "verifiable", index-derived =
"indexed · may lag". The foundation must give those badges a consistent slot, not
each surface inventing its own.

---

## 4. Information Hierarchy

### 4.1 Mobile header (single row)

```
[ logo ]                         [ wallet/account pill ] [ ☰ menu ]
```

- Connected: pill = chain dot + short address + caret (opens wallet sheet).
- Disconnected: pill = "Connect" (primary-tinted) + a chain chip that **shows the
  chain name**.
- Network and language controls are **not** loose dropdowns in the bar — they live
  in the drawer (audit §Mobile Header).
- Product/game routes may add **one** low-height horizontal chip rail below the bar
  (game nav). Never a second full chrome row.

### 4.2 Nav drawer (top→bottom)

1. Account / wallet block (or Connect).
2. Primary nav sections.
3. Network (opens chain sheet or inline list).
4. Language.
5. Wallet-browser refresh (manual icon), legal/footer links.

### 4.3 Bottom sheet (top→bottom)

```
drag handle
title              [ X ]
─────────────────────────
body (scrolls)
─────────────────────────
sticky footer actions (optional, safe-area padded)
```

### 4.4 Sticky bet CTA (one row, thumb zone)

```
amount readout + ½ 2× Max          [ PLACE BET / CONNECT ]
```

---

## 5. Mobile Layout Rules (incl. wallet browser)

- **Single breakpoint.** Sheet↔popover switches at **`md` (768px)** everywhere.
  Delete the `sm`/`639px` path in `SharePanel`.
- **Safe areas.** Every bottom-anchored surface (sheet footer, sticky bar) uses
  `pb-[calc(1rem+env(safe-area-inset-bottom))]`. Sheets cap at `max-h-[82svh]`
  with internal scroll (`svh`, not `vh`, for mobile URL-bar correctness).
- **Sticky bar above wallet toolbars.** Keep the safe-area inset and avoid pinning
  content the in-app browser toolbar could cover; the bar's place CTA must remain
  fully tappable in MetaMask/Coinbase/Trust browsers.
- **Share degrades gracefully.** When `navigator.share` is absent (common in
  dApp browsers), the sheet shows copy-link / per-network intents — already the
  behavior; keep it and verify in a wallet browser.
- **No horizontal overflow** at 360–430px. Long addresses/URLs truncate, never
  widen the layout.
- **Touch targets** ≥ 44px (carry `16-mobile.md` §2).

---

## 6. Visual Direction

- Tokens only — no hex, no per-game color (CLAUDE.md hard rule). Surfaces use
  `surface-0..3`, text `fg / fg-muted / fg-subtle`, borders `border-soft / border`.
- **One backdrop language:** sheets & drawers `bg-surface-0/70 backdrop-blur-sm`;
  full modals `bg-surface-0/76 backdrop-blur-md`. Retire `bg-bg/65`.
- Sheet/drawer panels: `bg-surface-1`, `border border-border-soft`,
  `rounded-t-2xl` (sheet) / left border (drawer), `shadow-e3`.
- Motion: `animate-in slide-in-from-bottom` (sheet), `fade-in` (backdrop),
  respect `motion-safe`. No `transition-all` (hard rule).
- Drag handle is **standard** on every bottom sheet (`h-1 w-10 rounded-full bg-border`).

---

## 7. Unified Pattern Contract

Introduce one small app-local overlay module and route all five surfaces through
it. Pure-presentational, no wagmi/viem (keeps CLAUDE.md import boundaries clean).
Proposed home: `apps/web/src/components/overlay/` (can graduate to `@ssot/ui`
once stable — not now, to avoid expanding the ssot boundary for an unproven API).

### 7.1 `useOverlayController(opts)` — replaces the 5 duplicated effect blocks

Single hook owning: portal target, body scroll-lock (sheet/modal/drawer only),
`Escape`-to-close, backdrop/outside-click close, **focus-trap + focus-return**,
`role="dialog" aria-modal`. Inputs: `{ open, onClose, lockScroll?, trapFocus? }`.

### 7.2 Primitives (all consume the controller)

| Primitive           | Geometry                                                                                  | Used by                                            |
| ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `<Sheet>`           | bottom, `inset-x-0 bottom-0 max-h-[82svh]`, drag handle, header, scroll body, safe footer | chain (mobile), wallet (mobile), share (mobile)    |
| `<Drawer>`          | side, `inset-y-0 right-0 w-[min(22rem,86vw)]`                                             | nav menu                                           |
| `<Popover>`         | anchored, absolute to trigger, no scroll-lock                                             | chain (desktop), wallet (desktop), share (desktop) |
| `<Modal>`           | centered, internal scroll, pinned action row                                              | result overlay, confirmations                      |
| `<StickyActionBar>` | `fixed inset-x-0 bottom-0 lg:hidden`, blur, border-top, `max-w`, safe-area                | game room bet CTA                                  |

A surface that is a sheet on mobile and popover on desktop renders **both**
gated by the single `md` breakpoint (today's approach — just unified).

### 7.3 Z-index scale (single source, e.g. `overlay/z.ts`)

```
sticky  50
popover  60
drawer   70
sheet    80
modal    90
toast   100   (already @ssot/ui/toast — must stay on top)
```

Replaces `10/50/90/95/150`. **Nesting rule:** a sheet launched from inside a
modal (e.g. share from the result modal) renders as a child _within_ that modal's
stacking context, not as a sibling at global `z-80`, so it always sits above its
opener without inflating global z-values.

### 7.4 Breakpoint & tokens (single source)

- Switch constant: `md` / 768px.
- Backdrop tokens: as §6.
- Safe-area footer util: as §5.

---

## 8. Concrete Change List (by file)

> Build order: primitives first, then migrate surfaces one-by-one with a
> screenshot gate after each. No behavior change is shipped without §9 evidence.

1. **New** `apps/web/src/components/overlay/`
   - `use-overlay-controller.ts` — the shared hook (§7.1).
   - `sheet.tsx`, `drawer.tsx`, `popover.tsx`, `modal.tsx`, `sticky-action-bar.tsx`.
   - `z.ts` — z-scale constants (§7.3).
   - Unit test: controller locks scroll, traps focus, closes on Esc/backdrop.

2. **`app-shell/ChainSwitcher.tsx`**
   - Popover trigger: **always show chain short name** (drop `hidden sm:inline`);
     keep dot = mainnet/testnet. Fixes §1.2.
   - Replace bespoke sheet/popover with `<Sheet>`/`<Popover>`.

3. **`app-shell/WalletHeaderMenu.tsx`** — Done
   - Replaced bespoke sheet/popover with `<Sheet>`/`<Popover>`; kept current content
     (identity, copy, explorer, mismatch banner, chain list, disconnect).

4. **`app-shell/AppHeader.tsx`** — Done
   - `MobileNavDrawer` → `<Drawer>`.
   - Confirm header is one row + at most one low chip rail; ensure network/language
     live inside the drawer, not the bar.
   - Wallet-browser refresh = manual icon inside drawer/account block.

5. **`features/share/SharePanel.tsx`**
   - Replace bespoke sheet/popover with `<Sheet>`/`<Popover>`.
   - **Switch breakpoint `sm`→`md`** so it matches the rest.
   - Add the standard drag handle (anatomy parity).
   - Keep `navigator.share` → copy/intents fallback; verify in wallet browser.

6. **`features/casino/room/result-overlay.tsx`**
   - Done: adopted `<Modal>` (z=modal=90, standard backdrop, focus trap, body
     scroll lock, Escape). Share-from-result uses the in-modal nesting rule (§7.3).

7. **`features/casino/room/game-room-shell.tsx` + `bet-panel.tsx` + `mobile-action-bar.tsx`**
   - Done: sticky region is wrapped in `<StickyActionBar>`.
   - Done: mobile sticky bar is the **primary** bet control (amount + ½/2×/Max +
     place); the in-panel amount editor and place button collapse on mobile via
     `hideMobileAction`. Net: one amount control, one place button on mobile.

8. **`@ssot/ui/toast`** — confirm toasts render at z=100 above all overlays
   (read-only check; no change expected).

No i18n string is added without a key; no hex/per-game color; no `transition-all`;
no new shell (these are primitives, not a shell). All within CLAUDE.md hard rules.

---

## 9. Screenshot Acceptance Standard

Every migrated surface must produce three captures before it's considered done.
Typecheck/build passing is **necessary but not sufficient**.

| Viewport                       | What must be true                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop 1440px**             | Popover anchors to its trigger; no full-screen backdrop; Esc/outside-click closes.                                                                                                           |
| **Mobile 390px**               | Sheet/drawer fits viewport, drag handle present, header + close visible, body scrolls _inside_, footer actions never covered; no horizontal overflow; chain pill shows the network **name**. |
| **Wallet browser / safe-area** | Sticky bet bar fully tappable above the in-app toolbar; share sheet works with `navigator.share` absent (copy/intents visible); bottom insets respected.                                     |

Surface-specific gates:

- **Chain/wallet/share sheets:** open at 390px → fully visible, single backdrop
  token, drag handle, Esc + backdrop + X all close.
- **Game room:** at 390px the stage is reachable, and there is exactly **one**
  amount control and **one** place/connect button visible (no duplicate).
- **Stacking:** open share _from_ the result modal at 390px → share sits above the
  result, both readable, closing share returns to the result.

Captures land in `/tmp/agf-mobile-shell-2026-06-07/` with `before-*` / `after-*`
pairs per surface, linked back here on completion.

---

## 10. Resolved Decision

**Game-room mobile bet control (§1.3 / change #7):** the sticky bar is the
**primary** mobile control. The in-panel amount editor and place CTA collapse on
mobile, leaving one visible amount control and one visible place/connect button.
Future room work should preserve that invariant.
