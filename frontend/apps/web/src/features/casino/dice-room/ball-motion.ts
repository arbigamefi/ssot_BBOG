// The dice table's ball, as a pure controller (docs/design/12-motion.md §5). It follows the bet's
// chain state, not a script:
// - while Chainlink VRF has not answered it rolls back and forth along the whole scale;
// - when the number arrives it rolls on from where it is, at the speed it has, straight to the
//   number and stops: a cubic Hermite with no reversal, so it never crosses the line and comes
//   back, never overshoots and never slows down for the line;
// - the result never waits for animation frames: a deadline puts the ball on the number.
// Positions are fractions of the scale; number n sits at (n − 0.5) / 100.

const LO = 0.005;
const HI = 0.995;
/** Scale widths a second while the random number is awaited. */
export const WAIT_SPEED = 0.85;
/** The ball is on the first number this long after it arrives, frames or not. */
export const FIRST_ROLL_DEADLINE_MS = 4_000;
/** Each later round rolls from rest; this is its deadline. */
export const NEXT_ROLL_DEADLINE_MS = 2_000;
/** The pause between a landing and the next round. */
export const ROUND_GAP_MS = 420;
const REDUCED_ROUND_GAP_MS = 250;
const MAX_ROLL_S = 1.8;
const WOBBLE_S = 0.36;

/** Where number n sits on the scale. */
export const at = (n: number) => (n - 0.5) / 100;
/** The number under a position on the scale. */
export const numberAt = (x: number) => Math.min(100, Math.max(1, Math.ceil(x * 100)));

type Timer = ReturnType<typeof setTimeout>;
export type BallTimers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type BallEvents = {
  /** The ball meets an end of the lane while it waits. */
  onBounce?: () => void;
  /** The ball has stopped on rolls[index]. */
  onLand?: (index: number, value: number) => void;
  /** Every roll has landed. */
  onDone?: () => void;
};

export type BallMode = "rest" | "wait" | "roll" | "settle";

type Roll = { t0: number | null; x0: number; v0: number; x1: number; T: number };
type Settle = { t0: number | null; x1: number; dir: number };

/** The cubic Hermite from (x0, v0) to (x1, 0) over T seconds, at s in [0, 1]. */
export function hermite(s: number, x0: number, v0: number, x1: number, T: number) {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * T * v0 + (-2 * s3 + 3 * s2) * x1;
}

/**
 * How long a roll from speed v over distance d takes. Monotone while v·T ≤ 3d, so the ball never
 * reverses; from rest a roll takes 0.5–0.9 s.
 */
export function rollSeconds(d: number, v: number) {
  return v > 0 ? Math.min(MAX_ROLL_S, (3 * d) / v) : Math.max(0.5, Math.min(0.9, 0.5 + d));
}

