/**
 * The baccarat deal, with no DOM: the table draws what this reports.
 *
 * It follows the bet's chain state, never a script:
 * - placing the bet deals four cards face down out of the shoe, P, B, P, B. They are blank: what
 *   they are is only decided when the random number arrives, and they stay down until then;
 * - when the number arrives they turn over in dealing order, each side's total counting up as its
 *   cards turn; a third card comes out of the shoe only when the rule says so, and turns; then the
 *   winning hand and its spot light. For more hands the cards are swept and the next hand is dealt,
 *   faster from the second hand on;
 * - a deadline, or the tab going out of sight, lays the rest out at once: the receipt never waits
 *   for frames or timers;
 * - with reduced motion the last hand is shown at once, face up.
 */
import type { BaccaratSide } from "../room/params";
import { handTotal, naturalOf, ranksOf, type BaccaratHand, type HandSide } from "./baccarat-model";

/** Milliseconds between the steps of a hand: the first hand, then the later ones. */
export const PACE = {
  first: { lead: 250, flip: 560, pause: 520, third: 420, mark: 520 },
  next: { lead: 420, flip: 260, pause: 300, third: 300, mark: 300 }
} as const;
/** After a hand is marked, before its cards are swept; then the sweep, then each card dealt. */
export const GAP = 650;
export const SWEEP = 200;
export const DEAL = 90;
/** The four face-down cards of a bet come out of the shoe this far apart. */
export const DEAL_STAGGER = 170;
/** Slack for the deadline after the last planned step. */
const SLACK = 800;

type Pace = (typeof PACE)[keyof typeof PACE];

/** One card on the felt. `rank` is null while it is a blank back; `gone` while it is swept. */
export type CardView = {
  key: string;
  rank: number | null;
  up: boolean;
  /** Milliseconds after it is dealt before it leaves the shoe. */
  delay: number;
  gone: boolean;
};

/** What the status line says about the hand on the felt. */
export type DealNote =
  | { kind: "natural"; player: number; banker: number }
  | { kind: "draws"; side: HandSide }
  | { kind: "hand"; k: number; n: number };

export type DealView = {
  cards: Record<HandSide, CardView[]>;
  /** Each side's total over its face-up cards; null before any turns. */
  totals: Record<HandSide, number | null>;
  note: DealNote | null;
  /** The winner of the hand on the felt, once it is marked. */
  winner: BaccaratSide | null;
};

type Act =
  | { kind: "sweep" }
  | { kind: "deal"; side: HandSide; k: number }
  | { kind: "turn"; side: HandSide; k: number }
  | { kind: "mark" };
type Step = { wait: number; act: Act };

const ORDER: ReadonlyArray<[HandSide, number]> = [
  ["player", 0],
  ["banker", 0],
  ["player", 1],
  ["banker", 1]
];

/** A hand's steps, each with the wait before it. Hand 0 starts from its four cards already down. */
export function stepsOf(hand: BaccaratHand, i: number): Step[] {
  const pace: Pace = i === 0 ? PACE.first : PACE.next;
  const steps: Step[] = [];
  if (i > 0) {
    steps.push({ wait: GAP, act: { kind: "sweep" } });
    ORDER.forEach(([side, k], n) =>
      steps.push({ wait: n === 0 ? SWEEP : DEAL, act: { kind: "deal", side, k } })
    );
  }
  ORDER.forEach(([side, k], n) =>
    steps.push({ wait: n === 0 ? pace.lead : pace.flip, act: { kind: "turn", side, k } })
  );
  for (const side of ["player", "banker"] as const) {
    if (ranksOf(hand, side).length < 3) continue;
    steps.push({ wait: pace.pause, act: { kind: "deal", side, k: 2 } });
    steps.push({ wait: pace.third, act: { kind: "turn", side, k: 2 } });
  }
  steps.push({ wait: pace.mark, act: { kind: "mark" } });
  return steps;
}

