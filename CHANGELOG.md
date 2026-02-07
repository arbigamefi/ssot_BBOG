# Changelog

## v1.12.15 — Extract shared StopLogic library (M-5, ADR-0027)

### Added
- `src/libs/StopLogic.sol`: canonical multi-roll stop logic (`shouldStop`).

### Changed
- CoinTossModule, DiceModule, RouletteModule, KenoModule: replaced inline `_shouldStop` with `StopLogic.shouldStop`.
- DiffCoinToss, DiffRoulette test references: same replacement.

## v1.12.14 — AccountingLib.nav() defensive overflow hardening (H-1)

### Changed
- `AccountingLib.nav()`: `PF + XP` addition moved outside `unchecked` block to checked context. Subtraction remains unchecked (safe after guard).

## v1.12.13 — Error semantics: separate auth from balance errors (H-2, ADR-0026)

### Added
- `Errors.Unauthorized()` for access-control reverts.

### Changed
- `Governable.onlyGov` / `acceptGovernance`: revert with `Unauthorized()` instead of `InsufficientBalance()`.
- `Bank.setRiskInPaused`: revert with `Unauthorized()` for auth failure.
- `Bank.setHubOnce` (already-set guard): revert with `InvalidConfig()`.
- `Bank.rescueToken` (asset guard): revert with `InvalidConfig()`.

## v1.12.12 — Error library cleanup

### Removed
- `SafeTransferLib.sol`: unused dead code (Bank uses OZ SafeERC20 per ADR-0015).
- `Errors.BadConfig`: redundant with `Errors.InvalidConfig`.

### Changed
- `VRFHub.sol`: replaced `BadConfig()` with `InvalidConfig()`.

## v1.12.11.13 — Tooling cleanup after verification fix

- Default to preserving `broadcast/` traces when cleaning Foundry artifacts; set `CLEAN_BROADCAST=1` only when needed.
- `make verify` now precompiles once before running explorer verification to avoid noisy compiler cache warnings.


## v1.12.11.2 — Build/test compatibility fixes

- Use `FOUNDRY_PROFILE=pr|nightly` (instead of `--profile`) in Makefile, CI workflows, and docs for broader Foundry compatibility.
- Remove duplicated `audit-package` Makefile target.
- Stop vendoring OpenZeppelin under `lib/`; dependencies are installed via `make deps` (pinned in `deps.lock`).

## v1.12.11 — Audit handoff bundle packaging

- Add `make audit-package` to produce a single **audit handoff bundle** (code + docs + pinned deps metadata + release artifacts + verify helpers).
- Generate `AUDIT_VERIFY.md` and `MANIFEST.sha256` inside the bundle for quick verification and integrity.
- Enforce audit bundle build in the CI `Release Gate` workflow on `v*` tags.

## v1.12.10 — Closeout summary (Milestone 4 handoff)

- Add one-page closeout handoff tying SSOT v1.2, proofs, release gates, and ops docs (`docs/closeout/README.md`).
- Align docs index, roadmap acceptance, and README pointers.

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.
This project uses semantic versioning (repo-internal milestones).

## v1.12.9 — Ops alert rules + incident templates

- Add alert rules inventory mapping metrics → actionable alerts (`docs/ops/alerts.md`).
- Add incident + postmortem templates (release-digest aware) (`docs/ops/incident-templates.md`).
- Update ops/docs indexes and Milestone 4 acceptance to include alerts + incident process.

## v1.12.8 — Ops runbooks: solvency, config drift, finalization

- Add Bank solvency/reserve anomalies runbook (`docs/ops/runbooks/bank-solvency.md`).
- Add Pause + config drift + governance safety runbook (`docs/ops/runbooks/pause-config-drift.md`).
- Add Game finalization stalls/diff anomalies runbook (`docs/ops/runbooks/game-finalization-diffs.md`).
- Update ops/docs indexes and Milestone 4 acceptance.

## v1.12.7 — Ops runbook: VRF + refundCredit

- Add VRF + refundCredit incident runbook (`docs/ops/runbooks/vrf-refundcredit.md`).
- Update ops/docs indexes and Milestone 4 acceptance.

## v1.12.6 — Ops monitoring metrics inventory

