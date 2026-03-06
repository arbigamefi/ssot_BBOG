# ADR-011: CI Gates on GitHub Actions

## Context
We need institution-grade guardrails similar to the contract repo's proof/release gates.

## Decision
Use **GitHub Actions** as the baseline CI platform with the following required gates:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`
6. `pnpm storybook:build`

## Alternatives
- No CI gates (rejected): leads to drift and regressions.
- Self-hosted CI (deferred): can be added later without changing repo layout.

## Consequences
All PRs must pass the same deterministic toolchain using `pnpm-lock.yaml`.

## Status
Accepted