/** How long a bet's hands take to deal out after the number arrives, with no deadline. */
export const dealMs = (hands: readonly BaccaratHand[]) =>
  hands.reduce((sum, hand, i) => sum + stepsOf(hand, i).reduce((a, s) => a + s.wait, 0), 0);

/** The latest the last hand is marked after the number arrives, frames, timers or not. */
export const deadlineMs = (hands: readonly BaccaratHand[]) => dealMs(hands) + SLACK;

const EMPTY: DealView = {
  cards: { player: [], banker: [] },
  totals: { player: null, banker: null },
  note: null,
  winner: null
};

const keyOf = (bet: number, i: number, side: HandSide, k: number) => `${bet}.${i}.${side}${k}`;

function totalsOf(cards: DealView["cards"]): DealView["totals"] {
  const total = (list: readonly CardView[]) => {
    const up = list.filter((card) => card.up && !card.gone && card.rank != null);
    return up.length ? handTotal(up.map((card) => card.rank!)) : null;
  };
  return { player: total(cards.player), banker: total(cards.banker) };
}

/** The four cards of hand 0 face down, blank or with the ranks the number chose. */
function dealtView(bet: number, hand: BaccaratHand | null): DealView {
  const cards: DealView["cards"] = { player: [], banker: [] };
  ORDER.forEach(([side, k], n) =>
    cards[side].push({
      key: keyOf(bet, 0, side, k),
      rank: hand ? ranksOf(hand, side)[k]! : null,
      up: false,
      delay: n * DEAL_STAGGER,
      gone: false
    })
  );
  return { ...EMPTY, cards };
}

function apply(
  view: DealView,
  act: Act,
  hand: BaccaratHand,
  i: number,
  count: number,
  bet: number
): DealView {
  const cards = { player: [...view.cards.player], banker: [...view.cards.banker] };
  switch (act.kind) {
    case "sweep":
      for (const side of ["player", "banker"] as const)
        cards[side] = cards[side].map((card) => ({ ...card, gone: true }));
      return {
        cards,
        totals: EMPTY.totals,
        note: { kind: "hand", k: i + 1, n: count },
        winner: null
      };
    case "deal": {
      if (act.k === 0 && act.side === "player") {
        cards.player = [];
        cards.banker = [];
      }
      cards[act.side].push({
        key: keyOf(bet, i, act.side, act.k),
        rank: ranksOf(hand, act.side)[act.k]!,
        up: false,
        delay: 0,
        gone: false
      });
      return {
        ...view,
        cards,
        note: act.k === 2 ? { kind: "draws", side: act.side } : view.note
      };
    }
    case "turn": {
      cards[act.side] = cards[act.side].map((card, k) =>
        k === act.k ? { ...card, up: true } : card
      );
      const natural = act.side === "banker" && act.k === 1 ? naturalOf(hand) : null;
      return {
        ...view,
        cards,
        totals: totalsOf(cards),
        note: natural ? { kind: "natural", ...natural } : view.note
      };
    }
    case "mark":
      return { ...view, winner: hand.outcome };
  }
}

/** A hand laid out face up and marked, as a hidden tab, a deadline or reduced motion shows it. */
export function laidOut(hand: BaccaratHand, i: number, bet: number): DealView {
  const cards: DealView["cards"] = { player: [], banker: [] };
  for (const side of ["player", "banker"] as const)
    cards[side] = ranksOf(hand, side).map((rank, k) => ({
      key: keyOf(bet, i, side, k),
      rank,
      up: true,
      delay: 0,
      gone: false
    }));
  return { cards, totals: totalsOf(cards), note: null, winner: hand.outcome };
}

