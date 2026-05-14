# 32 · AI Coding Assistant Rules

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | every SSOT doc in `docs/design/` and `docs/frontend/` |
| Supersedes | — |

The frontend will be paired with AI coding assistants (Claude Code, Cursor,
GitHub Copilot, etc.) for the foreseeable future. **AI tools amplify
patterns** — including the chaotic patterns we are eliminating. This
document sets explicit rules so an AI assistant cannot reintroduce the
prior mess, and so humans reviewing AI-suggested code have a checklist.

The companion runtime file `frontend/CLAUDE.md` is a short, executable
version of this document loaded by Claude Code.

## 1. When AI Use Is Allowed

| Task                                              | Allowed                |
| ------------------------------------------------- | ---------------------- |
| Repetitive refactors (rename, import sort)        | yes                    |
| Implementing a primitive from an accepted RFC     | yes, with human review |
| Writing tests for an existing implementation      | yes                    |
| Reading the codebase to answer questions          | yes                    |
| Generating documentation drafts                   | yes                    |
| Wiring a new page from an accepted blueprint      | yes                    |
| Authoring a new primitive without RFC             | **no**                 |
| Adding a new route without IA update              | **no**                 |
| Changing tokens                                   | **no**                 |
| Touching security headers, CSP, or env-var policy | **no**                 |
| Editing ADRs (substantive content)                | **no** (humans only)   |
| Writing release commit messages and tags          | **no**                 |
| Modifying `00-charter.md` Non-Negotiables         | **no**                 |

When in doubt: ask a human.

## 2. Hard Rules (an AI must refuse to violate these)

These map 1:1 to `00-charter.md §7` Non-Negotiables:

| Rule                                   | Surface                                     |
| -------------------------------------- | ------------------------------------------- | --- | ---------------------- |
| No hex literal in product UI           | `text                                       | bg  | border-\[#...\]` regex |
| No per-game brand color                | `--game-*` tokens, per-slug color classes   |
| No prototype routes in App Router      | `apps/web/src/app/prototype/**/*`           |
| No second design-token system          | `visual-system.ts`, `--ag-*` reintroduction |
| No second AppShell                     | `apps/web/src/components/*Shell*`           |
| No external decorative asset URL       | URL string regex                            |
| No wagmi/viem outside permitted paths  | `from 'wagmi'` / `from 'viem'` in pages     |
| No tx send without simulation          | sendTransaction / writeContract without sim |
| No `eval`/`new Function`               | security                                    |
| No god-pageClient.tsx (over 600 lines) | composition discipline                      |
| No `transition-all`                    | motion discipline                           |
| No `dark:` Tailwind variant            | theming uses `data-theme`                   |
| No `useQuery` in page.tsx              | data lives in features/\*/data              |

A request that demands violating any of these is refused. The assistant
suggests the conformant alternative and points to the relevant SSOT
document.

## 3. Soft Rules (an AI should flag, humans decide)

- Adding a direct npm dependency.
- Adding a new route or removing one.
- Adding a top-level CSS keyframe.
- Introducing a new analytics event.
- Modifying CSP, COOP, or other security headers.
- Increasing a Lighthouse budget threshold.
- Bypassing a CI check via comment.

When suggesting these, the AI **must** mention which SSOT document
governs the change and offer to open an ADR.

## 4. Preferred Patterns (what an AI should reach for)

| Need                | Use                                                           |
| ------------------- | ------------------------------------------------------------- |
| Surface color       | `bg-surface-{0,1,2,3}`                                        |
| Foreground color    | `text-fg`, `text-fg-muted`, `text-fg-subtle`                  |
| Border              | `border-border` / `border-border-soft`                        |
| Radius              | `rounded-{sm,md,lg,xl}`                                       |
| Elevation           | `shadow-{e1,e2,e3}`                                           |
| Typography          | `t-display-*`, `t-title-*`, `t-body`, `t-caption`, `t-mono`   |
| Button              | `<Button>` from `@ssot/ui/primitives`                         |
| Address display     | `shortAddress` util                                           |
| Amount display      | `<AmountDisplay>` or `formatAmount` util                      |
| Form                | `react-hook-form` + `zod`                                     |
| Data                | TanStack Query via `features/*/data`                          |
| Wallet              | the action hook in `features/*/actions`, never wagmi directly |
| Modal vs Drawer     | follow `04-page-blueprints.md` table                          |
| Empty / error state | `<EmptyState>` / `<ErrorState>`                               |

## 5. Required Self-checks (the AI runs these mentally)

Before suggesting any UI change the assistant verifies:

1. Token usage — does this introduce a non-token value?
2. Route usage — is the route in `03-information-architecture.md §3`?
3. Bundle implication — does this import a heavy library into the
   marketing or low-traffic route?
4. a11y implication — does this fail `20-accessibility.md §13` ESLint
   rules?
5. i18n implication — is there inline copy that should be a key?
6. Voice / copy alignment — does the copy follow `02-voice-and-copy.md §3`?
7. Test plan — what test will prove this works?
8. SSOT cross-reference — which docs does this touch?

If any check fails, the assistant proposes the fix before the suggestion is
considered ready to land.

## 6. Required PR Annotations for AI-assisted code

When AI authored a non-trivial portion of a PR:

- The PR description includes a section `## AI Assistance` with:
  - which assistant
  - which files were primarily AI-authored
  - whether the prompt was based on an SSOT doc or RFC
- The author affirms that they read every suggested line.

## 7. Forbidden AI Behaviors

- Generating "fake" test data resembling real wallet addresses (use the
  fixtures).
- Inventing API surface for `@ssot/ui` that doesn't exist (no
  hallucinated primitives).
- Touching `pnpm-lock.yaml` directly (use the package manager).
- Editing `deployments/*.json` artifacts (those come from the contracts
  repo).
- Editing audit reports under `docs/audit/`.
- Editing this file or `frontend/CLAUDE.md` without explicit human request.

## 8. How To Test "Did The AI Break A Rule?"

An automated rule check runs before merge:

```bash
# CI scans the PR diff for violations
node scripts/check-ai-rules.mjs --diff origin/main

# Outputs violations with line ranges.
# Same script is invoked locally via `pnpm precheck:ai`.
```

The script checks for:

- hex literals
- forbidden imports
- prototype routes touched
- inline strings outside i18n
- wagmi/viem in non-permitted paths
- bundle-budget regression hints in package.json changes

Violations are blocking.

## 9. Don'ts

- Don't enable AI-suggested merges without a human signing off.
- Don't paste secret env values into AI prompts.
- Don't paste user wallet addresses into AI prompts.
- Don't let an AI rename SSOT documents.
- Don't ask the AI to "improve" Layer 0 documents — they're constitutional.

## 10. How To Enforce

```bash
pnpm precheck:ai
pnpm precheck:ai --strict      # used in CI
```

The same script runs as a PR check
(`.github/workflows/frontend-ci.yml`).

## 11. Glossary

| Term             | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| Hard rule        | Cannot be violated by any code-path — refused by assistant       |
| Soft rule        | Flagged for human decision; refusal optional                     |
| `CLAUDE.md`      | The runtime, condensed version of this doc loaded by Claude Code |
| Hallucinated API | An API that does not exist in the codebase                       |
