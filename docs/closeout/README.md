# Closeout summary (Milestone 4)

This document is a **one-page handoff** that ties together:

- **Normative SSOT (v1.2)**
- **Executable proofs** (invariants + differential tests + CI gates)
- **Real-network readiness** (fork validation + deploy scripts + verify helpers)
- **Release discipline** (locked artifacts + digest/signature + notes + packaging)
- **Operational hardening** (metrics → alerts → runbooks → incident templates)

If you only read one document before an audit/ops handoff, read this.

---

## What is “done” in this repository

### Protocol correctness (institution-grade)
- **SSOT constitution (v1.2)** is the normative spec: `docs/constitution/SSOT.v1.2.md`.
- **Executable SSOT (v1.2)** is the proof spec enforced by tests: `docs/constitution/ExecutableSSOT.v1.2.md`.
- **Proof gates** are not advisory: PR + nightly CI run unit/diff/invariants and must pass.

### Real-network readiness
- **Fork tests** exist under `test/fork/*`.
  - Local/dev: auto-skip when RPC env is absent.
  - Release tags: **fork tests are mandatory gates** (ADR-0023 + release CI).
- **Deploy scripts + runbooks** are in `script/*` and `docs/deploy/*`.
- Deploy produces **audit-friendly artifacts**:
  - `deployments/latest.json` (snapshot)
  - `deployments/verify-latest.sh` (verify helper)

### Release discipline (reproducible + non-repudiable)
- Release lock: **digest + signature** (`deployments/release-latest.json`).
- Release notes MUST include the digest.
- Tag builds enforce **STRICT** checks (`STRICT=1 make release-check`).
- Required frontend artifacts:
  - `deployments/frontend-manifest-latest.json`
  - `deployments/golden-vectors-latest.json`
- Optional: release bundle archive (`make release-package`).

### Operations (metrics → alerts → runbooks → incidents)
- Metrics inventory: `docs/ops/metrics.md`
- Alert rules inventory: `docs/ops/alerts.md`
- Runbooks: `docs/ops/runbooks/*`
- Incident + postmortem templates: `docs/ops/incident-templates.md`

---

## Compliance matrix (SSOT → enforcement → ops)

| Area | Code enforcement | Proof enforcement (tests) | CI / release gate | Ops linkage |
|---|---|---|---|---|
| Bank SSOT (NAV, PF/XP, reserves) | `src/core/Bank.sol` | `test/invariants/*` + unit E2E | PR+nightly | `../ops/runbooks/bank-solvency.md` + [`../ops/alerts.md`](../ops/alerts.md) |
| Hub lifecycle SSOT (bet registry, finalize/refund) | `src/core/Hub.sol` | invariants + stateful system diff | PR+nightly | `../ops/runbooks/game-finalization-diffs.md` |
| VRFHub liveness (fulfill never reverts) | `src/core/VRFHub.sol` | invariants + VRF unit cases | PR+nightly | `../ops/runbooks/vrf-refundcredit.md` |
| Charged VRF fee (native) + refundCredit debt-out | `Hub/VRFHub` | `test/unit/VRFFee*.t.sol` + invariants | PR+nightly | alerts (refundCredit growth / claim failures) |
| Adapter mode ETH/Credit invariants | `src/adapters/*` + `VRFHub` | `StatefulSystemDiffAdapter` + `InvariantsAdapter` | PR+nightly | alerts (ETH balance sanity) |
| Fork validation against canonical wrapper | `test/fork/*` | fork tests | **release tags** | runbooks (VRF) |
| Release integrity (artifact lock + notes) | `script/release/*` | `release-check` verification | **release tags** | incident templates require digest |

---

## How to verify the “provably correct” claims

### Local proof gates
```bash
make deps
FOUNDRY_PROFILE=pr forge test
```

### Nightly-strength gates (more runs)
```bash
FOUNDRY_PROFILE=nightly forge test
```

### Fork validation (developer mode)
```bash
export FORK_RPC_URL=...
export FORK_VRF_WRAPPER=...
forge test --match-path "test/fork/*" -vvv
```

### Deploy + snapshot + verify helper
```bash
# see docs/deploy/README.md for required env
forge script script/Deploy.s.sol:Deploy --broadcast -vvv
ls deployments/latest.json deployments/verify-latest.sh
```

### Release lock + notes + strict checks
```bash
make release-digest
TAG_NAME=vX.Y.Z make release-notes
STRICT=1 make release-check
```

---

## Audit / external handoff checklist

When handing off to auditors, ops, or a partner team, provide:

1) **Deployed addresses + snapshot**: `deployments/latest.json`
2) **Release lock**: `deployments/release-latest.json`
3) **Release notes (with digest)**: `deployments/release-notes-latest.md`
4) **Frontend manifest**: `deployments/frontend-manifest-latest.json`
5) **Golden vectors**: `deployments/golden-vectors-latest.json`
6) **Verify helper script**: `deployments/verify-latest.sh`
7) (Optional) **Single bundle archive**: `dist/ssot-<tag>-<digestPrefix>.tar.gz`

If the recipient wants a **single audit handoff bundle** (code + docs + pinned deps metadata + release artifacts):

8) **Audit bundle**: `dist/ssot-audit-<tag>-<digestPrefix>.tar.gz` (build with `make audit-package`)

---

## Out of scope / not claimed

- Full feature parity migration (Milestone 3) is tracked separately in `docs/migration/refactored-mapping.md`.
- Optional formal verification tooling (Scribble/Certora hooks) is not required for Milestone 4.
