import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BALL,
  createBlowerMotion,
  deadlineMs,
  DRAWN,
  GLOBE,
  LIMIT,
  PACE,
  RACK_X,
  ROUND_GAP_MS,
  slotY,
  tubePoint
} from "./blower-motion";

const FRAME = 1000 / 60;
const timers = {
  setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer)
};

/** A small fixed-seed generator, so a failure can be replayed. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Five of fifteen without replacement, as KenoModule draws them. */
function drawFive(random: () => number) {
  const pool = Array.from({ length: 15 }, (_, i) => i + 1);
  for (let i = 0; i < DRAWN; i++) {
    const j = i + Math.floor(random() * (15 - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, DRAWN);
}

function setup({ reduced = false, seed = 1 } = {}) {
  const landed: Array<{ round: number; k: number; n: number; at: number }> = [];
  const rounds: Array<[number, number]> = [];
  const done = vi.fn();
  let now = 1000;
  const motion = createBlowerMotion({
    timers,
    reduced,
    random: seeded(seed),
    events: {
      onRound: (round) => rounds.push([round, now]),
      onLand: (round, k, n) => landed.push({ round, k, n, at: now }),
      onDone: done
    }
  });
  /** Frames and timers move together, as in a browser tab that is on screen. */
  const frames = (count: number, each?: () => void) => {
    for (let i = 0; i < count; i++) {
      now += FRAME;
      vi.advanceTimersByTime(FRAME);
      motion.tick(now);
      each?.();
    }
  };
  motion.tick(now);
  return { motion, landed, rounds, done, frames, time: () => now };
}

const inGlass = (motion: ReturnType<typeof createBlowerMotion>) =>
  motion.balls
    .filter((b) => b.mode === "globe")
    .every((b) => Math.hypot(b.x - GLOBE.x, b.y - GLOBE.y) <= LIMIT + 1e-6);

describe("the keno blower", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs each tube from the globe's mouth over the top to its own slot", () => {
    for (let k = 0; k < DRAWN; k++) {
      expect(tubePoint(k, 0)).toEqual({ x: GLOBE.x, y: GLOBE.y - GLOBE.r + 2 });
      const end = tubePoint(k, 1);
      expect(end.x).toBeCloseTo(RACK_X);
      expect(end.y).toBeCloseTo(slotY(k));
      // The slots are a ball apart, so the rack never overlaps.
      if (k > 0) expect(slotY(k - 1) - slotY(k)).toBeGreaterThanOrEqual(2 * BALL);
    }
  });

  it("keeps every ball in the glass while the air is on, and settles the pile when it stops", () => {
    const { motion, frames } = setup({ seed: 7 });
    motion.wait();
    expect(motion.mixing).toBe(true);
    frames(600, () => expect(inGlass(motion)).toBe(true));
    // The air keeps them moving.
    expect(motion.balls.some((b) => Math.hypot(b.vx, b.vy) > 100)).toBe(true);
    motion.reset();
    expect(motion.mixing).toBe(false);
    frames(240);
    expect(inGlass(motion)).toBe(true);
    // At rest they lie in the lower half, none deep inside another.
    expect(motion.balls.every((b) => b.y > GLOBE.y - 20)).toBe(true);
    for (const a of motion.balls)
      for (const b of motion.balls)
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * BALL - 4);
    expect(motion.active).toBe(false);
  });

  it("draws the five balls one by one into their slots, in order, before the deadline (300 draws)", () => {
    const random = seeded(3003);
    for (let draw = 0; draw < 300; draw++) {
      const { motion, landed, done, frames, time } = setup({ seed: draw + 1 });
      motion.wait();
      frames(30);
      const numbers = drawFive(random);
      const start = time();
      motion.play([numbers]);
      frames(Math.ceil(deadlineMs(PACE.first) / FRAME) - 30);
      expect(done).toHaveBeenCalledOnce();
      expect(landed.map((l) => l.n)).toEqual(numbers);
      expect(landed.map((l) => l.k)).toEqual([0, 1, 2, 3, 4]);
      // Each ball takes the lift and the tube, the next leaves the pile a gap later.
      landed.forEach((l, k) => {
        const expected = start + (k * PACE.first.gap + PACE.first.up + PACE.first.tube) * 1000;
        expect(l.at).toBeGreaterThanOrEqual(expected - FRAME);
        expect(l.at).toBeLessThan(expected + 3 * FRAME);
      });
      expect(landed.at(-1)!.at - start).toBeLessThan(deadlineMs(PACE.first) - 500);
      frames(30);
      for (const [k, n] of numbers.entries()) {
        const ball = motion.balls[n - 1]!;
        expect(ball.mode).toBe("rack");
        expect(ball.x).toBeCloseTo(RACK_X);
        expect(ball.y).toBeCloseTo(slotY(k));
      }
      expect(inGlass(motion)).toBe(true);
    }
  });

  it("puts the balls in the rack by the deadline when the tab gets no frames", () => {
    const { motion, landed, done } = setup();
    motion.wait();
    motion.play([[3, 9, 1, 15, 7]]);
    vi.advanceTimersByTime(deadlineMs(PACE.first) - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledOnce();
    expect(landed.map((l) => l.n)).toEqual([3, 9, 1, 15, 7]);
    expect(motion.balls[2]!.mode).toBe("rack");
  });

  it("draws later rounds faster, each after the last one's pause, frames or not", () => {
    const draws = [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15]
    ];
    const { motion, landed, rounds, done, frames, time } = setup();
    motion.wait();
    const start = time();
    motion.play(draws);
    frames(
      Math.ceil((deadlineMs(PACE.first) + 2 * (ROUND_GAP_MS + deadlineMs(PACE.next))) / FRAME)
    );
    expect(done).toHaveBeenCalledOnce();
    expect(rounds.map(([round]) => round)).toEqual([0, 1, 2]);
    expect(landed.map((l) => l.n)).toEqual(draws.flat());
    const span = (round: number) => {
      const own = landed.filter((l) => l.round === round);
      return own.at(-1)!.at - rounds[round]![1];
    };
    expect(span(1)).toBeLessThan(span(0) / 1.6);
    expect(rounds[1]![1] - start).toBeGreaterThanOrEqual(span(0) + ROUND_GAP_MS - FRAME);
    expect(deadlineMs(PACE.next)).toBeLessThan(deadlineMs(PACE.first));

    // The same bet in a hidden tab ends by the sum of the deadlines.
    const hidden = setup();
    hidden.motion.wait();
    hidden.motion.play(draws);
    vi.advanceTimersByTime(deadlineMs(PACE.first) + 2 * (ROUND_GAP_MS + deadlineMs(PACE.next)));
    expect(hidden.done).toHaveBeenCalledOnce();
    expect(hidden.landed.map((l) => l.n)).toEqual(draws.flat());
  });

  it("places the balls at once under reduced motion, with no air", () => {
    const { motion, landed, done } = setup({ reduced: true });
    motion.wait();
    expect(motion.mixing).toBe(false);
    motion.play([
      [2, 4, 6, 8, 10],
      [1, 3, 5, 7, 9]
    ]);
    expect(landed.map((l) => l.n)).toEqual([2, 4, 6, 8, 10]);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(landed.map((l) => l.n)).toEqual([2, 4, 6, 8, 10, 1, 3, 5, 7, 9]);
    expect(done).toHaveBeenCalledOnce();
  });

  it("places a result in the rack without events, and resets to the globe", () => {
    const { motion, landed } = setup();
    motion.place([5, 6, 7, 8, 9]);
    expect(landed).toEqual([]);
    expect(motion.balls[4]!.mode).toBe("rack");
    expect(motion.balls[4]!.y).toBeCloseTo(slotY(0));
    motion.reset();
    expect(motion.balls.every((b) => b.mode === "globe")).toBe(true);
  });
});
