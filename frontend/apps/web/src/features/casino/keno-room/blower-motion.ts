// The keno blower, as a controller with no DOM: fifteen balls in a glass globe, a tube over the top
// and a rack of five beside it. It follows the bet's chain state, never a script:
// - while Chainlink VRF has not answered, air from below keeps the balls tumbling (a small 2D
//   simulation: gravity, the jet, the glass, and the balls knocking each other);
// - when the number arrives, each round's five drawn balls are pulled up one at a time, travel the
//   tube and drop into the rack, and each marks its number as it lands;
// - a deadline puts every drawn ball in the rack whether or not the tab gets animation frames, so
//   the receipt never waits on them. Under reduced motion the balls are placed at once.
// Coordinates are the blower SVG's (viewBox 0 0 340 292).

export const POOL = 15;
export const DRAWN = 5;
export const GLOBE = { x: 132, y: 150, r: 116 } as const;
export const BALL = 16;
/** Where the tube leaves the globe. */
export const MOUTH = { x: GLOBE.x, y: GLOBE.y - GLOBE.r + 2 } as const;
/** The rack's x, and the height of its slot `k`, the first at the bottom. */
export const RACK_X = 314;
export const slotY = (k: number) => 256 - k * 34;
/** How far inside the glass a ball's centre stays. */
export const LIMIT = GLOBE.r - BALL - 2;

export type Pace = {
  /** Seconds to lift a ball from the pile to the mouth. */
  up: number;
  /** Seconds along the tube to its slot. */
  tube: number;
  /** Seconds between two balls leaving the pile. */
  gap: number;
  /** Seconds of the bounce in the slot. */
  drop: number;
};
export const PACE: { first: Pace; next: Pace } = {
  first: { up: 0.34, tube: 0.78, gap: 0.62, drop: 0.16 },
  next: { up: 0.18, tube: 0.42, gap: 0.3, drop: 0.1 }
};
/** The pause after a round's last ball lands, before the next is drawn. */
export const ROUND_GAP_MS = 650;
const ROUND_GAP_REDUCED_MS = 250;

/** The latest a round's fifth ball is in its slot after the round starts. */
export const deadlineMs = (pace: Pace) =>
  ((DRAWN - 1) * pace.gap + pace.up + pace.tube) * 1000 + 900;

// ---------- The tube ----------

type Point = { x: number; y: number };

const quad = (a: Point, c: Point, b: Point, s: number): Point => ({
  x: (1 - s) ** 2 * a.x + 2 * (1 - s) * s * c.x + s ** 2 * b.x,
  y: (1 - s) ** 2 * a.y + 2 * (1 - s) * s * c.y + s ** 2 * b.y
});

/** The tube to slot `k` as SVG path data: up from the mouth, over the top, down to the slot. */
export const tubePath = (k: number) =>
  `M${MOUTH.x} ${MOUTH.y} V22 Q${MOUTH.x} 8 ${MOUTH.x + 14} 8 H${RACK_X - 14} Q${RACK_X} 8 ${RACK_X} 22 V${slotY(k)}`;
/** The glass tube itself runs down to below the bottom slot. */
export const TUBE_PATH = `M${MOUTH.x} ${MOUTH.y} V22 Q${MOUTH.x} 8 ${MOUTH.x + 14} 8 H${RACK_X - 14} Q${RACK_X} 8 ${RACK_X} 22 V272`;

