# 10 · Design Tokens

| Owner | Frontend Lead + Design Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `01-brand.md` |
| Supersedes | `frontend/packages/ui/src/themes/visual-system.ts`, all `--ag-*` ad-hoc variables, all hex literals in product UI |

This is the **canonical token spec**. Every color, radius, shadow, font, and
spacing value visible to a user must resolve to a token defined here.

## 1. Token Source

> One source of truth: CSS variables in `@ssot/ui/themes/arbi-dark.css` (and
> any sibling theme files for `arbi-light.css`, `partner-*.css`). Tailwind
> aliases these via the preset. **There is no second source.**

Disallowed:

- TypeScript objects exporting Tailwind class strings as tokens
  (`visual-system.ts`, deleted).
- Page-local `bg-[#hex]`, `rounded-[NNNpx]`, `shadow-[...]` literals.
- Independent CSS variables in `apps/web` that duplicate `@ssot/ui` tokens
  (`--ag-*`, deleted).

## 2. Color Tokens

Color values are declared in HSL **components** (without the `hsl()` wrapper)
so Tailwind can compose `hsl(var(--token) / <alpha>)`.

### 2.1 Dark theme (default)

```css
/* packages/ui/src/themes/arbi-dark.css */
:root {
  /* Surfaces */
  --surface-0: 220 39% 4%; /* page background */
  --surface-1: 220 35% 7%; /* app shell, header */
  --surface-2: 220 30% 11%; /* card, panel, modal */
  --surface-3: 220 26% 16%; /* hover, active fill */

  /* Foregrounds */
  --fg: 210 40% 98%; /* default text */
  --fg-muted: 215 16% 65%; /* secondary text, label */
  --fg-subtle: 215 14% 45%; /* disabled, caption-2 */
  --fg-inverse: 222 47% 11%; /* text on brand-fill */

  /* Borders */
  --border: 220 20% 18%;
  --border-soft: 220 14% 14%;
  --border-strong: 220 24% 28%;

  /* Brand + accent */
  --brand: 255 92% 66%;
  --brand-hover: 255 92% 71%;
  --brand-active: 255 92% 60%;
  --accent: 170 84% 60%;
  --accent-hover: 170 84% 65%;

  /* Semantic */
  --success: 145 65% 52%;
  --success-soft: 145 60% 20%;
  --warn: 38 92% 60%;
  --warn-soft: 38 80% 22%;
  --danger: 0 84% 62%;
  --danger-soft: 0 70% 24%;
  --info: 210 80% 60%;
  --info-soft: 210 70% 22%;

  /* Focus ring */
  --ring: var(--brand);
}
```

### 2.2 Light theme

```css
/* packages/ui/src/themes/arbi-light.css */
:root {
  --surface-0: 0 0% 100%;
  --surface-1: 220 20% 98%;
  --surface-2: 220 14% 96%;
  --surface-3: 220 14% 92%;

  --fg: 222 47% 11%;
  --fg-muted: 215 16% 47%;
  --fg-subtle: 215 14% 67%;
  --fg-inverse: 210 40% 98%;

  --border: 220 14% 88%;
  --border-soft: 220 14% 93%;
  --border-strong: 220 14% 76%;

  --brand: 255 92% 56%;
  --brand-hover: 255 92% 50%;
  --brand-active: 255 92% 46%;
  --accent: 170 80% 40%;
  --accent-hover: 170 80% 35%;

  --success: 145 65% 38%;
  --success-soft: 145 60% 92%;
  --warn: 38 92% 45%;
  --warn-soft: 38 80% 92%;
  --danger: 0 80% 50%;
  --danger-soft: 0 70% 94%;
  --info: 210 80% 45%;
  --info-soft: 210 70% 94%;

  --ring: var(--brand);
}
```

### 2.3 Theme switching

The `.dark` selector is **not** used. We swap entire variable scopes via the
`data-theme` attribute on `<html>`:

```html
<html data-theme="dark">
  <!-- imports arbi-dark -->
  <html data-theme="light">
    <!-- imports arbi-light -->
  </html>
</html>
```

The Tailwind preset is theme-agnostic — it consumes variables only.

### 2.4 Tailwind aliases

