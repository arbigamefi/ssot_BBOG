# ArbiGameFi Monorepo

ArbiGameFi is designed as a single-brand B2C casino/sportsbook product built on
a protocol-grade settlement kernel. It serves players, LPs, referrers and the
operators of this deployment. The [product architecture commitment](docs/strategy/fullstack-product-architecture.md)
sets that direction and keeps future third-party infrastructure an option to
validate against real demand.

This repository contains the **ArbiGameFi smart contracts** and the
**ArbiGameFi frontend workspace**:

- **Contracts**: Foundry project at the repository root
- **Frontend**: pnpm workspace under `frontend/`

The whitepapers are project design guides: they explain the intended product,
mechanisms, principles and choices that should guide implementation. The
[project roadmap](docs/roadmap.md) turns that design into phases, dependencies
and acceptance conditions. Economic and governance proposals marked as design
drafts remain proposals; they do not imply approval or availability.

For implemented and deployed scope, use the dated [release facts](docs/release/STATUS-v1.5.zh-CN.md).
The [v1.5 release workflow](docs/deploy/v15-release.md) covers deployments, and the
[implementation record](docs/deploy/v15/implementation-status.zh-CN.md) retains
execution evidence. The project’s design scope is broader than any one release.

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

Choose the entrypoint that matches your question:

| Document                                                                    | Purpose                                                                                             |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Project brief](docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)                   | A short introduction to the project’s purpose, audience, value and direction.                       |
| [Product and business whitepaper](docs/WHITEPAPER.product.zh-CN.md)         | The user experience, product principles, economic design and open choices that guide what to build. |
| [Technical whitepaper](docs/WHITEPAPER.zh-CN.md)                            | The intended architecture, funds and authority boundaries, invariants and technical evolution.      |
| [Project roadmap](docs/roadmap.md)                                          | Implementation phases, dependencies, decision points and acceptance conditions.                     |
| [Release facts](docs/release/STATUS-v1.5.zh-CN.md)                          | What has been implemented, deployed, opened and accepted at a stated time.                          |
| [Repository retrospective](docs/audit/RepositoryReview-2026-09-25.zh-CN.md) | Findings, impact, validation and rework from a bounded review.                                      |

Design guides and implementation evidence have different roles. The whitepapers
may describe future mechanisms and unresolved choices; the facts table and
retrospective retain dated evidence without turning the whitepapers into audit
reports. See the [writing and publishing standard](docs/WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md)
for design-state labels and the [documentation index](docs/README.md) for the full catalog.

Engineering and operations references:

- [Protocol constitution](docs/constitution/SSOT.v1.3.md), [executable invariants](docs/constitution/ExecutableSSOT.v1.3.md), and [architecture overview](docs/architecture/overview.md)
- [Architecture decisions](docs/adr/README.md) and [implementation action plans](docs/plan/README.md)
- [Release process](docs/release/README.md), [operations runbooks](docs/ops/runbooks/README.md), and [incident templates](docs/ops/incident-templates.md)
- [Frontend design references](docs/design/README.md) and [frontend engineering index](docs/frontend/INDEX.md)
- [Threat model](docs/audit/threat-model.md) and [invariant-to-code map](docs/audit/invariants-map.md)
- [Historical Milestone 4 closeout](docs/closeout/README.md) — historical handoff rather than current deployment instructions

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
