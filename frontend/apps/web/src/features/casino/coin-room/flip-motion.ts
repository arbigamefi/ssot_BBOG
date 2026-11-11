/**
 * The coin's motion, with no DOM: the room draws what this reports.
 *
 * It follows the bet's chain state, never a script:
 * - placing the bet tosses the coin, and it spins over the felt while the random number is awaited;
 * - when the number arrives the coin comes down still turning, ends exactly on the side the number
 *   chose, touches the printed ring, rattles briefly and lies flat. For more flips it is tossed
 *   again from there;
 * - a deadline lays the coin on its last side whether or not the tab gets frames;
 * - with reduced motion the coin never moves: it is shown on its last side.
 *
 * The coin turns about the table's horizontal axis: 0° is heads up, 180° tails up. Its height
 * over the felt runs from 0 to about 1 and reads as size and a softer, offset shadow.
 */

/** Seconds for each part of a flip. */
export const PACE = {
  /** The first toss, up off the felt. */
  rise: 0.38,
  /** The first flip down from its spin, onto the felt. */
  land: 1.05,
  /** A later flip down. */
  landNext: 0.72,
  /** The rattle on the felt before the coin lies flat. */
  rattle: 0.45,
  /** A later toss, up again from the felt. */
  toss: 0.28
} as const;
/** How far into a flip down the coin touches the felt, and counts as landed. */
export const TOUCH = 0.78;
/** Degrees a second while spinning in the air, and while tossed again. */
const SPIN = 820;
const TOSS_SPIN = 1100;

/** The latest the last of `count` flips is flat after the number arrives, frames or not. */
export const deadlineMs = (count: number) =>
  (PACE.land + PACE.rattle + (Math.max(1, count) - 1) * (PACE.toss + PACE.landNext + PACE.rattle)) *
    1000 +
  900;

/** The angle a side rests at: heads up at 0°, tails up at 180°. */
export const restAngle = (tails: boolean) => (tails ? 180 : 0);

/** The first angle at least `minTurn` past `from` that has the chosen side up. */
export function landingAngle(from: number, tails: boolean, minTurn: number) {
  let a = Math.ceil((from + minTurn) / 360) * 360 + restAngle(tails);
  if (a - 360 >= from + minTurn) a -= 360;
  return a;
}

/** True when `angle` shows tails: the coin's back faces up. */
export const showsTails = (angle: number) => {
  const a = ((angle % 360) + 360) % 360;
  return a > 90 && a < 270;
};

const easeOut = (s: number) => 1 - (1 - s) * (1 - s);

type Timer = ReturnType<typeof setTimeout>;
export type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type FlipEvents = {
  /** The coin leaves the felt: the toss for a bet, or again for a later flip. */
  onToss?: () => void;
  /** Flip `i` is on the felt, on its side. */
  onLand: (i: number) => void;
  /** The last flip lies flat. */
  onDone: () => void;
};

type Mode = "rest" | "rise" | "spin" | "land" | "rattle" | "toss";

export type FlipMotion = ReturnType<typeof createFlipMotion>;

