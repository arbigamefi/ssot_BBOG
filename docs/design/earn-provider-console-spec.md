# Earn Provider Console Spec — `/earn`

| Owner    | Product + Frontend                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Draft — design spec, no code yet                                                                                                                                                                               |
| Date     | 2026-06-07                                                                                                                                                                                                     |
| Priority | Slice #5 (roadmap Phase 5 — bankroll providers)                                                                                                                                                                |
| Extends  | `frontend-product-ui-ux-roadmap-2026-06-07.md` §9; `frontend-product-ui-ux-audit-2026-06-07.md` §4; `go-to-market.md` (provider narrative)                                                                     |
| Scope    | The `/earn` provider console: hero metrics, performance panel, reserve/risk diligence, deposit/withdraw console, provider ledger. Data-integrity correctness is the core of this slice — not a layout rebuild. |

**Headline judgment.** `/earn` is **already a genuine due-diligence console**, not a
card stack. The roadmap's structural asks are largely met: metrics lead, a
deposit/withdraw two-tab console with assets/shares modes exists, reserve/risk
live in tabs, and a durable provider ledger is wired. The launch-blocking work is
**integrity-labeling correctness after the V14 upgrade** (which moved turnover /
payout / P&L on-chain), plus drawdown surfacing, a deliberate pre-launch empty
state, and mobile action reachability. This spec is precise about those, and does
**not** propose a redesign.

---

## 1. Current State (what already ships)

Source: `app/(product)/earn/pageClient.tsx`, `features/earn/*`.

- **`EarnHero`** — eyebrow + H1 (`用 USDC 当庄`) + `BankSnapshot` (bank address with
  verifiable shield + 4 metrics: share price, total shares, velocity, hold) +
  description + a `disclosure` line.
- **`BankrollPerformancePanel`** — lead figure **House P&L** (`totalTurnover −
totalPayoutGross`), stat rows (hold, velocity, wagered, payout, bets), a
  window toggle (24h/7d/30d/all), and a cumulative **equity chart** with
  peak/trough.
- **Diligence tabs** — `EarnBankSummary` (reserve / capital posture) and
  `EarnRiskPanel` (custody, withdrawal buffer, liquidity floor, protocol
  payables, release digest), each badged with a "read model" tag.
- **`EarnActionPanel`** — sticky deposit/withdraw console: `tab` (deposit/withdraw)
  × `amountMode` (assets/shares) → deposit/mint/withdraw/redeem flows, with
  available-balance label, Max, disabled reasons, and toast feedback.
- **`BankProviderLedgerPanel`** — the connected provider's deposit/withdraw
  history, reconstructed from share mint/burn + asset transfers (durable, not an
  ad hoc log scan).

All money figures read from `sdk.bank.getSnapshot(poolId)` (chain) and
`getPosition` (chain). The daily chart reads an indexed timeseries
(`useCasinoTimeseries`, postgres).

## 2. Current Problems (evidence-based)

### 2.1 🔴 Integrity disclosure contradicts the data (post-V14 mislabel)

`earn.hero.disclosure` (zh `common.json:2671`):

> 储备数值直接读取 Bank 合约;**表现指标来自索引估算,可能存在延迟**。

