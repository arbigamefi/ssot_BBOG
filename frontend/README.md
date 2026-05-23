# ArbiGameFi Frontend

This package is the clean-room, v1.3-only frontend for ArbiGameFi.

- **UI stack**: Next.js + Tailwind CSS + `@ssot/ui`
- **Protocol stack**: embedded release artifact -> `@ssot/ssot` SDK -> feature data layer
- **Design governance**: `../docs/design/` and `../docs/frontend/`

## Quickstart

```bash
pnpm install
pnpm dev
```

Storybook:

```bash
pnpm storybook
```

## Release Artifact Sync

Writes are disabled unless a valid embedded release snapshot is present.

Sync from a local SSOT release bundle:

```bash
pnpm ssot:sync -- --from ../path-to-ssot-release
```

The release snapshots live in `packages/ssot/src/release/embedded/`.

## Release Gates

```bash
pnpm check:release
pnpm precheck:frontend -- --strict
pnpm smoke:release-readonly
pnpm typecheck
```

`smoke:release-readonly` uses RPC only. It does not require a wallet and does
not broadcast transactions. It also verifies embedded asset and pool decimals
against each ERC20 `decimals()` value on chain.

## Active Docs

- Design SSOT: `../docs/design/README.md`
- Frontend engineering SSOT: `../docs/frontend/INDEX.md`
- Release artifact contract: `../docs/frontend/README.md`
- Contract constitution: `../docs/constitution/SSOT.v1.3.md`
- Frontend implementation roadmap: `../docs/design/frontend-implementation-roadmap.md`
