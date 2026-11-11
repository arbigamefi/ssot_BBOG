// The three reels, as a controller with no DOM: the table calls `tick` once a frame and draws each
// reel at position `c`. A reel's position counts symbols; the symbol on the line at an integer `c`
// is `STRIPS[i][mod(c, 8)]`, and `c` falls while the reel turns, so the symbols move down.
//
// The reels follow the chain, not a script (docs/design/12-motion.md §5):
// - while Chainlink VRF has not answered they spin at full speed; nothing hints at a symbol;
// - when the number arrives they stop left to right, each slowing at a steady rate from the speed
//   it has onto its symbol. A reel only moves one way while it stops, so it never passes its
//   symbol and comes back;
// - each stop ends in one damped bounce past the line and back, under 0.15 of a symbol, so a
//   different symbol never touches the line;
// - the result never waits for frames: a deadline puts every reel on its symbol in a hidden tab too.

/** Each reel carries all eight symbols once, in its own order, like a printed strip. */
export const STRIPS = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [3, 7, 1, 5, 0, 6, 2, 4],
  [5, 2, 7, 0, 4, 1, 6, 3]
] as const;
export const SYMBOL_COUNT = 8;
/** Symbols drawn on a reel's strip: two turns, so the window is always full. */
export const CELLS = 16;
/** The strip cell on the line at position 0. */
export const CELL_OFFSET = 4;
/** The symbols on the line before the first spin. */
export const START = [2, 5, 0] as const;

export type Pace = {
  /** Full speed, symbols a second. */
  V: number;
  /** From the number to the first reel's stop starting, seconds. */
  lead: number;
  /** Between one reel's stop starting and the next's. */
  gap: number;
  /** The shortest slow-down. */
  tmin: number;
  /** The speed a reel meets its stop with, symbols a second. */
  ve: number;
  /** How long the bounce on the stop lasts. */
  bounce: number;
  /** A short pull up before the reel drops, as a real reel kicks off. */
  windup: number;
  /** Seconds from rest to full speed. */
  accel: number;
  /** The least time between one reel catching its stop and the next, so they stop left to right. */
  order: number;
};

/** The first round shows the full stop; later rounds of one bet go quicker. */
export const PACE: { first: Pace; next: Pace } = {
  first: {
    V: 15,
    lead: 0.3,
    gap: 0.42,
    tmin: 0.75,
    ve: 3.2,
    bounce: 0.4,
    windup: 0.14,
    accel: 0.3,
    order: 0.15
  },
  next: {
    V: 26,
    lead: 0.12,
    gap: 0.08,
    tmin: 0.25,
    ve: 6,
    bounce: 0.26,
    windup: 0,
    accel: 0.15,
    order: 0.06
  }
};
/** The pause between rounds. */
export const ROUND_GAP_MS = 260;
/** How high the windup lifts the reel, in symbols. */
const WINDUP = 0.18;
/** The bounce: angular frequency and damping. */
const W = 24;
const DAMP = 10;
/** The slowest a reel starts its stop from, symbols a second. */
const V_MIN = 4;
/** Speed at which the strip blurs: strongly, then slightly. */
export const BLUR_FAST = 9;
export const BLUR_SOFT = 4;

export const mod = (x: number, m: number) => ((x % m) + m) % m;

/** The symbol on the line of reel `i` at position `c`. */
export const symbolAt = (i: number, c: number) => STRIPS[i]![mod(Math.round(c), SYMBOL_COUNT)]!;

/** Where symbol `s` sits on reel `i`'s strip. */
export const stripIndex = (i: number, s: number) => (STRIPS[i] as readonly number[]).indexOf(s);

/** The strip cell whose centre is on the line at position `c`, fractional while the reel turns. */
export const lineCell = (c: number) => mod(c, SYMBOL_COUNT) + CELL_OFFSET;

/** How far past its stop a reel is `e` seconds into its bounce, in symbols. */
export const bounceOffset = (ve: number, e: number) =>
  (ve / W) * Math.exp(-DAMP * e) * Math.sin(W * e);

/**
 * A stop: c(s) = c0 − (v0·T·s − (v0 − ve)·T·s²/2), s = t/T, so the speed falls steadily from v0 to
 * ve and never turns. It takes at least `least` seconds (the pace's `tmin`, or longer so the reel
 * stops after the one to its left) and covers at least 1.5 symbols, plus whatever lines the target
 * up, so it ends exactly on it: at most 8 symbols more.
 */
