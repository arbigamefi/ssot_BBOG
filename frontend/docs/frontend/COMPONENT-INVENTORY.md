# Component Inventory (UI SSOT)

This document is a living inventory of reusable components.

## Principles

- **@ssot/ui** is **pure UI**: it must not import ABI, chain clients, or call RPC.
- Feature-specific components live in `apps/web/src/features/**/ui`.
- Every **system component** must have Storybook stories for: **default / loading / empty / error**.

## Layers

### 1) Primitives (shadcn/ui)
Examples: Button, Card, Tabs, Dialog, Toast...

### 2) System Components (@ssot/ui)
| Component | Purpose | Stories |
|---|---|---|
| `ReleaseBadge` | Shows network + hub short + release digest | required |
| `ReadOnlyBanner` | Blocks writes when release snapshot invalid | required |
| `TxStepper` | Canonical step list UI for write flows | required |
| `TxStatusChip` | Compact status indicator for tx machine state | required |
| `ErrorCallout` | Canonical error callout (UI-only) | required |
| `Input` | Text/number input primitive (Tailwind) | required |
| `Label` | Form label primitive | required |
| `AssetSelector` | Canonical asset selector (pure UI) | required |
| `StakeSpecForm` | StakeSpec form (amountPerRoll, betCount, stopGain/loss) | required |
| `DiceParamsForm` | Dice params form (cap) | required |
| `CoinTossParamsForm` | Coin toss params form (heads/tails) | required |
| `RouletteParamsForm` | Roulette params form (uint40 mask) | required |
| `KenoParamsForm` | Keno params form (uint40 mask) | required |

### 3) Feature Components (apps/web)
Examples: BetPanel, BankPanel, ReferralPanel.

## Backlog (to implement)

### System (@ssot/ui)
- `DataTable` (standardized column definitions, alignment, empty state)
- `MetricCard` (numbers + deltas + tooltip)
- `MaskPickerGrid` (40-bit toggle grid) — optional enhancement for Roulette/Keno UX (post-D2)
- `AddressInput` (validated address field with helper text) — used by Referral/Affiliate (Milestone D5)

### Feature (apps/web)
- (none in backlog yet)
