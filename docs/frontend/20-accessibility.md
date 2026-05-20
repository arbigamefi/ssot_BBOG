# 20 · Accessibility

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../design/11-component-library.md`, `../design/12-motion.md`, `../design/15-forms.md` |
| Supersedes | Draft v1 exhaustive accessibility spec |

Accessibility is a release quality gate for user-facing flows. The goal is
WCAG 2.2 AA in practice, with automated checks plus manual keyboard review for
money-moving paths.

## 1. Required Baseline

- Keyboard access for all interactive controls.
- Visible focus state.
- Form labels and accessible error text.
- Color is never the only status signal.
- Reduced-motion preference is respected.
- Dialogs and drawers trap focus and restore it on close.
- Player flows do not hide critical state behind hover-only UI.

## 2. Keyboard

Every button, link, tab, drawer trigger, wallet action, and form control must be
reachable by Tab and usable with Enter or Space according to native semantics.

Do not use:

- `tabIndex` greater than `0`;
- clickable `div` where a `button` or `a` works;
- `outline: none` without a visible replacement;
- keyboard shortcuts that conflict with browser or screen-reader defaults.

## 3. Forms

Each field has:

- visible label or `sr-only` label;
- stable id;
- `aria-invalid` when invalid;
- `aria-describedby` for hint and error text.

Submit blockage must be explained near the action. Do not leave a disabled
button with no visible reason.

## 4. Status And Live Regions

Use visible text plus status styling for:

- wallet connection;
- approval/signing/mining;
- VRF waiting;
- keeper settling;
- settled/won/lost/refunded;
- sportsbook market locked/expired.

Use `aria-live="polite"` for normal transaction progress and
`aria-live="assertive"` only for blocking errors.

## 5. Contrast

Token pairs should meet WCAG AA:

- normal text: at least 4.5:1;
- large text: at least 3:1;
- focus indicators and non-text controls: at least 3:1.

If contrast fails, fix the token or component, not a one-off page style.

## 6. Motion

Follow `../design/12-motion.md`:

- no scroll-triggered decorative motion that blocks comprehension;
- no flashing;
- no gameplay animation that hides transaction state;
- reduced motion keeps the same information with less movement.

## 7. Manual Release Check

Before a public release, manually check:

1. Connect wallet and wrong-chain path.
2. Casino place bet through settled receipt.
3. Sportsbook ticket place path.
4. Portfolio activity and claims.
5. Earn deposit/withdraw.

At minimum, run each with keyboard only through the primary action.

## 8. Do Not Do

- Do not use placeholder text as the only label.
- Do not make charts or tables hover-only.
- Do not use color-only win/loss/locked status.
- Do not disable pinch zoom.
- Do not auto-focus random content after async refresh.
- Do not trap focus outside a modal or drawer.

## 9. Verification

```bash
pnpm -C frontend lint
pnpm -C frontend/apps/web e2e
rg -nE "tabIndex=\\{?[1-9]|outline-none|role=['\\\"]button" frontend/apps/web/src
```