But after the V14 upgrade, House P&L / hold / velocity / wagered / payout / bets
all come from `Bank.getSnapshot` on-chain and are tagged
`earn.performance.onChain` = `链上可验证`. The panel's own
`earn.performance.note` (`:2881`) already states this correctly ("Lifetime 毛博彩
收入来自 Bank.getPerformance() 链上直读 … 下方每日曲线来自索引"). So the hero
disclosure is **stale and self-contradictory** — it tells a provider that
verifiable, chain-read figures are "indexed estimates that may lag." For the
hard-side (provider) audience this is the worst direction to err: it understates
trust in exactly the numbers the page exists to prove. **GTM red line.**

### 2.2 🟠 Window toggle implies it scopes the headline, but it only scopes the chart

In `BankrollPerformancePanel`, the 24h/7d/30d/all toggle lives in the panel header
next to the title, but House P&L / hold / velocity / wagered / payout / bets are
**lifetime** `getSnapshot` totals — they do not change when the window changes.
Only the indexed daily equity chart (`useCasinoTimeseries({ days })`) re-windows.
A provider clicking "24小时" reasonably expects the headline to follow; it does
not. The fine-print note explains it, but placement overrides fine print.

### 2.3 🟠 Drawdown is promised in prose but never surfaced

The audit and roadmap both name **drawdown** as a first-class provider risk
metric. It appears only in hero prose (`…回撤是这门生意的一部分` /
`…drawdowns are part of the risk`). It is never computed or shown. The equity
chart already derives `peak`/`trough` of cumulative P&L — max drawdown is one step
away — but the headline risk view (`EarnRiskPanel`) shows only structural limits
(buffer, liquidity floor, payables), not performance drawdown.

### 2.4 🟡 Pre-launch empty state reads as broken, not intentional

With no betting activity (testnet / pre-launch): share price shows the `1 USDC`
default, total shares `0`, velocity / hold / House P&L render `—`, and the equity
chart is hidden (`points.length === 0`). The screen reads unfinished rather than
"vault is live, no flow yet." Per the roadmap data rule, missing values must not
look like placeholders — they need a deliberate empty state.

### 2.5 🟡 Mobile: the provider's primary action is buried

Decision order on mobile is hero → description + disclosure → performance panel →
diligence tabs → **then** the deposit/withdraw console. A provider whose decision
is "deposit" must scroll past everything to act. Metrics are in the first viewport
(good), but the action is not reachable.

## 3. Target User & Decision (GTM)

**User.** Bankroll provider / DeFi capital allocator (the hard side of the
flywheel).

**Decision.** "Is this vault worth underwriting, and exactly what risk am I
taking?"

**What the first screen must make true.** In one viewport a provider can read:
(1) what one share is worth and how much capital backs the vault, (2) whether the
house is actually ahead (lifetime, verifiable), (3) the structural safety limits,
and (4) how to deposit — without being told a verifiable number is an estimate.

**Provenance is the product here.** Every figure carries an honest tag:
chain-read = `链上可验证`; index-derived = `索引 · 可能延迟`. The two must be
visually distinct and never swapped.

## 4. Information Hierarchy

### 4.1 Desktop

1. Hero: H1 + bank address (verifiable) + lead metrics **share price · reserve ·
   lifetime House P&L · hold** (verifiable).
2. Performance panel: House P&L headline (tagged **Lifetime · 链上可验证**),
   lifetime stat rows, then the **indexed** daily equity chart with its **own**
   window toggle + **max drawdown** (indexed).
3. Two-column: diligence tabs (reserve / risk) on the left; sticky
   deposit/withdraw console on the right.
4. Provider ledger.

### 4.2 Mobile

1. H1 + `BankSnapshot` metrics (already `lg:hidden` inline — keep).
2. **Reachable deposit affordance** (see §5 / §10 open decision).
3. Correct one-line integrity disclosure (verifiable headline vs indexed chart).
4. Performance → diligence tabs → console → ledger.

## 5. Mobile Layout

- Keep the inline `BankSnapshot` metrics directly under H1 (already done).
- **Action reachability:** surface a compact `存入 / 提取` control in the first
  viewport that routes to the console (sticky bar via the shared
  `StickyActionBar`, or a hero-anchored button that scrolls to / focuses the
  console). Resolve in §10.
- No horizontal overflow at 360–430px; long addresses/figures truncate.
- Reuse the shared overlay/sticky tokens from
  `mobile-shell-foundation-spec.md` (no new bottom-anchored pattern).

## 6. Data Integrity Matrix (the core of this slice)

| Figure                                    | Source                         | Tag                     |
| ----------------------------------------- | ------------------------------ | ----------------------- |
| Share price (`assetsPerShare`)            | `getSnapshot` (chain)          | `链上可验证`            |
| Total shares (`totalSupply`)              | chain                          | `链上可验证`            |
| Reserve / vault assets (`totalAssets`)    | chain                          | `链上可验证`            |
| Lifetime turnover (`totalTurnover`)       | chain (V14)                    | `链上可验证 · Lifetime` |
| Lifetime payout (`totalPayoutGross`)      | chain (V14)                    | `链上可验证 · Lifetime` |
| House P&L (`turnover − payout`)           | chain-derived                  | `链上可验证 · Lifetime` |
| Hold % (`P&L / turnover`)                 | chain-derived                  | `链上可验证 · Lifetime` |
| Capital velocity (`turnover / assets`)    | chain-derived                  | `链上可验证 · Lifetime` |
| Bets held (`totalBetsHeld`)               | chain                          | `链上可验证 · Lifetime` |
| Withdrawal buffer / liquidity floor (bps) | chain                          | `链上可验证`            |
| Protocol payables (`protocolFeesPayable`) | chain                          | `链上可验证`            |
| Daily equity curve / volume               | indexed timeseries (postgres)  | `索引 · 可能延迟`       |
| **Max drawdown** (new)                    | derived from indexed daily P&L | `索引 · 可能延迟`       |

**Rule:** every `getSnapshot`-derived figure is verifiable (and lifetime → tag
`Lifetime`); every daily-timeseries figure is indexed. The hero disclosure and
all badges must follow this table exactly.

## 7. Visual Direction

- Tokens only; no hex, no per-asset color (CLAUDE.md). Use
  `surface/fg/border/success/danger`.
- Provenance tags are quiet, consistent chips: verifiable = `success` outline;
  indexed = muted/`fg-subtle` outline. Same shape everywhere (carry the landing
  `IntegrityBadge` pattern).
- House P&L stays a **report figure** (mono, success/danger), never a promotional
  APY tile. Keep current treatment.
- Calm, dense, fund-tearsheet feel. No new card mosaics.

## 8. Concrete Change List (by file)

1. **`i18n .../earn.hero.disclosure` (all 5 locales)** — rewrite to split provenance:
   reserve, share price, lifetime turnover / House P&L / hold / velocity, and
   structural limits are **chain-read (verifiable)**; only the **daily trend chart
   and drawdown** are indexed / may lag. No blanket "performance metrics are
   indexed."
2. **`features/earn/BankrollPerformancePanel.tsx`** —
   - Tag the House P&L headline block and the lifetime stat rows explicitly
     **`Lifetime · 链上可验证`**.
   - Move/relabel the window toggle so it visibly scopes **the daily chart only**
     (e.g., into `VaultEquityChart`'s header), not the lifetime headline.
   - Add **Max drawdown** derived from the cumulative equity series
     (peak-to-trough, integer units), placed with the chart and tagged
     `索引 · 可能延迟`. Hide gracefully when no indexed points exist.
3. **`features/earn/earn-hero.tsx` + pageClient `metrics`** — keep lead metrics as
   share price · reserve · House P&L (lifetime) · hold; ensure the visible
   integrity line is the corrected disclosure; per-metric provenance may surface
   as a small chip rather than tooltip-only `detail`.
4. **Pre-launch empty state** (`BankrollPerformancePanel` + hero metrics) — when
   `totalSupply === 0n` / no turnover, render a deliberate "金库已上线 · 暂无投注
   流水" state (one honest line + what will populate once live), instead of `—`
   rows and a silently hidden chart.
5. **Mobile action reachability** (`pageClient` + `StickyActionBar`) — add the
   first-viewport `存入 / 提取` affordance per §10.
6. **(Verify, likely no change)** `EarnRiskPanel` — confirm buffer / liquidity
   floor / payables all carry the verifiable tag; consider adding current
   **utilization** (assets deployed vs reserve) if derivable from chain, tagged
   accordingly.

No i18n string added without a key; no hex / per-asset color; no `transition-all`;
no native number input or `parseFloat` on asset amounts (advisory RG limits
excepted, already isolated). Within CLAUDE.md hard rules.

## 9. Screenshot Acceptance

| Viewport               | Must be true                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile 390px**       | First viewport: H1 + lead metrics + a reachable `存入/提取` affordance; integrity line correctly splits verifiable vs indexed; no overflow.                                                             |
| **Desktop 1440px**     | Console sticky right; performance + diligence left; House P&L tagged `Lifetime · 链上可验证`; window toggle visibly scopes only the chart; drawdown visible + tagged indexed; no slash-composite cards. |
| **Empty / pre-launch** | Seeded-but-no-activity reads intentional ("金库已上线 · 暂无投注流水"), not broken `—`/blank.                                                                                                           |
| **Connected**          | Deposit & withdraw show wallet balance, available shares, Max, preview, and explicit disabled reasons; toast on submit.                                                                                 |

Captures land in `/tmp/agf-earn-console-2026-06-07/` as `before-*`/`after-*`.

## 10. Open Decision (needs sign-off before code)

**Mobile deposit reachability (§2.5 / change #5):** which affordance?

- **A (recommended): a `StickyActionBar` "存入 / 提取" CTA** that opens the console
  (reuses the shared sticky pattern; consistent with the casino room; thumb-zone).
- **B: a hero-anchored button** that scrolls to / focuses the console (lighter, no
  persistent chrome, but less reachable after scrolling).

Everything else in this spec is non-controversial integrity/correctness work and
can start on approval.
