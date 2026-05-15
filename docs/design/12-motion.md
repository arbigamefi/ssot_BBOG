# 12 · Motion

| Owner | Frontend Lead + Design Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `10-design-tokens.md` |
| Supersedes | `north-star.md §3.7` |

Motion in ArbiGameFi is **functional**, not decorative. Every animation
either communicates a state transition or guides attention. Motion that
exists "because it looks cool" is rejected.

## 1. Principles

1. **Purposeful**. Motion answers a question: "what changed?", "where did
   that come from?", "what should I look at next?".
2. **Restrained**. At most **two** concurrent animations on a single screen.
3. **Honest**. Motion duration reflects perceived effort. A 10-step transaction
   doesn't finish in 80 ms.
4. **Reduced-motion-safe**. `prefers-reduced-motion` short-circuits every
   non-essential animation to a fade or static state.
5. **No surprise bounce**. We use eased curves, not overshoot/spring unless
   explicitly designed for confirmation.

## 2. Motion Tokens

Defined in `10-design-tokens.md §8`:

```css
--ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

--dur-instant: 80ms;
--dur-fast: 140ms;
--dur-normal: 220ms;
--dur-slow: 360ms;
```

## 3. The Motion Catalog

Every animation in product UI maps to one of these archetypes.

| Archetype            | Where                          | Duration    | Easing          | Notes                                       |
| -------------------- | ------------------------------ | ----------- | --------------- | ------------------------------------------- |
| **Press**            | buttons, toggles               | instant     | standard        | `scale: 0.98` on `:active`                  |
| **Reveal**           | toasts, banners, popovers      | fast        | decelerate      | fade + 4px translate                        |
| **Drawer slide**     | sheet, drawer                  | normal      | emphasized      | from right (desktop) / from bottom (mobile) |
| **Modal pop**        | dialog                         | normal      | emphasized      | fade-in + 8px translate-y                   |
| **Tab change**       | tabs underline                 | fast        | standard        | width + x interpolation                     |
| **Skeleton pulse**   | skeleton                       | slow        | linear (looped) | reduced-motion → static muted bar           |
| **Number tween**     | `<AnimatedNumber>`             | slow        | emphasized      | only on big change (>1%)                    |
| **Status flash**     | tx success / fail confirmation | normal once | emphasized      | brand glow ring expand-then-fade            |
| **Route transition** | between top-level routes       | normal      | standard        | crossfade only; no slide                    |
| **Stagger reveal**   | hero / marketing entry only    | normal      | decelerate      | children 30ms apart, max 6 children         |
| **Loading spinner**  | indeterminate wait             | continuous  | linear          | reduced-motion → static `Loading` text      |

Nothing else animates without an ADR.

## 4. Reduced Motion

```ts
// packages/ui/src/motion/presets.ts
import { useReducedMotion } from "framer-motion";

export function useMotion() {
  const reduced = useReducedMotion();
  return {
    duration: reduced ? 0 : 0.22,
    ease: reduced ? "linear" : [0.16, 1, 0.3, 1],
    skipDecorative: !!reduced,
  };
}
```

Reduced-motion behavior matrix:

| Default motion              | Reduced-motion fallback                       |
| --------------------------- | --------------------------------------------- |
| Press scale                 | none                                          |
| Reveal fade+translate       | fade only                                     |
| Drawer slide                | fade only                                     |
| Modal pop                   | fade only                                     |
| Tab underline interpolation | instant jump                                  |
| Skeleton pulse              | static `bg-surface-3` bar                     |
| Number tween                | instant value                                 |
| Status flash                | static `bg-success-soft` for 1s, then default |
| Route transition            | instant                                       |
| Stagger reveal              | instant                                       |
| Loading spinner             | text `Loading…`                               |

`prefers-reduced-motion` is detected globally and surfaced via context. No
component decides on its own to ignore it.

## 5. Motion Presets

Implemented in `packages/ui/src/motion/presets.ts`:

```ts
export const m = {
  press: { whileTap: { scale: 0.98 } },
  reveal: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
    transition: { duration: 0.14, ease: "easeOut" },
  },
  drawer: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  modal: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.14, ease: "easeOut" },
  },
  stagger: (delay = 0.03) => ({
    animate: { transition: { staggerChildren: delay } },
  }),
};
```

