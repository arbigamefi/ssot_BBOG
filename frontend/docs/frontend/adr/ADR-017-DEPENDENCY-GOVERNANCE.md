# ADR-017: Dependency Governance (Deprecations, Overrides, and Upgrade Discipline)

**Status**: Accepted  
**Date**: 2026-01-10  
**Owner**: Frontend Architecture

## Context

This repository is a greenfield monorepo (pnpm workspaces) with three core pillars:

- `packages/ssot`: SSOT release loader + protocol SDK + (future) indexer
- `packages/ui`: Tailwind + shadcn/ui + Storybook component system
- `apps/web`: Next.js app consuming only the public APIs of the above packages

We want an “institutional-grade” frontend: stable, auditable, and resistant to drift.
In practice, dependency drift is a top source of uncontrolled change:

- Transitive deprecations/noise hide real security issues.
- Minor/patch mismatches in Storybook packages can break the dev server.
- Accidental upgrades of Next/wagmi/viem can change runtime behavior and break wallet flows.
- Different Node versions across developers cause hard-to-reproduce issues.

We need a disciplined, repeatable dependency upgrade process with hard gates.

## Decision

### 1) Supported toolchain is **pinned**

- **Node**: use `.node-version` (CI) and root `engines.node` (local guidance).
- **pnpm**: pinned via `packageManager` and `engines.pnpm`.

Developers should use `fnm`, `nvm`, or Volta to align with `.node-version`.

### 2) Platform dependencies are **exact pinned**, not floating

The following dependency families are treated as platform dependencies and must be kept consistent across the workspace:

- Next.js / React
- wagmi / viem
- Storybook (all `@storybook/*`)
- Tailwind / PostCSS
- TypeScript / ESLint

Policy:

- Prefer **exact versions** (no `^` / `~`) for platform dependencies.
- Transitive alignment is enforced via `pnpm.overrides` at the root.

### 3) Deprecations are **triaged**, not ignored

We classify dependency warnings into:

- **Action Required**: security advisories, runtime breakages, toolchain incompatibilities.
- **Action Planned**: noisy transitive deprecations with no runtime impact.
- **Ignore (Documented)**: known upstream warnings that are harmless under the supported toolchain.

All “Action Required” items must be handled before release.

### 4) Upgrades are performed only through a **scheduled upgrade window**

We do not upgrade platform dependencies ad hoc.

- Use a weekly/biweekly upgrade window.
- Upgrades must include:
  - changelog link(s)
  - risk assessment
  - rollback plan
  - verification checklist (see below)

### 5) Verification checklist is mandatory for platform upgrades

Any PR that changes platform dependencies must pass:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm storybook:build`
- (when implemented) `pnpm e2e`

And must update relevant ADRs/docs if behavior changes.

## Implementation Notes

1) Root-level `pnpm.overrides` is used to keep Storybook packages on the same version.
2) CI uses `.node-version` to guarantee consistent Node behavior.
3) The lockfile (`pnpm-lock.yaml`) must be committed for deterministic CI.

## Alternatives Considered

1) Allow floating versions (`^`) and rely on lockfile only
   - Rejected: increases accidental drift and makes dependency intent unclear.

2) Use Renovate/Dependabot to auto-merge
   - Rejected: upgrades must be deliberate and audited, not auto-merged.
   - Future: Renovate can be enabled in “PR-only, no automerge” mode.

3) Centralize dependencies into one root `package.json`
   - Rejected: reduces package-level clarity and makes UI/SDK separation harder to enforce.

## Consequences

- Slightly more manual work for upgrades, but far fewer regressions.
- Stronger reproducibility and auditability (front-end release is deterministic).
- Clear process for handling transitive deprecation noise.
