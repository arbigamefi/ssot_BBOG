/**
 * The plinko ball's motion, with no DOM: the room draws what this reports.
 *
 * It follows the bet's chain state, never a script:
 * - while the random number is awaited, the ball rocks in its cradle at the top;
 * - when the number arrives, the ball rolls to the middle, the gate opens and it falls along the
 *   exact eight bounces the number chose (one fair left or right per row), each pin it hits
 *   reported as it goes, then bounces to rest in its cup. Later balls follow about 0.4 s apart;
 * - a deadline puts every ball in its cup whether or not the tab gets frames;
 * - with reduced motion every ball is placed in its cup at once.
 *
 * Board coordinates match the SVG's viewBox (0 0 360 334).
 */

export const ROWS = 8;
export const CUPS = ROWS + 1;
/** Pin spacing across and row spacing down. */
export const SPACE = 40;
export const ROW_GAP = 30;
export const CX = 180;
export const PIN_R = 4.6;
export const BALL_R = 10;
const ROW0 = 62;
export const rowY = (r: number) => ROW0 + r * ROW_GAP;
export const pinX = (r: number, j: number) => CX + (j - r / 2) * SPACE;
export const CUP_TOP = rowY(ROWS - 1) + 14;
export const CUP_FLOOR = 328;
export const REST_Y = CUP_FLOOR - BALL_R - 0.5;
export const cupX = (k: number) => CX + (k - ROWS / 2) * SPACE;
/** The cradle: the ball's centre runs on a shallow parabola. */
export const CRADLE_Y = 26;
export const CRADLE_HALF = 44;
export const cradleY = (dx: number) => CRADLE_Y - 9 * (dx / CRADLE_HALF) ** 2;
/** Half the gap in the trough that the ball drops through. */
export const GATE = 12;

/** The pins: each row has one more than the last, plus an outer pin each side inside the board. */
export const PINS: ReadonlyArray<{ r: number; j: number; x: number; y: number }> = (() => {
  const pins: Array<{ r: number; j: number; x: number; y: number }> = [];
  for (let r = 0; r < ROWS; r++)
    for (let j = -1; j <= r + 1; j++) {
      const x = pinX(r, j);
      if (x < -0.5 || x > 360.5) continue;
      pins.push({ r, j, x, y: rowY(r) });
    }
  return pins;
})();

export type Point = { x: number; y: number };

/** The cup a path ends in: its number of rights. */
export const cupOf = (bits: readonly boolean[]) => bits.filter(Boolean).length;

/** Where the ball touches each row's pin, then where it rests in its cup. */
export function route(bits: readonly boolean[]): Point[] {
  const points: Point[] = [];
  let x = CX;
  for (let r = 0; r < ROWS; r++) {
    points.push({ x, y: rowY(r) - PIN_R - BALL_R + 0.5 });
    x += bits[r] ? SPACE / 2 : -SPACE / 2;
  }
  points.push({ x, y: REST_Y });
  return points;
}

export type Pace = {
  /** Seconds to roll to the middle and open the gate. */
  open: number;
  /** Seconds to fall from the gate onto the first pin. */
  fall: number;
  /** Seconds from one pin to the next. */
  hop: number;
  /** Seconds from the last pin into the cup. */
  cup: number;
  /** Seconds of the bounce in the cup. */
  settle: number;
  /** Seconds after the ball before it leaves the cradle. */
  gap: number;
};
export const PACE: { first: Pace; next: Pace } = {
  first: { open: 0.26, fall: 0.3, hop: 0.2, cup: 0.32, settle: 0.32, gap: 0 },
  next: { open: 0.12, fall: 0.2, hop: 0.12, cup: 0.22, settle: 0.22, gap: 0.42 }
};
const fallSeconds = (p: Pace) => p.open + p.fall + p.hop * (ROWS - 1) + p.cup;
/** When ball `i` leaves the cradle, in seconds after the number arrives. */
export const launchAt = (i: number) =>
  i === 0 ? 0 : i * (PACE.next.gap + PACE.next.open) + PACE.first.open + PACE.first.fall;
/** The latest every ball of `count` is in its cup after the number arrives, frames or not. */
export const deadlineMs = (count: number) =>
  (fallSeconds(PACE.first) + (Math.max(1, count) - 1) * (PACE.next.gap + PACE.next.open) + 0.4) *
    1000 +
  900;