Anything not in `m` requires PR review + ADR.

## 6. Page Transition Contract

Default: **no** page transition. The first paint of a route loads via the
existing RSC streaming; layout shifts are minimized through skeleton.

Crossfade for marketing → product transitions only:

```tsx
<AnimatePresence mode="wait">
  <motion.main key={pathname} {...m.fade}>
    {children}
  </motion.main>
</AnimatePresence>
```

Per-route slide transitions are banned. They steal attention from the actual
page content.

## 7. Number Animation

`<AnimatedNumber>` (in `11-component-library.md §4.10`) implements:

- Tween only when the relative change exceeds the configured threshold
  (default `1%`). Smaller changes set instantly to avoid jitter.
- Format-aware: amounts use a non-linear lerp that flips through digits at
  decreasing speed; multipliers use linear lerp.
- Caps at 1.5x `--dur-slow` (~540 ms). Anything longer makes the UI feel slow.

## 8. Glow & Status Flash

Banned outside `<StatusFlash>`:

- arbitrary `drop-shadow-[0_0_15px_...]`
- `animate-pulse` on decorative elements
- `bg-gradient-to-r from-fuchsia-...` decorative loops

Allowed once per state transition: a single flash from `--success-soft` /
`--warn-soft` / `--danger-soft` background fading to default surface over
`--dur-normal`, used only on:

- bet settled (`<StatusFlash variant="success">`)
- tx failed (`<StatusFlash variant="danger">`)
- result proposed in sportsbook market

## 9. Performance Budget for Motion

Hard limits per page:

| Metric                                              | Budget    |
| --------------------------------------------------- | --------- |
| Concurrent animations                               | ≤ 2       |
| Animated DOM nodes per second                       | ≤ 30      |
| Compositor-only properties (transform / opacity)    | required  |
| Layout-thrashing animations (top/left/width/height) | forbidden |
| Long task (`> 50 ms`) introduced by animation       | 0         |

Enforced by:

- ESLint rule banning `transition-all` (specify which property).
- ESLint rule banning `animate-` Tailwind utilities outside `@ssot/ui/motion`.
- Playwright performance assertions on home + casino room (`24-testing.md`).

## 10. Sound

There is no sound. Motion has no audio counterpart in v1. Audio cues will
require their own SSOT document if proposed.

## 11. Don'ts

- No `transition-all` outside emergency button polish. Use specific
  property transitions.
- No `hover:scale-105` scattered across pages. Use `m.press` or nothing.
- No keyframe definitions in feature code. All keyframes live in
  `motion/presets.ts` or `motion/primitives.ts`.
- No animation triggered on first paint by JS — RSC + skeleton is the
  default loading affordance.
- No "glassy shimmer" hover effects on cards.
- No mascot animations, particle systems, fireworks, confetti.
- No parallax in product UI (marketing is also off-limits for v1).
- No looping animations beyond skeleton-pulse and loading-spinner.

## 12. How To Enforce

```bash
# Banned utilities
rg -nE "transition-all|animate-(pulse|bounce|spin|ping)" frontend/apps/web/src \
  | rg -v "// motion-allow"

# Keyframes only in approved files
rg -lE "@keyframes" frontend/apps/web frontend/packages/ui/src \
  | rg -vE "packages/ui/src/motion|packages/ui/src/primitives/(toast|skeleton)\\.tsx"

# Inline glow patterns
rg -nE "drop-shadow-\\[|shadow-\\[0_0_" frontend/apps/web/src
```

CI rule: any matches outside `// motion-allow` opt-outs fail the build.

## 13. Accessibility Notes

- Every motion-triggering interaction must be reachable by keyboard with
  identical motion behavior (or reduced-motion fallback).
- `aria-busy` is set only during legitimate loading; not as a side effect of
  animation.
- Motion must not block screen-reader output. Toast content is announced
  before its motion completes.

## 14. Glossary

| Term                     | Meaning                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| Tween                    | A timed interpolation between two values                            |
| Easing                   | The curve describing how a tween changes over time                  |
| Stagger                  | Sequenced motion of sibling elements                                |
| Compositor-only          | CSS properties that don't trigger layout/paint (transform, opacity) |
| `prefers-reduced-motion` | OS-level user preference signaling motion sensitivity               |
