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

| Item                                           | Status      | Notes                                                                                                                |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Mobile header CTA hierarchy                    | Done        | The disconnected mobile header no longer uses a large purple CTA that competes with the hero.                        |
| Mobile nav drawer owns chain/language controls | Done        | Drawer chain and language controls now use shared sheet/popover/listbox anatomy.                                      |
| Share panel mobile sheet                       | Partial     | Share now uses shared sheet/popover; still needs screenshot gate and wallet-browser QA.                              |
| Game nav chip rail compression                 | Done        | Product/game route nav is shorter than the earlier full chrome row.                                                  |
| Dev review flags for onboarding/age gate       | Done        | Local review can disable those gates without changing product code.                                                  |
| Shared overlay primitives                      | Partial     | `Sheet`, `Popover`, z tokens, and `useOverlayController` exist; Drawer/Modal/StickyActionBar remain.                 |
| Unified z-index scale                          | Partial     | Share and chain surfaces now use `overlayZ`; wallet/nav/result still need migration.                                 |
| Focus trap and focus return                    | Partial     | Shared `Sheet` covers focus trap/return for migrated sheets; remaining private overlays still need migration.         |
| Sticky bet CTA de-duplication                  | Not started | Game room mobile can still expose duplicated bet controls depending on state.                                        |
| Wallet-browser safe-area QA                    | Not started | Needs explicit MetaMask/Coinbase/Trust-style verification.                                                           |

---

## 1. Current Problems (evidence-based)

The mobile shell works, but it is **five independent re-implementations of the
same idea**. Each overlay re-derives portal mounting, scroll-lock, Escape,
outside-click, and backdrop styling on its own, and they disagree with each
other. A user who resizes, stacks two overlays, or opens a sheet inside a modal
feels the seams.

### 1.1 Overlay fragmentation (measured in source)

| Surface                          | File                   | z-index   | mobile↔desktop switch | backdrop token            | drag handle | close affordance |
| -------------------------------- | ---------------------- | --------- | --------------------- | ------------------------- | ----------- | ---------------- |
| Wallet menu — desktop popover    | `WalletHeaderMenu.tsx` | `z-50`    | —                     | none                      | —           | outside-click    |
| Wallet menu — mobile sheet       | `WalletHeaderMenu.tsx` | `z-[95]`  | `md` (768)            | `bg-surface-0/70` blur-sm | ?           | X + backdrop     |
| Chain switcher — desktop popover | `ChainSwitcher.tsx`    | `overlayZ.popover` | —                     | none                      | —           | outside-click    |
| Chain switcher — mobile sheet    | `ChainSwitcher.tsx`    | `overlayZ.sheet` | `md` (768)            | shared sheet backdrop     | ✅          | X + backdrop     |
| Nav drawer                       | `AppHeader.tsx`        | (own)     | `md` (768)            | (own)                     | —           | X + backdrop     |
| Share — desktop popover          | `SharePanel.tsx`       | `overlayZ.popover` | `md` (768)            | none                      | —           | outside-click    |
| Share — mobile sheet             | `SharePanel.tsx`       | `overlayZ.sheet` | `md` (768)            | shared sheet backdrop     | ✅          | X + backdrop     |
| Result overlay (modal)           | `result-overlay.tsx`   | `z-[90]`  | all                   | `bg-surface-0/76` blur-md | —           | (in-content)     |

Concrete defects this table proves:

1. **The z-index scale is only partially adopted.** Share and chain now use
   `overlayZ`, but wallet menu, nav drawer, result modal, and toasts are still
   outside the shared scale.
2. **The breakpoint disagreement has been fixed for share/chain**, both now use
   the header's **`md` (768px)** sheet↔popover boundary. Wallet and nav still
   need to be migrated through the same primitives so the rule stays enforced.
3. **Backdrop drift remains outside the migrated surfaces.** Share and chain now
   use the shared sheet backdrop; result modal and nav drawer still carry their
   own visual language.
4. **Anatomy drift is reduced, not eliminated.** Migrated bottom sheets now share
   the drag handle, close button, internal scroll, and safe-area padding. Private
   sheets/drawers still need migration.
5. **Effect duplication is partly removed.** Share and chain no longer hand-roll
   portal, scroll-lock, Escape, and focus handling. Wallet menu, nav drawer, and
   result modal remain to be consolidated.

### 1.2 Header — chain pill is cryptic on mobile

`ChainSwitcher.tsx` popover trigger hides the chain name below `sm`:

```
<span className="hidden truncate sm:inline">{selectedChain?.shortName ...}</span>
```

On a phone the standalone header chain control collapses to a bare colored
dot + chevron with no label. A new visitor cannot tell which network they are
browsing. The chain name ("Base", "Base Sepolia") is short and should always show.

### 1.3 Game room — duplicate bet controls on mobile

`game-room-shell.tsx` renders the full bet panel (`aside`, `order-2`) **and** a
`fixed bottom-0 lg:hidden` sticky action bar at the same time. The panel's
`hideMobileAction` prop hides its _place-bet button_ on mobile, but the panel's
**amount editor still coexists** with the sticky bar's amount readout + quick
adjust + place CTA. Result on a phone: two "BET AMOUNT" labels, two place/connect
affordances. It reads like two designs stacked, which is the single biggest
"not a mature product" tell in the room.

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

3. **`app-shell/WalletHeaderMenu.tsx`**
   - Replace bespoke sheet/popover with `<Sheet>`/`<Popover>`; keep current content
     (identity, copy, explorer, mismatch banner, chain list, disconnect).

4. **`app-shell/AppHeader.tsx`**
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
   - Adopt `<Modal>` (z=modal=90, standard backdrop). Share-from-result uses the
     in-modal nesting rule (§7.3).

7. **`features/casino/room/game-room-shell.tsx` + `bet-panel.tsx` + `mobile-action-bar.tsx`**
   - Wrap the sticky region in `<StickyActionBar>`.
   - **Resolve bet duplication (§1.3).** _Recommended:_ on mobile the sticky bar is
     the **primary** bet control (amount + ½/2×/Max + place); the in-panel amount
     editor and place button collapse on mobile (extend `hideMobileAction` to also
     hide the amount stepper at `< lg`), leaving the panel for game-specific
     selection/advanced options only. Net: one amount control, one place button on
     mobile. **(Open decision — needs sign-off before building, see §10.)**

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

## 10. Open Decision (needs sign-off before code)

**Game-room mobile bet control (§1.3 / change #7):** is the sticky bar the
**primary** control (recommended — in-panel amount/CTA collapse on mobile, one of
each), or a **secondary** "jump to bet" affordance (panel stays the editor, bar
just scrolls/triggers)? This is the one structural choice that changes the room
build. Everything else in this spec is non-controversial consolidation and can
start on approval.
