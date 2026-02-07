# Bankroll Protocol — SSOT v1.2 (Immutable, Clean-Room)

This repository is a **clean-room rewrite** of a bankroll-backed on-chain gaming protocol, designed for
**institution-grade, provably correct** behavior.

The core idea is to treat the protocol as a set of **Single Sources of Truth (SSOT)**:
- **Per-asset Bank SSOT (Accounting Truth):** for each supported asset, `NAV = B - PF - XP` and `totalAssets() == NAV`
- **Hub SSOT (Lifecycle Truth):** one global `betId` registry (across assets) + permissionless `finalize()` / `refund()`
- **VRFHub SSOT (Transport Truth):** request mapping + `detach` + **fulfill never reverts**
- **Modules (Game Semantics):** pure, deterministic payout logic (`IGameModule`)

v1.2 additionally specifies **charged VRF fees in native token** ("多退少补") and a **Chainlink VRF v2.5+ Wrapper adapter**
integration, while preserving SSOT liveness and minimal trust surface.

## What’s in this repo

- `src/core/Bank.sol` — per-asset ERC4626-like vault + accounting buckets (PF/XP/R) + bet funds API (**only Hub**)
- `src/core/Hub.sol` — bet registry SSOT (global `betId`) + VRF orchestration + permissionless `finalize/refund`
- `src/core/VRFHub.sol` — VRF transport + request mapping + `detach` + **fulfill never reverts**
- `src/adapters/*` — optional VRF provider adapters (e.g., Chainlink Wrapper)
- `src/modules/*` — pure game modules (`IGameModule`)
- `src/engines/referral/*` — referral registry + deterministic referral engine (pure math)
- `test/unit/*` — unit & end-to-end tests
- `test/diff/*` — differential tests (module-level + system-level, incl. adapter mode)
- `test/invariants/*` — **Executable SSOT** (Foundry invariants, incl. adapter ETH/credit invariants)

## Documentation

Start here:
- **Closeout handoff (Milestone 4):** `docs/closeout/README.md`
- **Constitution (SSOT):** `docs/constitution/SSOT.v1.2.md`
- **Executable SSOT:** `docs/constitution/ExecutableSSOT.v1.2.md`
- **Architecture overview:** `docs/architecture/overview.md`
- **Threat model:** `docs/audit/threat-model.md`
- **Invariant-to-code map:** `docs/audit/invariants-map.md`
- **ADR log:** `docs/adr/README.md`
- **Roadmap:** `docs/roadmap.md`
- **Action plans:** `docs/plan/README.md`
- **Migration notes (from refactored):** `docs/migration/refactored-mapping.md`
- **Runbooks:** `docs/runbooks/*`

- Ops monitoring metrics: `docs/ops/metrics.md`
- Ops alert rules: `docs/ops/alerts.md`
- Ops incident templates: `docs/ops/incident-templates.md`
- Ops runbooks: `docs/ops/runbooks/README.md`

## Quickstart

Prerequisites: Foundry.

```bash
make deps
make test
```

Run invariants only:
```bash
forge test --match-path "test/invariants/*" -vvv
```

Run adapter-mode gates only:
```bash
forge test --match-path "test/diff/StatefulSystemDiffAdapter.t.sol" -vvv
forge test --match-path "test/invariants/InvariantsAdapter.t.sol" -vvv
```

## Real-network readiness (Milestone 2.5)

- Deploy runbook: `docs/deploy/README.md`
- Fork validation tests: `test/fork/*` (auto-skip when no RPC URL is provided)

Release artifacts (production discipline):

- Release lock (digest + signature): `make release-digest` (writes `deployments/release-latest.json`)
- Release notes (must include digest): `TAG_NAME=vX.Y.Z make release-notes`
- Strict gate (enforced on `v*` tags in CI): `STRICT=1 make release-check`

- Optional packaging: `make release-package` (writes `dist/ssot-<tag>-<digestPrefix>.tar.gz`)

CI runs on pushes to the default branch (main/master) and on pull requests. If you don’t see runs in GitHub, ensure Actions are enabled and that your default branch name matches the workflow trigger.

Typical fork test usage:
```bash
export FORK_RPC_URL=...
export FORK_VRF_WRAPPER=...
forge test --match-path "test/fork/*" -vvv
```

## Design highlights

### Accounting SSOT (per asset)
For each supported asset `a`:

- `B[a]`  = `asset.balanceOf(Bank(a))`
- `PF[a]` = protocol fees payable (not LP backing)
- `XP[a]` = external payables total (referral/kickback liabilities; not LP backing)
- `NAV[a] = B[a] - PF[a] - XP[a]`
- `R[a]`  = `totalReserved` (worst-case pending bet liability)

And **MUST** satisfy:
- `totalAssets() == NAV`
- `NAV >= R`

### Charged VRF fee (native)
- `Hub.quoteVRFFee(betCount)` gives a deterministic quote `(fee, callbackGasLimit)`.
- `Hub.placeBet(...)` is `payable` and requires `msg.value >= fee`.
- Any overpayment is refunded best-effort; failed refunds accrue `refundCredit` claimable later.

### Referral / XP (permissionless)
Referral liabilities are modeled as XP buckets:
- `xpAccrued` (claimable)
- `xpLocked` (turnover-gated unlock; permissionless)
- `xpHoldback` (rolling linear vesting; permissionless)

Unlock/release are **bucket moves only** (no transfers), so they never block player settlement.

## Contributing

See `CONTRIBUTING.md` for workflow, standards, and how SSOT + ADRs govern changes.

## Security

See `SECURITY.md` for the vulnerability disclosure process.

## License

MIT — see `LICENSE`.
