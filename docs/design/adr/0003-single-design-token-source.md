# ADR-0003 · Single Design-Token Source

| Status | Accepted |
| Date | 2026-05-14 |
| Owner | Frontend Lead + Design Lead |
| Reviewers | Eng team |
| Supersedes | — |
| Superseded by | — |
| Affects | `frontend/packages/ui/src/themes/**`, `frontend/packages/ui/src/styles/globals.css`, `frontend/packages/ui/src/themes/visual-system.ts`, `frontend/apps/web/src/app/globals.css`, `docs/design/10-design-tokens.md`, `docs/design/01-brand.md` |

## 1. Context

The pre-rewrite frontend hosts **three parallel design-token systems**:

1. shadcn-style HSL CSS variables in
   `frontend/packages/ui/src/themes/default.css` (e.g., `--background`,
   `--foreground`, `--primary`, …).
2. Ad-hoc `--ag-*` CSS variables and component-coupled classes in
   `frontend/packages/ui/src/styles/globals.css` (e.g., `--ag-bg`,
   `--ag-cyan`, `--ag-pink`, `--ag-violet`, `.ag-shell-panel`,
   `.ag-marketing-panel`, `.ag-pill-tab`).
3. TypeScript objects exporting **Tailwind class strings** as tokens in
   `frontend/packages/ui/src/themes/visual-system.ts` (e.g.,
   `SHADOWS.glass = "shadow-lg shadow-black/40"`).

Audit evidence: `docs/design/north-star.md §1`. Grep evidence:
`bg-[#050505]` occurs 123 times, `bg-[#0a0a0a]` 70 times, plus over 30
distinct hardcoded hex backgrounds across product UI.

The three systems do not align. Pages reach for whatever is closest. CSS
specificity bugs are common.

## 2. Decision

There is **exactly one source of design tokens**: CSS variables defined in
`frontend/packages/ui/src/themes/arbi-dark.css` (and sibling `arbi-light.css`
for light theme). Tailwind aliases these variables via the preset. Pages
never see hex literals, raw class-string tokens, or alternative variables.

## 3. Rationale

- **Drift is the root cause.** A second token source becomes a target for
  improvisation. The only durable answer is one source.
- **CSS variables are the right primitive.** They cross the
  RSC / Client / Storybook / preview boundary cleanly.
- **Tailwind aliases keep DX fast.** Devs write `bg-surface-2`, not
  `bg-[hsl(var(--surface-2))]`.
- **Class-string token objects** (visual-system.ts) are an antipattern:
  they cannot be themed, cannot be inspected, and cannot be tree-shaken.

## 4. Alternatives Considered

| Alternative                                   | Pros                              | Cons                                        | Why not chosen                                  |
| --------------------------------------------- | --------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Keep three systems, document priority         | No code churn                     | Drift continues, mental load remains        | Doesn't solve root cause                        |
| Style Dictionary multi-platform tokens        | Vendor-neutral, multi-output      | Build complexity; v1 web-only               | Overkill for v1                                 |
| Tailwind v4 native `@theme` directive         | First-class native                | Tailwind v4 still maturing for some plugins | Phase 2 candidate; v1 sticks with preset + vars |
| CSS-in-JS theming (Vanilla Extract, Stitches) | Type-safe, scoped                 | Adds bundle, breaks RSC boundary            | Rejected                                        |
| **CSS variables + Tailwind preset**           | Simple, standards-based, RSC-safe | Token alias step                            | Chosen                                          |

## 5. Consequences

Positive:

- Single mental model for color / radius / shadow / typography.
- Theming (light, partner) is a stylesheet swap.
- RSC / Client / Storybook agree.
- CI grep rules become trivial.

Negative:

- A one-time sweep replaces ~30+ hex literals and the entire
  `visual-system.ts` consumer set.
- Some plugins (charts) need a small adapter to consume HSL.

Neutral:

- Hot reload behavior identical to existing setup.

## 6. Migration Plan

1. Land `frontend/packages/ui/src/themes/arbi-dark.css` with the full
   token catalog from `docs/design/10-design-tokens.md`.
2. Refit `frontend/packages/ui/src/tailwind-preset.ts` to alias the new
   variables via `hsl(var(--token) / <alpha-value>)`.
3. Sweep replace:
   ```bash
   rg -lE "bg-\\[#" frontend/apps/web/src | xargs sed -i '' -E 's/.../.../g'
   ```
   Then manually verify edge cases.
4. Delete `frontend/packages/ui/src/themes/visual-system.ts` and all
   imports.
5. Delete `--ag-*` declarations from `frontend/packages/ui/src/styles/globals.css`,
   keeping only Tailwind base + token import.
6. Replace `bg-[url('https://grainy-gradients.vercel.app/noise.svg')]`
   with `apps/web/public/textures/noise.svg`.
7. Add CI rules per `docs/design/10-design-tokens.md §14`.
8. Update Storybook to render the Tokens page from the new source.

## 7. SSOT Documents Affected

- `docs/design/10-design-tokens.md` — full token spec.
- `docs/design/01-brand.md` — references the new token names.
- `docs/design/11-component-library.md` — primitives import only token-based
  classes.
- `frontend/CLAUDE.md` — Hard rule 1 + Hard rule 4.

## 8. Acceptance Criteria

- [ ] `rg "#050505|#0a0a0a|#020202|--ag-" frontend/apps/web/src frontend/packages/ui/src`
      returns 0 product UI matches.
- [ ] `rg "from .*visual-system" frontend/` returns 0 matches.
- [ ] `visual-system.ts` removed from the workspace.
- [ ] All Tailwind utilities consuming colors resolve to CSS variables.
- [ ] Storybook "Tokens" page renders from the new source.
- [ ] Theme switch via `data-theme` works in Storybook and the app.

## 9. References

- Frontend audit `docs/design/north-star.md §1`.
- Charter `docs/design/00-charter.md §7-N1, N5`.
- `docs/design/10-design-tokens.md` (canonical spec).
