# ADR-0003 · Single Design-Token Source

| Status | Accepted |
| Date | 2026-05-14 |
| Owner | Frontend Lead + Design Lead |
| Reviewers | Eng team |
| Supersedes | — |
| Superseded by | — |
| Affects | `frontend/packages/ui/src/tokens/**`, `frontend/packages/ui/src/styles/globals.css`, `frontend/apps/web/src/app/globals.css`, `docs/design/10-design-tokens.md`, `docs/design/01-brand.md` |

## 1. Context

Shared components and product pages need the same color, radius, shadow,
typography, and motion values in both themes. Independent token definitions
would let those consumers drift and make theme changes inconsistent.

## 2. Decision

There is **exactly one source of design tokens**: CSS variables defined in
`frontend/packages/ui/src/tokens/arbi-dark.css` (and sibling `arbi-light.css`
for light theme). The `@theme inline` block in
`frontend/packages/ui/src/styles/globals.css` maps those variables to Tailwind
utilities. Product pages consume these shared tokens instead of defining a
second palette or token system.

## 3. Rationale

- **Drift is the root cause.** A second token source becomes a target for
  improvisation. The only durable answer is one source.
- **CSS variables are the right primitive.** They cross the
  RSC / Client / Storybook / preview boundary cleanly.
- **Tailwind aliases keep DX fast.** Devs write `bg-surface-2`, not
  `bg-[hsl(var(--surface-2))]`.
- **Shared aliases stay inspectable.** Utility classes resolve to the same
  CSS variables that inline styles and third-party component adapters consume.

## 4. Alternatives Considered

| Alternative                                   | Pros                              | Cons                                 | Why not chosen                               |
| --------------------------------------------- | --------------------------------- | ------------------------------------ | -------------------------------------------- |
| Independent component token systems          | Local customization               | Drift and conflicting definitions   | Rejected                                     |
| Style Dictionary multi-platform tokens        | Vendor-neutral, multi-output      | Adds a build step for a web UI       | Unnecessary for the current consumers         |
| CSS variables + Tailwind `@theme inline`       | One token source with native utilities | Requires explicit aliases       | Adopted                                      |
| CSS-in-JS theming (Vanilla Extract, Stitches) | Type-safe, scoped                 | Adds bundle, breaks RSC boundary     | Rejected                                     |

## 5. Consequences

Positive:

- Single mental model for color / radius / shadow / typography.
- Theming (light, partner) is a stylesheet swap.
- RSC / Client / Storybook agree.
- CI grep rules become trivial.

Negative:

- Some plugins (charts) need a small adapter to consume HSL.

Neutral:

- Hot reload behavior identical to existing setup.

## 6. Implementation Rules

1. Define token values in the dark and light token stylesheets.
2. Keep Tailwind color, radius, shadow, and animation aliases in the shared
   `@theme inline` block; aliases reference the source variables.
3. The web app imports `@ssot/ui/styles/globals.css`. Page-specific motion and
   layout rules may live in app CSS without redefining the shared token values.
4. Components use the shared utilities or CSS variables. Check changes in both
   themes and include contrast checks for new token values.

## 7. SSOT Documents Affected

- `docs/design/10-design-tokens.md` — full token spec.
- `docs/design/01-brand.md` — references the new token names.
- `docs/design/11-component-library.md` — primitives import only token-based
  classes.
- `frontend/CLAUDE.md` — Hard rule 1 + Hard rule 4.

## 8. Acceptance Criteria

- [ ] Product UI does not introduce independent color-token definitions.
- [ ] All Tailwind utilities consuming colors resolve to CSS variables.
- [ ] Storybook "Tokens" page renders from the new source.
- [ ] Theme switch via `data-theme` works in Storybook and the app.

## 9. References

- Frontend audit `docs/design/north-star.md §1`.
- Charter `docs/design/00-charter.md §7-N1, N5`.
- `docs/design/10-design-tokens.md` (canonical spec).
- [Shared Tailwind aliases](../../../frontend/packages/ui/src/styles/globals.css)
- [Web stylesheet entry](../../../frontend/apps/web/src/app/globals.css)
