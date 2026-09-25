# ArbiGameFi Monorepo

Fresh deployments use the [v1.5 Safe release workflow](docs/deploy/v15-release.md). Both embedded chains now use v1.5. See the [current release facts](docs/release/STATUS-v1.5.zh-CN.md) for website availability, deployed capabilities and bounded acceptance evidence. Historical execution details remain in the [implementation log](docs/deploy/v15/implementation-status.zh-CN.md).

This repository is a single Git project that contains both the **ArbiGameFi smart contracts** and the
**ArbiGameFi frontend workspace**.

- **Contracts**: Foundry project at the repository root
- **Frontend**: pnpm workspace under `frontend/`

ArbiGameFi is a bankroll-backed on-chain gaming system with explicit accounting and settlement boundaries. Tests and deployment evidence support specific properties; they do not establish the absence of defects.

Start with the [project brief](docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md), [product whitepaper](docs/WHITEPAPER.product.zh-CN.md), [technical whitepaper](docs/WHITEPAPER.zh-CN.md), or [independent repository review](docs/audit/RepositoryReview-2026-09-25.zh-CN.md). The whitepaper set is a Review Copy based on v1.5. Public mainnet betting remains disabled in the website; sportsbook is not deployed in the current releases.

Its core design follows a **Single Source of Truth (SSOT)** architecture:

- **Per-pool Bank SSOT (Accounting Truth):** for each single-asset Bank, `NAV = B - PF - XP` and `totalAssets() == NAV`
- **PoolRegistry SSOT (Routing Truth):** pool -> asset/bank/domain/hub permissions
- **SettlementRouter SSOT (Position Truth):** cross-vertical position lifecycle and Bank authority
- **GameHub SSOT (Casino Lifecycle Truth):** casino `betId` registry + permissionless `finalize()` / `refund()`
- **SportsHub SSOT (Sports Lifecycle Truth):** fixed-odds market/ticket lifecycle
- **VRFHub SSOT (Casino RNG Transport Truth):** request mapping + `detach` + best-effort downstream callback handling
- **Modules (Game Semantics):** pure, deterministic payout logic (`IGameModule`)

The current implementation additionally specifies **charged VRF fees in native token** ("多退少补") and a **Chainlink VRF v2.5+ Wrapper adapter**
integration, while preserving SSOT liveness and a minimal trust surface.

## Repository layout

```text
.
├── src/                    # Foundry contracts
├── test/                   # Foundry unit/diff/invariant/fork tests
├── script/                 # Deploy/release tooling
├── deployments/            # Release snapshots and generated frontend artifacts
├── docs/                   # Protocol, audit, deploy, ops docs
└── frontend/               # Frontend monorepo
    ├── apps/web/           # Next.js application
    └── packages/
        ├── ssot/           # SDK, release loader, encoding, indexer
        └── ui/             # Shared UI system
```

## What’s in this repo

### Contracts

- `src/core/Bank.sol` — per-asset ERC4626-like vault + accounting buckets (PF/XP/R) + bet funds API (**only SettlementRouter**)
- `src/core/PoolRegistry.sol` — pool registry for asset, Bank, domain, and hub permissions
- `src/core/SettlementRouter.sol` — shared settlement authority between vertical hubs and Bank pools
- `src/core/GameHub.sol` — casino bet registry SSOT + VRF orchestration + permissionless `finalize/refund`
- `src/core/SportsHub.sol` — fixed-odds sports market/ticket lifecycle
- `src/core/SportsRiskEngine.sol` — sports exposure and risk hash controls
- `src/core/VRFHub.sol` — VRF transport + request mapping + `detach` + best-effort downstream callback handling
- `src/adapters/*` — optional VRF provider adapters (e.g., Chainlink Wrapper)
- `src/modules/*` — pure game modules (`IGameModule`)
- `src/engines/referral/*` — referral registry + deterministic referral engine (pure math)
- `test/unit/*` — unit & end-to-end tests
- `test/diff/*` — differential tests (module-level + system-level, incl. adapter mode)
- `test/invariants/*` — **Executable SSOT** (Foundry invariants, incl. adapter ETH/credit invariants)

