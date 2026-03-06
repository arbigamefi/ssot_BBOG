# ADR-009: Monorepo Structure (apps/web + packages/ui + packages/ssot)

## Context
We want strict separation between protocol layer and UI layer, and allow UI/UX team to work independently.

## Decision
Use a monorepo with workspaces:
- `apps/web`: Next.js app composition
- `packages/ui`: presentational components + tokens + Storybook
- `packages/ssot`: release loader + SDK + indexer

## Consequences
- Requires Next transpilePackages config for workspace deps
- Enables clear ownership and review gates
