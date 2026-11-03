# 12 · Motion

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `10-design-tokens.md`, `../architecture/overview.md` |
| Supersedes | Draft v1 motion catalog |

Motion is functional. It should clarify state, not decorate the product.

## 1. Allowed Motion

Use motion only for:

- button press feedback;
- modal/drawer reveal;
- tab or segmented-control selection;
- loading and skeleton states;
- transaction status changes;
- printing, stamping and tearing a receipt (§3);
- small number transitions where a sudden jump would be confusing.

Everything else should be static unless the user-visible benefit is obvious.

## 2. Timing

Use the token durations from `10-design-tokens.md`:

| Purpose                | Duration        |
| ---------------------- | --------------- |
| press feedback, reveal | `--motion-fast` |
| drawer, toast, chip    | `--motion-base` |
| number tween, skeleton | `--motion-slow` |

Prefer transform and opacity. Avoid layout-affecting animation.

## 3. Printing

The receipt is the one orchestrated motion on the site:

- **Print.** The receipt feeds out of the slip in steps, like a thermal printer: a stepped
  vertical reveal over about 2.4s while the bet waits for randomness. It tracks real state: it
  starts when the bet is placed and holds on the last step until the result is read.
- **Stamp.** On settlement the stamp lands once (about 0.3s).
- **Punch.** Each roll is punched into the dice scale once (about 0.3s).
- **Tear.** "Place another bet" tears the receipt off (about 0.35s) before the slip resets.

On the home page the rotating receipt prints the same way, and only when the visitor asks for
the next one.

## 4. Reduced Motion

Respect `prefers-reduced-motion`.

Fallbacks:

- slides become fades;
- number tweens become instant updates;
- skeleton pulses become static bars;
- spinners may become static loading text;
- printing, stamping, punching and tearing become instant changes of content;
- decorative motion is removed.

## 5. Casino-Specific Rule

The casino room may animate while a round is in progress, but the animation
must track real state:

```text
placing -> waiting_vrf -> settling -> settled/refunded/failed
```

Do not use animation to imply that a result has settled before chain-derived
state confirms it.

## 6. Do Not Do

- No `transition-all`.
- No scattered `hover:scale-105`.
- No confetti, fireworks, particle systems, mascot motion, or parallax.
- No looping decorative glow.
- No animation that blocks screen-reader output or delays actionable status.
- No new keyframes in feature code.

## 7. Verification

```bash
rg -nE "transition-all|animate-(pulse|bounce|spin|ping)" frontend/apps/web/src \
  | rg -v "// motion-allow"

rg -lE "@keyframes" frontend/apps/web frontend/packages/ui/src \
  | rg -vE "packages/ui/src/motion|packages/ui/src/primitives/(toast|skeleton)\\.tsx"
```