- Add contract-first monitoring metrics inventory (`docs/ops/metrics.md`).
- Update docs index + roadmap Milestone 4 acceptance to include metrics inventory.

## [Unreleased]
- N/A

## v1.12.5 (ExecutableSSOT v1.2 alignment)
### Added
- ExecutableSSOT v1.2 additive proof obligations for charged VRF fee (native) and adapter ETH/credit gates: `docs/constitution/ExecutableSSOT.v1.2.md`.
- Unit tests hardening v1.2 semantics:
  - Underpay fee reverts: `test/unit/VRFFee.t.sol::test_vrf_fee_underpay_reverts`.
  - Failed refundCredit claim preserves credit: `test/unit/VRFFeeCreditClaim.t.sol::test_vrf_refundCredit_failed_claim_preserves_credit`.
### Changed
- Documentation indices updated to reference ExecutableSSOT v1.2.

## v1.12.4 (Fork tests as release gate)
### Added
- Release CI gate that forces `test/fork/*` to pass on `v*` tags when target-chain RPC secrets are present.
### Changed
- Fork tests run in **required** mode during releases (no silent skip): `FORK_REQUIRED=1`.

## v1.12.3 (Release discipline: notes + packaging)
### Added
- Release notes generator (`make release-notes`) that embeds the release digest into Markdown output.
- Artifact packager (`make release-package`) that builds a single `dist/...tar.gz` bundle for auditors/ops.
- Release documentation: `docs/release/README.md` and `docs/release/checklist.md`.
### Changed
- `release-check` strict mode now requires release notes and enforces digest presence to prevent notes drift.

## v1.12.2 (Release lock: digest + signature)
### Added
- Deterministic release digest derived from deployment snapshot fields and signed by governance: `script/release/ReleaseDigest.s.sol`.
- Offline release verification: `script/release/VerifyRelease.s.sol`.
- CI-friendly release gate wrapper: `script/release/check_release.sh` and `make release-check`.
- Tag/release workflow enforcing strict presence: `.github/workflows/release.yml`.
- Docs + ADR: `docs/deploy/release-artifacts.md`, `docs/adr/0024-release-artifacts-digest-signature.md`.
- Repo-local network address map for deploy/front-end alignment: `docs/deploy/networks.ts`.

## v1.12.1 (Real-network artifacts + deps determinism fix)
### Changed
- Pinned deps install script updated for modern Foundry: remove `--no-commit`, use `--no-git` to support zip-distributed repos.
### Added
- Deployment snapshot + verify helper generation from `script/Deploy.s.sol` (writes `deployments/latest.json` and `deployments/verify-latest.sh`).

## v1.12 (Milestone 2.5: fork + deploy)
### Added
- Fork tests scaffold (`test/fork/*`) that auto-skip without RPC env and validate real wrapper request path.
- Deterministic deployment script (`script/Deploy.s.sol`) + deploy runbooks (`docs/deploy/*`).
- CI workflows pinned to Foundry stable and deps lock.

## v1.11 (Adapter-mode proof gates)
### Added
- Adapter-mode invariant suite: `test/invariants/InvariantsAdapter.t.sol` (ETH/credit accounting gates).
- Adapter-mode system diff extensions: `test/diff/StatefulSystemDiffAdapter.t.sol`.

## v1.10 (Chainlink VRF v2.5+ Wrapper adapter)
### Added
- `IVRFAdapter` and `ChainlinkV2PlusWrapperAdapter` callback-forwarding adapter.
- Local `MockVRFV2PlusWrapper` and adapter end-to-end unit tests.

## v1.9 (Charged VRF fee — native token)
### Added
- SSOT v1.2 charged VRF fee semantics (native token): quote + charge + best-effort refund + `refundCredit`.
- Hub bet snapshots for VRF fee accounting (`vrfFeePaid/vrfFeeCharged/vrfCallbackGasLimit`).
- Unit tests validating overpay refund and claimable credits.

## v1.8.5 (Docs + proof gate polish)
### Added
- A1 invariant (`totalAssets == NAV`) per asset.
- Foundry profiles (`pr`, `nightly`) and CI workflows using them.
### Changed
- Documentation updates: audit mapping, migration checklist, testing runbook.