export function planStop(c: number, v: number, index: number, pace: Pace, least = pace.tmin) {
  const v0 = Math.max(v, V_MIN);
  const { ve } = pace;
  const dmin = Math.max(1.5, ((v0 + ve) / 2) * Math.max(pace.tmin, least));
  const d = dmin + mod(c - dmin - index, SYMBOL_COUNT);
  return { c0: c, v0, ve, d, T: (2 * d) / (v0 + ve), cf: Math.round(c - d) };
}

/**
 * The deadline after the number arrives. Each reel's stop is its least time plus at most 8
 * symbols, and starts no sooner than the one to its left ends, so the last reel is at rest by
 * lead + tmin + 3 × (16 ÷ (V + ve)) + 2 × order + bounce; a little more for a reel still speeding
 * up.
 */
export const deadlineMs = (pace: Pace) =>
  (pace.lead + pace.tmin + (3 * 16) / (pace.V + pace.ve) + 2 * pace.order + pace.bounce) * 1000 +
  600;

type Timer = ReturnType<typeof setTimeout>;
type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};
export type ReelEvents = {
  /** Reel `i` catches on its stop. */
  onStop?: (i: number) => void;
  /** Round `index` is at rest on `symbols`. */
  onLand?: (index: number, symbols: readonly number[]) => void;
  /** Every round is at rest. */
  onDone?: () => void;
};
export type ReelMode = "rest" | "spin" | "stop" | "bounce";

type Reel = {
  c: number;
  v: number;
  mode: ReelMode;
  /** Seconds since this spin started. */
  t: number;
  /** Where this spin started. */
  start: number;
  /** The symbol index to stop on, once the reel's turn has come. */
  target: number | null;
  plan: (ReturnType<typeof planStop> & { t0: number }) | null;
  /** When its bounce started. */
  bounced: number;
  done: boolean;
};

