# 12 · Motion

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `10-design-tokens.md`, `frontend-implementation-roadmap.md` |
| Supersedes | Draft v1 motion catalog |

Motion is functional. It should clarify state, not decorate the product.

## 1. Allowed Motion

Use motion only for:

- button press feedback;
- modal/drawer reveal;
- tab or segmented-control selection;
- loading and skeleton states;
- transaction status changes;
- result receipt reveal;
- small number transitions where a sudden jump would be confusing.

Everything else should be static unless the user-visible benefit is obvious.

## 2. Timing

Use the token durations from `10-design-tokens.md`:

| Purpose                         | Duration        |
| ------------------------------- | --------------- |
| press feedback                  | `--dur-instant` |
| reveal / toast / chip           | `--dur-fast`    |
| modal / drawer / result receipt | `--dur-normal`  |
| number tween / skeleton         | `--dur-slow`    |

Prefer transform and opacity. Avoid layout-affecting animation.

## 3. Reduced Motion

Respect `prefers-reduced-motion`.

Fallbacks:

- slides become fades;
- number tweens become instant updates;
- skeleton pulses become static bars;
- spinners may become static loading text;
- decorative motion is removed.

## 4. Casino-Specific Rule

The casino room may animate while a round is in progress, but the animation
must track real state:

```text
placing -> waiting_vrf -> settling -> settled/refunded/failed
```

Do not use animation to imply that a result has settled before chain-derived
state confirms it.

## 5. Do Not Do

- No `transition-all`.
- No scattered `hover:scale-105`.
- No confetti, fireworks, particle systems, mascot motion, or parallax.
- No looping decorative glow.
- No animation that blocks screen-reader output or delays actionable status.
- No new keyframes in feature code.

## 6. Verification

```bash
rg -nE "transition-all|animate-(pulse|bounce|spin|ping)" frontend/apps/web/src \
  | rg -v "// motion-allow"

rg -lE "@keyframes" frontend/apps/web frontend/packages/ui/src \
  | rg -vE "packages/ui/src/motion|packages/ui/src/primitives/(toast|skeleton)\\.tsx"
```
