# 10 · Design Tokens

| Owner | Frontend Lead + Design Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `01-brand.md`, `11-component-library.md` |
| Supersedes | Draft v1 duplicated token spec |

Design tokens are a code contract. The source files are:

- `frontend/packages/ui/src/tokens/arbi-dark.css`;
- `frontend/packages/ui/src/tokens/arbi-light.css`;
- `frontend/packages/ui/src/styles/globals.css` (the Tailwind v4 `@theme inline`
  block that maps the CSS variables onto Tailwind utility namespaces);
- `frontend/packages/ui/src/tokens/VERSION.md`.

This document defines the rules. It does not duplicate every token value.

## 1. Source Of Truth

CSS variables in `frontend/packages/ui/src/tokens/*` are the source of truth.
As of Tailwind v4 the project is CSS-first: there is **no `tailwind.config.ts`
and no `tailwind-preset.ts`**. `globals.css` consumes the variables through a
single `@theme inline { … }` block (e.g. `--color-surface-0: hsl(var(--surface-0))`),
which is what generates utilities like `bg-surface-0`, `shadow-e1`,
`border-border-strong`. Named transition durations (`duration-fast/base/slow`)
are declared as explicit `@utility` rules in the same file, because Tailwind v4
has no theme namespace for named durations.

Do not create a second token system in app routes, feature folders, or
TypeScript class-string exports.

## 2. Color Families

Allowed product color families:

- `surface-0..3`;
- `fg`, `fg-muted`, `fg-subtle`, `fg-inverse`;
- `border`, `border-soft`;
- `brand`;
- `accent`;
- `success`, `warn`, `danger`, `info`.

Game modules do not get separate brand color families. They can differ through
layout, iconography, copy, animation, and game-specific visuals.

## 3. Radius And Elevation

Allowed radius tokens:

- `sm`;
- `md`;
- `lg`;
- `xl`;
- `full` for pills and circular affordances.

Allowed elevation tokens:

- `shadow-e1`;
- `shadow-e2`;
- `shadow-e3`;
- `shadow-glow`;
- `shadow-inner-e1`.

No arbitrary radius or inline shadow values in product UI.

## 4. Typography

Use the app font contract from layout and shared utilities. Display scale is
reserved for marketing and top-level product pages. Dense product panels use
title/body/caption scale, not hero-scale text.

Rules:

- no viewport-width font scaling;
- no ad-hoc negative letter spacing;
- mono only for hashes, ids, amounts that benefit from tabular rhythm, and ops
  data;
- translated strings must be allowed to wrap.

## 5. Spacing And Layout

Use Tailwind spacing values that follow the normal rhythm (`1`, `2`, `3`, `4`,
`6`, `8`, `12`, `16`, `24`). Avoid odd spacing as a one-off page mood.

Use stable dimensions for:

- buttons;
- tabs;
- boards/grids;
- result receipts;
- toolbars;
- counters;
- game stages.

Stable dimensions are part of the UX contract because live data and translated
copy can otherwise shift the layout.

## 6. Theme Switching

Theme state is handled by token scope and provider code. Components must be
theme-agnostic and should not branch on `dark:` variants for product styling.

Light theme can lag behind dark theme during MVP development, but the token
names must stay compatible.

## 7. Token Versioning

Use `frontend/packages/ui/src/tokens/VERSION.md`.

- Patch: tune a value without changing semantic use.
- Minor: add a token.
- Major: rename or remove a token.

Major token changes need a short ADR or roadmap entry because they affect many
routes.

## 8. Do Not Do

- Do not use `bg-[#...]`, `text-[#...]`, `border-[#...]`, or `shadow-[...]`.
- Do not reintroduce `visual-system.ts`.
- Do not add `--ag-*` variables.
- Do not add per-game color maps.
- Do not add `rounded-[...]`, `rounded-2xl`, or `rounded-3xl` in product UI.
- Do not add third-party decorative background URLs.

## 9. Verification

```bash
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src
rg -nE "visual-system|--ag-" frontend/apps/web/src frontend/packages/ui/src
rg -nE "rounded-(2xl|3xl|\\[)" frontend/apps/web/src frontend/packages/ui/src
rg -nE "\\bdark:" frontend/apps/web/src frontend/packages/ui/src
test -f frontend/packages/ui/src/tokens/VERSION.md
```
