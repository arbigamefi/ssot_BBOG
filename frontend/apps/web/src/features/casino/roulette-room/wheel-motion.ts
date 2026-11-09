// The roulette wheel and its ball, as a controller with no DOM: the table calls `tick` once a frame
// and draws `theta`, `psi` and `r`. Angles are degrees, clockwise from the top.
//
// The ball follows the chain, not a script (docs/design/12-motion.md §5):
// - while Chainlink VRF has not answered, the ball circles the track and the wheel turns the other
//   way; nothing on the table hints at a number;
// - when the number arrives the ball slows at a steady rate relative to the wheel, from the speed
//   it has, to rest in that number's pocket. It only ever moves one way, so it never passes the
//   pocket and comes back;
// - it leaves the track for the last 20 degrees only, drops straight into its own pocket, bounces
//   three times and rocks a little inside it; it never hops between pockets;
// - the result never waits for frames: a deadline puts the ball in the pocket in a hidden tab too.

/** The European single-zero wheel, clockwise from zero. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
] as const;
/** One pocket's arc. */
export const SEG = 360 / 37;
/** The ball's radius on the track and in a pocket, in the wheel drawing's units. */
export const R_TRACK = 139;
export const R_POCKET = 91;

/** The ball's speed against the wheel while it circles, degrees a second. */
export const SPIN = -516;
/** The wheel's speed while the ball is in play, and between spins. */
const OMEGA = 36;
const IDLE = 9;
/** The last stretch the ball travels off the track, degrees. */
const DROP = 20;
/** Height (track units) and length (seconds) of each bounce in the pocket. */
export const BOUNCES: ReadonlyArray<readonly [number, number]> = [
  [10, 0.28],
  [5, 0.19],
  [2, 0.12]
];
/** How far the ball rocks in its pocket: well inside the pocket's half-width of 4.9 degrees. */
export const ROCK = 1.6;
/** The shortest slow-down: the first round, and each later round from rest. */
export const FIRST_ROLL_MIN_S = 2.2;
export const NEXT_ROLL_MIN_S = 1.5;
/** The pause between rounds. */
export const ROUND_GAP_MS = 700;

/** Where a number's pocket sits on the wheel head. */
export const pocketAngle = (n: number) => WHEEL_ORDER.indexOf(n as never) * SEG;
export const mod = (x: number, m: number) => ((x % m) + m) % m;
/** The deadline after the number arrives: the longest slow-down and the bounces, with room. */
export const deadlineMs = (tmin: number) => (tmin * 1.65 + 1.2) * 1000;

/**
 * The drop: psi(s) = psi0 + u0·T·(s − s²/2), s = t/T, the cubic Hermite with end speed 0. With
 * |u0|·T = 2d it never reverses. d is at least the distance the ball covers in `tmin` at half its
 * speed, plus whatever lines it up with the pocket, so T runs from tmin to tmin + 720/|u0|.
 */
export function planDrop(psi: number, u0: number, target: number, tmin: number) {
  const dmin = (Math.abs(u0) * tmin) / 2;
  const d = dmin + mod(psi - target - dmin, 360);
  const T = (2 * d) / Math.abs(u0);
  return { psi0: psi, u0, T, d, sd: 1 - Math.sqrt(DROP / d), psi1: psi - d };
}

type Timer = ReturnType<typeof setTimeout>;
type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};
export type WheelEvents = {
  /** The ball clips a deflector while slowing. */
  onDeflect?: () => void;
  /** The ball leaves the track. */
  onClack?: () => void;
  /** The ball drops into the pocket. */
  onPocket?: () => void;
  /** Bounce k (1, 2) meets the frets. */
  onFret?: (k: number) => void;
  /** Round `index` is at rest on `value`. */
  onLand?: (index: number, value: number) => void;
  /** Every round is at rest. */
  onDone?: () => void;
};
export type WheelMode = "rest" | "spin" | "drop" | "settle" | "ride";

type Drop = ReturnType<typeof planDrop> & {
  t0: number;
  rd: number | null;
  defl?: number;
  knock?: number;
};

