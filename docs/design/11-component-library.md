# 11 · Component Library

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `10-design-tokens.md`, `frontend-implementation-roadmap.md` |
| Supersedes | Draft v1 component platform spec |

The component library exists to keep product UI consistent. It is not a
standalone platform goal.

## 1. Component Tiers

| Tier       | Examples                                                      | Rule                                |
| ---------- | ------------------------------------------------------------- | ----------------------------------- |
| Primitive  | Button, Input, Dialog, Tabs, Table, Badge                     | Generic, tokenized, accessible.     |
| Pattern    | AppShell, WalletGate, AmountDisplay, TxStatusChip, EmptyState | Product-aware but reusable.         |
| Feature UI | CasinoRoom, TicketPanel, PortfolioActivity                    | Lives in `apps/web/src/features/*`. |

Prefer feature-local components unless a UI element is reused across routes.

## 2. Keep In Shared UI

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

## 3. Import Rules

- Pages compose feature components.
- Features may use shared patterns and primitives.
- Primitives must not import features.
- Shared UI must not import app routes or product data hooks.
- Wallet/RPC-aware components stay in approved wallet/action/data boundaries.

## 4. NumberInput

Asset amounts must use bigint-safe input behavior:

- no native `<input type="number">`;
- no `parseFloat` or `Number(...)` on user-entered amounts;
- no scientific notation;
- decimals come from release metadata;
- max/min validation happens before simulation.

## 5. Component Quality

Any shared component should have:

- accessible label/name behavior;
- focus-visible state;
- disabled/loading state where relevant;
- tokenized color/radius/shadow;
- a focused test when logic exists.

Storybook is useful but not a hard gate for every small change at the current
stage.

## 6. Do Not Do

- Do not reintroduce `cyber-*` primitives.
- Do not create a second shell.
- Do not create one-off shared components for a single feature.
- Do not add arbitrary hex, radius, or shadow values.
- Do not add new visual variants because one page wants a different mood.

## 7. Verification

```bash
rg -nE "cyber-|visual-system|--ag-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "from ['\\\"]wagmi|from ['\\\"]viem|from ['\\\"]@rainbow" frontend/apps/web/src/app frontend/packages/ui/src
```