export function createReelMotion({
  timers,
  reduced,
  events,
  start = START
}: {
  timers: Timers;
  reduced: boolean;
  events: ReelEvents;
  /** The symbols on the line before the first spin. */
  start?: readonly number[];
}) {
  const reels: Reel[] = STRIPS.map((_, i) => ({
    c: stripIndex(i, start[i] ?? 0),
    v: 0,
    mode: "rest",
    t: 0,
    start: 0,
    target: null,
    plan: null,
    bounced: 0,
    done: true
  }));
  let pace = PACE.first;
  let last = 0;
  let rounds: number[][] = [];
  let index = 0;
  let deadline: Timer | null = null;
  let pending: Timer[] = [];
  let planned: number | null = null;
  /** When each reel of this round catches its stop, once planned. */
  let ends: Array<number | null> = [null, null, null];

  const clear = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
    pending.forEach((timer) => timers.clearTimeout(timer));
    pending = [];
  };
  const later = (ms: number, run: () => void) => {
    const timer = timers.setTimeout(() => {
      pending = pending.filter((t) => t !== timer);
      run();
    }, ms);
    pending.push(timer);
  };

  const spinUp = (next: typeof pace) => {
    pace = next;
    ends = [null, null, null];
    if (reduced) return;
    for (const reel of reels) {
      reel.mode = "spin";
      reel.t = 0;
      reel.start = reel.c;
      reel.v = 0;
      reel.target = null;
      reel.plan = null;
      reel.done = false;
    }
  };

  // Reel i is at rest on its symbol. Once all three are, the round is in.
  const stopped = (i: number, quiet: boolean) => {
    const reel = reels[i]!;
    if (reel.done) return;
    reel.done = true;
    reel.mode = "rest";
    reel.v = 0;
    reel.plan = null;
    reel.target = null;
    if (!quiet) events.onStop?.(i);
    if (rounds.length > 0 && reels.every((r) => r.done)) landed();
  };

  const landed = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
    const k = index;
    events.onLand?.(k, rounds[k]!);
    if (k + 1 < rounds.length) {
      later(reduced ? 250 : ROUND_GAP_MS, () => {
        index = k + 1;
        spinUp(PACE.next);
        stopOn(rounds[k + 1]!);
      });
    } else {
      rounds = [];
      events.onDone?.();
    }
  };

  // The deadline: wherever each reel is, it is on its symbol now.
  const finishNow = () => {
    deadline = null;
    const symbols = rounds[index];
    if (!symbols) return;
    reels.forEach((reel, i) => {
      if (reel.done) return;
      reel.c = reel.plan ? reel.plan.cf : stripIndex(i, symbols[i]!);
      stopped(i, false);
    });
  };

  const stopOn = (symbols: readonly number[]) => {
    ends = [null, null, null];
    if (reduced) {
      reels.forEach((reel, i) => {
        reel.c = stripIndex(i, symbols[i]!);
        reel.done = false;
      });
      reels.forEach((_, i) => stopped(i, true));
      return;
    }
    if (deadline) timers.clearTimeout(deadline);
    deadline = timers.setTimeout(finishNow, deadlineMs(pace));
    reels.forEach((reel, i) => {
      later((pace.lead + i * pace.gap) * 1000, () => {
        if (reel.mode === "spin") reel.target = stripIndex(i, symbols[i]!);
      });
    });
  };

  return {
    /** Each reel's position and speed, for drawing. */
    reels: reels as ReadonlyArray<Readonly<Pick<Reel, "c" | "v" | "mode">>>,
    /** The last stop planned, for tests: its length in seconds. */
    get plannedSeconds() {
      return planned;
    },
    get spinning() {
      return reels.some((reel) => reel.mode !== "rest");
    },
    /** Waiting for the random number: every reel spins. */
    wait() {
      clear();
      rounds = [];
      index = 0;
      spinUp(PACE.first);
    },
    /** The symbols are in: stop on each round's in turn. */
    play(next: ReadonlyArray<readonly number[]>) {
      clear();
      rounds = next.map((symbols) => [...symbols]);
      index = 0;
      if (rounds.length === 0) return;
      if (!reels.every((reel) => reel.mode === "spin")) spinUp(PACE.first);
      stopOn(rounds[0]!);
    },
    /** A result shown without its spin: the reels sit on it. */
    place(symbols: readonly number[]) {
      clear();
      rounds = [];
      reels.forEach((reel, i) => {
        reel.c = stripIndex(i, symbols[i]!);
        reel.v = 0;
        reel.mode = "rest";
        reel.plan = null;
        reel.target = null;
        reel.done = true;
      });
    },
    /** Forget the bet: nothing lands; a spinning reel stops on the nearest symbol. */
    reset() {
      clear();
      rounds = [];
      for (const reel of reels) {
        reel.c = Math.round(reel.c);
        reel.v = 0;
        reel.mode = "rest";
        reel.plan = null;
        reel.target = null;
        reel.done = true;
      }
    },
    /** One frame. Returns how fast the fastest reel turns, for its whirr: 0 to about 1.7. */
    tick(now: number) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      let speed = 0;
      reels.forEach((reel, i) => {
        if (reel.mode === "spin") {
          if (reel.target != null) {
            // It catches its stop after the reel to its left has.
            const left = i > 0 ? ends[i - 1] : null;
            const least = left == null ? pace.tmin : (left - now) / 1000 + pace.order;
            reel.plan = { ...planStop(reel.c, reel.v, reel.target, pace, least), t0: now };
            ends[i] = now + reel.plan.T * 1000;
            planned = reel.plan.T;
            reel.target = null;
            reel.mode = "stop";
          } else {
            reel.t += dt;
            if (reel.t < pace.windup) {
              reel.c = reel.start + WINDUP * Math.sin((Math.PI * reel.t) / pace.windup);
            } else {
              reel.v = Math.min(pace.V, reel.v + (pace.V * dt) / pace.accel);
              reel.c -= reel.v * dt;
            }
          }
        }
        if (reel.mode === "stop" && reel.plan) {
          const { t0, c0, v0, ve, T, cf } = reel.plan;
          const s = (now - t0) / 1000 / T;
          if (s >= 1) {
            reel.c = cf;
            reel.v = 0;
            reel.mode = "bounce";
            reel.bounced = now;
            events.onStop?.(i);
          } else {
            reel.c = c0 - (v0 * T * s - ((v0 - ve) * T * s * s) / 2);
            reel.v = v0 - (v0 - ve) * s;
          }
        } else if (reel.mode === "bounce" && reel.plan) {
          const { cf, ve } = reel.plan;
          const e = (now - reel.bounced) / 1000;
          if (e >= pace.bounce) {
            reel.c = cf;
            stopped(i, true);
            return;
          }
          reel.c = cf - bounceOffset(ve, e);
        }
        speed = Math.max(speed, reel.v / PACE.first.V);
      });
      return speed;
    },
    dispose() {
      clear();
    }
  };
}

export type ReelMotion = ReturnType<typeof createReelMotion>;
