# Roadmap

This roadmap defines **milestones** with measurable acceptance criteria.

## Milestone 0 — SSOT v1.0 baseline (delivered)

**Delivered**
- Bank SSOT accounting (`NAV = B - PF - XP`, `NAV >= R`)
- Hub SSOT bet lifecycle (global betId; permissionless finalize/refund)
- VRFHub fulfill never reverts
- Referral liabilities as XP buckets (accrued/locked/holdback)
- Permissionless unlock (turnover-gated) + rolling linear vesting for holdback
- Skyline pricing + delta budgets (per-bet pricing snapshots)
- Unit tests + invariant baseline (A/B4/C1/C2/D1/E1/P1)

**Acceptance**
- `forge test` passes
- `forge test --match-path test/invariants/*` passes consistently at the PR profile

## Milestone 1.5 — Proof hardening (institution-grade)

This milestone converts the SSOT baseline into an institution-grade proof gate.

**Plan:** see `docs/plan/Milestone-1.5-Proof-Hardening.md`.

**Goals**
- Add reference model differential testing (ADR-0009)
- Complete missing audit-critical invariants + run policy (ADR-0010)
- Add two additional pure game modules without new trust surface (ADR-0011)
- Wire PR vs nightly CI proof gates

**Acceptance**
- PR gate: unit + invariants (~256 runs) + diff (small profile) all pass
- Nightly gate: invariants (≥ 1024 runs) + diff (stateful, multi-seed) are stable

## Milestone 2.0 — Multi-Asset Foundation (base substrate)

This milestone makes multi-asset support a **base property**, per SSOT v1.1 and ADR-0012.

**Plan:** see `docs/plan/Milestone-2.0-MultiAsset-Foundation.md`.

**Goals**
- Support multiple ERC20 assets concurrently
- One immutable `Bank(asset)` per asset (custody + SSOT accounting per asset)
- Single global Hub (global betId namespace) routing to per-asset banks
- Upgrade invariants to run per asset + cross-asset isolation checks

**Acceptance**
- Place/settle/refund bets in at least 2 assets in E2E tests
- A1–A4 and B4 invariants pass **per asset**
- Cross-asset isolation tests pass (no wrong-asset transfers)

## Milestone 2.1 — Multi-Roll Framework (parity substrate)

This milestone upgrades the bet lifecycle to support multi-roll + refund + stopGain/stopLoss, per
SSOT v1.1 and ADR-0013.

**Plan:** see `docs/plan/Milestone-2.1-MultiRoll-Framework.md`.

**Goals**
- StakeSpec (`amountPerRoll`, `betCount`, `stopGain`, `stopLoss`) becomes first-class
- Module resolve returns `usedTurnover` enabling `refundAmount = stake - usedTurnover`
- Canonical RNG expansion is implemented and shared across modules + reference model
- Diff tests upgraded to multi-roll semantics

**Acceptance**
- Unit + E2E tests cover refund and early-stop cases
- Invariants and diff tests remain stable (PR + nightly profiles)

## Milestone 2.2 — Keno module (refactored default parity)

This milestone adds Keno (refactored default N=40, M=10) as a pure SSOT module.

**Plan:** see `docs/plan/Milestone-2.2-Keno-Module.md`.

**Goals**
- Add deterministic Keno module with precomputed gain factors (ADR-0017)
- Add E2E tests and game documentation

**Acceptance**
- `forge test` includes at least one Keno E2E case (hit + fee-on-payout)
- Keno parameters and reserve semantics are documented

## Milestone 2.3 — Charged VRF fee (native) (refactored parity)

This milestone introduces a native-token VRF fee model to match refactored v0.7.8
"多退少补" behavior while preserving SSOT liveness.

**Plan:** see `docs/plan/Milestone-2.3-VRF-Fee-Adapter.md`.

**Goals**
- `Hub.placeBet` becomes payable and requires quoted VRF fee
- Deterministic fee quote endpoint for UIs/SDKs
- Best-effort overpayment refunds with claimable refund credit
- No privileged oracle-fee withdrawal backdoor

**Acceptance**
- All tests updated to pay VRF fees and remain green


