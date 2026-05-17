# ArbiGameFi Frontend — Rules for AI Coding Assistants

This file is the **runtime contract** loaded by Claude Code and other AI
assistants working in the `frontend/` workspace. The policy companion is
`../docs/frontend/32-ai-pairing.md`; the fullstack product boundary is
`../docs/strategy/fullstack-product-architecture.md`.

If anything below conflicts with release artifacts, contract SSOT, or the
fullstack strategy, those sources win.

## 1. Where rules live

| Domain                                       | Document                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fullstack strategy and complexity budget     | `../docs/strategy/fullstack-product-architecture.md`                                    |
| Mission, success metrics, Non-Negotiables    | `../docs/design/00-charter.md`                                                          |
| Brand, logo, palette, typography roles       | `../docs/design/01-brand.md`, `../docs/design/10-design-tokens.md`                      |
| Voice, copy, number / time / address formats | `../docs/design/02-voice-and-copy.md`                                                   |
| Route map, personas, journeys, state matrix  | `../docs/design/03-information-architecture.md`, `../docs/design/04-page-blueprints.md` |
| Components, primitives, patterns             | `../docs/design/11-component-library.md`                                                |
| Motion presets, reduced-motion rules         | `../docs/design/12-motion.md`                                                           |
| Wallet / signing / approve / tx state        | `../docs/design/13-web3-ux.md`                                                          |
| Data flow, TanStack Query keys, invalidation | `../docs/design/14-data-and-state.md`                                                   |
| Forms, bigint inputs, validation             | `../docs/design/15-forms.md`                                                            |
| Mobile breakpoints, touch targets, PWA       | `../docs/design/16-mobile.md`                                                           |
| Accessibility                                | `../docs/frontend/20-accessibility.md`                                                  |
| i18n                                         | `../docs/frontend/21-i18n.md`                                                           |
| Performance budgets                          | `../docs/frontend/22-performance.md`                                                    |
| Security, CSP, anti-phishing                 | `../docs/frontend/23-security.md`                                                       |
| Testing strategy                             | `../docs/frontend/24-testing.md`                                                        |
| Observability, analytics events              | `../docs/frontend/25-observability.md`                                                  |
| Build, CI, release                           | `../docs/frontend/30-build-and-release.md`                                              |
| Governance, ADR                              | `../docs/frontend/31-governance.md`                                                     |
| **You are here**                             | `frontend/CLAUDE.md`                                                                    |

Check the relevant document before suggesting code that touches its surface, but
do not block P0 runtime fixes on historical design/process docs.

## 2. Hard rules — refuse to violate

These are non-negotiable. If a prompt requires violating one, refuse and
suggest the conformant alternative.

1. **No hex literal in product UI.** Use `bg-surface-*`, `text-fg-*`,
   `border-border*`. Never `bg-[#050505]`.
2. **No per-game brand color family.** Casino, sportsbook, etc. all use
   the single `--brand`. No `--game-dice-*` tokens, no
   `bg-purple-500` per game.
3. **No prototype routes in `apps/web/src/app/`.** Prototypes live in
   `apps/web/src/sandbox/` and are not routable.
4. **No second design-token system.** No reintroduction of
   `visual-system.ts`, `--ag-*` variables, or page-local CSS variables
   that duplicate tokens.
5. **No second AppShell.** Use the single `AppShell` with `variant`
   prop. Don't create `*Shell.tsx` files in `apps/web/src/components/`.
6. **No external decorative URL.** Local assets only. No
   `grainy-gradients.vercel.app` or similar.
7. **No wagmi/viem/RainbowKit imports** outside:
   - `apps/web/src/app-shell/WalletProviderIsland.tsx`
   - `apps/web/src/features/<vertical>/data/**`
   - `apps/web/src/features/<vertical>/actions/**`
   - `frontend/packages/ui/src/patterns/wallet-gate.tsx`
     Pages must not import these libraries.
8. **No tx send without prior `eth_call` simulation.** All write flows
   simulate first; mismatched simulation blocks the sign step.
9. **No `eval`, `new Function`, `setTimeout("...")`, `setInterval("...")`.**
10. **No god-pageClient.** Any `pageClient.tsx` over 600 lines fails CI
    — decompose into feature modules.
11. **No `transition-all`.** Specify which CSS property transitions.
12. **No `dark:` Tailwind variant.** Theming is via `data-theme` attribute.
13. **No `useQuery` / `useInfiniteQuery` / `useMutation` directly in a
    `page.tsx`.** Wrap in a feature hook under `features/*/data` or
    `features/*/actions`.
14. **No native `<input type="number">` for asset amounts.** Use
    `<NumberInput>` for bigint precision.
15. **No `parseFloat` / `Number(...)` on user-entered amounts.** Native
    bigint via shared parsing helpers.
16. **No inline JSX strings** in `apps/web/src/app/`, `apps/web/src/features/`
    that should be translated. Use the i18n key system.
