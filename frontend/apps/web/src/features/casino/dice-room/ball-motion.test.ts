import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { at, createBallMotion, FIRST_ROLL_DEADLINE_MS, ROUND_GAP_MS } from "./ball-motion";
import { celebrate, printerState } from "../table-room/table-model";

const FRAME = 1000 / 60;
// Called as methods of this object, as the controller calls them.
const timers = {
  setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer)
};

function setup(reduced = false) {
  const landed: Array<[number, number]> = [];
  const done = vi.fn();
  const bounce = vi.fn();
  const ball = createBallMotion({
    timers,
    reduced,
    events: {
      onBounce: bounce,
      onLand: (index, value) => landed.push([index, value]),
      onDone: done
    }
  });
  let now = 0;
  const frames = (count: number, each?: () => void) => {
    for (let i = 0; i < count; i++) {
      now += FRAME;
      ball.tick(now);
      each?.();
    }
  };
  return { ball, landed, done, bounce, frames, time: () => now };
}

describe("the dice ball", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rolls back and forth while the number is awaited, bouncing off both ends", () => {
    const { ball, bounce, frames } = setup();
    ball.wait();
    expect(ball.mode).toBe("wait");
    frames(60 * 3);
    expect(bounce).toHaveBeenCalled();
    expect(ball.x).toBeGreaterThanOrEqual(0);
    expect(ball.x).toBeLessThanOrEqual(1);
  });

  it.each([3, 27, 50, 74, 98])(
    "rolls on to %i without reversing, overshooting or taking longer than 1.8 s",
    (value) => {
      const { ball, landed, frames, time } = setup();
      ball.wait();
      frames(37);
      ball.play([value]);
      const target = at(value);
      let start: number | null = null;
      let end: number | null = null;
      let previous = ball.x;
      let direction = 0;
      frames(60 * 4, () => {
        if (ball.mode === "roll") {
          if (start == null) {
            // The frame it leaves the back-and-forth: from here on it only heads for the number.
            start = time();
            direction = Math.sign(target - ball.x);
          } else {
            const step = ball.x - previous;
            if (step !== 0) expect(Math.sign(step)).toBe(direction);
          }
          // Never past the number before the settle.
          expect((ball.x - target) * direction).toBeLessThanOrEqual(1e-9);
        } else if (start != null && end == null) {
          end = time();
        }
        previous = ball.x;
      });
      expect(start).not.toBeNull();
      const seconds = (end! - start!) / 1000;
      expect(seconds).toBeGreaterThanOrEqual(0.9 - 2 * (FRAME / 1000));
      expect(seconds).toBeLessThanOrEqual(1.8 + 2 * (FRAME / 1000));
      expect(landed).toEqual([[0, value]]);
      expect(ball.x).toBeCloseTo(target, 9);
    }
  );

  it("lands on the number by the deadline even when the tab gets no frames", () => {
    const { ball, landed, done, frames } = setup();
    ball.wait();
    frames(20);
    ball.play([88]);
    vi.advanceTimersByTime(FIRST_ROLL_DEADLINE_MS - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(landed).toEqual([[0, 88]]);
    expect(ball.x).toBeCloseTo(at(88), 9);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("rolls each later round from rest in 0.5–0.9 s, after a short pause", () => {
    const { ball, landed, done, frames } = setup();
    ball.wait();
    frames(30);
    ball.play([10, 90, 45]);
    frames(60 * 3);
    expect(landed).toEqual([[0, 10]]);
    vi.advanceTimersByTime(ROUND_GAP_MS);
    expect(ball.mode).toBe("roll");
    let rolled = 0;
    frames(60 * 2, () => {
      if (ball.mode === "roll") rolled += FRAME;
    });
    expect(rolled / 1000).toBeGreaterThanOrEqual(0.5 - FRAME / 1000);
    expect(rolled / 1000).toBeLessThanOrEqual(0.9 + FRAME / 1000);
    expect(landed).toEqual([
      [0, 10],
      [1, 90]
    ]);
    vi.advanceTimersByTime(ROUND_GAP_MS);
    frames(60 * 2);
    expect(landed.at(-1)).toEqual([2, 45]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("under reduced motion never rolls while waiting and places the ball on each number", () => {
    const { ball, landed, done, frames } = setup(true);
    ball.wait();
    expect(ball.mode).toBe("rest");
    frames(30);
    ball.play([5, 95]);
    expect(landed).toEqual([[0, 5]]);
    expect(ball.x).toBeCloseTo(at(5), 9);
    vi.advanceTimersByTime(1_000);
    expect(landed).toEqual([
      [0, 5],
      [1, 95]
    ]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("forgets a bet on reset, so its deadline lands nothing", () => {
    const { ball, landed } = setup();
    ball.wait();
    ball.play([40]);
    ball.reset();
    vi.advanceTimersByTime(10_000);
    expect(landed).toEqual([]);
    expect(ball.mode).toBe("rest");
  });
});

describe("paying a result on the table", () => {
  it.each([
    // [what came back, stake, chips]
    [1_960_000n, 1_000_000n, 2],
    [2_000_000n, 1_000_000n, 3],
    [4_900_000n, 1_000_000n, 3],
    [5_000_000n, 1_000_000n, 5],
    [10_000_000n, 1_000_000n, 7],
    [98_000_000n, 1_000_000n, 7]
  ])("pays %s back on a %s stake with %i chips", (back, stake, chips) => {
    expect(celebrate({ playerOwed: back, netResult: back - stake })).toEqual({
      net: back - stake,
      chips,
      big: chips === 7
    });
  });

  it("does nothing for a loss, a push or a payout below the stake", () => {
    expect(celebrate({ playerOwed: 0n, netResult: -1_000_000n })).toBeNull();
    expect(celebrate({ playerOwed: 1_000_000n, netResult: 0n })).toBeNull();
    // Three rounds, one won: 1.96 back on a 3.00 stake.
    expect(celebrate({ playerOwed: 1_960_000n, netResult: -1_040_000n })).toBeNull();
  });
});

describe("the printer's status light", () => {
  const base = { revealing: false, receipt: false, printed: false };
  it("follows the bet from ready to printed", () => {
    expect(printerState({ ...base, phase: "ready" })).toBe("ready");
    expect(printerState({ ...base, phase: "placing" })).toBeNull();
    expect(printerState({ ...base, phase: "waiting_vrf" })).toBe("waiting");
    expect(printerState({ ...base, phase: "timeout_soft" })).toBe("waiting");
    expect(printerState({ ...base, phase: "revealing", revealing: true })).toBe("received");
    expect(printerState({ ...base, phase: "settling" })).toBe("printing");
    expect(printerState({ ...base, phase: "idle", receipt: true })).toBe("printing");
    expect(printerState({ ...base, phase: "idle", receipt: true, printed: true })).toBe("printed");
    expect(printerState({ ...base, phase: "refundable" })).toBeNull();
  });
});
