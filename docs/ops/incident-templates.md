# Incident response templates (Milestone 4)

This directory is intentionally **process-first**: incidents should be handled with reproducible artifacts,
not ad-hoc chat logs.

Use these templates for:
- live incident handling (status updates, actions, evidence)
- post-incident review (root cause, prevention, follow-ups)

> Always record the **release digest** (from `deployments/release-latest.json`) and the exact **block range**
> where the incident occurred.

---

## Severity guide (suggested)

- **SEV0:** funds at risk, protocol-wide outage, governance/security event, or `HubCallbackFailed` observed.
- **SEV1:** significant user impact (stuck bets, high VRF backlog) with no current evidence of funds at risk.
- **SEV2:** anomaly requiring investigation (refund failures, fee/accounting drift signals).

---

## Live incident log template (copy/paste)

**Incident ID:** INC-YYYYMMDD-<short>  
**Started (UTC):**  
**Detected by:** (alert id / user report / partner)  
**Severity:** SEV0 / SEV1 / SEV2  
**Status:** investigating / mitigating / monitoring / resolved  

### Scope
- **ChainId(s):**
- **Affected assets/banks:**
- **Contracts (from snapshot):**
  - hub:
  - gameHub / sportsHub:
  - vrfHub:
  - adapter:
  - vrfWrapper:
- **Deployment snapshot:** `deployments/snapshots/deploy-<chainId>-<block>.json`
- **Release digest:** `0x...` (from `deployments/release-latest.json` or `deployments/release-latest-v13.json`)
- **Release tag (if any):** vX.Y.Z

### Impact
- User symptoms:
- Bets affected (estimate):
- Funds at risk? (yes/no/unknown):
- Is risk-in currently paused? (yes/no):

### Fast triage (5 minutes)
- Which alert(s) fired? (from `docs/ops/alerts.md`)
- Key metrics now:
  - A5 bets_in_flight:
  - B6 vrf_pending_requests:
  - B5 latency p95/p99:
  - C6 refund_credit_outstanding_estimate:
  - D1 bank_total_assets:
  - G3 sports_exposure_reserved:
  - G4 sports_result_finality_pending_seconds:
- Hypothesis (initial):

### Actions (ordered, with evidence)
Record every on-chain action with signer + tx hash.

| Time (UTC) | Actor | Action | Tx hash | Result |
|---|---|---|---|---|
| | | | | |

### Evidence bundle
- **Block range:** startBlock–endBlock
- **Sample betIds / requestIds:** (list)
- **Relevant events:** (queries or links)
- **Reverts / revertData:** (if any)
- **Release artifacts:** attach `dist/ssot-<tag>-<digestPrefix>.tar.gz` or link to it.

### Communications
- Public status page link (if used):
- Partner comms (if any):
- Customer support notes:

### Resolution
- What changed that resolved the incident?
- When did metrics return to baseline?
- What remains to verify?

---

## Postmortem template (copy/paste)

**Incident ID:**  
**Date:**  
**Severity:**  
**Owners:**  
**Customer impact:**  

### Summary (5 lines)
What happened, why it mattered, and what we changed.

### Timeline (UTC)
| Time | Event |
|---|---|
| | |

### Root cause
- Direct cause:
- Contributing factors:
- Why did controls not catch it earlier?

### Detection & response quality
- What worked well?
- What was slow or unclear?
- Any missing dashboards/alerts/runbooks?

### Corrective actions
Classify each action as **code**, **tests/proofs**, **docs/process**, or **ops tooling**.

| Action | Type | Owner | Due date | Tracking link |
|---|---|---|---|---|
| | | | | |

### Prevention / hardening plan
- Add/strengthen invariants or diffs? (point to test files)
- Update `docs/ops/alerts.md` thresholds?
- Update runbooks?

### Release-level notes
- Release digest:
- Snapshot file:
- Any configuration changes (pause/refundTimeout/module registry):
- Any chain/environment specific factors:

