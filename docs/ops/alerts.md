# Alert rules inventory (Milestone 4)

This document turns `docs/ops/metrics.md` into a **minimal, actionable alert set**.
It is intentionally stack-agnostic: implement it in Prometheus, Datadog, a log pipeline, or a custom indexer.

**Rule:** every alert MUST map to a concrete operator action. If there is no runbook step, remove the alert.

## Severity levels

- **SEV0 (page):** funds at risk, protocol-wide outage, governance/security event, or a design invariant being violated in practice.
- **SEV1 (urgent):** sustained degradation with clear user impact, but no immediate evidence of funds at risk.
- **SEV2 (ticket):** anomaly worth investigating; may become urgent if it persists or clusters around a release.

## Global conventions

- Prefer alerts derived from **events** (high signal, low polling). Use **reads** for sanity checks (ETH balances, paused flags).
- Alerts MUST be labeled by `chainId`. If you support multiple assets, add `asset` and `bank` labels where actionable.
- **Maintenance windows:** suppress SEV1/SEV2 during explicitly scheduled maintenance, but NEVER suppress SEV0 governance/security alerts.
- **Release regression sensitivity:** for 2 hours after a production deploy/tag, lower SEV2 thresholds on VRF + refundCredit to catch regressions.

## Alert catalog

The “Query” fields are **pseudocode** (PromQL-like). Implement with your monitoring stack of choice.

### A. Core throughput & liveness

**ALERT-A5-INFLIGHT-GROWTH (SEV1)**
- Trigger: `bets_in_flight` increases monotonically for 15 minutes AND `bets_finalized_total` rate is below baseline.
- Query (pseudo): `deriv(bets_in_flight[15m]) > 0 AND rate(bets_finalized_total[5m]) < FINALIZE_MIN`
- Action: follow **Game finalization stalls / diff anomalies** runbook: `docs/ops/runbooks/game-finalization-diffs.md`

**ALERT-A5-INFLIGHT-HIGH (SEV0)**
- Trigger: `bets_in_flight` exceeds a chain capacity ceiling (set per chain).
- Query (pseudo): `bets_in_flight > INFLIGHT_MAX`
- Action: `docs/ops/runbooks/game-finalization-diffs.md` (containment includes pausing risk-in if needed)

### B. VRF health & latency

**ALERT-B4-HUB_CALLBACK_FAILED (SEV0)**
- Trigger: any `vrf_hub_callback_failed_total` increment.
- Query: `increase(vrf_hub_callback_failed_total[5m]) > 0`
- Action: **VRF + refundCredit (v1.2)** runbook: `docs/ops/runbooks/vrf-refundcredit.md` (Playbook C)

**ALERT-B6-VRF_BACKLOG_GROWING (SEV1)**
- Trigger: `vrf_pending_requests` rising steadily for 10 minutes.
- Query (pseudo): `deriv(vrf_pending_requests[10m]) > 0 AND vrf_pending_requests > PENDING_MIN`
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (Playbook A)

**ALERT-B5-VRF_LATENCY_SLA (SEV1 → SEV0)**
- Trigger: p95 latency exceeds SLA for 15 minutes (SEV1); p99 exceeds 2×SLA for 10 minutes (SEV0).
- Query (pseudo): `histogram_quantile(0.95, vrf_request_latency_seconds) > SLA_95` (SEV1)
- Query (pseudo): `histogram_quantile(0.99, vrf_request_latency_seconds) > 2*SLA_99` (SEV0)
- Action: `docs/ops/runbooks/vrf-refundcredit.md`

**ALERT-B3-VRF_IGNORED_NONZERO (SEV2)**
- Trigger: any `vrf_ignored_total` increment.
- Query: `increase(vrf_ignored_total[1h]) > 0`
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (configuration sanity checks)

### C. VRF fee accounting & refundCredit (v1.2)

