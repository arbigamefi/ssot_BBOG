# Monitoring metrics inventory (Milestone 4)

This document defines the **minimum on-chain monitoring surface** required to operate the SSOT protocol in production.
It is intentionally **contract-first** (events + simple view calls) so it can be implemented with any stack:
Substreams, The Graph, custom indexers, or centralized log pipelines.

## Principles

- Prefer **events** over storage reads for high-volume signals.
- Use **storage reads** for low-frequency health checks (balances, paused flags, credit totals).
- Every alert should map to an actionable runbook step (see `docs/ops/runbooks/`).
- Alert rules inventory: `docs/ops/alerts.md`
- Incident templates: `docs/ops/incident-templates.md`

## Data sources

### Primary events

From `IHub`:
- `BetPlaced`
- `BetRandomReady`
- `BetFinalized`
- `BetRefunded`
- `GameRegistered`
- `RiskInPausedSet`
- `RefundTimeoutSet`

From `IVRFHub` / `VRFHub`:
- `Requested`
- `Detached`
- `VRFFeeCharged`
- `VRFFeeRefundClaimed`
- `Fulfilled`
- `Ignored`
- `HubCallbackFailed`

From `IBank`:
- `BetHeld`
- `BetSettled`
- `BetRefunded` (bank-side)

From `ISportsHub`:
- `MarketCreated`
- `MarketStateSet`
- `OddsSignerSetHashSet`
- `OddsSignerSet`
- `ResultReporterSetHashSet`
- `ResultReporterThresholdSet`
- `ResultReporterSet`
- `TicketPlaced`
- `ResultProposed`
- `ResultChallenged`
- `ResultChallengeResolved`
- `ResultFinalized`
- `TicketSettled`
- `TicketRefunded`
- `TicketVoided`

From `SportsRiskEngine`:
- `RiskLimitsSet`
- `PoolRiskLimitsSet`

From `Governable`:
- `GovernanceTransferStarted`
- `GovernanceTransferred`

From `ChainlinkV2PlusWrapperAdapter`:
- `VRFHubSet`

### Low-frequency view calls

- `VRFHub.refundCreditOf(payer)` (spot checks / sampling; do **not** iterate all payers on-chain)
- `Bank.totalAssets()` (NAV proxy / sanity)
- `Bank.riskInPaused()` and `Hub.riskInPaused(asset)`
- `SportsHub.marketReserved(marketId)`, `marketOutcomeReserved(marketId,outcomeId)`,
  `poolEventReserved(poolId,eventId)`, `eventReserved(eventId)` aggregate
- `SportsHub.oddsSignerSetHash()`, `resultReporterSetHash()`, `resultReporterThreshold()`
- `SportsRiskEngine.limits()`, `limitsForPool(poolId)`, `currentRiskHashForPool(poolId)`
- `address(Hub).balance`, `address(VRFHub).balance`, `address(Adapter).balance` (should be ~0 by design)

---

## Metric set

The list below is the **minimum** recommended inventory. Add labels only where they improve actionability.

### A. Core throughput & liveness

**A1. bets_placed_total** (counter)  
Source: `IHub.BetPlaced`  
Labels: `asset`, `gameId`, `bank`

**A2. bets_random_ready_total** (counter)  
Source: `IHub.BetRandomReady`  
Labels: `asset`, `gameId`, `bank`

**A3. bets_finalized_total** (counter)  
Source: `IHub.BetFinalized`  
Labels: `asset`, `gameId`, `bank`

**A4. bets_refunded_total** (counter)  
Source: `IHub.BetRefunded`  
Labels: `asset`, `gameId`, `bank`  
Notes: includes refund-timeout and any other refund path.

**A5. bets_in_flight** (gauge; derived)  
Compute: `placed - finalized - refunded` over a moving window (or track bet states in the indexer).  
Alert suggestion:  
- warn if rising steadily for > 15 min  
- page if exceeds an absolute threshold (set per chain capacity)

---

### B. VRF health & latency

**B1. vrf_requests_total** (counter)  
Source: `IVRFHub.Requested`  
Labels: `hub`

**B2. vrf_fulfilled_total** (counter)  
Source: `VRFHub.Fulfilled`  
Labels: `hub`

