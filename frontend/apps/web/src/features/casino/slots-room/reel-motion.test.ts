import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bounceOffset,
  createReelMotion,
  deadlineMs,
  PACE,
  planStop,
  ROUND_GAP_MS,
  STRIPS,
  stripIndex,
  symbolAt
} from "./reel-motion";

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

const onLine = (motion: ReturnType<typeof createReelMotion>) =>
  motion.reels.map((reel, i) => symbolAt(i, reel.c));

function setup(reduced = false) {
  const landed: Array<[number, number[], number]> = [];
  const stops: Array<[number, number]> = [];
  const done = vi.fn();
  let now = 1000;
  const motion = createReelMotion({
    timers,
    reduced,
    events: {
      onStop: (i) => stops.push([i, now]),
      onLand: (index, symbols) => landed.push([index, [...symbols], now]),
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
  return { motion, landed, stops, done, frames, time: () => now };
}

describe("the slot reels", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("prints every symbol once on each reel's strip", () => {
    for (const strip of STRIPS) expect([...strip].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("plans every stop one way, onto its symbol, no shorter than the pace allows (40,000 draws)", () => {
    const random = seeded(512);
    for (let k = 0; k < 40_000; k++) {
      const pace = random() < 0.5 ? PACE.first : PACE.next;
      const i = Math.floor(random() * 3);
      const symbol = Math.floor(random() * 8);
      const c = random() * 200 - 100;
      const v = random() * pace.V;
      const plan = planStop(c, v, stripIndex(i, symbol), pace);
      expect(plan.d).toBeGreaterThan(0);
      expect(plan.T).toBeGreaterThanOrEqual(pace.tmin - 1e-9);
      expect(Math.abs(c - plan.d - plan.cf)).toBeLessThan(1e-6);
      expect(symbolAt(i, plan.cf)).toBe(symbol);
    }
  });

  it("bounces past the line and back by under 0.15 of a symbol", () => {
    for (const pace of [PACE.first, PACE.next]) {
      let most = 0;
      for (let e = 0; e <= pace.bounce; e += 0.0005)
        most = Math.max(most, Math.abs(bounceOffset(pace.ve, e)));
      expect(most).toBeGreaterThan(0.05);
      expect(most).toBeLessThan(0.15);
    }
  });

  it("spins while the number is awaited, then stops each reel on its symbol, left to right (2,000 spins)", () => {
    const random = seeded(2026);
    for (let trial = 0; trial < 2_000; trial++) {
      const { motion, landed, stops, done, frames, time } = setup();
      const symbols = [0, 1, 2].map(() => Math.floor(random() * 8));
      motion.wait();
      // The number takes at least half a second to arrive.
      frames(30 + Math.floor(random() * 240));
      expect(motion.reels.every((reel) => reel.mode === "spin")).toBe(true);
      const arrived = time();
      motion.play([symbols]);
      const previous = motion.reels.map((reel) => reel.c);
      const ends: Array<number | null> = [null, null, null];
      frames(60 * 6, () => {
        motion.reels.forEach((reel, i) => {
          if (reel.mode === "stop") expect(reel.c).toBeLessThanOrEqual(previous[i]! + 1e-9);
          if (reel.mode === "bounce" && ends[i] == null) ends[i] = reel.c;
          if (reel.mode === "bounce") expect(Math.abs(reel.c - ends[i]!)).toBeLessThan(0.15);
          previous[i] = reel.c;
        });
      });
      // Left to right, each a beat after the one before.
      expect(stops.map(([i]) => i)).toEqual([0, 1, 2]);
      expect(stops[1]![1] - stops[0]![1]).toBeGreaterThanOrEqual(PACE.first.order * 1000 - FRAME);
      expect(stops[2]![1] - stops[1]![1]).toBeGreaterThanOrEqual(PACE.first.order * 1000 - FRAME);
      expect(landed).toHaveLength(1);
      expect(landed[0]![1]).toEqual(symbols);
      // Every reel came to rest on its own, well before the deadline.
      expect(landed[0]![2] - arrived).toBeLessThan(deadlineMs(PACE.first) - 500);
      expect(onLine(motion)).toEqual(symbols);
      expect(done).toHaveBeenCalledTimes(1);
      motion.dispose();
    }
  });

  it("puts every reel on its symbol by the deadline even when the tab gets no frames", () => {
    const { motion, landed, done } = setup();
    motion.wait();
    motion.play([[7, 7, 7]]);
    vi.advanceTimersByTime(deadlineMs(PACE.first) - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(landed.map(([k, s]) => [k, s])).toEqual([[0, [7, 7, 7]]]);
    expect(onLine(motion)).toEqual([7, 7, 7]);
    expect(motion.reels.every((reel) => Number.isInteger(reel.c))).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("spins each later round faster, after a short pause", () => {
    const { motion, landed, done, frames, time } = setup();
    motion.wait();
    frames(60);
    const arrived = time();
    motion.play([
      [1, 1, 4],
      [6, 0, 6],
      [3, 5, 2]
    ]);
    frames(60 * 10);
    const first = landed[0]![2];
    expect(landed.map(([k, s]) => [k, s])).toEqual([
      [0, [1, 1, 4]],
      [1, [6, 0, 6]],
      [2, [3, 5, 2]]
    ]);
    // The later rounds each take under two seconds from the one before.
    expect(landed[1]![2] - first).toBeLessThan(ROUND_GAP_MS + deadlineMs(PACE.next));
    expect(landed[2]![2] - landed[1]![2]).toBeLessThan(ROUND_GAP_MS + deadlineMs(PACE.next));
    expect(deadlineMs(PACE.next)).toBeLessThan(deadlineMs(PACE.first) / 1.5);
    expect(first - arrived).toBeLessThan(deadlineMs(PACE.first));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("takes far less time on a later round than on the first, on average (200 bets)", () => {
    const random = seeded(77);
    const draw = () => [0, 1, 2].map(() => Math.floor(random() * 8));
    let firsts = 0;
    let laters = 0;
    for (let bet = 0; bet < 200; bet++) {
      const { motion, landed, frames, time } = setup();
      motion.wait();
      frames(60);
      const arrived = time();
      motion.play([draw(), draw()]);
      for (let i = 0; i < 900 && landed.length < 2; i++) frames(1);
      expect(landed).toHaveLength(2);
      firsts += landed[0]![2] - arrived;
      laters += landed[1]![2] - landed[0]![2] - ROUND_GAP_MS;
      motion.dispose();
    }
    expect(laters / firsts).toBeLessThan(0.7);
  });

  it("lands a later round by its deadline without frames", () => {
    const { motion, landed, frames } = setup();
    motion.wait();
    frames(60);
    motion.play([
      [2, 2, 2],
      [0, 3, 0]
    ]);
    // Frames until the first round is in, then none at all.
    for (let i = 0; i < 600 && landed.length === 0; i++) frames(1);
    expect(landed).toHaveLength(1);
    vi.advanceTimersByTime(ROUND_GAP_MS + deadlineMs(PACE.next));
    expect(landed.map(([k, s]) => [k, s])).toEqual([
      [0, [2, 2, 2]],
      [1, [0, 3, 0]]
    ]);
    expect(onLine(motion)).toEqual([0, 3, 0]);
  });

  it("under reduced motion never spins and places each round's symbols", () => {
    const { motion, landed, done, frames } = setup(true);
    motion.wait();
    expect(motion.spinning).toBe(false);
    const before = motion.reels.map((reel) => reel.c);
    frames(60);
    expect(motion.reels.map((reel) => reel.c)).toEqual(before);
    motion.play([
      [4, 4, 1],
      [7, 7, 7]
    ]);
    expect(landed.map(([k, s]) => [k, s])).toEqual([[0, [4, 4, 1]]]);
    expect(onLine(motion)).toEqual([4, 4, 1]);
    vi.advanceTimersByTime(250);
    expect(landed.map(([k, s]) => [k, s])).toEqual([
      [0, [4, 4, 1]],
      [1, [7, 7, 7]]
    ]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("places a result shown without its spin, and forgets a bet on reset", () => {
    const { motion, landed, frames } = setup();
    motion.place([5, 5, 5]);
    expect(onLine(motion)).toEqual([5, 5, 5]);
    motion.wait();
    frames(40);
    motion.reset();
    expect(motion.spinning).toBe(false);
    expect(motion.reels.every((reel) => Number.isInteger(reel.c))).toBe(true);
    vi.advanceTimersByTime(10_000);
    frames(30);
    expect(landed).toEqual([]);
  });
});
