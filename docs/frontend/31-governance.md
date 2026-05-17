# 31 · Lean Frontend Governance

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `../design/frontend-implementation-roadmap.md` |
| Supersedes | Draft v1 governance/RFC process |

Frontend governance now follows the fullstack commitment:

> Protocol-grade contracts; lean B2C product; optional future infrastructure.

The goal is not to create ceremony. The goal is to prevent regressions in
runtime correctness, launch requirements, and contract-facing truth.

## 1. What Requires An ADR

Open or update an ADR only for durable decisions:

- changing a contract-facing frontend boundary (`packages/ssot`, release
  manifests, golden vectors, SDK encoding);
- changing runtime boundaries (`apps/keeper`, `packages/bet-index`, web API
  durable index behavior);
- adding a new production route family or deleting an existing one;
- changing wallet/security/env/RPC policy;
- changing i18n launch policy;
- changing durable indexing strategy;
- adding a new direct production dependency with meaningful bundle/security
  impact;
- changing a rule that accepted ADRs already protect.

Do not open ADRs for typo fixes, one-consumer file folds, copy edits, small UI
polish, test additions, or docs slimming that does not alter policy.

## 2. Required Review Mindset

For any change, ask four questions:

1. Does it protect money, settlement, release truth, or user safety?
2. Does it improve the B2C funnel: connect, bet, settle, return, deposit LP?
3. Does it satisfy a launch requirement: i18n, security, testing, release,
   keeper, durable index?
4. Does it remove complexity without crossing a real runtime boundary?

If the answer to all four is no, the change is probably not worth doing.

## 3. Documentation Ownership

| Doc family                                   | Current policy                                    |
| -------------------------------------------- | ------------------------------------------------- |
| Contract constitution, audits, invariants    | Keep high-discipline. These are assurance assets. |
| Release artifacts and frontend manifest docs | Keep strict. UI must consume contract truth.      |
| i18n/security/testing/build docs             | Keep. These are launch requirements.              |
| Keeper and durable index docs                | Keep concise and operational.                     |
| Brand/voice/motion/process docs              | Keep as references; slim when touched.            |
| Historical planning docs                     | Replace with links to strategy and roadmap.       |

## 4. Definition Of Done

For code changes:

- targeted tests pass;
- affected local gate passes;
- no raw RPC/server/viem errors render as product copy;
- i18n keys are mirrored for visible product copy;
- release/golden-vector behavior is unchanged unless explicitly intended.

For docs-only changes:

- links still point to current files;
- the doc names the current decision or marks itself historical;
- `git diff --check` passes.

## 5. Standard Local Gates

Frontend-only:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

Workspace/runtime-boundary changes:

```bash
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
git diff --check
```

Docs-only:

```bash
pnpm -C frontend exec prettier --write <changed-docs>
git diff --check
```

After web builds, restore `frontend/apps/web/next-env.d.ts` to reference
`.next-dev/types/routes.d.ts` before committing.

## 6. Do Not Do

- Do not add frontend process gates that are not tied to launch risk.
- Do not collapse `packages/ssot`, `packages/bet-index`, or `apps/keeper` for
  cosmetic simplicity.
- Do not add white-label/operator workflows without a real requirement.
- Do not edit accepted ADRs substantively; supersede them.
- Do not delete audit/release/constitution artifacts as part of frontend
  cleanup.