```ts
// packages/ui/src/tailwind-preset.ts
const c = (v: string) => `hsl(var(${v}))`;
const ca = (v: string) => `hsl(var(${v}) / <alpha-value>)`;

theme: {
  extend: {
    colors: {
      surface: { 0: ca('--surface-0'), 1: ca('--surface-1'),
                 2: ca('--surface-2'), 3: ca('--surface-3') },
      fg:      { DEFAULT: ca('--fg'), muted: ca('--fg-muted'),
                 subtle: ca('--fg-subtle'), inverse: ca('--fg-inverse') },
      border:  { DEFAULT: ca('--border'), soft: ca('--border-soft'),
                 strong: ca('--border-strong') },
      brand:   { DEFAULT: ca('--brand'), hover: ca('--brand-hover'),
                 active: ca('--brand-active') },
      accent:  { DEFAULT: ca('--accent'), hover: ca('--accent-hover') },
      success: { DEFAULT: ca('--success'), soft: ca('--success-soft') },
      warn:    { DEFAULT: ca('--warn'),    soft: ca('--warn-soft') },
      danger:  { DEFAULT: ca('--danger'),  soft: ca('--danger-soft') },
      info:    { DEFAULT: ca('--info'),    soft: ca('--info-soft') },
    },
    ringColor: { DEFAULT: c('--ring') },
  }
}
```

Usage: `bg-surface-1`, `text-fg-muted`, `border-border-soft`, `bg-brand`,
`bg-success-soft text-success`.

## 3. Radius Tokens

```css
:root {
  --radius-sm: 8px; /* inputs, compact buttons, table cells */
  --radius-md: 12px; /* default buttons, list rows, menus */
  --radius-lg: 18px; /* cards, panels, drawer */
  --radius-xl: 24px; /* hero composed surfaces only */
  --radius-pill: 9999px; /* status chips, tabs (only) */
}
```

Tailwind:

```ts
borderRadius: {
  none: '0',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-pill)',
}
```

**Forbidden**: `rounded-[2rem]`, `rounded-[2.5rem]`, `rounded-[1.5rem]`,
`rounded-2xl`, `rounded-3xl`. Any commit re-introducing them fails CI.

## 4. Elevation Tokens

```css
:root {
  --elev-1: 0 1px 2px rgb(0 0 0 / 0.4);
  --elev-2: 0 4px 16px rgb(0 0 0 / 0.35), 0 1px 2px rgb(0 0 0 / 0.4);
  --elev-3: 0 12px 32px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.4);
  --elev-glow:
    0 0 0 1px hsl(var(--brand) / 0.45), 0 8px 32px hsl(var(--brand) / 0.18);
  --elev-inner-1: inset 0 1px 0 hsl(var(--fg) / 0.06);
}
```

Tailwind:

```ts
boxShadow: {
  e1: 'var(--elev-1)',
  e2: 'var(--elev-2)',
  e3: 'var(--elev-3)',
  glow: 'var(--elev-glow)',
}
```

Semantics:

| Token         | Use                            |
| ------------- | ------------------------------ |
| `shadow-e1`   | sticky header, table row hover |
| `shadow-e2`   | panels, popovers               |
| `shadow-e3`   | modals, drawers                |
| `shadow-glow` | only on focused primary CTA    |

Inline `shadow-[...]` literals are banned.

## 5. Spacing & Sizing

Spacing follows the **4-px grid**. Allowed Tailwind classes:

| Step | px  | Examples           |
| ---- | --- | ------------------ |
| 0    | 0   | —                  |
| 0.5  | 2   | rare               |
| 1    | 4   | tight inline gap   |
| 2    | 8   | default inline gap |
| 3    | 12  | compact stack      |
| 4    | 16  | default stack      |
| 5    | 20  | section row        |
| 6    | 24  | section gap        |
| 8    | 32  | large section gap  |
| 10   | 40  | container gap      |
| 12   | 48  | between sections   |
| 16   | 64  | major divider      |
| 20   | 80  | hero               |
| 24   | 96  | hero               |

Forbidden: `gap-7`, `gap-9`, `gap-11`, `gap-13`. They break the rhythm.

Container widths (declared once):

```ts
maxWidth: {
  prose: '64ch',
  shell: '1440px',
  shell-wide: '1600px',
}
```

## 6. Typography

### 6.1 Faces

```ts
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
```

CSS:

```css
:root {
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:
    "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
```

### 6.2 Type roles

The eight roles. Tailwind plugin `typography-roles` provides utility classes
mapping to these:

| Role              | Tailwind       | Size / line / tracking | Weight          |
| ----------------- | -------------- | ---------------------- | --------------- |
| `text-display-xl` | `t-display-xl` | 64 / 1.05 / -0.02em    | 700             |
| `text-display-lg` | `t-display-lg` | 48 / 1.08 / -0.02em    | 700             |
| `text-display-md` | `t-display-md` | 32 / 1.12 / -0.01em    | 600             |
| `text-title-lg`   | `t-title-lg`   | 24 / 1.2 / -0.005em    | 600             |
| `text-title-md`   | `t-title-md`   | 18 / 1.3 / 0           | 600             |
| `text-body`       | `t-body`       | 14 / 1.5 / 0           | 400             |
| `text-caption`    | `t-caption`    | 12 / 1.4 / 0.01em      | 500             |
| `text-mono`       | `t-mono`       | 12 / 1.4 / 0           | 500 + mono face |

