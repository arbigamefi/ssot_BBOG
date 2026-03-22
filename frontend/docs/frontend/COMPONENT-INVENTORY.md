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
| `MaskPickerGrid` | 40-cell visual selector for packed mask games | required |
| `DiceParamsForm` | Dice params form (cap) | required |
| `CoinTossParamsForm` | Coin toss params form (heads/tails) | required |
| `RouletteParamsForm` | Roulette params form (European typed bets + advanced raw mask fallback) | required |
| `KenoParamsForm` | Keno params form (uint40 mask) | required |
| `ShellHeader` | Shared shell header family for landing, room, and trust routes | required |
| `GlassCard` | Elevated surface primitive for prototype and trust-route exploration | optional |
| `RouletteBoard` | Standard European roulette board surface | required |
| `AuditTabs` | Shared trust-route tab strip and audit table framing | required |
| `GameCard` | Shared room-entry card | required |
| `DataTable` | Standardized table with column alignment and empty state | required |

### 3) Feature Components (apps/web)
Examples: BetPanel, BankPanel, ReferralPanel.

## Backlog (to implement or harden)

### System (@ssot/ui)
- `MetricCard` (numbers + deltas + tooltip)
- `AddressInput` (validated address field with helper text) — used by Referral/Affiliate (Milestone D5)
- tokenized room-shell surfaces (replace one-off prototype glow treatments)
- tokenized trust-shell stat cluster (replace ad-hoc metric cards across trust routes)

### Feature (apps/web)
- route-specific ticket rails:
  - roulette-native slip
  - dice-native slip
  - binary-game slip
- room lower-tab system:
  - `All Bets`
  - `My Bets`
  - `Players`
  - `Analytics`
  - `Game Details`
