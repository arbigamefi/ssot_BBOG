# 11 · Component Library

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `01-brand.md`, `10-design-tokens.md`, `../architecture/overview.md` |
| Supersedes | Draft v1 component platform spec |

The component library exists to keep product UI consistent. It is not a
standalone platform goal.

## 1. Component Tiers

| Tier       | Examples                                                      | Rule                                |
| ---------- | ------------------------------------------------------------- | ----------------------------------- |
| Primitive  | Button, Input, Dialog, Tabs, Table, Badge                     | Generic, tokenized, accessible.     |
| Pattern    | AppShell, WalletGate, AmountDisplay, TxStatusChip, EmptyState | Product-aware but reusable.         |
| Feature UI | CasinoRoom, PortfolioActivity                                 | Lives in `apps/web/src/features/*`. |

Prefer feature-local components unless a UI element is reused across routes.

## 2. Printed Objects

Carbon copy (`01-brand.md` §6) boxes only printed objects. They are shared because the home
page, the game rooms and the receipt page all print them:

| Component  | What it is                                                                                     | Consumers                                |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Receipt    | The settled record of a bet (`04-page-blueprints.md` §1): leaders, tear line, stamp, torn edge | home, every room, receipt page, activity |
| Slip       | The quote that prints into a receipt; owns the main action                                     | every room                               |
| TicketStub | A game's name, multiplier range and link, with a perforation                                   | home, lobby                              |
| Stamp      | A 2px ring with a word or a number: settled, step numbers, 18+                                 | receipt, home steps, footer              |
| Scale      | The dice table: a printed strip with a dashed cut and punched rolls                            | dice room                                |

Rules:

- Printed figures use `font-print`; everything else uses `font-text`.
- Ink appears only on paper. On carbon, a printed object sits on its own paper sheet.
- No other component draws a box, a card background or a shadow.
- A printed object takes its content as data and never computes money: amounts arrive as
  exact values from the SDK or the bet index.

## 3. Keep In Shared UI

Shared UI should cover:

- Button / IconButton;
- Input / NumberInput;
- Dialog / Drawer / Popover / Tooltip;
- Tabs / segmented controls;
- Table / pagination;
- Badge / Alert / StatusDot / Progress / Skeleton;
- CopyButton / AddressDisplay / AmountDisplay;
- AppShell / WalletGate / EmptyState / ErrorState / TxStatusChip.

Do not add a shared component before there are at least two real consumers or a
clear accessibility/token reason.

## 4. Import Rules

- Pages compose feature components.
- Features may use shared patterns and primitives.
- Primitives must not import features.
- Shared UI must not import app routes or product data hooks.
- Wallet/RPC-aware components stay in approved wallet/action/data boundaries.

## 5. NumberInput

Asset amounts must use bigint-safe input behavior:

- no native `<input type="number">`;
- no `parseFloat` or `Number(...)` on user-entered amounts;
- no scientific notation;
- decimals come from release metadata;
- max/min validation happens before simulation.

## 6. Component Quality

Any shared component should have:

- accessible label/name behavior;
- focus-visible state;
- disabled/loading state where relevant;
- tokenized color/radius/shadow;
- a focused test when logic exists.

Storybook is useful but not a hard gate for every small change at the current
stage.

## 7. Do Not Do

- Do not reintroduce `cyber-*` primitives.
- Do not create a second shell.
- Do not create one-off shared components for a single feature.
- Do not add arbitrary hex, radius, or shadow values.
- Do not add new visual variants because one page wants a different mood.
- Do not build a rebuilt page from old-palette primitives; extend the primitive to Carbon copy
  instead.

## 8. Verification

```bash
rg -nE "cyber-|visual-system|--ag-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "from ['\\\"]wagmi|from ['\\\"]viem|from ['\\\"]@rainbow" frontend/apps/web/src/app frontend/packages/ui/src
```