Mobile clamps: display-xl clamps to 40 px at sm breakpoint, display-lg clamps
to 32 px.

### 6.3 Anti-patterns

- Direct `text-5xl`, `text-7xl`, `text-[5.5rem]`. Use a role.
- Inline `tracking-tighter`, `tracking-widest` outside the role definition.
- `uppercase` outside `text-caption` for status pills. Never on body text.

## 7. Iconography Tokens

| Token       | Use                    |
| ----------- | ---------------------- |
| `--icon-xs` | 12 px (caption inline) |
| `--icon-sm` | 16 px (button leading) |
| `--icon-md` | 20 px (table cell)     |
| `--icon-lg` | 24 px (panel header)   |
| `--icon-xl` | 32 px (illustration)   |

Icon stroke must equal `1.5` for `@heroicons/react/24/outline`. Solid icons
use `@heroicons/react/24/solid` only when semantic-on state is needed.

## 8. Motion Tokens

Detailed in `12-motion.md`. The values live here:

```css
:root {
  --ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

  --dur-instant: 80ms;
  --dur-fast: 140ms;
  --dur-normal: 220ms;
  --dur-slow: 360ms;
}
```

## 9. Z-Index Tokens

```css
:root {
  --z-base: 0;
  --z-sticky: 10;
  --z-overlay: 20;
  --z-dropdown: 30;
  --z-drawer: 40;
  --z-modal: 50;
  --z-toast: 60;
  --z-tooltip: 70;
}
```

Inline `z-[9999]` is banned. The toast layer is the highest at 60 unless a
tooltip is hovered.

## 10. Breakpoints

```ts
screens: {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}
```

Density rules:

- `< sm`: stack only (no 2-col grids).
- `sm`–`md`: 2-col allowed.
- `md`–`lg`: 2-col default; sidebar collapses to drawer.
- `lg`+: 3-col allowed; sidebar visible.
- `2xl`+: shell width caps at 1600 px; never edge-to-edge text.

## 11. Versioning

Tokens are versioned semantically:

- **Patch**: value change inside the same semantic role (re-tune `--brand`
  saturation). No code changes required downstream.
- **Minor**: new token added. Backwards compatible.
- **Major**: token renamed or removed. Requires ADR + downstream PRs.

Version is declared in `packages/ui/package.json` and printed by
`Storybook → Design Tokens` page.

## 12. Partner Themes

Future partner deployments override tokens by importing a partner stylesheet
**after** `arbi-dark.css`:

```ts
// apps/web/src/app/globals.css
@import '@ssot/ui/themes/arbi-dark.css';
@import '@ssot/ui/themes/partner-xyz.css'; /* optional override */
```

Partner themes may override only `--brand`, `--accent`, and surface tokens.
Semantic colors and radius/elevation/motion tokens are **not** partner-themable.

## 13. Don'ts

- No hex literal in product UI.
- No `dark:` Tailwind variant (we swap themes via `data-theme`, not class).
- No more than four surface levels.
- No additional brand or accent color beyond the two declared.
- No arbitrary radius or shadow.
- No "system" font fallback ahead of Inter in body copy.
- No `data-theme` modifier inside components — components are theme-agnostic.

## 14. How To Enforce

```bash
# Hex literal scan
rg -nE "bg-\\[#|text-\\[#|border-\\[#|shadow-\\[" frontend/apps/web/src frontend/packages/ui/src \
  | rg -v "// allow-token-literal"

# Forbidden radius classes
rg -nE "rounded-(2xl|3xl|\\[)" frontend/apps/web/src frontend/packages/ui/src

# Forbidden gap classes (off-rhythm)
rg -nE "\\b(gap|space-[xy]|p|px|py|m|mx|my)-(7|9|11|13)\\b" frontend/apps/web/src

# Inline shadow literal
rg -nE "shadow-\\[" frontend/apps/web/src

# dark: variant (we use data-theme)
rg -nE "\\bdark:" frontend/apps/web/src frontend/packages/ui/src

# Token version file present
test -f frontend/packages/ui/src/themes/VERSION.md
```

All six become CI checks. See `../frontend/24-testing.md §6`.

## 15. Migration

Phase 1 of the rewrite blueprint:

1. Land `arbi-dark.css` and `arbi-light.css`.
2. Rewrite Tailwind preset to consume them.
3. Replace every hex literal — `rg`-driven sweep.
4. Delete `visual-system.ts`, `--ag-*`, `cyber-*` primitives.
5. Visual regression baseline becomes the new reference.

Migration is not done until every check in §14 returns zero matches in
product UI.