**ALERT-C4-REFUND_FAILED_SPIKE (SEV2 → SEV1)**
- Trigger: refund failures appear (SEV2) or spike around a release (SEV1).
- Query (pseudo): `increase(vrf_fee_refund_failed_total[1h]) > 0` (SEV2)
- Escalate to SEV1 if: `increase(vrf_fee_refund_failed_total[10m]) > REFUND_FAIL_SPIKE`
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (refundCredit playbook)

**ALERT-C6-REFUND_CREDIT_OUTSTANDING_SPIKE (SEV1)**
- Trigger: `refund_credit_outstanding_estimate` increases sharply, especially after a release.
- Query (pseudo): `increase(refund_credit_outstanding_estimate[30m]) > OUTSTANDING_SPIKE`
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (claim path verification + UX comms)

**ALERT-C6-REFUND_CREDIT_STUCK (SEV2)**
- Trigger: outstanding grows for 24h with near-zero claims.
- Query (pseudo): `increase(refund_credit_outstanding_estimate[24h]) > 0 AND increase(vrf_refund_claimed_total[24h]) == 0`
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (communications + known-contract-payer analysis)

### D. Solvency / reserve safety

**ALERT-D1-BANK_NAV_DROP (SEV0)**
- Trigger: `bank_total_assets` drops by more than X% within Y minutes without an approved operation.
- Query (pseudo): `((bank_total_assets - bank_total_assets offset 5m) / bank_total_assets offset 5m) < -NAV_DROP_PCT`
- Action: **Bank solvency** runbook: `docs/ops/runbooks/bank-solvency.md` (containment includes pausing risk-in)

**ALERT-D2-RESERVE_RATIO_CRITICAL (SEV0)**
- Trigger: derived reserve approaches NAV (liquidity crunch risk).
- Query (pseudo): `bet_reserved_total / bank_total_assets > RESERVE_RATIO_MAX`
- Action: `docs/ops/runbooks/bank-solvency.md`

**ALERT-D4-FEE_ACCRUAL_ZERO (SEV2)**
- Trigger: protocol fee accrual unexpectedly drops to zero (possible misconfiguration).
- Query (pseudo): `rate(protocol_fee_accrual_total[30m]) == 0 AND rate(bets_finalized_total[30m]) > 0`
- Action: `docs/ops/runbooks/pause-config-drift.md` (configuration drift checks)

### E. Pause / config drift / governance safety

**ALERT-E4-GOVERNANCE_CHANGE (SEV0)**
- Trigger: any governance transfer started or completed.
- Query: `increase(governance_changes_total[5m]) > 0`
- Action: `docs/ops/runbooks/pause-config-drift.md` (security escalation path)

**ALERT-E1-RISK_PAUSE_TOGGLED (SEV1)**
- Trigger: pause toggled (expected only during incidents/maintenance).
- Query: `changes(risk_in_paused[10m]) > 0` (or event-driven on `RiskInPausedSet`)
- Action: `docs/ops/runbooks/pause-config-drift.md`

**ALERT-E2-REFUND_TIMEOUT_CHANGED (SEV1)**
- Trigger: refund timeout changed outside approved window.
- Query: event-driven on `RefundTimeoutSet`
- Action: `docs/ops/runbooks/pause-config-drift.md`

**ALERT-E3-MODULE_REGISTRY_CHANGED (SEV1)**
- Trigger: any new game/module registered.
- Query: event-driven on `GameRegistered`
- Action: `docs/ops/runbooks/pause-config-drift.md`

### F. ETH balance sanity (adapter invariants operationalized)

**ALERT-F1-HUB_ETH_NONZERO (SEV1 → SEV0)**
- Trigger: Hub holds ETH beyond dust for > 10 minutes.
- Query (pseudo): `hub_eth_balance > HUB_DUST for 10m` (SEV1); escalate if `hub_eth_balance > HUB_ETH_MAX` (SEV0)
- Action: `docs/ops/runbooks/game-finalization-diffs.md` (also check release artifacts for config drift)

