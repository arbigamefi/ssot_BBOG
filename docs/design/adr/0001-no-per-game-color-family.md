# ADR-0001 · No Per-Game Brand Color Family

| Status | Accepted |
| Date | 2026-05-14 |
| Owner | Frontend Lead |
| Reviewers | Design Lead, Product Lead |
| Supersedes | — |
| Superseded by | — |
| Affects | `docs/design/01-brand.md`, `docs/design/10-design-tokens.md`, `docs/design/11-component-library.md`, `docs/design/04-page-blueprints.md`, `frontend/packages/ui/**`, `frontend/apps/web/src/app/**` |

## 1. Context

The pre-rewrite frontend assigns a distinct brand color family to each casino
game:

- Dice — purple
- Roulette — emerald
- Coin Toss — amber
- Keno — fuchsia

Subsequent v1.3 additions would extend this pattern (Baccarat, Plinko, Sic
Bo, Slots — each demanding its own hue). Evidence in
`apps/web/src/app/games/pageClient_list.tsx:67-100` (`ROOM_THEME_MAP`).

This produces a "rainbow pizza" effect across the casino directory and
home page, undermining the institutional positioning declared in
`docs/design/00-charter.md §3 Principle 3 (Restraint)`.

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

- Drops 7 color-token branches (`--game-*-{50,100,...,900}` style families).
- Simplifies focus / CTA / link / hover semantics.
- Improves a11y audit predictability.
- Aligns ArbiGameFi with institutional positioning.

Negative:

- The current home page (715 LOC) and `pageClient_list.tsx` need refactor.
- Brand "personality per game" must come from icon + interaction, not hue.

Neutral:

- Light theme inherits the same constraint.

## 6. Migration Plan

1. Remove `ROOM_THEME_MAP` from `pageClient_list.tsx`.
2. Update game cards in `apps/web/src/app/page.tsx` and `casino` directory
   to use uniform brand styling.
3. Update icons to geometric primitives per game (see
   `docs/design/01-brand.md §5`).
4. Land `docs/design/01-brand.md §3 Brand Palette` with `--brand` and
   `--accent` only.
5. Add CI rule scanning for forbidden patterns:
   ```bash
   rg -nE "--game-(dice|roulette|coin|keno|slots|sicbo|baccarat|plinko)-" frontend/
   ```

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
- [ ] `pageClient_list.tsx` no longer references `ROOM_THEME_MAP`.

## 9. References

- Frontend audit `docs/design/north-star.md §1 Current Findings`.
- Charter `docs/design/00-charter.md §3, §7-N2`.