export function createFlipMotion({
  timers,
  reduced,
  events
}: {
  timers: Timers;
  reduced: boolean;
  events: FlipEvents;
}) {
  let angle = 0;
  let height = 0;
  let wobble = 0;
  let mode: Mode = "rest";
  /** When the current move started; -1 starts it on the next frame. */
  let t0 = -1;
  /** The current flip down: where it turns from and to, and from what height. */
  let from = 0;
  let to = 0;
  let h0 = 0;
  let span: number = PACE.land;
  let flips: boolean[] = [];
  let index = 0;
  let landed = 0;
  let running = false;
  let deadline: Timer | null = null;
  let last = 0;

  const clear = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
  };

  const land = (i: number) => {
    if (!running || i < landed) return;
    landed = i + 1;
    events.onLand(i);
  };

  const finish = () => {
    clear();
    running = false;
    mode = "rest";
    events.onDone();
  };

  const startDown = (i: number) => {
    index = i;
    mode = "land";
    t0 = -1;
    from = angle;
    h0 = Math.max(height, 0.5);
    span = i === 0 ? PACE.land : PACE.landNext;
    to = landingAngle(angle, flips[i]!, i === 0 ? 430 : 320);
  };

  /** The deadline: every flip not yet down lands now, and the coin lies on the last side. */
  const finishNow = () => {
    deadline = null;
    if (!running) return;
    for (let i = landed; i < flips.length; i++) land(i);
    angle = restAngle(flips.at(-1)!);
    height = 0;
    wobble = 0;
    finish();
  };

  const lay = (tails: boolean) => {
    angle = restAngle(tails);
    height = 0;
    wobble = 0;
    mode = "rest";
  };

  return {
    get angle() {
      return angle;
    },
    /** Height over the felt, 0 to about 1. */
    get height() {
      return height;
    },
    /** A small tilt about the other axis while the coin rattles. */
    get wobble() {
      return wobble;
    },
    /** Tossed and waiting for the random number. */
    get spinning() {
      return mode === "rise" || mode === "spin";
    },
    /** True while the coin moves and needs frames. */
    get active() {
      return !reduced && mode !== "rest";
    },
    /** The bet is placed: toss the coin; it spins until the number arrives. */
    wait() {
      clear();
      running = false;
      flips = [];
      if (reduced) return;
      mode = "rise";
      t0 = -1;
      events.onToss?.();
    },
    /** The number is in: bring the coin down on each flip's side in turn (true = tails). */
    play(sides: readonly boolean[]) {
      if (sides.length === 0) return;
      clear();
      flips = [...sides];
      landed = 0;
      running = true;
      if (reduced) {
        for (let i = 0; i < flips.length; i++) land(i);
        lay(flips.at(-1)!);
        finish();
        return;
      }
      deadline = timers.setTimeout(finishNow, deadlineMs(flips.length));
      startDown(0);
    },
    /** Lay the coin on the last side at once, for a result shown before the table mounted. */
    place(sides: readonly boolean[]) {
      clear();
      running = false;
      flips = [...sides];
      landed = flips.length;
      if (flips.length > 0) lay(flips.at(-1)!);
    },
    /** Back to rest, flat on whichever side is up. */
    reset() {
      clear();
      running = false;
      lay(showsTails(angle));
    },
    tick(now: number) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (reduced || mode === "rest") return;
      if (t0 < 0) t0 = now;
      const e = (now - t0) / 1000;
      if (mode === "rise") {
        const s = Math.min(1, e / PACE.rise);
        height = easeOut(s);
        angle += SPIN * dt;
        if (s >= 1) {
          mode = "spin";
          t0 = now;
        }
      } else if (mode === "spin") {
        height = 1 + 0.06 * Math.sin(e * 3.1);
        angle += SPIN * dt;
      } else if (mode === "land") {
        const s = Math.min(1, e / span);
        angle = from + (to - from) * easeOut(s);
        if (s < TOUCH) height = h0 * (1 - (s / TOUCH) ** 2);
        else if (s < 0.92) height = 0.07 * Math.sin((Math.PI * (s - TOUCH)) / (0.92 - TOUCH));
        else height = 0.02 * Math.sin((Math.PI * (s - 0.92)) / 0.08);
        if (s >= TOUCH) land(index);
        if (s >= 1) {
          angle = to;
          height = 0;
          mode = "rattle";
          t0 = now;
        }
      } else if (mode === "rattle") {
        wobble = 7 * Math.exp(-e * 7) * Math.sin(e * 52);
        if (e >= PACE.rattle) {
          wobble = 0;
          angle = restAngle(flips[index]!);
          if (index + 1 < flips.length) {
            mode = "toss";
            t0 = now;
            index += 1;
            events.onToss?.();
          } else if (running) {
            finish();
          } else {
            mode = "rest";
          }
        }
      } else {
        const s = Math.min(1, e / PACE.toss);
        height = easeOut(s) * 0.85;
        angle += TOSS_SPIN * dt;
        if (s >= 1) {
          startDown(index);
          t0 = now;
        }
      }
    },
    dispose() {
      clear();
      running = false;
    }
  };
}