**ALERT-F2-VRFHUB_ETH_NONZERO (SEV1)**
- Trigger: VRFHub holds ETH beyond dust for > 10 minutes.
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (fee/refund path sanity)

**ALERT-F3-ADAPTER_ETH_NONZERO (SEV1)**
- Trigger: Adapter holds ETH beyond dust for > 10 minutes.
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (adapter forwarding sanity)

**ALERT-F4-WRAPPER_BALANCE_DEVIATION (SEV2)**
- Trigger: wrapper ETH balance deviates materially from expected charged-fee regime (operator-defined).
- Action: `docs/ops/runbooks/vrf-refundcredit.md` (provider/config sanity)

### G. SportsHub sportsbook operations

**ALERT-G1-SPORTS_ODDS_REJECT_SPIKE (SEV1)**
- Trigger: failed `placeTicket` transactions spike with `BadOddsSignature`, `OddsExpired`,
  `BadOddsSnapshot`, or odds `riskHash` mismatch.
- Query (pseudo): `increase(sports_ticket_reverts_total{reason=~"BadOddsSignature|OddsExpired|BadOddsSnapshot"}[5m]) > ODDS_REJECT_SPIKE`
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook A)

**ALERT-G2-SPORTS_RISK_CAP_REVERT_SPIKE (SEV1)**
- Trigger: failed `placeTicket` transactions spike with stake/payout/exposure cap errors.
- Query (pseudo): `increase(sports_ticket_reverts_total{reason=~"StakeTooLarge|PayoutTooLarge|.*ExposureExceeded"}[10m]) > RISK_CAP_REVERT_SPIKE`
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook C)

**ALERT-G3-SPORTS_EXPOSURE_NEAR_CAP (SEV1 -> SEV0)**
- Trigger: market/outcome/event reserved exposure exceeds an operator threshold below the on-chain cap.
- Query (pseudo): `sports_exposure_reserved / sports_exposure_cap > SPORTS_EXPOSURE_WARN_RATIO`
- Escalate to SEV0 if exposure keeps rising while the market remains open.
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook C)

**ALERT-G4-SPORTS_RESULT_FINALITY_STUCK (SEV1)**
- Trigger: `ResultProposed.finalizesAt` elapsed plus SLA, but `ResultFinalized` has not occurred.
- Query (pseudo): `sports_result_finality_pending_seconds > SPORTS_RESULT_FINALITY_SLA`
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook B)

**ALERT-G5-SPORTS_RESULT_CHALLENGED (SEV1 -> SEV0)**
- Trigger: any `ResultChallenged` event.
- Query: `increase(sports_results_challenged_total[5m]) > 0`
- Escalate to SEV0 for high-liability markets or suspected data-provider compromise.
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook B)
- Clear only after `ResultChallengeResolved` is emitted with an approved decision hash and the market is
  either resolved, reopened for a fresh quorum result, or voided.

**ALERT-G6-SPORTS_ORACLE_CONFIG_CHANGED (SEV0)**
- Trigger: `OddsSignerSetHashSet`, `OddsSignerSet`, `ResultReporterSetHashSet`, `ResultReporterSet`,
  `ResultReporterThresholdSet`, `ResultChallengerSet`, or `ResultArbitratorSet` outside an approved
  governance window.
- Query: `increase(sports_oracle_config_changes_total[5m]) > 0`
- Action: `docs/ops/runbooks/sportsbook-ops.md` and `docs/ops/runbooks/pause-config-drift.md`

**ALERT-G7-SPORTS_RISK_LIMITS_CHANGED (SEV0)**
- Trigger: any `RiskLimitsSet` or `PoolRiskLimitsSet` outside an approved governance window.
- Query: `increase(sports_risk_limits_changes_total[5m]) > 0`
- Action: `docs/ops/runbooks/sportsbook-ops.md` (Playbook C); confirm odds snapshots rotate to the new
  per-pool `riskHash`.
