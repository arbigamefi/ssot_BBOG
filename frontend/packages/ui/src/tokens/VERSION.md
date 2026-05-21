# ArbiGameFi Design Tokens Version

| Field         | Value                             |
| ------------- | --------------------------------- |
| Token Version | 1.1.0                             |
| Status        | Active                            |
| Last Updated  | 2026-05-18                        |
| Source        | `docs/design/10-design-tokens.md` |

This file tracks the token contract implemented by `arbi-dark.css`,
`arbi-light.css`, and `tailwind-preset.ts`.

Breaking token changes require an ADR and a version bump before product pages
consume the new contract.

## 1.1.0

- Added motion duration tokens: `--motion-fast`, `--motion-base`, `--motion-slow`.
- Exposed Tailwind duration aliases and tokenized accordion animation durations.
- Added the shared `shimmer` animation primitive for loading surfaces.