**B3. vrf_ignored_total** (counter)  
Source: `VRFHub.Ignored`  
Alert suggestion: non-zero should be investigated (unexpected transport / late fulfill).

**B4. vrf_hub_callback_failed_total** (counter)  
Source: `VRFHub.HubCallbackFailed`  
Alert suggestion: **page immediately** if non-zero (should be near-impossible in the design).

**B5. vrf_request_latency_seconds** (histogram; derived)  
Compute: time delta between `Requested(requestId)` and `Fulfilled(requestId)` (or between `BetPlaced` and `BetRandomReady`).  
Alert suggestion:
- warn at p95 > X seconds (chain-dependent)
- page if p99 exceeds SLA for sustained interval

**B6. vrf_pending_requests** (gauge; derived)  
Compute: count of `Requested - (Fulfilled + Detached + Ignored)` over window.

---

### C. VRF fee accounting & refundCredit (v1.2)

**C1. vrf_fee_paid_total** (counter; sum)  
Source: `IVRFHub.VRFFeeCharged.paid`  
Labels: `payer`, optional (consider sampling or hashing payer to avoid cardinality blowup)

**C2. vrf_fee_charged_total** (counter; sum)  
Source: `IVRFHub.VRFFeeCharged.charged`

**C3. vrf_fee_refund_due_total** (counter; sum)  
Source: `IVRFHub.VRFFeeCharged.refundDue`

**C4. vrf_fee_refund_failed_total** (counter)  
Source: `IVRFHub.VRFFeeCharged` where `refundSucceeded == false`  
Alert suggestion:
- warn if > 0 (often indicates payers are smart contracts rejecting ETH)

**C5. vrf_refund_claimed_total** (counter; sum)  
Source: `IVRFHub.VRFFeeRefundClaimed.amount`

**C6. refund_credit_outstanding_estimate** (gauge; derived)  
Compute: `sum(refundDue where refundSucceeded=false) - sum(refundClaimed)` from events.  
Notes: this is an indexer-side estimate; storage reads (`refundCreditOf`) can be used for spot verification.

Alert suggestion:
- warn if outstanding grows monotonically without corresponding claims (UX issue)
- page if outstanding spikes after a release (regression indicator)

---

### D. Solvency / reserve safety (SSOT accounting surfaces)

These metrics do **not** replace the on-chain invariants, but they help operators detect abnormal regimes fast.

**D1. bank_total_assets** (gauge)  
Source: `Bank.totalAssets()` per bank (poll at low frequency, e.g., 1–5 min)  
Labels: `asset`, `bank`  
Alert suggestion:
- page if drops sharply without corresponding expected withdrawals / payouts

**D2. bet_reserved_total** (gauge; derived)  
Compute: sum of `BetHeld.reserved` minus released amounts inferred from `BetSettled` / refunds.  
Labels: `asset`, `bank`  
Alert suggestion:
- page if reserved approaches total assets (liquidity crunch)

**D3. payout_gross_total / payout_net_total** (counter; sum)  
Source: `IBank.BetSettled.payoutGross`, `payoutNet`  
Labels: `asset`, `bank`, `gameId` (if you can join with betId->gameId from `BetPlaced`)

**D4. protocol_fee_accrual_total** (counter; sum)  
Source: `IHub.BetFinalized.protocolFeeAccrual` or `IBank.BetSettled.protocolFeeAccrual`  
Alert suggestion: unexpected drops to zero may indicate misconfiguration.

---

### E. Pause / config drift / governance safety

**E1. risk_in_paused** (gauge)  
Source: `Hub.riskInPaused(asset)` or `IHub.RiskInPausedSet` events  
Alert suggestion: page on pause toggles (expected only during incidents / maintenance)

**E2. refund_timeout_seconds** (gauge)  
Source: `IHub.RefundTimeoutSet` events (track latest value)  
Alert suggestion: page on changes outside approved windows.

**E3. module_registry_changes_total** (counter)  
Source: `IHub.GameRegistered`  
Alert suggestion: page on any change (should be rare; governance change control)

**E4. governance_changes_total** (counter)  
Source: `Governable.GovernanceTransferStarted/Transferred`  
Alert suggestion: page immediately.

