# ADR-0001 · No Per-Game Brand Color Family

| Status | Accepted |
| Date | 2026-05-14 |
| Owner | Frontend Lead |
| Reviewers | Design Lead, Product Lead |
| Supersedes | — |
| Superseded by | — |
| Affects | `docs/design/01-brand.md`, `docs/design/10-design-tokens.md`, `docs/design/11-component-library.md`, `docs/design/04-page-blueprints.md`, `frontend/packages/ui/**`, `frontend/apps/web/src/app/**` |

## 1. Context

The casino directory presents eight games within one product. Giving each
game its own brand color fragments the directory and increases the number
of contrast and theme combinations to maintain. The
[charter](../00-charter.md) calls for restraint and a consistent product
identity across casino, sportsbook, and earn.

## 2. Decision

ArbiGameFi uses **one brand color (`--brand`) and one accent color
(`--accent`) across all verticals**. Casino games are differentiated by
icon, shape, and copy — never by color family.

## 3. Rationale

- Restraint is a brand principle; eight colors fights it.
- Casino, sportsbook, earn, portfolio, and ops are facets of one product.
  Color-coding facets implies they are separate products.
- Reference brands (Polymarket, Hyperliquid, Linear) consolidate to one
  brand color with semantic exceptions; reference brands we avoid
  (Stake, BC.Game, Roobet) use per-game color families.
- Token simplification: one `--brand` is a value-objective. N brand hues
  spiral combinatorially with depth × surface × state.
- A11y: per-game contrast requires per-game audit; one brand color is
  audited once.

## 4. Alternatives Considered

| Alternative                                  | Pros                            | Cons                                         | Why not chosen            |
| -------------------------------------------- | ------------------------------- | -------------------------------------------- | ------------------------- |
| Keep per-game color                          | Maximalist character            | Fragmented brand, audit cost, bloated tokens | Conflicts with Charter §3 |
| Per-vertical color (casino vs sportsbook)    | Mild differentiation            | Same problem at a coarser level              | Same conflict             |
| Single brand color + per-game geometric icon | Visually distinct without color | Requires icon design discipline              | Chosen                    |

## 5. Consequences

Positive:

- Avoids per-game color-token branches (`--game-*-{50,100,...,900}` style families).
- Simplifies focus / CTA / link / hover semantics.
- Improves a11y audit predictability.
- Aligns ArbiGameFi with institutional positioning.

Negative:

- Brand "personality per game" must come from icon + interaction, not hue.

Neutral:

- Light theme inherits the same constraint.

## 6. Implementation Rules

1. Use the shared `--brand` and `--accent` tokens in
   `frontend/packages/ui/src/tokens/arbi-dark.css` and `arbi-light.css`.
2. Keep game cards and actions on the same brand palette.
3. Differentiate games with icons and copy, following the
   [brand specification](../01-brand.md).
4. Check new game UI for per-game color families and contrast in both themes.

## 7. SSOT Documents Affected

- `docs/design/01-brand.md` — §3 (Palette), §5 (Illustration), §10 (Don'ts).
- `docs/design/10-design-tokens.md` — §2 (Color tokens).
- `docs/design/11-component-library.md` — `<BetSlip>` and game cards lose
  per-slug color props.
- `docs/design/04-page-blueprints.md` — `/casino` directory wireframe.
- `frontend/CLAUDE.md` — Hard rule 2.

## 8. Acceptance Criteria

- [ ] CI rule installed; `rg` evidence returns 0 matches in product UI.
- [ ] Storybook stories show all 8 games in the same brand palette.
- [ ] Visual regression baseline updated.
- [ ] Game cards do not define a per-game brand palette.

## 9. References

- Frontend audit `docs/design/north-star.md §1 Current Findings`.
- Charter `docs/design/00-charter.md §3, §7-N2`.
