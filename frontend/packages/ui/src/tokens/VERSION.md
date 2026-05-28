# ArbiGameFi Design Tokens Version

| Field         | Value                             |
| ------------- | --------------------------------- |
| Token Version | 2.0.0                             |
| Status        | Active                            |
| Last Updated  | 2026-05-28                        |
| Source        | `docs/design/10-design-tokens.md` |

This file tracks the token contract implemented by `arbi-dark.css`,
`arbi-light.css`, and the Tailwind v4 `@theme inline` block in
`../styles/globals.css`.

Breaking token changes require an ADR and a version bump before product pages
consume the new contract.

## 2.0.0 — Tailwind v4 (CSS-first)

- Migrated from `tailwind-preset.ts` + `tailwind.config.ts` (both removed) to a
  CSS-first `@theme inline` block in `styles/globals.css`. CSS variables remain
  the single source of truth; the mapping generates the Tailwind utility layer.
- Added `--border-strong` token (dark + light) → `border-border-strong` utility
  and `hsl(var(--border-strong))` value.
- Re-expressed `duration-fast/base/slow` as explicit `@utility` rules backed by
  `--motion-*` (Tailwind v4 has no named-duration theme namespace).
- Skeleton background re-expressed as `@utility bg-skeleton` / `bg-skeleton-size`.

## 1.1.0

- Added motion duration tokens: `--motion-fast`, `--motion-base`, `--motion-slow`.
- Exposed Tailwind duration aliases and tokenized accordion animation durations.
- Added the shared `shimmer` animation primitive for loading surfaces.