type Timer = ReturnType<typeof setTimeout>;
export type Timers = {
  setTimeout: (run: () => void, ms: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

export type DealEvents = {
  /** The felt changed: draw it. */
  onChange: (view: DealView) => void;
  /** A card leaves the shoe. */
  onSlide?: () => void;
  /** A card turns over. */
  onTurn?: () => void;
  /** Hand `i` is marked: its winner is shown. */
  onHand: (i: number) => void;
  /** The last hand is marked. */
  onDone: () => void;
};

export type DealMotion = ReturnType<typeof createDealMotion>;

export function createDealMotion({
  timers,
  reduced,
  events
}: {
  timers: Timers;
  reduced: boolean;
  events: DealEvents;
}) {
  let view: DealView = EMPTY;
  let bet = 0;
  let dealt = false;
  let hands: BaccaratHand[] = [];
  let index = 0;
  let steps: Step[] = [];
  let step = 0;
  let marked = 0;
  let running = false;
  let next: Timer | null = null;
  let deadline: Timer | null = null;

  const show = (v: DealView) => {
    view = v;
    events.onChange(view);
  };

  const clear = () => {
    if (next) timers.clearTimeout(next);
    if (deadline) timers.clearTimeout(deadline);
    next = null;
    deadline = null;
  };

  const mark = (i: number) => {
    if (!running || i < marked) return;
    marked = i + 1;
    events.onHand(i);
  };

  const finish = () => {
    clear();
    running = false;
    events.onDone();
  };

  /** Every hand not yet marked is marked now, and the last one is laid out face up. */
  const flush = () => {
    if (!running) return;
    clear();
    for (let i = marked; i < hands.length; i++) mark(i);
    show(laidOut(hands.at(-1)!, hands.length - 1, bet));
    finish();
  };

  const schedule = () => {
    const current = steps[step];
    if (!current) {
      index += 1;
      if (index >= hands.length) {
        finish();
        return;
      }
      steps = stepsOf(hands[index]!, index);
      step = 0;
      schedule();
      return;
    }
    next = timers.setTimeout(() => {
      next = null;
      const { act } = current;
      show(apply(view, act, hands[index]!, index, hands.length, bet));
      if (act.kind === "deal") events.onSlide?.();
      if (act.kind === "turn") events.onTurn?.();
      if (act.kind === "mark") mark(index);
      step += 1;
      schedule();
    }, current.wait);
  };

  return {
    get view() {
      return view;
    },
    /** The four cards are down and the number is awaited. */
    get waiting() {
      return dealt && !running;
    },
    /** Hands are being dealt out and the receipt waits for them. */
    get running() {
      return running;
    },
    /** The bet is placed: deal four blank cards face down; they stay down until the number. */
    wait() {
      clear();
      running = false;
      bet += 1;
      dealt = true;
      show(dealtView(bet, null));
      if (!reduced) for (let n = 0; n < 4; n++) events.onSlide?.();
    },
    /** The number is in: turn the first hand's cards, draw by the rule, then deal the rest. */
    play(list: readonly BaccaratHand[]) {
      if (list.length === 0) return;
      clear();
      if (!dealt) bet += 1;
      dealt = false;
      hands = [...list];
      index = 0;
      marked = 0;
      running = true;
      if (reduced) {
        flush();
        return;
      }
      show(dealtView(bet, hands[0]!));
      deadline = timers.setTimeout(flush, deadlineMs(hands));
      steps = stepsOf(hands[0]!, 0);
      step = 0;
      schedule();
    },
    /** Lay out the last hand at once, for a result shown before the table mounted. */
    place(list: readonly BaccaratHand[]) {
      clear();
      running = false;
      dealt = false;
      if (list.length === 0) return;
      bet += 1;
      show(laidOut(list.at(-1)!, list.length - 1, bet));
    },
    /** Lay out whatever is left now: the tab went out of sight. */
    flush,
    /** Sweep the felt: a refund, or a new bet's form. */
    reset() {
      clear();
      running = false;
      dealt = false;
      show(EMPTY);
    },
    dispose() {
      clear();
      running = false;
    }
  };
}
