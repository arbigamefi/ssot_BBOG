/**
 * The sic bo dice's motion, with no DOM: the room draws what this reports.
 *
 * It follows the bet's chain state, never a script:
 * - placing the bet puts the glass dome down and shakes it; the dice tumble inside it and come off
 *   the glass while the random number is awaited;
 * - when the number arrives the dice spin down onto the faces it chose, in a loose triangle, and
 *   the dome lifts away up and to the right. For more rolls the dome comes back down, is shaken
 *   again and lifts on the next roll;
 * - a deadline lays the last roll out whether or not the tab gets frames, and so does a hidden tab
 *   (`flush`);
 * - with reduced motion the dice never move: the last roll is shown.
 *
 * Lengths are in die widths, from the middle of the dish; angles in degrees. A die shows the face
 * that looks up at the viewer.
 */
import type { Dice } from "./sicbo-model";

/** Seconds for each part of a roll. */
export const PACE = {
  /** The dice spin down onto the first roll's faces. */
  land: 0.9,
  /** Onto a later roll's faces. */
  landNext: 0.7,
  /** After the dice settle, the dome lifts. */
  open: 0.12,
  /** After the dice settle, the roll counts: the layout lights. */
  mark: 0.45,
  /** After the dice settle, the dome comes back down for the next roll. */
  next: 1.25,
  /** The dome is shaken again before the next roll comes down. */
  shake: 0.55
} as const;

/** The latest the last of `count` rolls is marked after the number arrives, frames or not. */
export const deadlineMs = (count: number) =>
  (PACE.land +
    PACE.mark +
    (Math.max(1, count) - 1) * (PACE.next - PACE.mark + PACE.shake + PACE.landNext + PACE.mark)) *
    1000 +
  900;

/** How far from the middle a die can go before it meets the glass. */
const WALL = 1.7;
/** Where the dice come to rest: a loose triangle this far from the middle. */
const REST = 0.78;

/** The rotation [x, y] that turns each face up: opposite faces add up to seven. */
export const FACE_UP: Record<number, readonly [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0]
};

/** The first angle at least `minTurn` past `from` that matches `base` on a full turn. */
export const aimAt = (from: number, base: number, minTurn: number) =>
  base + Math.ceil((from + minTurn - base) / 360) * 360;

/** The face a die's rotation shows up, for a die laid at rest. */
export function faceUp(rx: number, ry: number) {
  const norm = (a: number) => (((Math.round(a / 90) * 90) % 360) + 360) % 360;
  const [x, y] = [norm(rx), norm(ry)];
  for (const [face, [fx, fy]] of Object.entries(FACE_UP)) {
    if (norm(fx) === x && norm(fy) === y) return Number(face);
  }
  return 0;
}

export type DieState = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  /** Height off the dish, 0 to about 0.6: reads as size and a softer, offset shadow. */
  lift: number;
};

type Timer = ReturnType<typeof setTimeout>;
export type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type RollEvents = {
  /** A die knocks the glass while the dome is shaken. */
  onRattle?: () => void;
  /** The dice come to rest on the dish. */
  onSettle?: () => void;
  /** Roll `i` (1 or later) starts: the dome is down again and shaken. */
  onShake?: (i: number) => void;
  /** Roll `i` has settled and counts. */
  onRoll: (i: number) => void;
  /** The last roll counts, and the dome is off. */
  onDone: () => void;
};

type Mode = "rest" | "shake" | "land" | "settled";

export type RollMotion = ReturnType<typeof createRollMotion>;

const easeOutCubic = (s: number) => 1 - (1 - s) ** 3;

