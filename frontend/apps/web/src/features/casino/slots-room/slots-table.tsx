"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import type { PlaceBetButtonPhase } from "../room/place-bet-phase";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { createReelMotion, type ReelMotion } from "./reel-motion";
import { SlotTrio, useSlotsCopy, type Spin } from "./slots-copy";
import { drawReels, SlotsMachine } from "./slots-machine";
import {
  lineMultiplier,
  lineOf,
  slotsChance,
  slotsMultiple,
  winningReels,
  type SlotsLine
} from "./slots-model";
import { SlotsPaytable } from "./slots-paytable";

type SlotsOutcome = Extract<CasinoOutcome, { kind: "slots" }>;
type Marks = { lit: number[]; hit: SlotsLine | null };

/** The last results the table shows, newest first: this visit only. */
const HISTORY = 12;
const NO_MARKS: Marks = { lit: [], hit: null };

const marksFor = (symbols: readonly number[]): Marks => {
  const hit = lineOf(slotsMultiple(symbols));
  return { lit: hit ? winningReels(symbols) : [], hit };
};
const spinOf = (roll: SlotsOutcome["rolls"][number]): Spin => ({
  symbols: roll.symbols,
  paid: roll.won
});

/**
 * The slots table: the machine set into the felt under the lamp, the top prize, the win chance and
 * the last results beside it, the pay table printed below. The reels follow the bet's chain state
 * (reel-motion.ts): they spin until the random number arrives, then stop on its symbols, left to
 * right. A net win is paid on the felt; the slip beside it is the proof, and the table never holds
 * it up.
 */