export function createBallMotion({
  timers,
  reduced,
  events = {}
}: {
  timers: BallTimers;
  /** prefers-reduced-motion: no waiting roll, the ball is placed on each number. */
  reduced: boolean;
  events?: BallEvents;
}) {
  let x = LO;
  let v = 0;
  let mode: BallMode = "rest";
  let target: number | null = null;
  let roll: Roll | null = null;
  let settle: Settle | null = null;
  let last: number | null = null;
  let rolls: readonly number[] = [];
  let index = 0;
  let deadline: Timer | undefined;
  let gap: Timer | undefined;

  const clear = () => {
    if (deadline !== undefined) timers.clearTimeout(deadline);
    if (gap !== undefined) timers.clearTimeout(gap);
    deadline = gap = undefined;
  };

  const startRoll = (now: number | null, x1: number) => {
    const T = rollSeconds(Math.abs(x1 - x), Math.abs(v));
    roll = { t0: now, x0: x, v0: v, x1, T };
    mode = "roll";
  };

  const land = () => {
    if (deadline !== undefined) timers.clearTimeout(deadline);
    deadline = undefined;
    mode = "rest";
    v = 0;
    target = null;
    roll = settle = null;
    const k = index;
    events.onLand?.(k, rolls[k]!);
    if (k + 1 < rolls.length) {
      gap = timers.setTimeout(
        () => {
          gap = undefined;
          rollTo(k + 1);
        },
        reduced ? REDUCED_ROUND_GAP_MS : ROUND_GAP_MS
      );
    } else {
      events.onDone?.();
    }
  };

  // A hidden or throttled tab gets few frames or none, so the deadline lands the ball regardless.
  const landNow = () => {
    deadline = undefined;
    x = at(rolls[index]!);
    land();
  };

  const rollTo = (k: number) => {
    index = k;
    const x1 = at(rolls[k]!);
    if (reduced) {
      x = x1;
      land();
      return;
    }
    deadline = timers.setTimeout(landNow, k === 0 ? FIRST_ROLL_DEADLINE_MS : NEXT_ROLL_DEADLINE_MS);
    if (mode === "wait") {
      target = x1;
    } else {
      v = 0;
      startRoll(null, x1);
    }
  };

  return {
    get x() {
      return x;
    },
    get mode() {
      return mode;
    },
    /** Roll back and forth until the number arrives. */
    wait() {
      if (reduced || mode !== "rest" || rolls.length > 0) return;
      mode = "wait";
      target = null;
      last = null;
      v = (x > 0.5 ? -1 : 1) * WAIT_SPEED;
    },
    /** Roll to each number in turn. */
    play(values: readonly number[]) {
      if (values.length === 0) return;
      clear();
      rolls = values;
      if (mode === "rest") last = null;
      rollTo(0);
    },
    /** Put the ball on a number at once, with no events. */
    place(value: number) {
      clear();
      x = at(value);
      v = 0;
      mode = "rest";
      target = null;
      roll = settle = null;
    },
    /** Stop and forget the bet: the table is reset. */
    reset() {
      clear();
      rolls = [];
      index = 0;
      v = 0;
      mode = "rest";
      target = null;
      roll = settle = null;
    },
    /**
     * Advance to time `now` (ms, as from requestAnimationFrame). Returns the speed in scale
     * widths a second, for the rolling sound.
     */
    tick(now: number) {
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const before = x;
      if (mode === "wait") {
        x += v * dt;
        if (x > HI) {
          x = 2 * HI - x;
          v = -Math.abs(v);
          events.onBounce?.();
        }
        if (x < LO) {
          x = 2 * LO - x;
          v = Math.abs(v);
          events.onBounce?.();
        }
        if (target !== null) {
          const d = target - x;
          // Leave the back-and-forth only when heading for the number with room for a roll of
          // 0.9 s or more; otherwise keep rolling to the wall.
          if (Math.sign(d) === Math.sign(v) && Math.abs(d) >= 0.3 * Math.abs(v)) {
            startRoll(now, target);
          }
        }
      } else if (mode === "roll" && roll) {
        if (roll.t0 == null) roll.t0 = now;
        const s = (now - roll.t0) / 1000 / roll.T;
        if (s >= 1) {
          x = roll.x1;
          settle = { t0: now, x1: roll.x1, dir: Math.sign(roll.x1 - roll.x0) || 1 };
          roll = null;
          mode = "settle";
        } else {
          x = hermite(s, roll.x0, roll.v0, roll.x1, roll.T);
        }
      } else if (mode === "settle" && settle) {
        // A small settle inside the number's own cell, ±0.4 of a number.
        const e = (now - (settle.t0 ?? now)) / 1000;
        if (e >= WOBBLE_S) {
          x = settle.x1;
          land();
        } else {
          x = settle.x1 + settle.dir * 0.004 * Math.exp(-9 * e) * Math.sin(e * 26);
        }
      }
      return dt > 0 ? Math.abs(x - before) / dt : 0;
    },
    /** Cancel timers when the table unmounts. */
    dispose() {
      clear();
    }
  };
}

export type BallMotion = ReturnType<typeof createBallMotion>;
