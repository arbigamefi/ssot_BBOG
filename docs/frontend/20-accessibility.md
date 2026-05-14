# 20 · Accessibility

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `../design/11-component-library.md`, `../design/12-motion.md` |
| Supersedes | — |

ArbiGameFi is **WCAG 2.2 AA** baseline. Higher standards apply where reasonable
(e.g., AAA contrast for body copy, full keyboard-only operability). This
document is a contract, not aspirational — every check listed is enforced
by CI.

## 1. Standards

| Standard                               | Target   |
| -------------------------------------- | -------- |
| WCAG 2.2 Level AA                      | required |
| WCAG 2.2 Level AAA (contrast for body) | required |
| Section 508 (US federal)               | aligned  |
| EN 301 549 (EU accessibility)          | aligned  |
| ADA                                    | aligned  |

## 2. Keyboard Operability

### 2.1 Every interactive element

- Focusable via Tab.
- Activatable via Enter / Space (per element semantics).
- Visible focus indicator using `--ring`, never hidden.
- Reachable in logical reading order (DOM ≈ visual).

### 2.2 Skip links

`<AppShell>` includes a hidden "Skip to content" link as the first focusable
element. Target is `#main`.

### 2.3 Focus management on route change

After a route transition, focus moves to the `<h1>` of the new page (or
the `<main>` if no `<h1>`). Implemented in `<AppShell>` via Next.js
`useRouter` events.

### 2.4 Modal focus trap

Implemented via Radix Dialog. On open: focus moves to first focusable
inside. On close: focus returns to the trigger.

### 2.5 Tab navigation in tables

`<LedgerTable>` rows are not focusable; cells with interactive content
(copy button, link, action) are. Long tables use roving tabindex (one
focusable cell at a time).

### 2.6 Forbidden

- `tabindex` > 0.
- `outline: none` without an equivalent `:focus-visible` style.
- Disabling Esc on modal close.
- Trapping focus outside of a modal/drawer.
- Keyboard shortcuts conflicting with screen readers (`Alt + <letter>` rule:
  reserved combinations only).

## 3. Screen Reader Support

### 3.1 Announcements

| Event                  | Mechanism                                             | Politeness |
| ---------------------- | ----------------------------------------------------- | ---------- |
| Tx state change        | `aria-live="polite"` region in `<TxStepper>`          | polite     |
| Toast (info / success) | `aria-live="polite"`                                  | polite     |
| Toast (warn / danger)  | `aria-live="assertive"`                               | assertive  |
| Form error appearance  | `aria-describedby` + `role="alert"` on the error node | assertive  |
| Skeleton → loaded      | `aria-busy` toggles; content replaces in place        | implicit   |
| Modal open             | dialog role + `aria-labelledby` to title              | implicit   |

### 3.2 Required ARIA

- Every primary nav link: `aria-current="page"` when active.
- Every input: `aria-describedby` to hint + error.
- Every status chip: `aria-label` repeating the textual status (`Settled · win`).
- Every icon-only button: `aria-label` describing the action.

### 3.3 Forbidden ARIA

- `role="button"` on `<div>` when `<button>` is appropriate.
- `aria-label` overriding visible label without justification.
- `aria-hidden="true"` on focusable elements.
- Duplicate `aria-label` and visible label that say different things.

## 4. Contrast

| Surface                   | Token pair                    | Minimum ratio     | Target |
| ------------------------- | ----------------------------- | ----------------- | ------ |
| body text on surface-0    | `--fg` / `--surface-0`        | 7:1 (AAA)         | 8.5:1  |
| body text on surface-1    | `--fg` / `--surface-1`        | 7:1 (AAA)         | 8.0:1  |
| muted text on surface-2   | `--fg-muted` / `--surface-2`  | 4.5:1 (AA)        | 5.0:1  |
| caption text on surface-2 | `--fg-subtle` / `--surface-2` | 4.5:1 (AA)        | 4.5:1  |
| brand button label        | `--fg-inverse` / `--brand`    | 4.5:1 (AA)        | 5.0:1  |
| focus ring                | `--ring` / adjacent surface   | 3:1 (non-text AA) | 3.5:1  |
| danger pill text          | `--danger` / `--danger-soft`  | 4.5:1             | 5.0:1  |