export function SlotsTable({
  houseEdgeBps,
  houseEdgeRate,
  returnRate,
  locked,
  phase,
  outcome,
  revealing,
  decimals,
  symbol,
  onRolling,
  onLanded
}: {
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  /** What comes back on average, 98% at a 2% edge. */
  returnRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: SlotsOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The reels have started for the result; the receipt waits for them. */
  onRolling: () => void;
  /** Every round is on its symbols. */
  onLanded: () => void;
}) {
  const copy = useSlotsCopy();
  const { t } = copy;
  const tt = useTranslations("casino.table");
  const titleId = React.useId();
  const historyId = React.useId();
  const blurId = `reel-blur${React.useId().replace(/:/g, "")}`;
  const feltRef = React.useRef<HTMLElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const stripRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<ReelMotion | null>(null);
  const playedRef = React.useRef<SlotsOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  const [marks, setMarks] = React.useState<Marks>(NO_MARKS);
  const [landed, setLanded] = React.useState<Spin[]>([]);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [done, setDone] = React.useState(false);
  const [paid, setPaid] = React.useState<Celebration | null>(null);
  const [history, setHistory] = React.useState<Array<Spin & { id: number }>>([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((spins: readonly Spin[]) => {
    setHistory((list) =>
      [...spins.map((spin) => ({ ...spin, id: nextId.current++ })).reverse(), ...list].slice(
        0,
        HISTORY
      )
    );
  }, []);

  const render = React.useCallback(() => {
    const motion = motionRef.current;
    if (motion) drawReels(stripRefs.current, motion, blurId);
  }, [blurId]);

  // One frame loop, while a reel turns.
  const loop = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) return;
      const speed = motion.tick(now);
      soundEngine.current?.whirr(speed);
      render();
      if (motion.spinning) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [render, soundEngine]);

  // The latest callbacks, for the reels' events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  // A net win is paid on the best line of the bet: the reels and the line that made it light up.
  const pay = React.useCallback((current: SlotsOutcome) => {
    const win = celebrate(current);
    if (!win) return;
    const best = current.rolls.reduce<SlotsOutcome["rolls"][number] | null>(
      (top, roll) => (top && top.multiplier > roll.multiplier ? top : roll),
      null
    );
    if (best) setMarks(marksFor(best.symbols));
    setPaid(win);
  }, []);

  React.useEffect(() => {
    const motion = createReelMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onStop: (i) => soundEngine.current?.reelStop(i),
        onLand: (index, symbols) => {
          const current = playedRef.current;
          render();
          const spin = { symbols, paid: current?.rolls[index]?.won ?? false };
          setMarks(marksFor(symbols));
          record([spin]);
          setLanded((list) => [...list, spin]);
          if (current && index + 1 < current.rolls.length)
            setRound({ k: index + 2, n: current.rolls.length });
        },
        onDone: () => {
          const current = playedRef.current;
          soundEngine.current?.whirr(0);
          setRound(null);
          setDone(true);
          if (current) pay(current);
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    render();
    return () => {
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [pay, record, render, soundEngine]);

  // Waiting for the random number: the reels spin. They stop for a refund, but keep spinning when
  // the number arrives, so they stop from the speed they have.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.spinning && !hasOutcome) {
        motion.reset();
        render();
        soundEngine.current?.whirr(0);
      }
      return;
    }
    playedRef.current = null;
    setMarks(NO_MARKS);
    setLanded([]);
    setRound(null);
    setDone(false);
    setPaid(null);
    motion.wait();
    loop();
    // On a phone the machine goes to the top of the screen, so the reels and the pay table sit
    // above the docked slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const table = tableRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && table) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || table.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [hasOutcome, loop, render, soundEngine, waiting]);

  // The number is in: stop the reels on each round's symbols. A result shown before this table
  // mounted is placed.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        render();
        setLanded([]);
        setRound(null);
        setDone(false);
        setPaid(null);
        setMarks(NO_MARKS);
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    const spins = outcome.rolls.map((roll) => roll.symbols);
    setLanded([]);
    setPaid(null);
    setDone(false);
    if (spins.length === 0) return;
    if (revealing || motion.spinning) {
      setMarks(NO_MARKS);
      setRound(spins.length > 1 ? { k: 1, n: spins.length } : null);
      latest.current.onRolling();
      motion.play(spins);
      loop();
    } else {
      const last = outcome.rolls.at(-1)!;
      motion.place(last.symbols);
      render();
      record(outcome.rolls.map(spinOf));
      setLanded(outcome.rolls.map(spinOf));
      setMarks(marksFor(last.symbols));
      setDone(true);
      pay(outcome);
    }
    // `revealing` is read once per outcome.
  }, [loop, outcome, pay, record, render]);

  const lastSpin = landed.at(-1);
  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : round
      ? tt("round", { k: round.k, n: round.n })
      : done && lastSpin
        ? landed.length > 1
          ? t.rich("table.status.rounds", {
              spin: () => <SlotTrio symbols={lastSpin.symbols} paid={lastSpin.paid} size={20} />,
              paid: landed.filter((spin) => spin.paid).length,
              count: landed.length
            })
          : copy.rolledPrint(landed, "felt")
        : locked
          ? ""
          : t("table.status.ready");
  const net = paid
    ? splitAmount(paid.net, decimals, Math.max(2, fractionDigits(paid.net, decimals)))
    : null;
  const figure =
    "font-print text-[32px] leading-none font-extrabold text-print @max-[460px]/felt:text-[24px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";
  const chance = slotsChance();
  const [chanceWhole, chanceTenth] = chance.split(".");

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-[18px] pb-4 max-[720px]:px-3 max-[720px]:pt-[18px]"
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

      <div className="grid grid-cols-[minmax(0,1fr)_224px] items-center gap-x-7 gap-y-5 @max-[620px]/felt:grid-cols-1 @max-[620px]/felt:gap-y-3">
        <SlotsMachine stripRefs={stripRefs} lit={marks.lit} blurId={blurId} />

        <div className="grid min-w-0 content-center gap-3 @max-[620px]/felt:row-start-1 @max-[620px]/felt:grid-cols-[minmax(0,1fr)_auto] @max-[620px]/felt:items-center @max-[620px]/felt:gap-2">
          <div className="grid grid-cols-[auto_auto] justify-start gap-x-[22px] gap-y-2.5 @max-[620px]/felt:col-span-full @max-[620px]/felt:flex @max-[620px]/felt:flex-wrap @max-[620px]/felt:gap-x-[26px] @max-[620px]/felt:gap-y-1.5">
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.top")}</span>
              <span className={figure}>
                {houseEdgeBps == null ? (
                  "–"
                ) : (
                  <PrintedFigure value={lineMultiplier(64, houseEdgeBps)} suffix="×" />
                )}
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.chance")}</span>
              <span className={figure}>
                <PrintedFigure
                  value={{ whole: chanceWhole!, fraction: chanceTenth!, sign: "" }}
                  suffix="%"
                />
              </span>
            </p>
          </div>
          {net && paid ? (
            <p
              aria-hidden="true"
              data-big={paid.big || undefined}
              className={`table-pay-glow text-[34px] leading-none whitespace-nowrap text-print @max-[620px]/felt:col-span-full @max-[620px]/felt:text-[28px] ${
                paid.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[1.45em] text-note leading-normal text-print-soft @max-[620px]/felt:col-span-full @max-[460px]/felt:hidden"
          >
            {status}
          </p>
          <div className="grid gap-2 @max-[620px]/felt:grid-cols-[auto_minmax(0,1fr)] @max-[620px]/felt:items-center @max-[620px]/felt:gap-2.5 @max-[460px]/felt:grid-cols-1">
            <p
              id={historyId}
              className="text-note leading-tight text-print-soft @max-[460px]/felt:sr-only"
            >
              {t("table.history")}
            </p>
            <ol
              aria-labelledby={historyId}
              className="m-0 flex list-none flex-wrap gap-1.5 p-0 @max-[620px]/felt:max-h-[30px] @max-[620px]/felt:flex-nowrap @max-[620px]/felt:overflow-hidden"
            >
              {history.length === 0 ? (
                <li className="text-note text-print-faint">{t("table.noHistory")}</li>
              ) : (
                history.map((spin, index) => (
                  <li key={spin.id} className="flex">
                    <SlotTrio
                      symbols={spin.symbols}
                      paid={spin.paid}
                      latest={index === 0}
                      words={copy.words(spin.symbols)}
                    />
                  </li>
                ))
              )}
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <SoundButton
              sound={sound}
              compact="@max-[460px]/felt:h-[30px] @max-[460px]/felt:px-2 @max-[460px]/felt:[&_[data-label]]:sr-only"
            />
          </div>
        </div>
      </div>

      <div ref={tableRef}>
        <SlotsPaytable houseEdgeBps={houseEdgeBps} hit={marks.hit} paidRef={paidRef} />
      </div>
      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:mt-3 max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate, back: returnRate })}
      </p>
      {paid ? (
        <PaidChips
          key={`${marks.hit}-${history.length}`}
          count={paid.chips}
          feltRef={feltRef}
          spotRef={paidRef}
          sound={soundEngine}
          from="end"
        />
      ) : null}
    </section>
  );
}