17. **No raw RPC, viem, ABI, contract, or server errors as product copy.**
18. **No white-label/operator UI surfaces** before a real requirement exists.

## 3. Preferred patterns

| Want            | Use                                                                       |
| --------------- | ------------------------------------------------------------------------- |
| Surface color   | `bg-surface-{0,1,2,3}`                                                    |
| Foreground      | `text-fg`, `text-fg-muted`, `text-fg-subtle`                              |
| Border          | `border-border`, `border-border-soft`                                     |
| Brand fill      | `bg-brand text-fg-inverse`                                                |
| Status          | `text-success` / `text-warn` / `text-danger` (state only, not decoration) |
| Radius          | `rounded-{sm,md,lg,xl}`                                                   |
| Elevation       | `shadow-{e1,e2,e3,glow}`                                                  |
| Typography      | `t-display-*`, `t-title-*`, `t-body`, `t-caption`, `t-mono`               |
| Button          | `import { Button } from '@ssot/ui/primitives'`                            |
| Address display | `shortAddress` from `@ssot/ui/utils`                                      |
| Amount display  | `<AmountDisplay>` or `formatAmount` util                                  |
| Forms           | `react-hook-form` + `zod` + `<NumberInput>`                               |
| Data fetch      | `useXxxQuery` inside `features/*/data/`                                   |
| Tx flow         | `useXxxFlow` inside `features/*/actions/`                                 |
| Motion          | `m` presets from `@ssot/ui/motion`                                        |
| Icons           | `@heroicons/react/24/outline` (default) or `/solid` (semantic)            |
| Modal           | `<Dialog>` from `@ssot/ui/primitives`                                     |
| Drawer          | `<Drawer>` from `@ssot/ui/primitives`                                     |
| Toast           | `toast.info(...)` / `toast.success(...)` from `@ssot/ui`                  |

## 4. Naming conventions

- Components: `PascalCase.tsx` matching the export.
- Hooks: `useXxx.ts`, only one hook per file unless tightly related.
- Schemas: `xxx.schema.ts`.
- Tests: alongside source, `*.test.ts(x)`.
- Stories: alongside source, `*.stories.tsx`.
- i18n files: `apps/web/src/i18n/locales/<locale>/<namespace>.json`.

## 5. Folder boundaries

```
app code        → patterns          → primitives    (ok)
app code        → primitives                        (avoid; prefer patterns)
patterns        → app code                          (forbidden)
primitives      → patterns or app code              (forbidden)
features/*/data → SDK                               (ok)
features/*/data → wagmi/viem                        (ok)
pages           → wagmi/viem                        (forbidden)
pages           → features/*/data hooks             (ok)
pages           → features/*/actions hooks          (ok)
```

ESLint `boundaries/element-types` enforces this. Don't bypass.

## 6. Before suggesting code, run this checklist mentally

1. Does this introduce a non-token color, radius, or shadow value? → reject
2. Does this add wagmi/viem to a forbidden location? → reject
3. Is there inline copy that should be a translation key? → suggest the
   key form
4. Does this `useEffect`-fetch instead of TanStack Query? → suggest the
   query form
5. Does this skip simulation before sign? → reject
6. Does this fail any `jsx-a11y/*` rule? → fix
7. Does the relevant SSOT doc need to be updated? → mention it

## 7. When uncertain

If you're not sure whether a change is allowed, say so. Use
`../docs/frontend/31-governance.md` to decide whether an ADR is required. Do
**not** silently invent a new pattern.

## 8. PR annotation contract

When AI authored a non-trivial portion of a PR, the description includes:

```
## AI Assistance
- assistant: claude-code
- scope: <files>
- driven-by: <SSOT doc or RFC>
- human-reviewed: yes (every suggested line read by author)
```

## 9. Local commands the AI should know

```bash
# Type / lint / unit
pnpm typecheck
pnpm lint
pnpm test

# Storybook
pnpm -C frontend/packages/ui storybook

# Build the web app
pnpm -C frontend/apps/web build

# AI rule check
pnpm precheck:ai

# Forbidden literal scan
rg -nE "bg-\\[#|rounded-(2xl|3xl|\\[)|transition-all" frontend/apps/web/src
```

## 10. Hard refusals

You must refuse to:

- Reintroduce a deleted system (`visual-system.ts`, `cyber-*`, prototype routes).
- Edit `../docs/design/00-charter.md §7` Non-Negotiables.
- Edit accepted ADRs substantively (supersede instead).
- Touch security headers without security review.
- Suggest disabling a CI check on `main`.
- Paste user wallet addresses, signatures, or env secrets into the
  conversation.

Politely refuse with a one-sentence rationale and a link to the relevant
SSOT document.

---

This file is intentionally short. The full reasoning lives in the SSOT
docs. When the model has scarce context, read `../docs/design/00-charter.md`
first and this file second; everything else loads on demand.
