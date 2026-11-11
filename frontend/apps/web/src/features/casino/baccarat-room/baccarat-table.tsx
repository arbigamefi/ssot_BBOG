"use client";

import * as React from "react";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { BaccaratSide } from "../room/params";
import type { PlaceBetButtonPhase } from "../room/place-bet-button";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { useBaccaratCopy } from "./baccarat-copy";
import {
  HANDS,
  multiplierText,
  sideChance,
  sideMultiplier,
  SPOTS,
  suitOf,
  suitsOf,
  type BaccaratHand,
  type BaccaratOutcome,
  type HandSide,
  type Suit
} from "./baccarat-model";
import { createDealMotion, type DealMotion, type DealNote, type DealView } from "./deal-motion";
import { PlayingCard } from "./playing-card";

/** The bead road: six beads a column, the last twelve columns. */
const ROAD_ROWS = 6;
const ROAD_COLS = 12;

const EMPTY_VIEW: DealView = {
  cards: { player: [], banker: [] },
  totals: { player: null, banker: null },
  note: null,
  winner: null
};

/** The order of a hand's card spots on the felt: the third card lies outside the first two. */
const SLOT_ORDER: Record<HandSide, readonly number[]> = { player: [2, 0, 1], banker: [0, 1, 2] };

/**
 * The baccarat table, seen from above with the dealer's side at the top: the shoe at the top right,
 * the Player and Banker hands with their card spots printed on the felt, and the three spots for
 * your bet under them. The cards follow the bet's chain state (deal-motion.ts): four go out face
 * down when the bet is placed and stay down until the random number arrives; then they turn over in
 * dealing order, a third card is drawn when the rule says so, and the winning hand lights. A net
 * win is paid on the felt beside your chip; the slip beside it is the proof, and the table never
 * holds it up.
 */