### Frontend

- `frontend/apps/web` — Next.js frontend application
- `frontend/packages/ssot` — protocol SDK, encoding, release loader, indexer
- `frontend/packages/ui` — shared UI components, Tailwind preset, Storybook
- `deployments/frontend-manifest-latest-v15.json` — contract-generated manifest the frontend consumes directly
- `deployments/golden-vectors-latest-v15.json` — exact-hex vectors used to verify frontend encoders

## Documentation

Start here:

- **Current release process and evidence:** `docs/release/README.md`
- **Historical closeout (Milestone 4; not current deployment instructions):** `docs/closeout/README.md`
- **Constitution (SSOT):** `docs/constitution/SSOT.v1.3.md`
- **Executable SSOT:** `docs/constitution/ExecutableSSOT.v1.3.md`
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
- Frontend design SSOT: `docs/design/README.md`
- Frontend engineering SSOT: `docs/frontend/INDEX.md`

## Quickstart

Prerequisites:

- Foundry
- Node.js 24
- pnpm 9

### Contracts

```bash
make deps
make test
```

### Frontend

```bash
make frontend-install
make frontend-dev
```

### Unified root commands

```bash
pnpm run setup
pnpm run contracts:test
pnpm run frontend:build
pnpm run check
```

`make` is the contract-first entrypoint. `pnpm run ...` is the repo-level task runner entrypoint.

Run invariants only:

```bash
forge test --match-path "test/invariants/*" -vvv
```

Run adapter-mode gates only:

```bash
forge test --match-path "test/diff/StatefulSystemDiffAdapter.t.sol" -vvv
forge test --match-path "test/invariants/InvariantsAdapter.t.sol" -vvv
```

## Frontend release artifacts

- Frontend artifact contract: `docs/frontend/README.md`
- Sync local frontend snapshot: `pnpm -C frontend ssot:sync -- --from ../path-to-release`

## Real-network readiness (Milestone 2.5)

- Deploy runbook: `docs/deploy/README.md`
- Fork validation tests: `test/fork/*` (auto-skip when no RPC URL is provided)

Release artifacts (production discipline):

- Release lock (digest + signature): `make release-digest` (writes `deployments/release-latest-v15.json`)
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

### Accounting SSOT (per Bank)

For each Bank and its supported asset `a` (multiple pools may use the same asset):

- `B[a]` = `asset.balanceOf(Bank(a))`
- `PF[a]` = protocol fees payable (not LP backing)
- `XP[a]` = external payables total (referral/kickback liabilities; not LP backing)
- `NAV[a] = B[a] - PF[a] - XP[a]`
- `R[a]` = `totalReserved` (worst-case pending bet liability)

And **MUST** satisfy:

- `totalAssets() == NAV`
- `NAV >= R`

### Charged VRF fee (native)

- `GameHub.quoteVRFFee(betCount)` gives a deterministic quote `(fee, callbackGasLimit)`.
- `GameHub.placeBet(...)` is `payable` and requires `msg.value >= fee`.
- Any overpayment is refunded best-effort; failed refunds accrue `refundCredit` claimable later.

### Referral / XP (permissionless)

Referral liabilities are modeled as XP buckets:

- `xpAccrued` (claimable)
- `xpLocked` (turnover-gated unlock; permissionless)
- `xpHoldback` (aggregate linear vesting; new awards do not extend an active schedule)

Unlock/release are **bucket moves only** (no transfers), so they never block player settlement.

## Contributing

See `CONTRIBUTING.md` for workflow, standards, and how SSOT + ADRs govern changes.

## Security

See `SECURITY.md` for the vulnerability disclosure process.

## License

MIT — see `LICENSE`.