export type BallMode = "cradle" | "fall" | "settle" | "rest" | "gone";
export type Ball = {
  /** Its place among the bet's balls, from 0. */
  i: number;
  bits: boolean[];
  cup: number;
  points: Point[];
  x: number;
  y: number;
  mode: BallMode;
  /** -1 while rolling to the gate and falling onto the first pin; then the pin it left. */
  seg: number;
  t0: number;
  from: Point;
  pace: Pace;
  /** How many of `points` it has passed. */
  reached: number;
  /** In its cup, counted. */
  landed: boolean;
};

type Timer = ReturnType<typeof setTimeout>;
export type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type DropEvents = {
  /** Ball `i` hit pin `j` of row `r`. */
  onPin?: (i: number, r: number, j: number) => void;
  /** Ball `i` is in cup `cup`; one ball rests there and `count` have landed in it. */
  onLand: (i: number, cup: number, count: number) => void;
  /** Every ball is in its cup. */
  onDone: () => void;
};

export type DropMotion = ReturnType<typeof createDropMotion>;

export function createDropMotion({
  timers,
  reduced,
  events
}: {
  timers: Timers;
  reduced: boolean;
  events: DropEvents;
}) {
  const fresh = (): Ball => ({
    i: 0,
    bits: [],
    cup: -1,
    points: [],
    x: CX,
    y: cradleY(0),
    mode: "cradle",
    seg: -1,
    t0: 0,
    from: { x: CX, y: cradleY(0) },
    pace: PACE.first,
    reached: 0,
    landed: false
  });
  let balls: Ball[] = [fresh()];
  const counts: number[] = new Array(CUPS).fill(0);
  let rocking = false;
  let rockAmp = 0;
  let rockT = 0;
  let open = false;
  let last = 0;
  let running = false;
  let landed = 0;
  let deadline: Timer | null = null;
  let pending: Timer[] = [];

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

  const rest = (b: Ball) => {
    b.x = b.points[ROWS]!.x;
    b.y = REST_Y;
    b.reached = ROWS + 1;
  };

  /** The ball enters its cup and counts; the bounce after is only for the eye. */
  const land = (b: Ball, bounce: boolean) => {
    if (b.landed) return;
    b.landed = true;
    rest(b);
    b.mode = bounce ? "settle" : "rest";
    // One ball rests in a cup; the tag above it counts the rest.
    for (const other of balls)
      if (other !== b && other.landed && other.cup === b.cup) other.mode = "gone";
    counts[b.cup] = (counts[b.cup] ?? 0) + 1;
    landed += 1;
    if (running) events.onLand(b.i, b.cup, counts[b.cup]!);
    if (running && landed === balls.length) {
      clear();
      running = false;
      events.onDone();
    }
  };

  /** The ball leaves the cradle; its clock starts on the next frame. */
  const launch = (b: Ball) => {
    b.mode = "fall";
    b.seg = -1;
    b.t0 = -1;
    b.from = { x: b.x, y: b.y };
  };

  /** The deadline: every ball not yet in its cup goes there now, in order. */
  const finishNow = () => {
    deadline = null;
    for (const b of balls) {
      if (!running) return;
      land(b, false);
    }
  };

  const step = (now: number) => {
    for (const b of balls) {
      if (b.mode === "settle") {
        const e = (now - b.t0) / 1000;
        if (e >= b.pace.settle) {
          b.y = REST_Y;
          b.mode = "rest";
        } else
          b.y =
            REST_Y -
            Math.abs(Math.sin((e / b.pace.settle) * Math.PI * 2)) * 5 * (1 - e / b.pace.settle);
        continue;
      }
      if (b.mode !== "fall") continue;
      if (b.t0 < 0) b.t0 = now;
      const p = b.pace;
      for (let guard = 0; guard < 12; guard++) {
        const e = (now - b.t0) / 1000;
        if (b.seg === -1) {
          // Roll to the middle, the gate opens, the ball drops onto the first pin.
          const span = p.open + p.fall;
          if (e >= span) {
            b.seg = 0;
            b.t0 += span * 1000;
            b.x = b.points[0]!.x;
            b.y = b.points[0]!.y;
            b.reached = 1;
            open = true;
            events.onPin?.(b.i, 0, 0);
            continue;
          }
          if (e < p.open) {
            const s = e / p.open;
            b.x = CX + (b.from.x - CX) * (1 - s) * (1 - s);
            b.y = cradleY(b.x - CX);
            if (s > 0.6) open = true;
          } else {
            const s = (e - p.open) / p.fall;
            b.x = CX;
            b.y = cradleY(0) + (b.points[0]!.y - cradleY(0)) * s * s;
          }
          break;
        }
        const lastRow = b.seg === ROWS - 1;
        const span = lastRow ? p.cup : p.hop;
        const a = b.points[b.seg]!;
        const z = b.points[b.seg + 1]!;
        if (e >= span) {
          b.seg += 1;
          b.t0 += span * 1000;
          b.x = z.x;
          b.y = z.y;
          b.reached = b.seg + 1;
          if (b.seg < ROWS) {
            const rights = b.bits.slice(0, b.seg).filter(Boolean).length;
            events.onPin?.(b.i, b.seg, rights);
            continue;
          }
          land(b, true);
          break;
        }
        const s = e / span;
        b.x = a.x + (z.x - a.x) * s;
        // A small kick up off the pin, then gravity.
        b.y = a.y + (z.y - a.y) * s * s - 7 * Math.sin(Math.PI * s) * (1 - s);
        break;
      }
    }
  };

  const empty = () => {
    clear();
    running = false;
    landed = 0;
    counts.fill(0);
    open = false;
    balls = [fresh()];
  };

  const prepare = (paths: ReadonlyArray<readonly boolean[]>) => {
    const cradle = balls[0]?.mode === "cradle" ? balls[0] : fresh();
    clear();
    landed = 0;
    counts.fill(0);
    rocking = false;
    balls = paths.map((path, i) => {
      const bits = [...path];
      const b = i === 0 ? cradle : fresh();
      const pace = i === 0 ? PACE.first : PACE.next;
      return {
        ...b,
        i,
        bits,
        cup: cupOf(bits),
        points: route(bits),
        pace,
        landed: false,
        reached: 0
      };
    });
    // Later balls wait out of sight until their turn.
    for (const b of balls.slice(1)) b.mode = "gone";
  };

  return {
    get balls(): readonly Ball[] {
      return balls;
    },
    /** How many balls have landed in each cup. */
    counts: counts as readonly number[],
    /** The gate is open. */
    get open() {
      return open;
    },
    get rocking() {
      return rocking;
    },
    /** True while anything on the board moves and needs frames. */
    get active() {
      return (
        !reduced &&
        (running ||
          rocking ||
          rockAmp > 0.01 ||
          balls.some((b) => b.mode === "fall" || b.mode === "settle"))
      );
    },
    /** The path ball `b` has printed so far, from the gate. */
    trail(b: Ball): Point[] {
      if (b.reached === 0) return [];
      const passed = b.points.slice(0, b.reached);
      const moving = b.mode === "fall" && b.reached <= ROWS;
      return [{ x: CX, y: cradleY(0) }, ...passed, ...(moving ? [{ x: b.x, y: b.y }] : [])];
    },
    /** Waiting for the random number: the cups empty and the ball rocks in its cradle. */
    wait() {
      empty();
      rocking = !reduced;
    },
    /** Drop one ball for each path, one after another. */
    play(paths: ReadonlyArray<readonly boolean[]>) {
      if (paths.length === 0) return;
      prepare(paths);
      running = true;
      if (reduced) {
        open = true;
        for (const b of balls) if (running) land(b, false);
        return;
      }
      deadline = timers.setTimeout(finishNow, deadlineMs(balls.length));
      launch(balls[0]!);
      balls.slice(1).forEach((b) =>
        later(launchAt(b.i) * 1000, () => {
          if (!running || b.landed) return;
          b.x = CX;
          b.y = cradleY(0);
          open = false;
          launch(b);
        })
      );
    },
    /** Put each ball in its cup at once, for a result shown before the table mounted. */
    place(paths: ReadonlyArray<readonly boolean[]>) {
      if (paths.length === 0) return;
      prepare(paths);
      open = true;
      for (const b of balls) land(b, false);
    },
    /** Back to rest: the cups empty, one ball still in the cradle. */
    reset() {
      empty();
      rocking = false;
    },
    tick(now: number) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (reduced) return;
      const cradle = balls[0]?.mode === "cradle" ? balls[0] : null;
      rockAmp += ((rocking ? 1 : 0) - rockAmp) * Math.min(1, dt * 3);
      rockT += dt;
      if (cradle) {
        const amp = (CRADLE_HALF - 6) * rockAmp * (0.82 + 0.18 * Math.sin(rockT * 0.9));
        cradle.x = CX + amp * Math.sin(rockT * 5.2);
        cradle.y = cradleY(cradle.x - CX);
      }
      step(now);
    },
    dispose() {
      clear();
      running = false;
      rocking = false;
    }
  };
}
