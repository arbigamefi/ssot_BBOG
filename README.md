# ArbiGameFi Monorepo

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](docs/design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.
Current status is in the [release notes](docs/release/README.md): one launch candidate resolves, or
explicitly accepts and discloses, every known issue before real money. Per-game gas admission is redone
for it as v5 of the [first-callback gas certificate](docs/audit/first-callback-gas-certificate-2026-10-07.md).

ArbiGameFi is designed as a single-brand B2C casino product built on
a protocol-grade settlement kernel. It serves players, LPs, referrers and the
operators of this deployment. The [product architecture commitment](docs/strategy/fullstack-product-architecture.md)
sets that direction and keeps future third-party infrastructure an option to
validate against real demand.

This repository contains the **ArbiGameFi smart contracts** and the
**ArbiGameFi frontend workspace**:

- **Contracts**: Foundry project at the repository root
- **Frontend**: pnpm workspace under `frontend/`

Read the [project brief](docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md) for a short
introduction. The [business whitepaper](docs/WHITEPAPER.product.zh-CN.md) supports
cooperation and resource decisions; the
[technical whitepaper](docs/WHITEPAPER.zh-CN.md) explains mechanisms and trust
assumptions. The [product roadmap](docs/roadmap.md) presents intended capability.

The project has not launched. The accepted target uses a separate LiquidityVault, one ERC-721 NFT
per deposit, LiquidityTree P&L and a fixed 24-hour withdrawal lock. Bank holds bettor principal and
liabilities. Mature owner-only withdrawals pay the owner; partial success relocks remaining value,
full withdrawal burns the NFT, and transfers preserve maturity. Withdrawn capital has no future
P&L or recovery entitlement. No fungible LP share, daily exit queue or compatibility mode remains.
Use the [current release workflow](docs/deploy/v16-release.md). No deployment manifests are embedded
until a current release is verified and imported.

The accepted target follows a **Single Source of Truth (SSOT)** architecture:

- **Bank / LiquidityVault SSOT (Accounting Truth):** Vault tree capital `L`; Bank pending principal `P` and gross reserve `R`; net lock `K=R-P`, betting solvency basis `G=L+P`
- **PoolRegistry SSOT (Routing Truth):** pool -> asset/bank/domain/hub permissions
- **SettlementRouter SSOT (Position Truth):** position lifecycle and Bank authority
- **GameHub SSOT (Casino Lifecycle Truth):** casino `betId` registry + one settlement implementation, attempted in the callback and publicly retryable
- **VRFHub SSOT (Casino RNG Transport Truth):** direct wrapper consumer, canonical stored randomness and retryable same-result downstream settlement
- **Modules (Game Semantics):** pure, deterministic payout logic (`IGameModule`)

VRFHub is to use the existing **Chainlink VRF v2.5 wrapper consumer** directly. Native fees use the
wrapper quote; failed excess-payment refunds remain claimable credit. The independent adapter and
synthetic production fee mode are removed in the target. Full callback gas remains acceptance work.
The user accepted the existing pre-fulfillment LP ordering risk, with explicit disclosure;
atomic settlement and the 24-hour lock do not eliminate it. See the
[recorded decision](docs/adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04).

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

- `src/core/Bank.sol` — bettor principal, player/protocol/referral debt, gross reserve and per-bet deposit cutoff (**only SettlementRouter** for bet funds)
- `src/core/LiquidityVault.sol` — LP custody, ERC-721 deposits, fixed 24-hour locks and pinned LiquidityTree, bound to its Bank
- `src/core/PoolRegistry.sol` — pool registry for asset, Bank, domain, and hub permissions
- `src/core/SettlementRouter.sol` — settlement authority between GameHub and Bank pools
- `src/core/GameHub.sol` — casino registry + one settlement path for callback/public retry + eligible timeout refunds
- `src/core/VRFHub.sol` — VRF transport + direct wrapper consumer, canonical stored randomness and retryable same-result downstream settlement
- `src/modules/*` — pure game modules (`IGameModule`)
- `src/engines/referral/*` — referral registry + deterministic referral engine (pure math)
- `test/unit/*` — unit & end-to-end tests
- `test/diff/*` — differential tests (module-level and system-level; callback targets require new evidence)
- `test/invariants/*` — **Executable SSOT** (Foundry accounting and native refund-credit invariants)

### Frontend

- `frontend/apps/web` — Next.js frontend application
- `frontend/packages/ssot` — protocol SDK, encoding, release loader, indexer
- `frontend/packages/ui` — shared UI components, Tailwind preset, Storybook
- `deployments/frontend-manifest-latest-v16.json` — contract-generated manifest the frontend consumes directly
- `deployments/golden-vectors-latest-v16.json` — exact-hex vectors used to verify frontend encoders

## Documentation

Choose the entrypoint that matches your decision:

| Document                                                            | Purpose                                                                                  |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Project brief](docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)           | Understand the project and follow a player, capital, business or technical reading path. |
| [Project and business whitepaper](docs/WHITEPAPER.product.zh-CN.md) | Assess the market, user proposition, economics, operating and cooperation case.          |
| [Technical whitepaper](docs/WHITEPAPER.zh-CN.md)                    | Assess design rationale, mechanisms, capital constraints and trust assumptions.          |
| [Product roadmap](docs/roadmap.md)                                  | Follow intended product capabilities and their sequencing.                               |
| [Project master plan](docs/strategy/project-master-plan.zh-CN.md)   | Internal choices, resource focus, hypotheses and work packages.                          |