---

### F. ETH balance sanity (adapter invariants operationalized)

These are lightweight checks that mirror the **adapter ETH/credit invariants** at runtime.

**F1. hub_eth_balance** (gauge)  
Source: `eth_getBalance(Hub)`  
Alert: warn if > dust threshold; page if sustained or growing.

**F2. vrfhub_eth_balance** (gauge)  
Source: `eth_getBalance(VRFHub)`  
Alert: should be near 0 except transient; page if sustained.

**F3. adapter_eth_balance** (gauge)  
Source: `eth_getBalance(Adapter)`  
Alert: should be near 0; page if sustained.

**F4. vrf_wrapper_eth_balance** (gauge)  
Source: `eth_getBalance(Wrapper)`  
Interpretation: should track **charged fees**; large deviations should be investigated together with `vrf_fee_charged_total`.

---

### G. SportsHub sportsbook operations

These metrics apply to v1.3 Sports pools and map to `docs/ops/runbooks/sportsbook-ops.md`.

**G1. sports_tickets_placed_total** (counter)
Source: `ISportsHub.TicketPlaced`
Labels: `poolId`, `marketId`, `eventId`, `outcomeId`
Notes: avoid player labels in high-cardinality monitoring systems.

**G2. sports_tickets_terminal_total** (counter)
Source: `TicketSettled`, `TicketRefunded`, `TicketVoided`
Labels: `poolId`, `marketId`, terminal type
Use with `G1` to derive held Sports tickets.

**G3. sports_exposure_reserved** (gauge)
Source: derived from `TicketPlaced` minus terminal ticket events, with spot reads from
`marketReserved`, `marketOutcomeReserved`, and `poolEventReserved`.
Labels: `poolId`, `marketId`, `eventId`, optional `outcomeId`.

**G4. sports_result_finality_pending_seconds** (gauge)
Source: `ResultProposed.finalizesAt` until `ResultFinalized` or `ResultChallenged`.
Alert when a result remains unfinalized beyond finality plus operator SLA.

**G5. sports_oracle_config_changes_total** (counter)
Source: `OddsSignerSetHashSet`, `OddsSignerSet`, `ResultReporterSetHashSet`,
`ResultReporterThresholdSet`, `ResultReporterSet`, `ResultChallengerSet`, and `ResultArbitratorSet`.
Alert on any change outside an approved window.

**G6. sports_risk_limits_changes_total** (counter)
Source: `SportsRiskEngine.RiskLimitsSet` and `PoolRiskLimitsSet`.
Track new `riskHash` per pool; odds snapshots must use `currentRiskHashForPool(poolId)` after any cap change.

**G7. sports_ticket_reverts_total** (counter; derived from failed tx traces)
Source: failed `placeTicket` transactions grouped by custom error:
`BadOddsSignature`, `OddsExpired`, `BadOddsSnapshot`, `StakeTooLarge`, `PayoutTooLarge`,
`MarketExposureExceeded`, `OutcomeExposureExceeded`, `EventExposureExceeded`.
Alert on spikes by market/event.

---

## Implementation notes (non-normative)

- Avoid high-cardinality labels (`payer`, `player`) in Prometheus-style systems. Prefer:
  - sampling,
  - hashing into buckets,
  - or logs-only pipelines for per-address details.
- Maintain an indexer-side **BetState table** keyed by `betId`:
  - created at `BetPlaced`
  - `randomReady` at `BetRandomReady`
  - finalized at `BetFinalized`
  - refunded at `BetRefunded`
  This enables robust liveness and reconciliation metrics.

---


## Next: alerts & runbooks

- [Alert rules inventory](alerts.md)
- [Incident + postmortem templates](incident-templates.md)

- [VRF + refundCredit (v1.2)](runbooks/vrf-refundcredit.md)
- [Bank solvency / reserve anomalies](runbooks/bank-solvency.md)
- [SportsHub odds, result finality, and exposure caps](runbooks/sportsbook-ops.md)
- [Pause + config drift + governance safety](runbooks/pause-config-drift.md)
- [Game finalization stalls / diff anomalies](runbooks/game-finalization-diffs.md)
