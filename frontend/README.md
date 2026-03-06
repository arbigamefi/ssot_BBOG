# SSOT Frontend v2 (Greenfield Monorepo)

This repository is the **institution-grade** SSOT-aligned frontend.

- **UI stack**: Tailwind CSS + shadcn/ui + Storybook
- **Protocol stack**: SSOT release artifact → SDK → indexer → features
- **Design governance**: `docs/frontend/UI-CONSTITUTION.md` is the source of truth for visual + interaction rules.

## Quickstart

```bash
pnpm install
pnpm dev
```

Storybook (UI-only):

```bash
pnpm storybook
```

## Release artifact sync (MUST)

Writes are disabled unless a valid embedded release snapshot is present.

Sync from a local SSOT release bundle:

```bash
pnpm ssot:sync -- --from ../path-to-ssot-release
```

The release snapshots live in `packages/ssot/src/release/embedded/`.

## Docs

- `docs/frontend/PRD.md`
- `docs/frontend/ROADMAP.md`
- `docs/frontend/UI-CONSTITUTION.md`
- `docs/frontend/PAGE-SPECS/`
- `docs/frontend/adr/`
