# 12 · Motion

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-11-09 |
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
- a game table that follows a bet's chain state, and the payment of a net win on it (§5);
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

- **Feed.** Once the bet is placed a short waiting slip feeds out of the printer's slot (about
  0.5s), and a row of dots feeds across it in steps while the bet waits for randomness
  (`animate-feed`, 1.8s a pass). It tracks real state: it runs from the moment the bet is placed
  until the result is read, and stops for a refund or a stuck bet.
- **Print.** When the table has shown the result, the receipt prints down out of the slot in
  steps, like a thermal printer (`animate-print`, about 1.4s). The printer's light blinks slowly
  while it waits and fast while it prints.
- **Stamp.** On settlement the stamp lands once (about 0.3s).
- **Tear.** "Bet again" and "Change bet" tear the receipt off (about 0.35s) before the slip
  resets.

On the home page the rotating receipt prints the same way, and only when the visitor asks for
the next one.

## 4. Reduced Motion

Respect `prefers-reduced-motion`.

Fallbacks:

- slides become fades;
- number tweens become instant updates;
- skeleton pulses become static bars;
- spinners may become static loading text;
- printing, stamping and tearing become instant changes of content;
- a game table places its ball on the result directly, shows no number before the result, and
  shows paid chips in place without sliding them;
- decorative motion is removed.

## 5. Casino-Specific Rule

The casino room may animate while a round is in progress, but the animation
must track real state:

```text
placing -> waiting_vrf -> settling -> settled/refunded/failed
```

Do not use animation to imply that a result has settled before chain-derived
state confirms it.

The dice table's ball is the reference:

- **Waiting for randomness:** it rolls back and forth along the whole scale at about 0.85 scale
  widths a second, ticking off each end. The readout shows only the number under the ball.
- **The number arrives:** the ball leaves the back-and-forth only when it is heading for the
  number with at least 0.3 × its speed to go, then rolls on a cubic Hermite from its position
  and speed to the number at rest, over T = min(1.8s, 3 × distance ÷ speed), so 0.9–1.8s. It
  never reverses, overshoots or slows for the line. A ±0.4-number settle of 0.36s follows, then
  the readout becomes a paper tag (`animate-settle`).
- **Several rounds:** each later round rolls from rest over 0.5–0.9s after a short pause.
- **Turning:** the ball's mark turns by the distance rolled over the radius.
- **Deadline:** the ball is on the number 4s after the number arrives, whether or not the tab
  gets animation frames, so the receipt never waits on frames.
- **A net win** (`02-voice-and-copy.md` §11): chips slide from the house edge onto the bet
  (0.56s each, 0.11s apart), the net amount comes in (`animate-pay-in`, `animate-pay-pulse`
  from 10×), the winning print glows (`animate-print-glow`) and the lamp warms
  (`animate-lamp-warm`, `animate-lamp-warm-big` from 10×). Each runs once.

The roulette wheel follows the same rules (`roulette-room/wheel-motion.ts`, a controller with no
DOM, tested on its own):

- **Between spins:** the wheel turns slowly (9°/s) only while the felt is on screen, and stands
  still under reduced motion. Nothing on the table hints at a number.
- **Waiting for randomness:** the ball circles the track at 516°/s against the wheel, which
  turns the other way at 36°/s.
- **The number arrives:** the ball slows at a steady rate relative to the wheel, from the speed it
  has, to rest in that number's pocket, over at least 2.2s (1.5s for each later round, after a
  0.7s pause). It only moves one way: it never passes the pocket and comes back. It may clip a
  deflector on the way, leaves the track for the last 20° only, drops into its own pocket,
  bounces three times (10, 5, 2 units) and rocks ±1.6° inside it; it never hops between pockets.
- **Deadline:** the ball is in the pocket 4.83s after the number arrives, and each later round
  4.38s after the one before it, whether or not the tab gets frames. The room's own fallback reveal waits 5.4s, plus
  4.4s for each later round.
- **The result:** the pocket lights and the others dim, the result ball comes in and a net win's
  chips slide onto the winning spot as on the dice table.
- **Reduced motion:** the ball is placed in the pocket directly; the wheel does not turn.

The slot reels follow them too (`slots-room/reel-motion.ts`, a controller with no DOM, tested on
its own):

- **Waiting for randomness:** the three reels wind up and spin at 15 symbols a second, with a
  vertical blur that softens as they slow. Between bets they stand still.
- **The number arrives:** each reel slows at a steady rate, from the speed it has, onto its
  symbol, never turning back. The reels stop left to right, at least 0.15s apart, each with a
  damped bounce of less than 0.15 of a symbol, so no other symbol reaches the pay line. Each later
  round spins at 26 symbols a second and stops faster, after a 0.26s pause.
- **Deadline:** the reels are on their symbols 4.99s after the number arrives, and each later
  round 3.11s after the one before it, whether or not the tab gets frames. The room's own
  fallback reveal waits 5.5s, plus 3.4s for each later round.
- **The result:** the line that was hit and its reels light up, and a net win's chips slide onto
  that line as on the dice table.
- **Reduced motion:** the reels show the symbols directly, with no spin or blur.

## 6. Do Not Do

- No `transition-all`.
- No scattered `hover:scale-105`.
- No confetti, fireworks, particle systems, mascot motion, or parallax, on the table or off it.
- No looping decorative glow.
- No animation that blocks screen-reader output or delays actionable status.
- No new keyframes in feature code: they live in `packages/ui/src/styles/globals.css`.

## 7. Verification

```bash
rg -nE "transition-all|animate-(pulse|bounce|spin|ping)" frontend/apps/web/src \
  | rg -v "// motion-allow"

rg -lE "@keyframes" frontend/apps/web frontend/packages/ui/src \
  | rg -vE "packages/ui/src/motion|packages/ui/src/primitives/(toast|skeleton)\\.tsx"
```
