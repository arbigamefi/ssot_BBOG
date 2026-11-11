import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaccaratHand } from "./baccarat-model";
import {
  createDealMotion,
  dealMs,
  deadlineMs,
  DEAL,
  GAP,
  PACE,
  stepsOf,
  SWEEP,
  type DealView
} from "./deal-motion";

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

const points = (rank: number) => (rank <= 8 ? rank + 1 : 0);
const total = (ranks: readonly number[]) => ranks.reduce((a, r) => a + points(r), 0) % 10;

/** A hand dealt from six draws in card order P1 B1 P2 B2 P3 B3, by the module's rule. */
function hand(draws: readonly number[]): BaccaratHand {
  const p = [draws[0]!, draws[2]!];
  const b = [draws[1]!, draws[3]!];
  if (total(p) < 8 && total(b) < 8) {
    const pDraws = total(p) <= 5;
    const p3 = pDraws ? points(draws[4]!) : 0;
    if (pDraws) p.push(draws[4]!);
    const bt = total(b);
    const bDraws = !pDraws
      ? bt <= 5
      : bt <= 2 ||
        (bt === 3 && p3 !== 8) ||
        (bt === 4 && p3 >= 2 && p3 <= 7) ||
        (bt === 5 && p3 >= 4 && p3 <= 7) ||
        (bt === 6 && (p3 === 6 || p3 === 7));
    if (bDraws) b.push(draws[5]!);
  }
  const pt = total(p);
  const bt = total(b);
  const outcome = pt > bt ? "player" : bt > pt ? "banker" : "tie";
  return {
    playerRanks: p,
    bankerRanks: b,
    playerCards: p.map(points),
    bankerCards: b.map(points),
    playerTotal: pt,
    bankerTotal: bt,
    outcome,
    factorBps: 0,
    won: false
  };
}

// ranks: 0 ace, 1-8 for 2-9, 9 ten, 10-12 pictures
const NATURAL = hand([7, 2, 9, 3, 0, 0]); // P 8+10 = 8, B 3+4 = 7: a natural, no draws
const BOTH_DRAW = hand([1, 0, 1, 1, 4, 9]); // P 2+2 = 4 draws a 5 → 9; B 1+2 = 3 draws a 10 → 3

function setup({ reduced = false } = {}) {
  const views: DealView[] = [];
  const hands: Array<{ i: number; at: number }> = [];
  const done = vi.fn();
  const slides = vi.fn();
  const turns = vi.fn();
  let now = 0;
  const motion = createDealMotion({
    timers,
    reduced,
    events: {
      onChange: (view) => views.push(view),
      onSlide: slides,
      onTurn: turns,
      onHand: (i) => hands.push({ i, at: now }),
      onDone: done
    }
  });
  const advance = (ms: number, step = 10) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      vi.advanceTimersByTime(step);
    }
  };
  return { motion, views, hands, done, slides, turns, advance, time: () => now };
}