See the [documentation index](docs/README.md) for economic design, GTM,
reader-specific material roles and the full engineering catalog. Players,
LPs, partners and project investors have different information needs; providing
pool liquidity does not itself create equity or token rights in the project.

Engineering and operations references:

- [Protocol constitution](docs/constitution/SSOT.v1.6.md), [executable invariants](docs/constitution/ExecutableSSOT.v1.6.md), and [architecture overview](docs/architecture/overview.md)
- [Architecture decisions](docs/adr/README.md)
- [Release process](docs/release/README.md), [operations runbooks](docs/ops/runbooks/README.md), and [incident templates](docs/ops/incident-templates.md)
- [Frontend design references](docs/design/README.md) and [frontend engineering index](docs/frontend/INDEX.md)
- [Threat model](docs/audit/threat-model.md) and [invariant-to-code map](docs/audit/invariants-map.md)

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

The [implementation plan](docs/design/lp-accounting-and-callback-implementation.md) defines the new
Bank and callback gates. Earlier adapter-mode test results do not validate the direct consumer path.

## Frontend release artifacts

- Frontend artifact contract: `docs/frontend/README.md`
- Sync local frontend snapshot: `pnpm -C frontend ssot:sync -- --from ../path-to-release`

## Real-network readiness (Milestone 2.5)

- Deploy runbook: `docs/deploy/README.md`
- Fork validation tests: `test/fork/*` (auto-skip when no RPC URL is provided)

Release artifacts (production discipline):

- Sign and package: `make release-v16` (`script/release/release_v16.sh`). It checks governance and the callback domain,
  signs the release lock `deployments/release-latest-v16.json` once (the keystore password must unlock the release
  signer first), writes notes, manifest, vectors and ABIs, verifies, and packages
  `dist/ssot-release-<tag>-<digestPrefix>.tar.gz`. A rerun keeps a valid signature and never rewrites an archive.
- Strict gate (enforced on `v*` tags in CI): `STRICT=1 make release-check`

CI runs on pushes to the default branch (main/master) and on pull requests. If you don’t see runs in GitHub, ensure Actions are enabled and that your default branch name matches the workflow trigger.

Typical fork test usage:

```bash
export FORK_RPC_URL=...
export FORK_VRF_WRAPPER=...
forge test --match-path "test/fork/*" -vvv
```

## Design highlights

### Accounting SSOT (per Bank)

For each bound Bank/Vault pool:

- `L` = LiquidityTree root (LP capital), not token balance minus liabilities.
- `P` = Bank's unresolved bettor principal; `R` = its gross maximum payout reserve.
- `K = R - P` = net LP lock; `G = L + P` = betting solvency basis.
- `PF`, `XP`, `PP` = Bank's protocol, referral and player payables, separate from L.

Require `R >= P` and `L >= K`. Existing betting percentages remain unchanged: after accepting stake
`s`, `R + newReserve + floor((G+s) * riskReserveBps / 10000) <= G+s`. Zero tree capital rejects
new bets. A mature NFT's cash limit is `min(nodeValue, max(L-K,0))`; no additional LP withdrawal
buffer or last-NFT guard applies. K=0 permits all mature capital to exit even with open bets when
other guards allow it.

A bet snapshots `lastDepositId`. P&L targets that prefix; an insufficient prefix sends the **whole
loss** to the current tree, while an empty prefix sends profit to the current tree. New deposits can
therefore participate in old outcomes. If the whole root is zero at settlement, profit goes to
protocol capital. Donation surplus stays outside the tree and is diagnostic, not a new cash-out API.

Vault cash operations check Bank pause/busy/accounting state and canonical Router-to-VRF recorded
results. Unbooked randomness blocks additions/withdrawals; NFT views are custom, not ERC-4626 max
functions. Full mature withdrawal burns even a zero-value NFT; zero percent and zero-value partial
withdrawals revert. NFT operator approval can transfer ownership, so it remains economic authority;
the official withdrawal flow asks for no NFT approval. LP asset approval targets Vault, betting Hub.

Deposits and new bets also bound `G <= 2^108-1` for the original tree arithmetic.
The adopted 40-level tree has been measured through the real core callback; some 100-round paths
exceed the provider budget, so games admit at most 25 rounds. The
[first-callback gas certificate](docs/audit/first-callback-gas-certificate-2026-10-07.md) bounds every admitted
configuration of the code it certifies. Earlier 100-round support is not a promise for this path.

### Charged VRF fee (native)

- `GameHub.quoteVRFFee` quotes wrapper-native request/callback costs for the current gas budget; final callback limits require measurement.
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

Project files use their SPDX identifiers; see `LICENSE` for the MIT-licensed portions.
The pinned Azuro tree and the derived LiquidityVault use GPL-3.0; their provenance,
source hashes and license text are in [the vendor directory](src/vendor/azuro-v3/README.md).