/** The tube to slot `k` as points with the distance along it, for a point at any distance. */
function tubeTrack(k: number) {
  const points: Point[] = [{ ...MOUTH }, { x: MOUTH.x, y: 22 }];
  const corner = (a: Point, c: Point, b: Point) => {
    for (let i = 1; i <= 12; i++) points.push(quad(a, c, b, i / 12));
  };
  corner({ x: MOUTH.x, y: 22 }, { x: MOUTH.x, y: 8 }, { x: MOUTH.x + 14, y: 8 });
  points.push({ x: RACK_X - 14, y: 8 });
  corner({ x: RACK_X - 14, y: 8 }, { x: RACK_X, y: 8 }, { x: RACK_X, y: 22 });
  points.push({ x: RACK_X, y: slotY(k) });
  const at = [0];
  for (let i = 1; i < points.length; i++)
    at.push(
      at[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
    );
  const length = at.at(-1)!;
  return (s: number): Point => {
    const d = Math.min(1, Math.max(0, s)) * length;
    let i = 1;
    while (i < at.length - 1 && at[i]! < d) i++;
    const span = at[i]! - at[i - 1]! || 1;
    const f = (d - at[i - 1]!) / span;
    const a = points[i - 1]!;
    const b = points[i]!;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
}
const TRACKS = Array.from({ length: DRAWN }, (_, k) => tubeTrack(k));
export const tubePoint = (k: number, s: number) => TRACKS[k]!(s);

const ease = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);

// ---------- The balls ----------

export type BallMode = "globe" | "up" | "tube" | "bounce" | "rack";
export type Ball = {
  /** Its number, 1 to 15. */
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: BallMode;
  /** Its slot in the rack, once drawn. */
  k: number;
  /** When its current move started, in ms. */
  t0: number;
  x0: number;
  y0: number;
  /** Its own beat in the jet, so the pile never moves as one. */
  phase: number;
};

type Timer = ReturnType<typeof setTimeout>;
export type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type BlowerEvents = {
  /** Round `round`'s draw starts: the rack is empty and the balls are back in the globe. */
  onRound?: (round: number) => void;
  /** Ball `n` drops into slot `k` of round `round`. */
  onLand: (round: number, k: number, n: number) => void;
  /** Round `round`'s fifth ball is in the rack. */
  onRoundDone?: (round: number) => void;
  /** Every round is drawn. */
  onDone: () => void;
  /** A ball knocks the glass or another ball, at most a few times a second. */
  onKnock?: (strength: number) => void;
};

export type BlowerMotion = ReturnType<typeof createBlowerMotion>;

export function createBlowerMotion({
  timers,
  reduced,
  events,
  random = Math.random
}: {
  timers: Timers;
  reduced: boolean;
  events: BlowerEvents;
  random?: () => number;
}) {
  const balls: Ball[] = Array.from({ length: POOL }, (_, i) => ({
    n: i + 1,
    x: GLOBE.x - 64 + (i % 5) * 32 + (Math.floor(i / 5) % 2) * 12,
    y: GLOBE.y + 40 - Math.floor(i / 5) * 32,
    vx: 0,
    vy: 0,
    mode: "globe",
    k: -1,
    t0: 0,
    x0: 0,
    y0: 0,
    phase: random() * Math.PI * 2
  }));
  const byN = (n: number) => balls[n - 1]!;

  let mixing = false;
  let clock = 0;
  let lastKnock = -1;
  let last = 0;
  let pace = PACE.first;
  /** Until when the pile still moves after the air stops, in ms. */
  let settleUntil = 0;
  let draws: number[][] = [];
  let round = -1;
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
  const knock = (strength: number) => {
    if (clock - lastKnock < 0.045) return;
    lastKnock = clock;
    events.onKnock?.(strength);
  };

  /** One step of the globe: gravity, the jet while mixing, the glass, ball against ball. */
  const physics = (dt: number) => {
    clock += dt;
    const inGlobe = balls.filter((b) => b.mode === "globe");
    for (const b of inGlobe) {
      let ay = 980;
      let ax = 0;
      if (mixing) {
        // The jet: strongest low in the globe, never steady.
        const low = (b.y - (GLOBE.y - 20)) / GLOBE.r;
        if (low > 0)
          ay -= 3400 * (0.5 + 0.5 * Math.sin(clock * 6 + b.phase)) * Math.min(1.4, low * 1.6 + 0.3);
        ax += Math.sin(clock * 4.3 + b.phase * 2) * 700 + (random() - 0.5) * 900;
      }
      b.vx += ax * dt;
      b.vy += ay * dt;
      const damp = mixing ? 0.35 : 1.6;
      b.vx *= 1 - damp * dt;
      b.vy *= 1 - damp * dt;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 900) {
        b.vx *= 900 / speed;
        b.vy *= 900 / speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const dx = b.x - GLOBE.x;
      const dy = b.y - GLOBE.y;
      const d = Math.hypot(dx, dy);
      if (d > LIMIT) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = GLOBE.x + nx * LIMIT;
        b.y = GLOBE.y + ny * LIMIT;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          const e = mixing ? 0.85 : 0.35;
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
          if (vn > 120) knock(vn);
        }
      }
    }
    for (let i = 0; i < inGlobe.length; i++) {
      for (let j = i + 1; j < inGlobe.length; j++) {
        const a = inGlobe[i]!;
        const b = inGlobe[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= 2 * BALL) continue;
        const nx = dx / d;
        const ny = dy / d;
        const push = (2 * BALL - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const e = mixing ? 0.9 : 0.3;
          const impulse = (-(1 + e) * rel) / 2;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
          if (-rel > 160) knock(-rel);
        }
      }
    }
    // The glass wins over the push of another ball.
    for (const b of inGlobe) {
      const dx = b.x - GLOBE.x;
      const dy = b.y - GLOBE.y;
      const d = Math.hypot(dx, dy);
      if (d > LIMIT) {
        b.x = GLOBE.x + (dx / d) * LIMIT;
        b.y = GLOBE.y + (dy / d) * LIMIT;
      }
    }
  };
  const settle = (steps: number) => {
    for (let i = 0; i < steps; i++) physics(1 / 120);
  };
  settle(400);

  const toSlot = (b: Ball) => {
    const end = tubePoint(b.k, 1);
    b.x = end.x;
    b.y = end.y;
    b.vx = 0;
    b.vy = 0;
  };

  const land = (b: Ball, now: number, bounce: boolean) => {
    if (b.mode === "rack" || b.mode === "bounce") return;
    toSlot(b);
    b.mode = bounce ? "bounce" : "rack";
    b.t0 = now;
    landed += 1;
    events.onLand(round, b.k, b.n);
    if (landed === DRAWN) roundDone();
  };

  const roundDone = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
    const done = round;
    events.onRoundDone?.(done);
    if (done + 1 < draws.length) {
      later(reduced ? ROUND_GAP_REDUCED_MS : ROUND_GAP_MS, () => startRound(done + 1));
      return;
    }
    round = -1;
    mixing = false;
    settleUntil = last + 1500;
    events.onDone();
  };

  /** Drawn balls go back into the globe through the top. */
  const returnBalls = () => {
    for (const b of balls) {
      if (b.mode === "globe") continue;
      b.mode = "globe";
      b.k = -1;
      b.x = GLOBE.x + (random() - 0.5) * 50;
      b.y = GLOBE.y - GLOBE.r + BALL + 10 + random() * 20;
      b.vx = (random() - 0.5) * 200;
      b.vy = 150;
    }
    if (reduced) settle(300);
  };

  const startRound = (index: number) => {
    round = index;
    landed = 0;
    pace = index === 0 ? PACE.first : PACE.next;
    if (index > 0) returnBalls();
    events.onRound?.(index);
    const numbers = draws[index]!;
    numbers.forEach((n, k) => {
      byN(n).k = k;
    });
    if (reduced) {
      numbers.forEach((n) => land(byN(n), last, false));
      return;
    }
    deadline = timers.setTimeout(finishNow, deadlineMs(pace));
    numbers.forEach((n, k) =>
      later(k * pace.gap * 1000, () => {
        const b = byN(n);
        if (round !== index || b.mode !== "globe") return;
        b.mode = "up";
        b.t0 = last;
        b.x0 = b.x;
        b.y0 = b.y;
      })
    );
  };

  /** The deadline: whatever has not landed lands now, in order. */
  const finishNow = () => {
    deadline = null;
    if (round < 0) return;
    const index = round;
    for (const n of draws[index] ?? []) {
      if (round !== index) return;
      land(byN(n), last, false);
    }
    for (const b of balls) if (b.mode === "bounce") b.mode = "rack";
  };

  /** Lifted balls rise to the mouth, travel the tube, drop and bounce in their slot. */
  const moveDrawn = (now: number) => {
    for (const b of balls) {
      if (b.mode === "up") {
        const s = (now - b.t0) / 1000 / pace.up;
        if (s >= 1) {
          b.mode = "tube";
          b.t0 = now;
          b.x = MOUTH.x;
          b.y = MOUTH.y;
        } else {
          const e = s * s;
          b.x = b.x0 + (MOUTH.x - b.x0) * Math.min(1, e * 1.4);
          b.y = b.y0 + (MOUTH.y - b.y0) * e;
        }
      }
      if (b.mode === "tube") {
        const s = (now - b.t0) / 1000 / pace.tube;
        if (s >= 1) land(b, now, true);
        else {
          const at = tubePoint(b.k, ease(s));
          b.x = at.x;
          b.y = at.y;
        }
      }
      if (b.mode === "bounce") {
        const e = (now - b.t0) / 1000;
        const span = pace.drop * 2;
        const base = slotY(b.k);
        if (e >= span) {
          b.y = base;
          b.mode = "rack";
        } else b.y = base - Math.abs(Math.sin((e / span) * Math.PI * 2)) * 6 * (1 - e / span);
      }
    }
  };

  return {
    balls,
    get mixing() {
      return mixing;
    },
    /** True while anything on the blower moves and needs frames. */
    get active() {
      return (
        mixing ||
        round >= 0 ||
        balls.some((b) => b.mode === "up" || b.mode === "tube" || b.mode === "bounce") ||
        last < settleUntil
      );
    },
    /** The air is on until the number arrives. */
    wait() {
      clear();
      draws = [];
      round = -1;
      returnBalls();
      mixing = !reduced;
    },
    /** Draw each round's five numbers, one round after another. */
    play(rounds: ReadonlyArray<readonly number[]>) {
      clear();
      draws = rounds.map((numbers) => [...numbers]);
      if (draws.length === 0) return;
      returnBalls();
      mixing = !reduced;
      startRound(0);
    },
    /** Put these numbers in the rack at once, for a result shown before the table mounted. */
    place(numbers: readonly number[]) {
      clear();
      draws = [];
      round = -1;
      mixing = false;
      returnBalls();
      numbers.forEach((n, k) => {
        const b = byN(n);
        b.k = k;
        b.mode = "rack";
        toSlot(b);
      });
      settle(300);
    },
    /** Back to rest: every ball in the globe, the air off. */
    reset() {
      clear();
      draws = [];
      round = -1;
      mixing = false;
      returnBalls();
      settleUntil = last + 1500;
    },
    tick(now: number) {
      const dt = Math.min(0.033, (now - (last || now)) / 1000);
      last = now;
      if (reduced || dt <= 0) return;
      physics(dt / 2);
      physics(dt / 2);
      moveDrawn(now);
    },
    dispose() {
      clear();
      draws = [];
      round = -1;
      mixing = false;
    }
  };
}
