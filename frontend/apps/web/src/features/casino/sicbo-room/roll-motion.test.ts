import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aimAt, createRollMotion, deadlineMs, FACE_UP, faceUp, PACE } from "./roll-motion";
import type { Dice } from "./sicbo-model";

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

const facesOf = (motion: { dice: ReadonlyArray<{ rx: number; ry: number }> }) =>
  motion.dice.map((die) => faceUp(die.rx, die.ry));

function setup({ reduced = false, random = seeded(1) } = {}) {
  const rolled: Array<{ i: number; at: number; faces: number[]; open: boolean }> = [];
  const shakes: number[] = [];
  const done = vi.fn();
  let rattles = 0;
  let now = 1000;
  const motion = createRollMotion({
    timers,
    reduced,
    random,
    events: {
      onRattle: () => (rattles += 1),
      onShake: (i) => shakes.push(i),
      onRoll: (i) => rolled.push({ i, at: now, faces: facesOf(motion), open: motion.open }),
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
  return { motion, rolled, shakes, done, frames, rattles: () => rattles, time: () => now };
}

const roll = (random: () => number): Dice => [
  1 + Math.floor(random() * 6),
  1 + Math.floor(random() * 6),
  1 + Math.floor(random() * 6)
];

describe("the sic bo dice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("turns every face up, and aims a full turn or more ahead", () => {
    for (const [face, [rx, ry]] of Object.entries(FACE_UP)) {
      expect(faceUp(rx, ry)).toBe(Number(face));
      for (const from of [0, 47, -300, 1234]) {
        const a = aimAt(from, rx, 270);
        expect(a - from).toBeGreaterThanOrEqual(270);
        expect(a - from).toBeLessThan(270 + 360);
        expect(faceUp(a, aimAt(from, ry, 270))).toBe(Number(face));
      }
    }
  });

  it("shakes the dome and throws the dice about inside it while the number is awaited", () => {
    const { motion, frames, rattles } = setup();
    expect(motion.open).toBe(true);
    motion.wait();
    expect(motion.open).toBe(false);
    const xs: number[] = [];
    frames(180, () => {
      xs.push(motion.dice[0]!.x);
      // Never through the glass.
      for (const die of motion.dice) expect(Math.hypot(die.x, die.y)).toBeLessThanOrEqual(1.7001);
    });
    expect(motion.shaking).toBe(true);
    expect(motion.open).toBe(false);
    expect(new Set(xs.map((x) => x.toFixed(3))).size).toBeGreaterThan(100);
    expect(motion.dice.every((die) => die.lift > 0.3)).toBe(true);
    expect(rattles()).toBeGreaterThan(5);
    expect(Math.abs(motion.bowl.x) + Math.abs(motion.bowl.y)).toBeGreaterThan(0);
  });

  it("settles every one of 60 seeded multi-roll bets on its faces, in order and on time", () => {
    const random = seeded(7);
    for (let bet = 0; bet < 60; bet++) {
      const { motion, rolled, shakes, done, frames, time } = setup({ random: seeded(bet + 1) });
      const count = 1 + Math.floor(random() * 5);
      const rolls = Array.from({ length: count }, () => roll(random));
      motion.wait();
      frames(20 + Math.floor(random() * 60));
      const start = time();
      motion.play(rolls);
      frames(Math.ceil(deadlineMs(count) / FRAME) + 5);
      expect(done).toHaveBeenCalledTimes(1);
      expect(rolled.map((r) => r.i)).toEqual(rolls.map((_, i) => i));
      expect(shakes).toEqual(rolls.slice(1).map((_, i) => i + 1));
      rolled.forEach((r, i) => {
        // Each roll counts on its own faces, with the dome off.
        expect(r.faces).toEqual([...rolls[i]!]);
        expect(r.open).toBe(true);
        // On the frames, a frame or so late at each step, well before the deadline would step in.
        const first = (PACE.land + PACE.mark) * 1000;
        const each = (PACE.next - PACE.mark + PACE.shake + PACE.landNext + PACE.mark) * 1000;
        expect(r.at - start).toBeLessThanOrEqual(first + i * each + 4 * FRAME * (i + 1));
      });
      expect(motion.faces).toEqual(rolls.at(-1));
      expect(motion.active).toBe(false);
    }
  });

  it("keeps the room's fallback reveal beyond the deadline for up to 25 rolls", () => {
    for (let n = 1; n <= 25; n++) expect(deadlineMs(n)).toBeLessThan(2_900 + (n - 1) * 2_600);
  });

  it("lays the rest out at the deadline when the tab gets no frames", () => {
    const { motion, rolled, done } = setup();
    motion.wait();
    const rolls: Dice[] = [
      [1, 2, 3],
      [6, 6, 6],
      [4, 5, 1]
    ];
    motion.play(rolls);
    vi.advanceTimersByTime(deadlineMs(3) - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(rolled.map((r) => r.i)).toEqual([0, 1, 2]);
    expect(motion.open).toBe(true);
    expect(facesOf(motion)).toEqual([4, 5, 1]);
  });

  it("lays the rest out at once for a hidden tab", () => {
    const { motion, rolled, done, frames } = setup();
    motion.wait();
    motion.play([
      [2, 2, 3],
      [5, 5, 5]
    ]);
    frames(10);
    motion.flush();
    expect(done).toHaveBeenCalledTimes(1);
    expect(rolled.map((r) => r.i)).toEqual([0, 1]);
    expect(facesOf(motion)).toEqual([5, 5, 5]);
    // Nothing more after it: the deadline was cleared.
    vi.advanceTimersByTime(60_000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("never moves under reduced motion: the dome goes down, and the last roll is shown", () => {
    const { motion, rolled, done } = setup({ reduced: true });
    motion.wait();
    expect(motion.open).toBe(false);
    expect(motion.active).toBe(false);
    motion.play([
      [3, 3, 1],
      [6, 2, 4]
    ]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(rolled.map((r) => r.i)).toEqual([0, 1]);
    expect(motion.open).toBe(true);
    expect(facesOf(motion)).toEqual([6, 2, 4]);
  });

  it("lays out a result shown before the table mounted, and goes back to rest", () => {
    const { motion, rolled, done } = setup();
    motion.place([[1, 4, 4]]);
    expect(facesOf(motion)).toEqual([1, 4, 4]);
    expect(rolled).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
    motion.wait();
    motion.reset();
    expect(motion.open).toBe(true);
    expect(motion.active).toBe(false);
    expect(facesOf(motion)).toEqual([1, 4, 4]);
  });
});