describe("the baccarat deal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("turns P, B, P, B and draws a third card only by the rule", () => {
    const kinds = (h: BaccaratHand, i: number) =>
      stepsOf(h, i).map(({ act }) =>
        act.kind === "sweep" || act.kind === "mark" ? act.kind : `${act.kind} ${act.side}${act.k}`
      );
    expect(kinds(NATURAL, 0)).toEqual([
      "turn player0",
      "turn banker0",
      "turn player1",
      "turn banker1",
      "mark"
    ]);
    expect(kinds(BOTH_DRAW, 1)).toEqual([
      "sweep",
      "deal player0",
      "deal banker0",
      "deal player1",
      "deal banker1",
      "turn player0",
      "turn banker0",
      "turn player1",
      "turn banker1",
      "deal player2",
      "turn player2",
      "deal banker2",
      "turn banker2",
      "mark"
    ]);
    expect(stepsOf(BOTH_DRAW, 1)[0]?.wait).toBe(GAP);
    expect(stepsOf(BOTH_DRAW, 1)[1]?.wait).toBe(SWEEP);
    expect(stepsOf(BOTH_DRAW, 1)[2]?.wait).toBe(DEAL);
  });

  it("deals four blank cards face down that stay down until the number arrives", () => {
    const { motion, views, slides, advance } = setup();
    motion.wait();
    expect(slides).toHaveBeenCalledTimes(4);
    advance(10_000);
    const view = views.at(-1)!;
    expect(view.cards.player.map((c) => [c.rank, c.up])).toEqual([
      [null, false],
      [null, false]
    ]);
    expect(view.cards.banker).toHaveLength(2);
    expect(view.totals).toEqual({ player: null, banker: null });
    expect(motion.waiting).toBe(true);
  });

  it("turns the cards in deal order, counts each side up and says what the rule does", () => {
    const { motion, views, hands, done, advance } = setup();
    motion.wait();
    const keys = views.at(-1)!.cards.player.map((card) => card.key);
    motion.play([BOTH_DRAW]);
    // The same cards take their faces: nothing is dealt again.
    expect(views.at(-1)!.cards.player.map((card) => card.key)).toEqual(keys);
    expect(views.at(-1)!.cards.player.map((card) => card.rank)).toEqual([1, 1]);
    expect(views.at(-1)!.cards.player.every((card) => !card.up)).toBe(true);
    advance(PACE.first.lead);
    expect(views.at(-1)!.totals).toEqual({ player: 2, banker: null });
    advance(PACE.first.flip);
    expect(views.at(-1)!.totals).toEqual({ player: 2, banker: 1 });
    advance(PACE.first.flip * 2);
    expect(views.at(-1)!.totals).toEqual({ player: 4, banker: 3 });
    advance(PACE.first.pause);
    expect(views.at(-1)!.note).toEqual({ kind: "draws", side: "player" });
    expect(views.at(-1)!.cards.player[2]?.up).toBe(false);
    advance(PACE.first.third);
    expect(views.at(-1)!.totals.player).toBe(9);
    advance(PACE.first.pause + PACE.first.third);
    expect(views.at(-1)!.note).toEqual({ kind: "draws", side: "banker" });
    expect(views.at(-1)!.totals.banker).toBe(3);
    expect(hands).toHaveLength(0);
    advance(PACE.first.mark);
    expect(views.at(-1)!.winner).toBe("player");
    expect(hands).toEqual([{ i: 0, at: dealMs([BOTH_DRAW]) }]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("says a natural after the fourth card", () => {
    const { motion, views, advance } = setup();
    motion.wait();
    motion.play([NATURAL]);
    advance(PACE.first.lead + PACE.first.flip * 3);
    expect(views.at(-1)!.note).toEqual({ kind: "natural", player: 8, banker: 7 });
  });

  it("deals every one of 60 seeded multi-hand bets in order, each hand on time", () => {
    const random = seeded(11);
    for (let bet = 0; bet < 60; bet++) {
      const { motion, views, hands, done, advance } = setup();
      const count = 1 + Math.floor(random() * 5);
      const list = Array.from({ length: count }, () =>
        hand(Array.from({ length: 6 }, () => Math.floor(random() * 13)))
      );
      motion.wait();
      motion.play(list);
      advance(dealMs(list) + 50);
      expect(hands.map((h) => h.i)).toEqual(list.map((_, i) => i));
      expect(done).toHaveBeenCalledTimes(1);
      // Each hand's planned end, and never after the deadline.
      let end = 0;
      list.forEach((h, i) => {
        end += stepsOf(h, i).reduce((a, s) => a + s.wait, 0);
        expect(Math.abs(hands[i]!.at - end)).toBeLessThanOrEqual(10);
      });
      expect(hands.at(-1)!.at).toBeLessThan(deadlineMs(list));
      // The felt ends on the last hand, face up and marked, with its totals.
      const last = list.at(-1)!;
      const view = views.at(-1)!;
      expect(view.cards.player.map((c) => c.rank)).toEqual(last.playerRanks);
      expect(view.cards.banker.map((c) => c.rank)).toEqual(last.bankerRanks);
      expect(view.cards.player.every((c) => c.up && !c.gone)).toBe(true);
      expect(view.totals).toEqual({ player: last.playerTotal, banker: last.bankerTotal });
      expect(view.winner).toBe(last.outcome);
    }
  });

  it("keeps the deadline inside the room's fallback reveal for up to 25 hands", () => {
    // The longest hand: both sides draw.
    for (let n = 1; n <= 25; n++) {
      const list = Array.from({ length: n }, () => BOTH_DRAW);
      expect(deadlineMs(list)).toBeLessThan(5_500 + (n - 1) * 3_900);
    }
  });

  it("lays the rest out at the deadline when no timer gets to run, or when the tab is hidden", () => {
    const list = [BOTH_DRAW, NATURAL, BOTH_DRAW];
    {
      const { motion, views, hands, done } = setup();
      motion.wait();
      motion.play(list);
      // Steps are throttled away; only the deadline fires.
      vi.advanceTimersByTime(PACE.first.lead + 1);
      expect(hands).toHaveLength(0);
      motion.flush();
      expect(hands.map((h) => h.i)).toEqual([0, 1, 2]);
      expect(done).toHaveBeenCalledTimes(1);
      expect(views.at(-1)!.winner).toBe("player");
      expect(views.at(-1)!.cards.banker.map((c) => c.rank)).toEqual(BOTH_DRAW.bankerRanks);
    }
    {
      const { motion, hands, done } = setup();
      motion.play(list);
      vi.advanceTimersByTime(deadlineMs(list));
      expect(hands).toHaveLength(3);
      expect(done).toHaveBeenCalledTimes(1);
    }
  });

  it("shows the last hand at once under reduced motion, and lays out a past result", () => {
    const { motion, views, hands, done, slides } = setup({ reduced: true });
    motion.wait();
    expect(slides).not.toHaveBeenCalled();
    motion.play([NATURAL, BOTH_DRAW]);
    expect(hands.map((h) => h.i)).toEqual([0, 1]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(views.at(-1)!.cards.player.map((c) => c.rank)).toEqual(BOTH_DRAW.playerRanks);

    const past = setup();
    past.motion.place([BOTH_DRAW, NATURAL]);
    const view = past.views.at(-1)!;
    expect(view.winner).toBe("player");
    expect(view.totals).toEqual({ player: 8, banker: 7 });
    expect(past.hands).toHaveLength(0);
    past.motion.reset();
    expect(past.views.at(-1)!.cards.player).toHaveLength(0);
  });
});