export function createRollMotion({
  timers,
  reduced,
  events,
  random = Math.random
}: {
  timers: Timers;
  reduced: boolean;
  events: RollEvents;
  random?: () => number;
}) {
  const dice: DieState[] = [0, 1, 2].map(() => ({ x: 0, y: 0, rx: 0, ry: 0, rz: 0, lift: 0 }));
  const spin = dice.map(() => ({ vx: 0, vy: 0, wx: 0, wy: 0, wz: 0 }));
  const bowl = { x: 0, y: 0, rot: 0 };
  let open = true;
  let faces: Dice = [4, 1, 6];
  let mode: Mode = "rest";
  /** When the current move started; -1 starts it on the next frame. */
  let t0 = -1;
  let last = 0;
  let nextRattle = 0;
  /** A later roll's shake ends after this many seconds and its dice come down. */
  let until = 0;
  let rolls: Dice[] = [];
  let index = 0;
  let marked = 0;
  let running = false;
  let deadline: Timer | null = null;
  let land: {
    span: number;
    touched: boolean;
    from: DieState[];
    to: DieState[];
  } | null = null;
  let settled = { opened: false, marked: false };

  const clear = () => {
    if (deadline) timers.clearTimeout(deadline);
    deadline = null;
  };

  /** A loose triangle around the middle, turned at random. */
  const restSpots = () => {
    const turn = random() * Math.PI * 2;
    return [0, 1, 2].map((k) => {
      const a = turn + (k * Math.PI * 2) / 3 + (random() - 0.5) * 0.35;
      return { x: Math.cos(a) * REST, y: Math.sin(a) * REST };
    });
  };

  const lay = (next: Dice) => {
    faces = next;
    const spots = restSpots();
    dice.forEach((die, k) => {
      const [rx, ry] = FACE_UP[next[k]!]!;
      Object.assign(die, { x: spots[k]!.x, y: spots[k]!.y, rx, ry, rz: random() * 360, lift: 0 });
    });
    Object.assign(bowl, { x: 0, y: 0, rot: 0 });
    mode = "rest";
  };
  lay(faces);

  const mark = (i: number) => {
    if (!running || i < marked) return;
    marked = i + 1;
    events.onRoll(i);
  };

  const finish = () => {
    clear();
    running = false;
    mode = "rest";
    events.onDone();
  };

  /** Lay out whatever is left at once: the deadline, a hidden tab. */
  const finishNow = () => {
    deadline = null;
    if (!running) return;
    for (let i = marked; i < rolls.length; i++) mark(i);
    lay(rolls.at(-1)!);
    open = true;
    finish();
  };

  const startShake = () => {
    mode = "shake";
    t0 = -1;
    nextRattle = 0;
    open = false;
    spin.forEach((s) => {
      s.wx = 500 + random() * 500;
      s.wy = 400 + random() * 500;
      s.wz = (random() - 0.5) * 600;
      s.vx = (random() - 0.5) * 7.5;
      s.vy = (random() - 0.5) * 7.5;
    });
  };

  const startLand = (i: number) => {
    index = i;
    mode = "land";
    t0 = -1;
    open = false;
    const spots = restSpots();
    const next = rolls[i]!;
    land = {
      span: i === 0 ? PACE.land : PACE.landNext,
      touched: false,
      from: dice.map((die) => ({ ...die })),
      to: dice.map((die, k) => {
        const [bx, by] = FACE_UP[next[k]!]!;
        return {
          x: spots[k]!.x,
          y: spots[k]!.y,
          rx: aimAt(die.rx, bx, 270),
          ry: aimAt(die.ry, by, 270),
          rz: die.rz + 60 + random() * 120,
          lift: 0
        };
      })
    };
  };

  return {
    get dice(): readonly DieState[] {
      return dice;
    },
    /** The dish and dome, shaken: a few px and a degree or two. */
    get bowl(): Readonly<typeof bowl> {
      return bowl;
    },
    /** The dome is off the dish. */
    get open() {
      return open;
    },
    /** The faces the dice show at rest. */
    get faces() {
      return faces;
    },
    /** Shaken, waiting for the random number. */
    get shaking() {
      return mode === "shake" && !running;
    },
    /** True while the dice move and need frames. */
    get active() {
      return !reduced && mode !== "rest";
    },
    /** The bet is placed: the dome goes down; it is shaken until the number arrives. */
    wait() {
      clear();
      running = false;
      rolls = [];
      open = false;
      if (reduced) return;
      until = 0;
      startShake();
    },
    /** The number is in: bring the dice down on each roll's faces in turn. */
    play(next: readonly Dice[]) {
      if (next.length === 0) return;
      clear();
      rolls = [...next];
      marked = 0;
      running = true;
      if (reduced) {
        for (let i = 0; i < rolls.length; i++) mark(i);
        lay(rolls.at(-1)!);
        open = true;
        finish();
        return;
      }
      deadline = timers.setTimeout(finishNow, deadlineMs(rolls.length));
      startLand(0);
    },
    /** Lay the last roll out at once, for a result shown before the table mounted. */
    place(next: readonly Dice[]) {
      clear();
      running = false;
      rolls = [...next];
      marked = rolls.length;
      if (rolls.length > 0) lay(rolls.at(-1)!);
      open = true;
    },
    /** A hidden tab: lay the rest out now. */
    flush() {
      if (running && deadline) finishNow();
    },
    /** Back to rest on the faces last shown, the dome off: a refund, or no outcome. */
    reset() {
      clear();
      running = false;
      lay(faces);
      open = true;
    },
    tick(now: number) {
      const dt = Math.max(0, Math.min(0.05, (now - (last || now)) / 1000));
      last = now;
      if (reduced || mode === "rest") return;
      if (t0 < 0) t0 = now;
      // A frame's timestamp can be earlier than the moment the move started.
      const e = Math.max(0, (now - t0) / 1000);
      if (mode === "shake") {
        // The dome is shaken in short strokes; the dice are thrown about inside it.
        const amp = Math.min(1, e / 0.15);
        bowl.x = 4 * amp * Math.sin(e * 38);
        bowl.y = 3 * amp * Math.sin(e * 31 + 1);
        bowl.rot = 1.6 * amp * Math.sin(e * 23);
        const damp = 0.2 ** dt;
        dice.forEach((die, k) => {
          const s = spin[k]!;
          s.vx = (s.vx + (random() - 0.5) * 65 * dt) * damp;
          s.vy = (s.vy + (random() - 0.5) * 65 * dt) * damp;
          die.x += s.vx * dt;
          die.y += s.vy * dt;
          const r = Math.hypot(die.x, die.y);
          if (r > WALL) {
            // Off the glass
            const nx = die.x / r;
            const ny = die.y / r;
            const dot = s.vx * nx + s.vy * ny;
            s.vx -= 1.8 * dot * nx;
            s.vy -= 1.8 * dot * ny;
            die.x = nx * WALL;
            die.y = ny * WALL;
          }
          die.rx += s.wx * dt;
          die.ry += s.wy * dt;
          die.rz += s.wz * dt;
          die.lift = 0.35 + 0.25 * Math.abs(Math.sin(e * 9 + s.wx));
        });
        if (e >= nextRattle) {
          events.onRattle?.();
          nextRattle = e + 0.16 + random() * 0.1;
        }
        if (until > 0 && e >= until) startLand(index);
      } else if (mode === "land" && land) {
        const s = Math.min(1, e / land.span);
        const k = easeOutCubic(s);
        const fade = 1 - s;
        bowl.x = 3 * fade * Math.sin(s * 30);
        bowl.y = 2 * fade * Math.sin(s * 26);
        bowl.rot = 0;
        dice.forEach((die, j) => {
          const a = land!.from[j]!;
          const z = land!.to[j]!;
          die.x = a.x + (z.x - a.x) * k;
          die.y = a.y + (z.y - a.y) * k;
          die.rx = a.rx + (z.rx - a.rx) * k;
          die.ry = a.ry + (z.ry - a.ry) * k;
          die.rz = a.rz + (z.rz - a.rz) * k;
          die.lift = a.lift * fade + 0.18 * Math.abs(Math.sin(Math.PI * 2 * s)) * fade;
        });
        if (s >= 0.85 && !land.touched) {
          land.touched = true;
          events.onSettle?.();
        }
        if (s >= 1) {
          dice.forEach((die, j) => Object.assign(die, land!.to[j]));
          faces = rolls[index]!;
          Object.assign(bowl, { x: 0, y: 0, rot: 0 });
          mode = "settled";
          t0 = now;
          settled = { opened: false, marked: false };
        }
      } else if (mode === "settled") {
        if (!settled.opened && e >= PACE.open) {
          settled.opened = true;
          open = true;
        }
        if (!settled.marked && e >= PACE.mark) {
          settled.marked = true;
          mark(index);
          if (index + 1 >= rolls.length) {
            if (running) finish();
            else mode = "rest";
          }
        }
        if (settled.marked && index + 1 < rolls.length && e >= PACE.next) {
          // The dome back down for the next roll.
          index += 1;
          until = PACE.shake;
          startShake();
          events.onShake?.(index);
        }
      }
    },
    dispose() {
      clear();
      running = false;
    }
  };
}
