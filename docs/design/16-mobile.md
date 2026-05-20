# 16 · Mobile & Responsive

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `10-design-tokens.md`, `11-component-library.md` |
| Supersedes | Draft v1 mobile platform spec |

ArbiGameFi is a responsive web product. Mobile must work cleanly, but v1 does
not need native apps, custom offline behavior, or mobile-only routes.

## 1. Breakpoints

Use Tailwind defaults:

| Token | Width  |
| ----- | ------ |
| `sm`  | 640px  |
| `md`  | 768px  |
| `lg`  | 1024px |
| `xl`  | 1280px |
| `2xl` | 1536px |

Rules:

- `< md`: single column, no desktop sidebar.
- `md` to `lg`: two columns only when content remains readable.
- `lg+`: desktop density is allowed.
- `2xl+`: cap content width; do not stretch prose or controls endlessly.

## 2. Touch Targets

- Primary actions: at least 44px high.
- Icon buttons: at least 36px visual with enough padding to hit 44px.
- Form inputs: at least 44px high.
- Adjacent tappable targets: at least 8px apart.

Do not shrink wallet, approve, place bet, settle, or claim actions below these
targets.

## 3. Navigation

Desktop keeps the normal header navigation. Mobile keeps:

- wordmark;
- wallet entry;
- menu button.

The menu opens a drawer with the same product routes as desktop. No bottom tab
bar in v1 unless real usage data shows the route set needs it.

## 4. Casino Room

Mobile casino order:

```text
Game header
Game stage
Bet panel
Round status / receipt
Recent results
Risk and proof details
```

The user must always understand three things:

- current stake and expected payout;
- whether the round is waiting, settling, settled, or failed;
- what action, if any, is required from them.

Avoid fixed-height game stages. Dice, roulette, coin toss, and keno must scale
to the available viewport without pushing the primary CTA out of reach.

## 5. Sportsbook

Mobile sportsbook order:

```text
Market header
Outcome list
Ticket slip
Market status and rules
Recent activity
```

Outcome chips can wrap to two columns. The ticket slip should stay close to the
selected outcomes, not hidden below a long market history.

## 6. Portfolio, Earn, And Ops

- Portfolio activity uses stacked rows on mobile.
- Earn deposit/withdraw forms use full-width panels, not cramped modals.
- Ops remains functional but can use horizontal table scroll; ops is not the
  primary mobile surface.

## 7. Viewport And Keyboard

- Use `100dvh` for viewport-height layouts.
- Do not block pinch zoom.
- Use `inputmode="decimal"` for amount entry.
- Use `touch-action: manipulation` on primary CTAs when appropriate.
- Respect safe-area insets for sticky or bottom-adjacent controls.

## 8. PWA

v1 may ship a manifest and icons. It should not ship a custom service worker or
offline-first behavior unless there is a concrete product need.

No automatic install prompt. If install support is present, expose it as a
small drawer item only after the browser fires the install event.

## 9. Do Not Do

- Do not create mobile-only routes.
- Do not use hover-only controls.
- Do not use fixed-height modals that overflow the viewport.
- Do not use horizontal carousels for primary navigation.
- Do not add custom pull-to-refresh.
- Do not hide transaction or settlement state below the fold after a user signs.

## 10. Verification

For UI changes touching product routes, smoke at least one mobile viewport and
one desktop viewport.

```bash
rg -nE "100vh\\b|h-screen" frontend/apps/web/src
rg -nE "maximum-scale=1|user-scalable=no" frontend/apps/web
pnpm -C frontend/apps/web test
```
