# 32 · AI Pairing Rules

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `31-governance.md`, `../../frontend/CLAUDE.md` |
| Supersedes | Draft v1 AI governance checklist |

AI assistants may help with implementation, tests, docs, and codebase analysis.
They must not reintroduce the pre-rewrite chaos or hide runtime tradeoffs behind
large process documents.

The runtime rule file is [`../../frontend/CLAUDE.md`](../../frontend/CLAUDE.md).
This document explains the policy behind it.

## 1. Hard Rules

AI-assisted changes must not:

- expose raw RPC, viem, ABI, contract, or server errors as user-facing product
  copy;
- add product UI hex literals, per-game brand color families, or a second token
  system;
- add prototype routes to the production App Router;
- import wagmi/viem/RainbowKit from pages or unrelated UI components;
- send transactions without a simulation/planning step;
- edit generated deployment artifacts directly;
- edit audit reports as if they were normal docs;
- collapse `packages/ssot`, `packages/bet-index`, or `apps/keeper` for cosmetic
  simplicity;
- add white-label/operator frontend surfaces before a real requirement exists.

If a requested change violates one of these, propose the conforming alternative.

## 2. What AI Should Optimize For

Use the fullstack strategy priority:

1. runtime correctness for casino and sportsbook flows;
2. chain-derived result receipts and release truth;
3. i18n, security, testing, keeper, and durable index launch requirements;
4. lean frontend structure;
5. user conversion and LP/referrer clarity.

Do not optimize for document volume, theoretical completeness, or unused
platform workflows.

## 3. Before Suggesting Code

Check:

- Which runtime owns this behavior: web, keeper, `ssot`, or bet-index?
- Is this product copy localized?
- Is chain truth consumed instead of inferred?
- Does this change need a targeted test?
- Does this cross a runtime boundary that should stay separate?
- Is a doc update necessary, or would it just preserve chat history?

## 4. Preferred Local Verification

Use the smallest gate that proves the change:

```bash
# docs-only
pnpm -C frontend exec prettier --write <changed-docs>
git diff --check

# web UI / app code
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build

# shared runtime boundaries
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
```

Use browser validation for user-visible frontend behavior when practical.

## 5. PR / Commit Notes

AI assistance does not need a ceremonial section for every small change. It
should be disclosed when a PR is substantially AI-authored or when the change
touches money, security, release, or settlement flow.

Useful disclosure format:

```markdown
## AI Assistance

- scope: <files or subsystem>
- basis: <strategy, roadmap, ADR, or test evidence>
- human-reviewed: yes
```

## 6. Do Not Do

- Do not generate new frontend governance processes.
- Do not invent APIs that do not exist.
- Do not paste secrets, private keys, signatures, or real user wallet data into
  prompts.
- Do not bypass CI or hide failing checks.
- Do not turn a small runtime fix into a broad rewrite.