export function createWheelMotion({
  timers,
  reduced,
  events
}: {
  timers: Timers;
  reduced: boolean;
  events: WheelEvents;
}) {
  let theta = 0;
  let omega = 0;
  let psi = 203;
  let r = R_TRACK;
  let u = 0;
  let mode: WheelMode = "rest";
  let target: number | null = null;
  let tmin = FIRST_ROLL_MIN_S;
  let drop: Drop | null = null;
  let settleAt = 0;
  let bounce = -1;
  let last = 0;
  let values: number[] = [];
  let index = 0;
  let deadline: Timer | null = null;
  let gap: Timer | null = null;
  const idle = reduced ? 0 : IDLE;

  const clear = () => {
    if (deadline) timers.clearTimeout(deadline);
    if (gap) timers.clearTimeout(gap);
    deadline = null;
    gap = null;
  };

  const launch = (min: number) => {
    tmin = min;
    target = null;
    drop = null;
    if (reduced) return;
    u = SPIN;
    mode = "spin";
  };

  // The ball is in: report it, then roll the next round after a pause, or finish.
  const finish = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
    mode = "ride";
    r = R_POCKET;
    u = 0;
    drop = null;
    target = null;
    const k = index;
    events.onLand?.(k, values[k]!);
    if (k + 1 < values.length) {
      gap = timers.setTimeout(
        () => {
          gap = null;
          index = k + 1;
          launch(NEXT_ROLL_MIN_S);
          dropInto(values[k + 1]!);
        },
        reduced ? 250 : ROUND_GAP_MS
      );
    } else {
      events.onDone?.();
    }
  };

  // The deadline: wherever the ball is, it is in its pocket now.
  const landNow = () => {
    deadline = null;
    if (target == null && !drop) return;
    psi = drop ? drop.psi1 : psi - mod(psi - target!, 360);
    finish();
  };

  const dropInto = (n: number) => {
    if (reduced) {
      psi = pocketAngle(n);
      r = R_POCKET;
      finish();
      return;
    }
    target = pocketAngle(n);
    if (mode !== "spin") launch(tmin);
    if (deadline) timers.clearTimeout(deadline);
    deadline = timers.setTimeout(landNow, deadlineMs(tmin));
  };

  return {
    get theta() {
      return theta;
    },
    get psi() {
      return psi;
    },
    get r() {
      return r;
    },
    get mode() {
      return mode;
    },
    /** The table's last drop, for tests: its length in seconds. */
    get plannedSeconds() {
      return drop?.T ?? null;
    },
    /** Waiting for the random number: the ball circles the track. */
    wait() {
      clear();
      values = [];
      index = 0;
      launch(FIRST_ROLL_MIN_S);
    },
    /** The numbers are in: drop the ball into each round's pocket in turn. */
    play(next: readonly number[]) {
      clear();
      values = [...next];
      index = 0;
      if (values.length === 0) return;
      if (mode !== "spin") launch(FIRST_ROLL_MIN_S);
      dropInto(values[0]!);
    },
    /** A result shown without its spin: the ball sits in the pocket. */
    place(n: number) {
      clear();
      values = [];
      target = null;
      drop = null;
      psi = pocketAngle(n);
      r = R_POCKET;
      u = 0;
      mode = "ride";
    },
    /** Forget the bet: no deadline lands anything; the ball rests on the track. */
    reset() {
      clear();
      values = [];
      target = null;
      drop = null;
      if (mode !== "ride") {
        mode = "rest";
        r = R_TRACK;
        u = 0;
      }
    },
    /** One frame. Returns the ball's speed for its rumble, 0 to 1. */
    tick(now: number) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const playing = mode === "spin" || mode === "drop" || mode === "settle";
      const goal = playing ? OMEGA : idle;
      if (omega !== goal) {
        omega += (goal - omega) * (1 - Math.exp(-dt / (goal > omega ? 0.6 : 3.2)));
        if (Math.abs(goal - omega) < 0.05) omega = goal;
      }
      theta = mod(theta + omega * dt, 360);
      // Before the first spin the ball waits on the track, still in the room.
      if (mode === "rest") psi -= omega * dt;
      let speed = 0;
      if (mode === "spin") {
        psi += u * dt;
        r += (R_TRACK - r) * (1 - Math.exp(-dt * 7));
        speed = 1;
        if (target != null) {
          drop = { ...planDrop(psi, u, target, tmin), t0: now, rd: null };
          mode = "drop";
        }
      } else if (mode === "drop" && drop) {
        const p = drop;
        const s = (now - p.t0) / 1000 / p.T;
        if (s >= 1) {
          psi = p.psi1;
          r = R_POCKET;
          mode = "settle";
          settleAt = now;
          bounce = 0;
          events.onPocket?.();
        } else {
          psi = p.psi0 + p.u0 * p.T * (s - (s * s) / 2);
          speed = 1 - s;
          if (s < p.sd) {
            r += (R_TRACK - r) * (1 - Math.exp(-dt * 7));
            // Slowing down, the ball catches the deflectors: a tick and a small knock inward.
            if (s > 0.45) {
              const j = Math.floor((theta + psi - 22.5) / 45);
              if (p.defl !== undefined && j !== p.defl) {
                events.onDeflect?.();
                p.knock = now;
              }
              p.defl = j;
            }
            if (p.knock) r -= 3 * Math.exp(-(now - p.knock) / 70);
          } else {
            if (p.rd === null) {
              p.rd = r;
              events.onClack?.();
            }
            const q = (s - p.sd) / (1 - p.sd);
            r = p.rd - (p.rd - R_POCKET) * q * q;
          }
        }
      } else if (mode === "settle") {
        // Three bounces in the pocket, each lower and quicker; it rocks but never leaves it.
        const e = (now - settleAt) / 1000;
        let k = 0;
        let start = 0;
        while (k < BOUNCES.length && e >= start + BOUNCES[k]![1]) {
          start += BOUNCES[k]![1];
          k++;
        }
        const rest = drop ? drop.psi1 : psi;
        if (k >= BOUNCES.length) {
          psi = rest;
          finish();
        } else {
          if (k !== bounce) {
            bounce = k;
            if (k > 0) events.onFret?.(k);
          }
          const [h, d] = BOUNCES[k]!;
          const v = (e - start) / d;
          r = R_POCKET + h * 4 * v * (1 - v);
          psi = rest + ROCK * Math.sin(e * 23) * Math.exp(-4 * e);
        }
      }
      return speed;
    },
    /** Whether anything still moves: the idle wheel turns unless motion is reduced. */
    get moving() {
      return mode !== "ride" && mode !== "rest" ? true : omega !== 0 || idle !== 0;
    },
    dispose() {
      clear();
    }
  };
}

export type WheelMotion = ReturnType<typeof createWheelMotion>;
