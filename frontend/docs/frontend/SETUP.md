# Setup & Local Development

## 1. Install

```bash
pnpm install
```

## 2. Run the app

```bash
pnpm dev
```

## 3. Run Storybook

```bash
pnpm storybook
```

## 4. Sync release artifacts (FINAL SHAPE, required for writes)

This repo runs in **read-only** mode unless a valid embedded release snapshot exists.

We only support the **FINAL SHAPE Release Bundle** described in `docs/frontend/SPEC.md`.

Sync from a release bundle directory (preferred):

```bash
pnpm ssot:sync -- --from ../ssot-release-chain-84532-.../
```

Or directly from a `.tar.gz` bundle:

```bash
pnpm ssot:sync -- --from ../ssot-release-chain-84532-...tar.gz
```

Expected release bundle layout:

```
<bundle-root>/
  deployments/
    frontend-manifest-latest.json
    golden-vectors-latest.json
    release-latest.json
    latest.json              # optional (audit)
  abis/
    index.json
    *.abi.json
  MANIFEST.sha256            # optional
```

## 5. CI parity

Run the same checks as GitHub Actions:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm storybook:build
```
