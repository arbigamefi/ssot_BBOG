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

The keno blower follows them too (`keno-room/blower-motion.ts`, a controller with no DOM, tested
on its own):

- **Waiting for randomness:** the air comes on and the fifteen balls tumble in the globe on 2D
  physics: gravity, a jet from the bottom, collisions between balls and with the glass. Between
  bets they settle into a pile.
- **The number arrives:** the round's five balls leave the pile one by one, rise to the mouth and
  run along the tube into the rack, each with a short drop in its slot. Each landing marks the
  board. Later rounds draw faster, after a 0.65s pause in which the marks clear.
- **Deadline:** the fifth ball is in the rack 4.5s after the number arrives, and each later round's
  2.7s after it starts, whether or not the tab gets frames. The room's own fallback reveal waits
  5s, plus 3.8s for each later round.
- **The result:** the hit column of the pay strip lights, and a net win's chips slide onto it as on
  the dice table.
- **Reduced motion:** the balls do not move; each round's five are placed in the rack at once.

The plinko drop follows them too (`plinko-room/drop-motion.ts`, a controller with no DOM, tested
on its own):

- **Waiting for randomness:** the cups empty and the ball rocks in its cradle along the cradle's
  curve, easing in and out.
- **The number arrives:** the ball rolls to the middle, the gate swings open and it falls onto the
  first pin, then hops pin to pin along the number's bits, one fair left or right a row: each pin
  it hits lights for 140ms and the ball leaves a dotted trace (earlier balls' traces fade). It
  bounces to rest in its cup. Later balls leave the cradle 0.54s apart and fall faster; one ball
  rests in a cup and a tag counts the rest.
- **Deadline:** the first ball is in its cup 3.58s after the number arrives and each later one
  0.54s after the last, whether or not the tab gets frames. The room's own fallback reveal waits
  4.2s, plus 0.6s for each later ball.
- **The result:** the cups lit, a net win's cups glow and its chips slide onto the best cup's label
  as on the dice table.
- **Reduced motion:** no rocking and no fall; every ball is placed in its cup at once.

The coin follows them too (`coin-room/flip-motion.ts`, a controller with no DOM, tested on its
own):

- **Waiting for randomness:** placing the bet tosses the coin (0.38s up), and it spins over the
  felt at 820°/s about the table's horizontal axis, bobbing slightly. Height reads as size (up to
  1.42×) and a smaller, softer shadow offset down and right.
- **The number arrives:** the coin comes down over 1.05s, easing its turn so it ends exactly on
  the side the number chose after at least 430° more. It touches the felt 78% of the way down, two
  small bounces follow, then a 0.45s rattle and it lies flat. Each later flip is tossed again
  (0.28s), turns at least 320° and comes down over 0.72s.
- **Deadline:** the coin lies flat on its first flip 2.4s after the number arrives and on each
  later one 1.45s after the last, whether or not the tab gets frames. The room's own fallback
  reveal waits 2.9s, plus 1.5s for each later flip.
- **The result:** the side that came up lights its spot; a net win turns your chip red and its
  chips slide in beside it as on the dice table.
- **Reduced motion:** the coin is never tossed; it is shown flat on the last side.

The baccarat cards follow them too (`baccarat-room/deal-motion.ts`, a controller with no DOM,
tested on its own):

- **Waiting for randomness:** placing the bet deals four blank cards face down out of the shoe, P,
  B, P, B, 0.17s apart, each sliding 0.38s from the shoe's mouth to its spot. They stay down: what
  they are is only decided when the number arrives.
- **The number arrives:** the four cards take their faces and turn over in dealing order (0.25s,
  then 0.56s apart; each turn takes 0.34s), each side's total counting up. A third card comes out
  of the shoe 0.52s later only when the rule says so and turns 0.42s after; the winner is marked
  0.52s after the last card. For more hands the cards are swept 0.65s after the mark, and the next
  hand is dealt 0.2s later, 0.09s a card, and turns faster (0.42s, then 0.26s apart; a third card
  0.3s and 0.3s).
- **Deadline:** baccarat's first hand is marked 5.13s after the number at the latest and each
  later one 3.82s after the last; if the tab goes out of sight, the rest is laid out at once. The
  room's own fallback reveal waits 5.5s, plus 3.9s for each later hand.
- **The result:** the winning hand and its spot light; a net win turns your chip red and its chips
  slide in, stacked half over it.
- **Reduced motion:** nothing slides or turns; the last hand is shown face up.

The sic bo dice follow them too (`sicbo-room/roll-motion.ts`, a controller with no DOM, tested on
its own):

- **Waiting for randomness:** placing the bet brings the dome down over the dice and shakes it;
  the dice tumble, lift and bounce off the glass, never through it, with a soft rattle. What they
  show is only decided when the number arrives.
- **The number arrives:** the shaking stops and the dice spin down onto their faces in 0.9s, in a
  loose triangle; the dome lifts up and to the right and the roll counts 0.45s later. For more
  rolls the dome comes back down 0.8s after, shakes for 0.55s, and the dice settle again in 0.7s.
- **Deadline:** the first roll counts 2.25s after the number at the latest and each later one
  2.5s after the last; if the tab goes out of sight, the rest is laid out at once. The room's own
  fallback reveal waits 2.9s, plus 2.6s for each later roll.
- **The result:** every true area lights; a net win turns your chip red and its chips stack on
  it.
- **Reduced motion:** the dome is never shaken; it goes down for the wait and lifts on the last
  roll.

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
