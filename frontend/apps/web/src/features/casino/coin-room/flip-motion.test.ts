import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFlipMotion, deadlineMs, landingAngle, PACE, showsTails, TOUCH } from "./flip-motion";

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

function setup({ reduced = false } = {}) {
  const landed: Array<{ i: number; at: number; tails: boolean }> = [];
  const tosses: number[] = [];
  const done = vi.fn();
  let now = 1000;
  const motion = createFlipMotion({
    timers,
    reduced,
    events: {
      onToss: () => tosses.push(now),
      onLand: (i) => landed.push({ i, at: now, tails: showsTails(motion.angle) }),
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
  return { motion, landed, tosses, done, frames, time: () => now };
}

describe("the coin flip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("finds the next angle with the chosen side up, at least a set turn ahead", () => {
    for (const from of [0, 37, 180, 359, 1234]) {
      for (const tails of [false, true]) {
        const a = landingAngle(from, tails, 320);
        expect(a - from).toBeGreaterThanOrEqual(320);
        expect(a - from).toBeLessThan(320 + 360);
        expect(((a % 360) + 360) % 360).toBe(tails ? 180 : 0);
        expect(showsTails(a)).toBe(tails);
      }
    }
  });

  it("spins in the air while the number is awaited", () => {
    const { motion, tosses, frames } = setup();
    motion.wait();
    expect(tosses).toHaveLength(1);
    const angles: number[] = [];
    frames(120, () => angles.push(motion.angle));
    expect(motion.spinning).toBe(true);
    expect(motion.height).toBeGreaterThan(0.9);
    // Always turning, never settling while it waits.
    for (let k = 1; k < angles.length; k++) expect(angles[k]!).toBeGreaterThan(angles[k - 1]!);
  });

  it("lands every one of 60 seeded multi-flip bets on its sides, in order and on time", () => {
    const random = seeded(7);
    for (let bet = 0; bet < 60; bet++) {
      const { motion, landed, tosses, done, frames, time } = setup();
      const count = 1 + Math.floor(random() * 6);
      const sides = Array.from({ length: count }, () => random() < 0.5);
      motion.wait();
      frames(10 + Math.floor(random() * 90));
      const start = time();
      motion.play(sides);
      frames(Math.ceil(deadlineMs(count) / FRAME) + 2);
      expect(done).toHaveBeenCalledTimes(1);
      expect(landed.map((land) => land.i)).toEqual(sides.map((_, i) => i));
      // Each flip touches the felt on the side its number chose.
      landed.forEach((land, i) => expect(land.tails).toBe(sides[i]));
      expect(showsTails(motion.angle)).toBe(sides.at(-1));
      expect(motion.height).toBe(0);
      expect(motion.active).toBe(false);
      // The first flip touches the felt TOUCH of the way down; each later one after a rattle and a toss.
      expect(landed[0]!.at - start).toBeCloseTo(PACE.land * TOUCH * 1000, -2);
      for (let i = 1; i < count; i++) {
        const gap = landed[i]!.at - landed[i - 1]!.at;
        const expected =
          ((1 - TOUCH) * (i === 1 ? PACE.land : PACE.landNext) +
            PACE.rattle +
            PACE.toss +
            TOUCH * PACE.landNext) *
          1000;
        expect(Math.abs(gap - expected)).toBeLessThan(4 * FRAME);
      }
      // One toss for the bet, one before every later flip.
      expect(tosses).toHaveLength(count);
    }
  });

  it("lays the coin on its last side by the deadline when the tab gets no frames", () => {
    const { motion, landed, done } = setup();
    motion.wait();
    motion.play([true, false, true]);
    vi.advanceTimersByTime(deadlineMs(3) - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(landed.map((land) => land.i)).toEqual([0, 1, 2]);
    expect(showsTails(motion.angle)).toBe(true);
    expect(motion.height).toBe(0);
    expect(motion.active).toBe(false);
  });

  it("keeps the deadline inside the room's fallback reveal, up to 25 flips", () => {
    expect(deadlineMs(1)).toBeCloseTo(2_400, 6);
    for (let count = 1; count <= 25; count++)
      expect(deadlineMs(count)).toBeLessThan(2_900 + (count - 1) * 1_500);
  });

  it("never moves under reduced motion", () => {
    const { motion, landed, tosses, done } = setup({ reduced: true });
    motion.wait();
    expect(motion.active).toBe(false);
    expect(motion.height).toBe(0);
    expect(tosses).toHaveLength(0);
    motion.play([false, true]);
    expect(landed.map((land) => land.i)).toEqual([0, 1]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(showsTails(motion.angle)).toBe(true);
    expect(motion.active).toBe(false);
  });

  it("places a result shown before the table mounted, and lies flat on a refund", () => {
    const { motion, landed, done, frames } = setup();
    motion.place([true]);
    expect(showsTails(motion.angle)).toBe(true);
    expect(landed).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
    motion.wait();
    frames(40);
    motion.reset();
    expect(motion.height).toBe(0);
    expect(motion.active).toBe(false);
    expect(motion.angle % 180).toBe(0);
  });
});
