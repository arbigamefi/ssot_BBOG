# Page Spec — Games (Dice / CoinToss / Roulette / Keno)

## Purpose
Allow a user to place bets via SSOT `Hub.placeBet(payable)` using the standardized tx flow.

## Routes (Canonical)
Games are routed by **release manifest slugs**.

- Canonical: `/games/[slug]` where `slug ∈ release.gamesMeta[].slug`
- For Base Sepolia (example):
  - `/games/dice`
  - `/games/coin-toss`
  - `/games/roulette`
  - `/games/keno`

> **No legacy aliases.** Do not introduce `/games/cointoss` or other compatibility routes.

## Information Architecture
1. **Page Header**
   - Game title + short description
   - Release badge
2. **Primary Card: Bet Panel**
   - Inputs
   - Plan preview
   - Stepper
3. **Secondary Card: Recent Bets**
   - Event-driven list (Hub events)
   - Click-through to `/bets/{betId}`
4. **Secondary Card: Advanced / Help**
   - House edge explanation (maxHouseEdgeBps)
   - VRF fee explanation

## Modules (Component Tree)
- `GamePageShell`
  - `BetPanel` (feature component)
    - `AssetSelector`
    - `AmountInput`
    - `StakeSpecInputs`
    - `GameSpecificInputs` (by slug)
    - `PlanPreview`
    - `TxStepper`
  - `RecentBetsTable`
  - `HelpCard`

## Data Sources
- `ssot-sdk.planPlaceBet()` → PlaceBetPlan
- `ssot-sdk.executePlan()`
- Indexer: Hub events → DomainBet list

## Canonical Game Mapping (MUST)
The page MUST resolve the active game **only** from the embedded release:

1. Read the route slug (`/games/[slug]`).
2. Find `gameMeta = release.gamesMeta.find(g => g.slug === slug)`.
3. If missing:
   - Render a 404/Not Found state.
   - Disable all writes (no plan/execute).
4. If present:
   - Use `gameMeta.gameId` for `Hub.placeBet`.
   - Use `gameMeta.paramsEncoding` to select the correct params form + encoder.
   - Show `gameMeta.label` in the page header.

> **Never** hardcode `gameId` or module addresses in UI.

## Presentation Metadata (MUST)
- Icons, short marketing copy, and other decorative UI metadata MAY come from a governed frontend map keyed by `slug`.
- Presentation metadata MUST NOT override release truth for `gameId`, `module`, `paramsEncoding`, supported assets, or route validity.
- RTP, odds, or payout claims MUST NOT be hardcoded unless they come from a canonical protocol source for the active release.
- If a slug has no governed presentation entry, the page MUST fall back to a generic release-routed presentation instead of inventing protocol facts.

## Inputs Spec (Shared, MUST)

### Asset selector
- Options come from `release.assets[]` (multi-asset ready).
- UI shows: `symbol`, `decimals`, user balance (read-only), and bank address (advanced tooltip).
- Default selection:
  - If URL contains `?asset=<address>`, attempt to preselect it.
  - Else select `release.assets[0]`.
- If `release.assets.length === 0`, the page MUST be read-only with an explicit reason.

### StakeSpec inputs (user-facing)
The BetPanel uses a canonical StakeSpec model:

- `amountPerBet` (human input, decimal string) → `amountPerBetWei: bigint`
- `betCount` (integer)
- `stopGain` (optional, human input) → `stopGainWei: bigint` (0 when empty)
- `stopLoss` (optional, human input) → `stopLossWei: bigint` (0 when empty)

UI MUST display derived totals:
- `totalStakeWei = amountPerBetWei * betCount`
- `amountPerBet` and `totalStake` formatted using the selected asset decimals.

### Affiliate + maxHouseEdgeBps
- `affiliate` input is optional.
  - If URL contains `?ref=<address>`, prefill and persist it (local storage) as the default affiliate.
  - If invalid address, ignore and show a non-blocking warning.
- `maxHouseEdgeBps` is a user tolerance parameter.
  - Default MUST be computed as: `affiliateHouseEdgeBps(affiliate) + bufferBps`, with `bufferBps = 50`.
  - Clamp MUST be applied: `min=100`, `max=10_000`.
  - Advanced: allow override via an “Advanced” section, but always show the final bps value in the Plan preview.

> Rationale: too-low tolerances cause avoidable reverts; the default should be “computed + small buffer”, not an arbitrary constant.

## Game Params Spec (per slug, MUST)

