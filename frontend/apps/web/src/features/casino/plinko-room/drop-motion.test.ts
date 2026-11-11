import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BALL_R,
  createDropMotion,
  cupX,
  CX,
  cradleY,
  CRADLE_HALF,
  deadlineMs,
  launchAt,
  PINS,
  pinX,
  REST_Y,
  route,
  ROWS,
  rowY
} from "./drop-motion";

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
const randomPath = (random: () => number) => Array.from({ length: ROWS }, () => random() < 0.5);
const rights = (bits: readonly boolean[]) => bits.filter(Boolean).length;

function setup({ reduced = false } = {}) {
  const landed: Array<{ i: number; cup: number; count: number; at: number }> = [];
  const pins: Array<{ i: number; r: number; j: number }> = [];
  const done = vi.fn();
  let now = 1000;
  const motion = createDropMotion({
    timers,
    reduced,
    events: {
      onPin: (i, r, j) => pins.push({ i, r, j }),
      onLand: (i, cup, count) => landed.push({ i, cup, count, at: now }),
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
  return { motion, landed, pins, done, frames, time: () => now };
}

describe("the plinko drop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("builds the triangle, with the last row's pins on the cup walls", () => {
    for (let r = 0; r < ROWS; r++) {
      const row = PINS.filter((pin) => pin.r === r);
      expect(row[0]!.x).toBeGreaterThanOrEqual(0);
      expect(row.at(-1)!.x).toBeLessThanOrEqual(360);
      // Every pin a ball can touch is on the board.
      for (let j = 0; j <= r; j++) expect(row.some((pin) => pin.j === j)).toBe(true);
    }
    const last = PINS.filter((pin) => pin.r === ROWS - 1).map((pin) => pin.x);
    const walls = Array.from({ length: 10 }, (_, k) => cupX(k) - 20);
    expect(last).toEqual(walls);
  });

  it("routes a ball over the pin it hits in each row into the cup of its rights", () => {
    const random = seeded(7);
    for (let n = 0; n < 200; n++) {
      const bits = randomPath(random);
      const points = route(bits);
      let j = 0;
      for (let r = 0; r < ROWS; r++) {
        expect(points[r]!.x).toBeCloseTo(pinX(r, j));
        expect(points[r]!.y).toBeLessThan(rowY(r));
        if (bits[r]) j += 1;
      }
      expect(points[ROWS]!.x).toBeCloseTo(cupX(rights(bits)));
      expect(points[ROWS]!.y).toBe(REST_Y);
    }
  });

  it("rocks in the cradle while waiting, on the cradle's curve", () => {
    const { motion, frames } = setup();
    motion.wait();
    let reach = 0;
    frames(240, () => {
      const ball = motion.balls[0]!;
      expect(ball.mode).toBe("cradle");
      expect(Math.abs(ball.x - CX)).toBeLessThanOrEqual(CRADLE_HALF);
      expect(ball.y).toBeCloseTo(cradleY(ball.x - CX));
      reach = Math.max(reach, Math.abs(ball.x - CX));
    });
    expect(reach).toBeGreaterThan(20);
    expect(motion.active).toBe(true);
  });

  it("drops each ball along its own bits, lighting the pins it hits, before the deadline", () => {
    const random = seeded(3);
    for (let n = 0; n < 60; n++) {
      const count = 1 + Math.floor(random() * 4);
      const paths = Array.from({ length: count }, () => randomPath(random));
      const { motion, landed, pins, done, frames, time } = setup();
      motion.wait();
      frames(10);
      const start = time();
      motion.play(paths);
      frames(Math.ceil(deadlineMs(count) / FRAME) + 10);
      expect(done).toHaveBeenCalledTimes(1);
      expect(landed.map((l) => l.i).sort()).toEqual(paths.map((_, i) => i));
      for (const l of landed) {
        expect(l.cup).toBe(rights(paths[l.i]!));
        expect(l.at - start).toBeLessThanOrEqual(deadlineMs(count));
      }
      // Every row's pin, in order, for every ball: frames never skip one.
      paths.forEach((bits, i) => {
        let j = 0;
        const expected = bits.map((right, r) => {
          const pin = { i, r, j };
          if (right) j += 1;
          return pin;
        });
        expect(pins.filter((pin) => pin.i === i)).toEqual(expected);
      });
      // One ball rests in each cup; the tag counts the rest.
      const shown = motion.balls.filter((b) => b.mode === "rest");
      expect(new Set(shown.map((b) => b.cup)).size).toBe(shown.length);
      for (const b of shown)
        expect(motion.counts[b.cup]).toBe(paths.filter((p) => rights(p) === b.cup).length);
      expect(motion.active).toBe(false);
    }
  });

  it("drops later balls about 0.4 s apart, the first landing first", () => {
    const paths = [Array(8).fill(true), Array(8).fill(false), Array(8).fill(true)];
    const { motion, landed, frames, time } = setup();
    motion.wait();
    frames(5);
    const start = time();
    motion.play(paths);
    frames(400);
    expect(landed.map((l) => l.i)).toEqual([0, 1, 2]);
    expect(launchAt(2) - launchAt(1)).toBeCloseTo(0.54);
    expect(landed[2]!.at - landed[1]!.at).toBeGreaterThan(400);
    expect(landed[0]!.at - start).toBeGreaterThan(2000);
    expect(landed[2]!.count).toBe(2);
    const trail = motion.trail(motion.balls[1]!);
    expect(trail[0]).toEqual({ x: CX, y: cradleY(0) });
    expect(trail.at(-1)).toEqual({ x: cupX(0), y: REST_Y });
  });

  it("puts every ball in its cup by the deadline when the tab gets no frames", () => {
    const paths = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 8 }, (_, r) => (i + r) % 2 === 0)
    );
    const { motion, landed, done, frames } = setup();
    motion.wait();
    frames(3);
    motion.play(paths);
    vi.advanceTimersByTime(deadlineMs(5) - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(landed.map((l) => l.i)).toEqual([0, 1, 2, 3, 4]);
    expect(motion.balls.every((b) => b.y === REST_Y || b.mode === "gone")).toBe(true);
  });

  it("lands every ball before the room's fallback reveal (use-stage-reveal.ts) ends", () => {
    for (let count = 1; count <= 25; count++)
      expect(deadlineMs(count)).toBeLessThan(4_200 + (count - 1) * 600);
    expect(deadlineMs(1)).toBeCloseTo(3_580);
  });

  it("places the balls at once under reduced motion, and resets to the cradle", () => {
    const { motion, landed, done } = setup({ reduced: true });
    motion.wait();
    expect(motion.active).toBe(false);
    motion.play([Array(8).fill(false), Array(8).fill(false)]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(landed.map((l) => [l.cup, l.count])).toEqual([
      [0, 1],
      [0, 2]
    ]);
    expect(motion.balls[0]!.mode).toBe("gone");
    expect(motion.balls[1]!.mode).toBe("rest");
    motion.reset();
    expect(motion.balls).toHaveLength(1);
    expect(motion.balls[0]!.mode).toBe("cradle");
    expect(motion.counts.every((c) => c === 0)).toBe(true);

    const placed = setup();
    placed.motion.place([Array(8).fill(true)]);
    expect(placed.landed).toHaveLength(0);
    expect(placed.motion.balls[0]!.x).toBe(cupX(8));
    expect(placed.motion.counts[8]).toBe(1);
    expect(BALL_R).toBeGreaterThan(0);
  });
});