## Milestone 2.4 — Chainlink VRF Adapter (Wrapper v2.5+)

This milestone connects SSOT v1.2 charged VRF fee semantics to a real Chainlink VRF request path
(v2.5+ Wrapper), while preserving SSOT axioms (fulfill never reverts; debt-out liveness; no backdoor).

**Plan:** see `docs/plan/Milestone-2.4-Chainlink-Adapter.md`.

**Goals**
- Introduce `IVRFAdapter` + Chainlink wrapper adapter callback-forwarding flow
- Add adapter-mode proof gates:
  - system-level adapter diff (`StatefulSystemDiffAdapter`)
  - adapter ETH/credit invariants (`InvariantsAdapter`)

**Acceptance**
- Unit tests for adapter path pass
- Adapter-mode diff and adapter-mode invariants are stable under PR and nightly profiles

## Milestone 2.5 — Real-network readiness (fork + deploy)

**Goals**
- Prefer official Chainlink libraries where possible (reduce encoding drift)
- Add `test/fork/*` (optional, auto-skip without RPC env) to validate against real wrapper/coordinator addresses
- Add `script/*` deployment + configuration scripts and runbooks (addresses, gas policy, confirmations, callbackGas)
- Generate a release artifact lock (digest + signature) for deployment snapshots
- Document operational parameters and safety checks

**Acceptance**
- `forge test` remains green in local mode
- Fork tests pass when RPC env vars are provided (and are skipped otherwise)
- Deployment runbook produces a reproducible configuration for at least one target network
- Release lock (digest + signature) can be generated and verified offline; tag builds enforce strict presence

## Milestone 2.6 — Additional module expansion (optional)

**Goals**
- Add additional modules beyond the refactored parity set, without new trust surface
- Document reserve upper bounds and deterministic parameter encoding for all modules
- Maintain cross-module invariant and diff-test stability

**Acceptance**
- E2E tests for each new module
- Invariant + diff suites remain stable (PR + nightly profiles)


## Milestone 3 — Full feature parity migration from refactored protocol

**Goals**
- Migrate all economic and gameplay features (multi-roll games, stopGain/stopLoss, referral v2 semantics as needed)
- Maintain SSOT proof gates while closing the migration checklist
- Improve observability (SSOT view + event indexing for monitoring)

**Acceptance**
- Migration checklist in `docs/migration/refactored-mapping.md` is fully satisfied
- Stable invariants and reproducible payout verification for all migrated features

## Milestone 4 — Operational hardening

**Goals**
- CI gating for unit + invariant tests
- Release process (CHANGELOG, tags, reproducible builds, locked artifacts)
- [x] Release bundle includes `frontend-manifest.json` and `golden-vectors.json` (frontend zero-inference + bytes correctness)
- Fork validation as a release gate (real-network sanity)
- Monitoring metrics inventory (contract-first, event + view-call based)
- Alert rules inventory (metrics → actionability)
- Emergency runbooks (VRF, solvency, config drift, finalization)
- Incident + postmortem templates (digest-aware)
- Closeout summary suitable for audit/ops handoff

**Acceptance**
- CI runs on every PR and nightly
- Documented release process and emergency runbooks
- Tag builds enforce a strict release lock and notes consistency (`STRICT=1 make release-check`)
- Tag builds also enforce fork validation (`test/fork/*`) for the target chain (ADR-0023)
- Release handoff artifact can be produced as a single archive (`make release-package`)
- Audit handoff bundle can be produced as a single archive (`make audit-package`)
- Monitoring metrics inventory is published (`docs/ops/metrics.md`)
- Alert rules inventory is published (`docs/ops/alerts.md`)
- Incident + postmortem templates are published (`docs/ops/incident-templates.md`)
- Ops runbooks are published:
  - VRF + refundCredit (`docs/ops/runbooks/vrf-refundcredit.md`)
  - Bank solvency (`docs/ops/runbooks/bank-solvency.md`)
  - Pause + config drift (`docs/ops/runbooks/pause-config-drift.md`)
  - Game finalization/diff anomalies (`docs/ops/runbooks/game-finalization-diffs.md`)
- Closeout summary is published (`docs/closeout/README.md`)