### Dice (`slug=dice`)
- UI control: integer input + slider.
- Canonical model: `{ cap: number }`.
- Encoding: `abi.encode(uint8 cap)`.
- Validation:
  - `cap` MUST be an integer.
  - `1 <= cap <= 255` (uint8 bound).
  - UI SHOULD warn (non-blocking) if cap is outside typical safe ranges (e.g. `< 2` or `> 98`).
- Default: `cap = 50`.

### Coin Toss (`slug=coin-toss`)
- UI control: segmented toggle “Heads / Tails”.
- Canonical model: `{ isHeads: boolean }`.
- Encoding: `abi.encode(bool isHeads)`.
- Validation: none beyond boolean.
- Default: `isHeads = true`.

### Roulette (`slug=roulette`)
- UI control (v1): 40-bit legacy mask picker.
  - Present a 40-cell grid/toggles. Each toggle sets one bit in `mask`.
  - UI labels MAY be domain-specific (0–36 + specials) but the underlying encoding MUST be a uint40 bitmask.
- Canonical model: `{ mask: bigint }`.
- Encoding (v1 MUST): `abi.encode(uint40 legacyMask)`.
- Validation:
  - `mask` MUST be non-zero.
  - `0 <= mask < 2^40`.
  - UI SHOULD show `selectedCount` and enforce a reasonable max selection count if desired.
- Default: select a single bit (e.g. bit 0) so mask is non-zero.

### Keno (`slug=keno`)
- UI control: number picker mapped to a 40-bit mask (same representation constraints as Roulette).
- Canonical model: `{ mask: bigint }`.
- Encoding: `abi.encode(uint40 numbersPacked)`.
- Validation:
  - `mask` MUST be non-zero.
  - `0 <= mask < 2^40`.
  - UI SHOULD limit pick count (e.g. 1–10) and warn when exceeded.
- Default: pick a minimal valid set (non-zero mask).

## Interaction Flow (MUST)
1. User enters inputs
2. UI calls `planPlaceBet()`
3. UI displays:
   - stake (ERC20)
   - vrfFee (native)
   - spender (bank)
   - maxHouseEdgeBps
4. UI runs preflight simulate before each step
5. User signs transactions via stepper
6. On receipt, UI **MUST** reconcile `txHash → betId` (ADR-023) and show a stable bet link

### Stepper Contract (MUST)
- Stepper state machine is standardized (ADR-022):
  `Idle → Planning → NeedsApproval | Ready → Submitting → Mined → Reconciled | Failed`
- If the tx is mined but betId is not found, UI **MUST** enter `Mined but Unreconciled` and provide a retry/manual-bind entry.

### Validation (MUST)
- Amounts are `bigint` internally (ADR-025)
- StakeSpec must be validated:
  - `amountPerBetWei > 0`
  - `betCount >= 1`
  - `betCount` MUST be bounded by a UI limit (default `<= 100`) to prevent accidental large multi-bet submissions.
    - If a release-specific limit exists, UI SHOULD use it instead of the default.
  - `stopGain, stopLoss >= 0`
  - `totalStake` MUST fit safe bigint arithmetic (no overflow in JS bigint)
- Game params must validate to module encoding:
  - Dice cap fits `uint8`
  - Roulette/Keno masks fit `uint40`

### Plan Preview (MUST)
The preview area MUST show (before signing):
- `asset` (symbol + address)
- `amountPerBet` (human) and `totalStake` (human)
- `betCount`
- `bank` spender (address)
- `allowance` and whether approval is needed
- `approveAmount` (if any)
- `vrfFee` and `msg.value`
- `maxHouseEdgeBps`
- `affiliate` (if any)

## States
- Read-only: plan/execute disabled, show banner reason
- Error: DomainError displayed inline
- Loading: skeletons for plan and recent bets
- Empty: if no recent bets, show empty state

## Telemetry
- `bet_plan_generated`
- `bet_step_executed` (approve/place)
- `bet_failed` (DomainError code)

## Acceptance Criteria
- No direct ABI import in page
- Approve target is **bank** (never hub), and approval semantics follow `ADR-024`:
  - default is **exact approve** to `stake` (not delta)
  - tokens that require reset MUST use `approve(0) -> approve(stake)`
- `msg.value` equals VRF fee from hub quote
- Recent bets show correct state transitions

## Non-Goals
- Page must not infer gameId or module addresses. It must use `release.gamesMeta` as truth.