If a token-pair contrast falls below the target, **adjust the token, not the
local style**. Tokens that fail any AA pair at design time block adoption.

Tooling: `pa11y` and `axe-core` run in CI against every page state.

## 5. Color & Information

No information may be conveyed by **color alone**. Every status pill, chart
series, and progress segment includes:

- a textual label (`Settled · win` not just green)
- a shape/icon differentiator where space-constrained
- a pattern fallback for charts

Test: a screenshot rendered in grayscale must still be parseable.

## 6. Motion Accessibility

See `../design/12-motion.md §4`. Reduced-motion preference fully respected.
No exception — including marketing animations.

## 7. Forms

Detailed in `../design/15-forms.md §7`. Summary:

- `<label>` mandatory.
- `aria-invalid` toggles with validation.
- Error nodes `role="alert"` + `aria-describedby` wired.
- Submit button disabled state announced via `aria-disabled`.

## 8. Charts

Charts must include:

- a textual data summary (visually hidden `sr-only` or visible caption).
- a `<details>` element with a data table fallback.
- focusable points with `aria-label` per point (or grouped summary).

We do not use chart libraries that don't support keyboard nav. Approved
library: `visx` (composable, headless), with our own keyboard handling.

## 9. Internationalization & Direction

We are LTR-only in v1. The infrastructure supports RTL (see
`21-i18n.md §6`); active toggle requires re-audit of components for
mirror-friendliness.

## 10. Testing

| Layer                    | Tool                                        | Coverage                       |
| ------------------------ | ------------------------------------------- | ------------------------------ |
| Unit                     | `vitest` + `@testing-library/jest-dom`      | primitive a11y (label / aria)  |
| Component                | `@storybook/test` + `@storybook/addon-a11y` | one a11y story per state       |
| Visual / a11y page-level | `@axe-core/playwright`                      | every primary route in `03-IA` |
| Manual                   | screen reader + keyboard QA                 | release-gate ad hoc            |

Critical violations (Serious/Critical) fail CI. Moderate violations fail CI
unless an exception is registered with an expiry date.

## 11. Exceptions Registry

Exceptions live in `docs/frontend/a11y-exceptions.md`:

```md
| ID    | Rule           | File    | Reason                    | Expires    |
| ----- | -------------- | ------- | ------------------------- | ---------- |
| A-001 | color-contrast | <route> | Pending design adjustment | 2026-06-01 |
```

A PR adding an exception requires Frontend Lead approval.

## 12. Don'ts

- No fixed pixel font sizes that don't scale with user zoom.
- No `prefers-reduced-motion: no-preference` assumption.
- No focus-shifting on hover.
- No mouse-only interactions (drag-and-drop without keyboard alternative).
- No CAPTCHA without an accessible fallback (we don't ship CAPTCHA in v1).
- No autoplay video with sound.
- No flashing > 3 Hz (seizure risk).
- No `placeholder` as sole label.
- No `outline-none` on focus indicators.

## 13. How To Enforce

```bash
# Run axe across all primary routes
pnpm e2e:a11y

# Storybook addon-a11y in CI
pnpm -C frontend/packages/ui test:a11y

# ESLint rules (jsx-a11y)
pnpm -C frontend lint
```

Required jsx-a11y rules (subset):

- `jsx-a11y/alt-text`: error
- `jsx-a11y/aria-props`: error
- `jsx-a11y/aria-role`: error
- `jsx-a11y/click-events-have-key-events`: error
- `jsx-a11y/label-has-associated-control`: error
- `jsx-a11y/no-noninteractive-element-interactions`: error
- `jsx-a11y/no-redundant-roles`: error
- `jsx-a11y/role-supports-aria-props`: error
- `jsx-a11y/tabindex-no-positive`: error
- `jsx-a11y/anchor-is-valid`: error

## 14. Glossary

| Term            | Meaning                                                   |
| --------------- | --------------------------------------------------------- |
| WCAG            | Web Content Accessibility Guidelines                      |
| Section 508     | US federal accessibility standard                         |
| EN 301 549      | EU accessibility standard                                 |
| `aria-live`     | Region whose changes are announced by screen readers      |
| Focus trap      | Constraining tab focus to within a region (modal)         |
| Roving tabindex | One focusable element at a time within a composite widget |
