import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWheelMotion,
  deadlineMs,
  FIRST_ROLL_MIN_S,
  mod,
  NEXT_ROLL_MIN_S,
  planDrop,
  pocketAngle,
  R_POCKET,
  ROCK,
  ROUND_GAP_MS,
  SEG,
  SPIN,
  WHEEL_ORDER
} from "./wheel-motion";

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

/** How far the ball sits from the centre of `n`'s pocket, relative to the wheel. */
const offPocket = (psi: number, n: number) => {
  const off = mod(psi - pocketAngle(n), 360);
  return Math.min(off, 360 - off);
};

function setup(reduced = false) {
  const landed: Array<[number, number, number]> = [];
  const done = vi.fn();
  const frets = vi.fn();
  let wheel: ReturnType<typeof createWheelMotion>;
  wheel = createWheelMotion({
    timers,
    reduced,
    events: {
      onLand: (index, value) => landed.push([index, value, wheel.psi]),
      onDone: done,
      onFret: frets
    }
  });
  let now = 1000;
  const frames = (count: number, each?: () => void, step = FRAME) => {
    for (let i = 0; i < count; i++) {
      now += step;
      wheel.tick(now);
      each?.();
    }
  };
  return { wheel, landed, done, frets, frames, time: () => now };
}

describe("the roulette wheel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("puts every number on the wheel once, zero first", () => {
    expect(WHEEL_ORDER).toHaveLength(37);
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    expect(pocketAngle(0)).toBe(0);
    expect(pocketAngle(26)).toBeCloseTo(36 * SEG, 9);
  });

  it("plans every drop one way, onto the pocket, in 1.5 to 3.6 seconds (20,000 draws)", () => {
    const random = seeded(17);
    for (let i = 0; i < 20_000; i++) {
      const tmin = random() < 0.5 ? FIRST_ROLL_MIN_S : NEXT_ROLL_MIN_S;
      const psi = random() * 3600 - 1800;
      const n = Math.floor(random() * 37);
      const plan = planDrop(psi, SPIN, pocketAngle(n), tmin);
      expect(plan.T).toBeGreaterThanOrEqual(1.5 - 1e-9);
      expect(plan.T).toBeLessThanOrEqual(3.6 + 1e-9);
      expect(plan.d).toBeGreaterThan(0);
      expect(offPocket(plan.psi1, n)).toBeLessThan(1e-6);
      // It leaves the track for the last 20 degrees only.
      expect(plan.d * (1 - plan.sd) ** 2).toBeCloseTo(20, 6);
    }
  });

  it("circles while the number is awaited, then drops into it without reversing (2,000 spins)", () => {
    const random = seeded(2026);
    for (let trial = 0; trial < 2_000; trial++) {
      const { wheel, landed, done, frames } = setup();
      const n = Math.floor(random() * 37);
      wheel.wait();
      frames(5 + Math.floor(random() * 120));
      expect(wheel.mode).toBe("spin");
      wheel.play([n]);
      let previous = wheel.psi;
      let dropFrames = 0;
      frames(300, () => {
        if (wheel.mode === "drop") {
          dropFrames++;
          expect(wheel.psi).toBeLessThanOrEqual(previous + 1e-9);
        }
        if (wheel.mode === "settle") {
          // Rocking, never out of its own pocket.
          expect(offPocket(wheel.psi, n)).toBeLessThanOrEqual(ROCK + 1e-9);
          expect(wheel.r).toBeGreaterThanOrEqual(R_POCKET - 1e-9);
        }
        previous = wheel.psi;
      });
      const seconds = (dropFrames * FRAME) / 1000;
      expect(seconds).toBeGreaterThanOrEqual(FIRST_ROLL_MIN_S - 2 * (FRAME / 1000));
      expect(seconds).toBeLessThanOrEqual(3.6 + 2 * (FRAME / 1000));
      expect(landed).toHaveLength(1);
      expect(landed[0]![1]).toBe(n);
      expect(offPocket(landed[0]![2], n)).toBeLessThan(1e-6);
      expect(done).toHaveBeenCalledTimes(1);
      wheel.dispose();
    }
  });

  it("bounces three times in the pocket, each meeting the frets", () => {
    const { wheel, frets, frames } = setup();
    wheel.wait();
    frames(10);
    wheel.play([17]);
    frames(300);
    expect(frets.mock.calls).toEqual([[1], [2]]);
  });

  it("lands on the number by the deadline even when the tab gets no frames", () => {
    const { wheel, landed, done } = setup();
    wheel.wait();
    wheel.play([5]);
    vi.advanceTimersByTime(deadlineMs(FIRST_ROLL_MIN_S) - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(landed.map(([k, n]) => [k, n])).toEqual([[0, 5]]);
    expect(offPocket(wheel.psi, 5)).toBeLessThan(1e-6);
    expect(wheel.r).toBe(R_POCKET);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("spins each later round from the pocket after a pause, in 1.5 to 2.9 seconds", () => {
    const { wheel, landed, done, frames } = setup();
    wheel.wait();
    frames(20);
    wheel.play([12, 0, 33]);
    frames(60 * 5);
    expect(landed.map(([k, n]) => [k, n])).toEqual([[0, 12]]);
    vi.advanceTimersByTime(ROUND_GAP_MS);
    let dropped = 0;
    frames(60 * 4, () => {
      if (wheel.mode === "drop") dropped += FRAME;
    });
    expect(dropped / 1000).toBeGreaterThanOrEqual(NEXT_ROLL_MIN_S - FRAME / 1000);
    expect(dropped / 1000).toBeLessThanOrEqual(2.9 + FRAME / 1000);
    expect(landed.map(([k, n]) => [k, n])).toEqual([
      [0, 12],
      [1, 0]
    ]);
    // The third round with no frames at all still lands by its deadline.
    vi.advanceTimersByTime(ROUND_GAP_MS + deadlineMs(NEXT_ROLL_MIN_S));
    expect(landed.map(([k, n]) => [k, n])).toEqual([
      [0, 12],
      [1, 0],
      [2, 33]
    ]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion never spins and places the ball in each pocket", () => {
    const { wheel, landed, done, frames } = setup(true);
    wheel.wait();
    expect(wheel.mode).toBe("rest");
    const before = wheel.theta;
    frames(60);
    // The idle wheel stands still.
    expect(wheel.theta).toBe(before);
    wheel.play([7, 29]);
    expect(landed.map(([k, n]) => [k, n])).toEqual([[0, 7]]);
    expect(offPocket(wheel.psi, 7)).toBeLessThan(1e-9);
    vi.advanceTimersByTime(1_000);
    expect(landed.map(([k, n]) => [k, n])).toEqual([
      [0, 7],
      [1, 29]
    ]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("turns slowly while idle, and forgets a bet on reset", () => {
    const { wheel, landed, frames } = setup();
    const before = wheel.theta;
    frames(120);
    expect(wheel.theta).not.toBe(before);
    wheel.wait();
    wheel.play([22]);
    wheel.reset();
    vi.advanceTimersByTime(10_000);
    expect(landed).toEqual([]);
    expect(wheel.mode).toBe("rest");
  });
});
