"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import type { PlaceBetButtonPhase } from "../room/place-bet-phase";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { createBlowerMotion, type BlowerMotion } from "./blower-motion";
import { drawBlower, KenoBlower, markBall } from "./keno-blower";
import { KenoBoard } from "./keno-board";
import { useKenoCopy, type Draw } from "./keno-copy";
import { bestHits, hitMultiplier, kenoChance, paysMore } from "./keno-model";
import { KenoPaystrip } from "./keno-paystrip";

type KenoOutcome = Extract<CasinoOutcome, { kind: "keno" }>;
type Marks = { drawn: number[]; hits: number[]; now: { hits: number; win: boolean } | null };

/** The last results the table shows, newest first: this visit only. */
const HISTORY = 10;
const NO_MARKS: Marks = { drawn: [], hits: [], now: null };

const drawsOf = (outcome: KenoOutcome, bps: number): Draw[] =>
  outcome.draws.map((draw) => ({
    numbers: draw.numbers,
    hits: draw.hits,
    paid: paysMore(outcome.pickedNumbers.length, draw.hits, bps)
  }));

/**
 * The keno table: the blower set on the felt under the lamp, the figures, the board and the last
 * results beside it, and the pay strip printed under both. The balls follow the bet's chain state
 * (blower-motion.ts): they tumble until the random number arrives, then each round's five are drawn
 * into the rack and marked on the board as they land. A net win is paid on the felt; the slip
 * beside it is the proof, and the table never holds it up.
 */