export function BaccaratTable({
  side,
  onSideChange,
  houseEdgeBps,
  houseEdgeRate,
  locked,
  phase,
  outcome,
  revealing,
  decimals,
  symbol,
  onRolling,
  onLanded
}: {
  side: BaccaratSide;
  onSideChange: (side: BaccaratSide) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: BaccaratOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The cards have started turning for the result; the receipt waits for them. */
  onRolling: () => void;
  /** The last hand is marked. */
  onLanded: () => void;
}) {
  const copy = useBaccaratCopy();
  const { t } = copy;
  const titleId = React.useId();
  const betsId = React.useId();
  const roadId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const betsRef = React.useRef<HTMLDivElement>(null);
  const shoeRef = React.useRef<HTMLDivElement>(null);
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const motionRef = React.useRef<DealMotion | null>(null);
  const playedRef = React.useRef<BaccaratOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  const [view, setView] = React.useState<DealView>(EMPTY_VIEW);
  /** The hands of the bet on the felt, for their suits. */
  const [hands, setHands] = React.useState<readonly BaccaratHand[]>([]);
  /** How many of them are marked. */
  const [marked, setMarked] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [up, setUp] = React.useState<{ side: BaccaratSide; won: boolean } | null>(null);
  const [paid, setPaid] = React.useState<Celebration | null>(null);
  const [road, setRoad] = React.useState<Array<{ side: BaccaratSide; id: number }>>([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((sides: readonly BaccaratSide[]) => {
    setRoad((list) =>
      [...list, ...sides.map((s) => ({ side: s, id: nextId.current++ }))].slice(-ROAD_ROWS * 60)
    );
  }, []);

  // The latest callbacks, for the deal's events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  /** Clear the lit spot, the paid chips and the result; the cards stay until swept. */
  const clear = React.useCallback(() => {
    setUp(null);
    setPaid(null);
    setDone(false);
    setRunning(false);
    setMarked(0);
  }, []);

  // The hand's winner lights its spot; your chip turns red only when it won and the bet as a whole
  // won, and the chips are paid beside it.
  const settle = React.useCallback((current: BaccaratOutcome) => {
    const win = celebrate(current);
    const last = current.rolls.at(-1);
    if (last) setUp({ side: last.outcome, won: Boolean(win) && last.won });
    setPaid(win);
  }, []);

  React.useEffect(() => {
    const motion = createDealMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onChange: setView,
        onSlide: () => soundEngine.current?.slide(),
        onTurn: () => soundEngine.current?.snap(),
        onHand: (i) => {
          const hand = playedRef.current?.rolls[i];
          if (!hand) return;
          setMarked(i + 1);
          setUp({ side: hand.outcome, won: false });
          record([hand.outcome]);
        },
        onDone: () => {
          const current = playedRef.current;
          setRunning(false);
          setDone(true);
          if (current) settle(current);
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    // Out of sight, the rest of the deal is laid out at once.
    const hidden = () => {
      if (document.hidden) motion.flush();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      motion.dispose();
      motionRef.current = null;
    };
  }, [record, settle, soundEngine]);

  // Waiting for the random number: four blank cards go out face down. A refund sweeps them; when
  // the number arrives they take their faces and turn.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.waiting && !hasOutcome) motion.reset();
      return;
    }
    playedRef.current = null;
    clear();
    setHands([]);
    motion.wait();
    // On a phone the table goes to the top of the screen, so the hands and the spots sit above the
    // docked slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const bets = betsRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && bets) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || bets.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [clear, hasOutcome, waiting]);

  // The number is in: turn the cards and deal the hands. A result shown before this table mounted
  // is laid out on its last hand.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        clear();
        setHands([]);
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    clear();
    setHands(outcome.rolls);
    if (outcome.rolls.length === 0) return;
    if (outcome.side !== side) onSideChange(outcome.side);
    if (revealing || motion.waiting) {
      latest.current.onRolling();
      setRunning(true);
      motion.play(outcome.rolls);
    } else {
      motion.place(outcome.rolls);
      setMarked(outcome.rolls.length);
      record(outcome.rolls.map((hand) => hand.outcome));
      setDone(true);
      settle(outcome);
    }
    // `revealing` and the side are read once per outcome.
  }, [clear, outcome, record, settle]);

  // Changing the bet after a result clears the spots for the next bet; the cards stay as they lie.
  const choose = (next: BaccaratSide) => {
    if (next === side) return;
    if (done) clear();
    onSideChange(next);
  };

  const noteText = (note: DealNote) => {
    if (note.kind === "hand") return t("table.status.hand", { k: note.k, n: note.n });
    if (note.kind === "draws")
      return t("table.status.draws", { side: t(`table.hand.${note.side}`) });
    if (note.player >= 8 && note.banker >= 8)
      return t("table.status.naturals", { player: note.player, banker: note.banker });
    const natural: HandSide = note.player >= 8 ? "player" : "banker";
    return t("table.status.natural", {
      side: t(`table.hand.${natural}`),
      total: note[natural]
    });
  };
  const shown = marked > 0 ? hands[marked - 1] : undefined;
  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : done && outcome
      ? copy.cameText(outcome.rolls, outcome.side)
      : view.winner && shown
        ? copy.result(shown)
        : view.note
          ? noteText(view.note)
          : running
            ? hands.length > 1
              ? t("table.status.hand", { k: 1, n: hands.length })
              : t("table.status.turning")
            : locked
              ? ""
              : t("table.status.ready");

  // A card's suit, from the hand it was dealt for (its key is bet.hand.spot); a blank has none.
  const suitOfCard = (key: string, hand: HandSide, k: number): Suit => {
    const dealtFor = hands[Number(key.split(".")[1] ?? 0)];
    return dealtFor ? suitOf(suitsOf(dealtFor), hand, k) : 0;
  };

  const net = paid
    ? splitAmount(paid.net, decimals, Math.max(2, fractionDigits(paid.net, decimals)))
    : null;
  const multiples = Object.fromEntries(
    SPOTS.map((spot) => [spot, houseEdgeBps != null ? sideMultiplier(spot, houseEdgeBps) : null])
  ) as Record<BaccaratSide, ReturnType<typeof sideMultiplier> | null>;
  const chosenPays = multiples[side];
  const [chanceWhole, chanceTenth] = sideChance(side).split(".");
  const figure =
    "font-print text-[30px] leading-none font-extrabold text-print @max-[460px]/felt:text-[24px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";

  const start = Math.max(0, (Math.ceil(road.length / ROAD_ROWS) - ROAD_COLS) * ROAD_ROWS);
  const beads = road.slice(start);

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-[26px] pb-4 max-[720px]:px-3 max-[720px]:pt-[18px]"
    >
      <h2 id={titleId} className="sr-only">
        {t("table.title")}
      </h2>
      <div
        aria-hidden="true"
        className={`table-lamp pointer-events-none absolute inset-[-24%_8%_28%] -z-10 ${
          paid
            ? paid.big
              ? "motion-safe:animate-lamp-warm-big"
              : "motion-safe:animate-lamp-warm"
            : ""
        }`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap gap-x-7 gap-y-2 @max-[460px]/felt:gap-x-5 @max-[460px]/felt:gap-y-1">
          <p className="grid gap-2 @max-[460px]/felt:gap-1">
            <span className={figLabel}>{t("table.chance")}</span>
            <span className={figure}>
              <PrintedFigure
                value={{ whole: chanceWhole!, fraction: chanceTenth!, sign: "" }}
                suffix="%"
              />
            </span>
          </p>
          <p className="grid gap-2 @max-[460px]/felt:gap-1">
            <span className={figLabel}>{t("table.pays")}</span>
            <span className={figure}>
              {chosenPays ? <PrintedFigure value={chosenPays} suffix="×" /> : "–"}
            </span>
          </p>
        </div>
        <div ref={shoeRef} aria-hidden="true" className="table-shoe">
          <span />
        </div>
      </div>

      <div aria-hidden="true" className="table-hands" data-tie={view.winner === "tie" || undefined}>
        {HANDS.map((hand) => {
          const cards = view.cards[hand];
          const total = view.totals[hand];
          return (
            <div
              key={hand}
              className="table-hand"
              data-side={hand}
              data-win={view.winner === hand || undefined}
              data-lose={
                (view.winner != null && view.winner !== hand && view.winner !== "tie") || undefined
              }
            >
              <p data-c="head">
                <span data-c="name">{t(`table.hand.${hand}`)}</span>
                <span data-c="total" data-on={total != null || undefined}>
                  {total ?? "–"}
                </span>
              </p>
              <div data-c="cards">
                {SLOT_ORDER[hand].map((k) => {
                  const card = cards[k];
                  return (
                    <span key={k} data-c="slot" data-k={k} data-filled={card ? "" : undefined}>
                      {card ? (
                        <PlayingCard
                          key={card.key}
                          rank={card.rank}
                          suit={suitOfCard(card.key, hand, k)}
                          up={card.up}
                          gone={card.gone}
                          delay={card.delay}
                          shoe={shoeRef}
                        />
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={betsRef}
        role="group"
        aria-labelledby={betsId}
        className="mt-4 grid grid-cols-[1fr_0.82fr_1fr] gap-3 @max-[460px]/felt:mt-3 @max-[460px]/felt:gap-2"
      >
        <span id={betsId} className="sr-only">
          {t("table.bets")}
        </span>
        {SPOTS.map((spot) => {
          const chosen = spot === side;
          const isUp = up?.side === spot;
          const pays = multiples[spot];
          const m = pays ? multiplierText(pays) : "–";
          return (
            <button
              key={spot}
              type="button"
              className="table-bet"
              aria-pressed={chosen}
              aria-label={t("table.spotLabel", {
                side: copy.side(spot),
                m,
                chance: sideChance(spot)
              })}
              disabled={locked}
              data-up={isUp || undefined}
              data-won={(isUp && up?.won) || undefined}
              onClick={() => choose(spot)}
            >
              <span data-name>{copy.side(spot)}</span>
              <span data-sub>{t("table.spot", { m })}</span>
              <span data-chip aria-hidden="true">
                {chosen ? <span ref={paidRef} data-pay /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-5 gap-y-3 @max-[460px]/felt:mt-3 @max-[460px]/felt:grid-cols-1">
        <div className="grid min-w-0 gap-2 @max-[460px]/felt:hidden">
          {net && paid ? (
            <p
              aria-hidden="true"
              data-big={paid.big || undefined}
              className={`table-pay-glow text-[34px] leading-none whitespace-nowrap text-print @max-[620px]/felt:text-[28px] ${
                paid.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[1.45em] max-w-[24em] text-note leading-normal text-print-soft"
          >
            {status}
          </p>
        </div>
        <div className="flex items-end gap-3 @max-[460px]/felt:items-center @max-[460px]/felt:justify-between">
          <SoundButton
            sound={sound}
            compact="w-8 flex-none justify-center px-0! [&_[data-label]]:sr-only @max-[460px]/felt:size-[30px]"
          />
          <div>
            <p id={roadId} className="sr-only">
              {t("table.history")}
            </p>
            <ol aria-labelledby={roadId} className="table-road">
              {Array.from({ length: ROAD_ROWS * ROAD_COLS }, (_, k) => {
                const bead = beads[k];
                if (!bead) return <li key={`e${k}`} aria-hidden="true" data-side="none" />;
                return (
                  <li
                    key={bead.id}
                    data-side={bead.side}
                    data-new={start + k === road.length - 1 || undefined}
                  >
                    <span aria-hidden="true">{t(`table.bead.${bead.side}`)}</span>
                    <span className="sr-only">{copy.side(bead.side)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:mt-3 max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <PaidChips
          key={`${side}-${road.length}`}
          count={paid.chips}
          feltRef={feltRef}
          spotRef={paidRef}
          sound={soundEngine}
        />
      ) : null}
    </section>
  );
}