export function KenoTable({
  picks,
  onPicksChange,
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
  picks: readonly number[];
  onPicksChange: (picks: number[]) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: KenoOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The draw has started for the result; the receipt waits for it. */
  onRolling: () => void;
  /** Every round is in the rack. */
  onLanded: () => void;
}) {
  const copy = useKenoCopy();
  const { t } = copy;
  const tt = useTranslations("casino.table");
  const titleId = React.useId();
  const historyId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const ballRefs = React.useRef<Array<SVGGElement | null>>([]);
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<BlowerMotion | null>(null);
  const playedRef = React.useRef<KenoOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;
  const bps = houseEdgeBps ?? 0;

  const [marks, setMarks] = React.useState<Marks>(NO_MARKS);
  const [landed, setLanded] = React.useState<Draw[]>([]);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [done, setDone] = React.useState(false);
  const [paid, setPaid] = React.useState<Celebration | null>(null);
  const [mixing, setMixing] = React.useState(false);
  const [hint, setHint] = React.useState("");
  const [history, setHistory] = React.useState<
    Array<{ hits: number; picked: number; paid: boolean; id: number }>
  >([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((draws: readonly Draw[], picked: number) => {
    setHistory((list) =>
      [
        ...draws
          .map((draw) => ({ hits: draw.hits, picked, paid: draw.paid, id: nextId.current++ }))
          .reverse(),
        ...list
      ].slice(0, HISTORY)
    );
  }, []);

  const render = React.useCallback(() => {
    const motion = motionRef.current;
    if (motion) drawBlower(ballRefs.current, motion);
  }, []);

  // One frame loop, while anything on the blower moves.
  const loop = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) return;
      motion.tick(now);
      render();
      if (motion.active) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [render]);

  // The latest callbacks and figures, for the blower's events.
  const latest = React.useRef({ onLanded, onRolling, bps });
  latest.current = { onLanded, onRolling, bps };

  /** Clear the board's and the balls' marks. */
  const unmark = React.useCallback(() => {
    for (let n = 1; n <= 15; n++) markBall(ballRefs.current, n, false);
    setMarks(NO_MARKS);
  }, []);

  // A net win is paid onto the best number of hits of the bet; its column lights.
  const pay = React.useCallback((current: KenoOutcome) => {
    const win = celebrate(current);
    if (!win) return;
    const picked = current.pickedNumbers.length;
    const best = bestHits(
      picked,
      current.draws.map((draw) => draw.hits)
    );
    setMarks((m) => ({ ...m, now: { hits: best, win: true } }));
    setPaid(win);
  }, []);

  React.useEffect(() => {
    const motion = createBlowerMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onRound: (index) => {
          const current = playedRef.current;
          unmark();
          if (current && current.draws.length > 1)
            setRound({ k: index + 1, n: current.draws.length });
        },
        onLand: (_, __, n) => {
          const current = playedRef.current;
          const hit = current?.pickedNumbers.includes(n) ?? false;
          markBall(ballRefs.current, n, hit);
          setMarks((m) => ({
            ...m,
            drawn: [...m.drawn, n],
            hits: hit ? [...m.hits, n] : m.hits
          }));
          soundEngine.current?.drop(hit);
        },
        onRoundDone: (index) => {
          const current = playedRef.current;
          if (!current) return;
          const draw = drawsOf(current, latest.current.bps)[index];
          if (!draw) return;
          setMarks((m) => ({ ...m, now: { hits: draw.hits, win: draw.paid } }));
          record([draw], current.pickedNumbers.length);
          setLanded((list) => [...list, draw]);
        },
        onDone: () => {
          const current = playedRef.current;
          soundEngine.current?.air(0);
          setMixing(false);
          setRound(null);
          setDone(true);
          if (current) pay(current);
          latest.current.onLanded();
        },
        onKnock: (strength) => soundEngine.current?.knock(strength)
      }
    });
    motionRef.current = motion;
    render();
    return () => {
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [pay, record, render, soundEngine, unmark]);

  // Waiting for the random number: the air is on. The balls settle again for a refund, but keep
  // tumbling when the number arrives, and the draw starts from there.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.mixing && !hasOutcome) {
        motion.reset();
        setMixing(false);
        soundEngine.current?.air(0);
        loop();
      }
      return;
    }
    playedRef.current = null;
    unmark();
    setLanded([]);
    setRound(null);
    setDone(false);
    setPaid(null);
    setHint("");
    motion.wait();
    setMixing(motion.mixing);
    soundEngine.current?.air(motion.mixing ? 1 : 0);
    loop();
    // On a phone the table goes to the top of the screen, so the blower, the board and the pay
    // strip sit above the docked slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const strip = stripRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && strip) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || strip.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [hasOutcome, loop, soundEngine, unmark, waiting]);

  // The number is in: draw each round's five. A result shown before this table mounted is placed.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        loop();
        unmark();
        setLanded([]);
        setRound(null);
        setDone(false);
        setPaid(null);
        setMixing(false);
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    const draws = drawsOf(outcome, latest.current.bps);
    setLanded([]);
    setPaid(null);
    setDone(false);
    if (draws.length === 0) return;
    if (revealing || motion.mixing) {
      latest.current.onRolling();
      if (draws.length > 1) setRound({ k: 1, n: draws.length });
      motion.play(outcome.draws.map((draw) => draw.numbers));
      setMixing(motion.mixing);
      loop();
    } else {
      const last = outcome.draws.at(-1)!;
      motion.place(last.numbers);
      render();
      const hits = last.numbers.filter((n) => outcome.pickedNumbers.includes(n));
      for (const n of last.numbers) markBall(ballRefs.current, n, hits.includes(n));
      record(draws, outcome.pickedNumbers.length);
      setLanded(draws);
      setMarks({
        drawn: [...last.numbers],
        hits,
        now: { hits: last.hits, win: draws.at(-1)!.paid }
      });
      setDone(true);
      pay(outcome);
      if (picks.length === 0) onPicksChange([...outcome.pickedNumbers]);
    }
    // `revealing` and the picks are read once per outcome.
  }, [loop, outcome, pay, record, render, unmark]);

  // Changing the picks after a result clears the table for the next bet.
  const changePicks = (next: number[]) => {
    setHint("");
    if (done || marks.drawn.length > 0) {
      unmark();
      setPaid(null);
      setDone(false);
      setLanded([]);
    }
    onPicksChange(next);
  };

  const picked = picks.length;
  const shownPicks = outcome?.pickedNumbers ?? picks;
  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : round
      ? tt("round", { k: round.k, n: round.n })
      : done && landed.length > 0
        ? copy.drewPrint(landed, shownPicks, "felt")
        : locked
          ? ""
          : picked === 0
            ? t("table.status.ready")
            : "";
  const net = paid
    ? splitAmount(paid.net, decimals, Math.max(2, fractionDigits(paid.net, decimals)))
    : null;
  const figure =
    "font-print text-[26px] leading-none font-extrabold text-print @max-[620px]/felt:text-[30px] @max-[460px]/felt:text-[22px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";
  const chance = picked > 0 && houseEdgeBps != null ? kenoChance(picked, houseEdgeBps) : null;
  const [chanceWhole, chanceTenth] = chance ? chance.split(".") : [];

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-7 pb-4 max-[720px]:px-3 max-[720px]:pt-[18px]"
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

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-x-6 gap-y-3.5 [grid-template-areas:'blower_top'_'blower_right'] @max-[620px]/felt:grid-cols-1 @max-[620px]/felt:[grid-template-areas:'top'_'blower'_'right'] @max-[460px]/felt:gap-2.5">
        <div className="grid min-w-0 content-start gap-1.5 [grid-area:top] @max-[620px]/felt:flex @max-[620px]/felt:flex-wrap @max-[620px]/felt:justify-between @max-[620px]/felt:gap-x-6 @max-[620px]/felt:gap-y-2">
          <div className="flex flex-nowrap gap-x-[18px] gap-y-2 @max-[460px]/felt:gap-x-5">
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.picked")}</span>
              <span className={figure}>
                <PrintedFigure value={{ whole: String(picked), fraction: "", sign: "" }} />
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.chance")}</span>
              <span className={figure}>
                {chance ? (
                  <PrintedFigure
                    value={{ whole: chanceWhole!, fraction: chanceTenth!, sign: "" }}
                    suffix="%"
                  />
                ) : (
                  "–"
                )}
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.top")}</span>
              <span className={figure}>
                {picked > 0 && houseEdgeBps != null ? (
                  <PrintedFigure value={hitMultiplier(picked, picked, houseEdgeBps)} suffix="×" />
                ) : (
                  "–"
                )}
              </span>
            </p>
          </div>
          <div className="grid min-w-0 justify-items-start gap-1.5 @max-[460px]/felt:hidden">
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
              className="min-h-[1.45em] max-w-[22em] text-note leading-normal text-print-soft"
            >
              {status}
            </p>
          </div>
        </div>

        <div className="relative self-center [grid-area:blower] @max-[620px]/felt:w-full @max-[620px]/felt:max-w-[420px] @max-[620px]/felt:justify-self-center @max-[460px]/felt:max-w-[284px]">
          <KenoBlower ballRefs={ballRefs} mixing={mixing} />
        </div>

        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 [grid-area:right] @max-[620px]/felt:w-full @max-[620px]/felt:max-w-[440px] @max-[620px]/felt:justify-self-center">
          <div className="col-span-full">
            <KenoBoard
              picks={picks}
              onPicksChange={changePicks}
              locked={locked}
              drawn={marks.drawn}
              hits={marks.hits}
              onFull={() => setHint(t("table.status.full"))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locked || picked === 0}
              onClick={() => changePicks([])}
              className="h-8 rounded-full border border-print-faint bg-transparent px-3 text-note text-print-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:cursor-default disabled:opacity-40 @max-[460px]/felt:h-[30px] @max-[460px]/felt:px-2.5 @max-[460px]/felt:text-[12px]"
            >
              {t("table.clear")}
            </button>
            <SoundButton
              sound={sound}
              compact="w-8 justify-center px-0! [&_[data-label]]:sr-only @max-[460px]/felt:size-[30px]"
            />
          </div>
          <div className="min-w-0">
            <p id={historyId} className="sr-only">
              {t("table.history")}
            </p>
            <ol
              aria-labelledby={historyId}
              className="m-0 flex max-h-[30px] list-none flex-nowrap gap-1.5 overflow-hidden p-0"
            >
              {history.length === 0 ? (
                <li className="text-note whitespace-nowrap text-print-soft">
                  {t("table.noHistory")}
                </li>
              ) : (
                history.map((item, index) => (
                  <li key={item.id} className="flex">
                    <span
                      data-paid={item.paid || undefined}
                      data-latest={index === 0 || undefined}
                      className="table-tile"
                    >
                      <span className="sr-only">
                        {t("table.tileLabel", { hits: item.hits, picked: item.picked })}
                      </span>
                      <span aria-hidden="true">
                        {t("table.tile", { hits: item.hits, picked: item.picked })}
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ol>
          </div>
          <p
            aria-live="polite"
            className="col-span-full min-h-[1.4em] text-note leading-snug text-print-soft empty:hidden"
          >
            {hint}
          </p>
        </div>
      </div>

      <div ref={stripRef}>
        <KenoPaystrip
          picked={outcome && done ? outcome.pickedNumbers.length : picked}
          houseEdgeBps={houseEdgeBps}
          now={marks.now}
          paidRef={paidRef}
        />
      </div>
      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <PaidChips
          key={`${marks.now?.hits}-${history.length}`}
          count={paid.chips}
          feltRef={feltRef}
          spotRef={paidRef}
          sound={soundEngine}
        />
      ) : null}
    </section>
  );
}
