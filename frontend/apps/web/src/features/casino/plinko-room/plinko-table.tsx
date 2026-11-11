"use client";

import * as React from "react";
import type { PlinkoRisk } from "@ssot/ssot/encoding";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import type { PlaceBetButtonPhase } from "../room/place-bet-button";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { createDropMotion, CUPS, type DropMotion } from "./drop-motion";
import { drawBoard, flashPin, PlinkoBoard, type BoardRefs } from "./plinko-board";
import { usePlinkoCopy, type Drop } from "./plinko-copy";
import { PlinkoCups } from "./plinko-cups";
import { bestCup, cupMultiplier, pathBits, paysMore, plinkoChance, RISKS } from "./plinko-model";

type PlinkoOutcome = Extract<CasinoOutcome, { kind: "plinko" }>;
type Marks = { now: number[]; win: number[] };

/** The last results the table shows, newest first: this visit only. */
const HISTORY = 10;
const NO_MARKS: Marks = { now: [], win: [] };
const NO_COUNTS: readonly number[] = new Array(CUPS).fill(0);

const text = ({ whole, fraction }: { whole: string; fraction: string }) =>
  fraction ? `${whole}.${fraction}` : whole;

const dropsOf = (outcome: PlinkoOutcome, bps: number): Drop[] =>
  outcome.rolls.map((roll) => ({
    bits: pathBits(roll.path),
    cup: roll.bucket,
    multiple: text(cupMultiplier(outcome.risk, roll.bucket, bps)),
    paid: paysMore(outcome.risk, roll.bucket, bps)
  }));

/**
 * The plinko table: the pin board in a well on the felt under the lamp, with what each cup pays
 * printed under it, and the figures, the risk and the last results beside it. The ball follows
 * the bet's chain state (drop-motion.ts): it rocks in its cradle until the random number arrives,
 * then falls along the bounces the number chose, ball after ball. A net win is paid on the felt;
 * the slip beside it is the proof, and the table never holds it up.
 */
export function PlinkoTable({
  risk,
  onRiskChange,
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
  risk: PlinkoRisk;
  onRiskChange: (risk: PlinkoRisk) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: PlinkoOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The drop has started for the result; the receipt waits for it. */
  onRolling: () => void;
  /** Every ball is in its cup. */
  onLanded: () => void;
}) {
  const copy = usePlinkoCopy();
  const { t } = copy;
  const titleId = React.useId();
  const riskId = React.useId();
  const historyId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const cupsRef = React.useRef<HTMLDivElement>(null);
  const boardRefs = React.useRef<BoardRefs>({ svg: null, balls: [], traces: [] });
  const paidRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<DropMotion | null>(null);
  const playedRef = React.useRef<PlinkoOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;
  const bps = houseEdgeBps ?? 0;

  const [balls, setBalls] = React.useState(1);
  const [counts, setCounts] = React.useState<readonly number[]>(NO_COUNTS);
  const [marks, setMarks] = React.useState<Marks>(NO_MARKS);
  const [landed, setLanded] = React.useState<Drop[]>([]);
  const [falling, setFalling] = React.useState(false);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [done, setDone] = React.useState(false);
  const [paid, setPaid] = React.useState<{ win: Celebration; cup: number } | null>(null);
  const [history, setHistory] = React.useState<
    Array<{ multiple: string; paid: boolean; id: number }>
  >([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((drops: readonly Drop[]) => {
    setHistory((list) =>
      [
        ...drops
          .map((drop) => ({ multiple: drop.multiple, paid: drop.paid, id: nextId.current++ }))
          .reverse(),
        ...list
      ].slice(0, HISTORY)
    );
  }, []);

  const render = React.useCallback(() => {
    const motion = motionRef.current;
    if (motion) drawBoard(boardRefs.current, motion);
  }, []);

  // One frame loop, while anything on the board moves.
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

  // The latest callbacks and figures, for the drop's events.
  const latest = React.useRef({ onLanded, onRolling, bps });
  latest.current = { onLanded, onRolling, bps };

  /** Empty the cups' marks and the paid chips. */
  const clear = React.useCallback(() => {
    setCounts(NO_COUNTS);
    setMarks(NO_MARKS);
    setLanded([]);
    setRound(null);
    setFalling(false);
    setDone(false);
    setPaid(null);
  }, []);

  // Every cup a ball landed in stays lit; its winning cups glow only when the bet as a whole won,
  // and the chips go to the best of them.
  const settle = React.useCallback((current: PlinkoOutcome, drops: readonly Drop[]) => {
    const win = celebrate(current);
    const cups = [...new Set(drops.map((drop) => drop.cup))];
    const paying = [...new Set(drops.filter((drop) => drop.paid).map((drop) => drop.cup))];
    setMarks({ now: cups, win: win ? paying : [] });
    if (win) setPaid({ win, cup: bestCup(current.risk, cups) });
  }, []);

  React.useEffect(() => {
    const motion = createDropMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onPin: (_, r, j) => {
          flashPin(boardRefs.current.svg, r, j);
          soundEngine.current?.pin(r);
        },
        onLand: (i, cup) => {
          const current = playedRef.current;
          if (!current) return;
          const drop = dropsOf(current, latest.current.bps)[i];
          if (!drop) return;
          const motionNow = motionRef.current;
          setCounts(motionNow ? [...motionNow.counts] : NO_COUNTS);
          setMarks((m) => ({
            now: m.now.includes(cup) ? m.now : [...m.now, cup],
            win: drop.paid && !m.win.includes(cup) ? [...m.win, cup] : m.win
          }));
          setLanded((list) => [...list, drop]);
          record([drop]);
          soundEngine.current?.drop(drop.paid);
          const n = current.rolls.length;
          if (n > 1) setRound({ k: Math.min(i + 2, n), n });
        },
        onDone: () => {
          const current = playedRef.current;
          setRound(null);
          setFalling(false);
          setDone(true);
          if (current) settle(current, dropsOf(current, latest.current.bps));
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
  }, [record, render, settle, soundEngine]);

  // Waiting for the random number: the cups empty and the ball rocks in its cradle. It settles
  // again for a refund, and keeps rocking when the number arrives; the drop starts from there.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.rocking && !hasOutcome) {
        motion.reset();
        loop();
      }
      return;
    }
    playedRef.current = null;
    clear();
    setBalls(1);
    motion.wait();
    render();
    loop();
    // On a phone the table goes to the top of the screen, so the board and the cups sit above
    // the docked slip; elsewhere it comes into view.
    const felt = feltRef.current;
    const cups = cupsRef.current;
    const slip = document.querySelector("[data-slip]");
    const docked = slip ? getComputedStyle(slip).position === "fixed" : false;
    if (felt && cups) {
      const top = felt.getBoundingClientRect().top;
      const off = docked
        ? Math.abs(top) > 2
        : top < 0 || cups.getBoundingClientRect().bottom > window.innerHeight;
      if (off)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [clear, hasOutcome, loop, render, waiting]);

  // The number is in: drop each ball along its bounces. A result shown before this table mounted
  // is placed in its cups.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        setBalls(1);
        clear();
        render();
        loop();
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    const drops = dropsOf(outcome, latest.current.bps);
    clear();
    if (drops.length === 0) return;
    setBalls(drops.length);
    if (outcome.risk !== risk) onRiskChange(outcome.risk);
    const paths = drops.map((drop) => drop.bits);
    if (revealing || motion.rocking) {
      latest.current.onRolling();
      setFalling(true);
      if (drops.length > 1) setRound({ k: 1, n: drops.length });
      motion.play(paths);
      loop();
    } else {
      motion.place(paths);
      setCounts([...motion.counts]);
      setLanded(drops);
      record(drops);
      setDone(true);
      settle(outcome, drops);
      render();
    }
    // `revealing` and the risk are read once per outcome.
  }, [clear, loop, outcome, record, render, settle]);

  // Draw the balls again once React has made their groups.
  React.useLayoutEffect(render, [balls, render]);

  // Changing the risk after a result clears the table for the next bet.
  const chooseRisk = (next: PlinkoRisk) => {
    if (next === risk) return;
    if (done || landed.length > 0) {
      motionRef.current?.reset();
      setBalls(1);
      clear();
      loop();
    }
    onRiskChange(next);
  };

  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : round
      ? t("table.ball", { k: round.k, n: round.n })
      : falling
        ? t("table.status.falling")
        : done && landed.length > 0
          ? copy.fellPrint(landed)
          : locked
            ? ""
            : t("table.status.ready");
  const net = paid
    ? splitAmount(paid.win.net, decimals, Math.max(2, fractionDigits(paid.win.net, decimals)))
    : null;
  const figure =
    "font-print text-[24px] leading-none font-extrabold text-print @max-[620px]/felt:text-[26px] @max-[460px]/felt:text-[22px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";
  const chance = houseEdgeBps != null ? plinkoChance(risk, houseEdgeBps) : null;
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
            ? paid.win.big
              ? "motion-safe:animate-lamp-warm-big"
              : "motion-safe:animate-lamp-warm"
            : ""
        }`}
      />

      <div className="grid grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] items-start gap-x-[22px] gap-y-4 [grid-template-areas:'board_head'_'board_foot'] @max-[620px]/felt:grid-cols-1 @max-[620px]/felt:gap-3.5 @max-[620px]/felt:[grid-template-areas:'head'_'board'_'foot']">
        <div className="grid min-w-0 gap-4 [grid-area:head] @max-[460px]/felt:gap-2.5">
          <div className="grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-2.5 @max-[620px]/felt:flex @max-[620px]/felt:flex-wrap @max-[620px]/felt:gap-x-6 @max-[620px]/felt:gap-y-1.5 @max-[460px]/felt:flex-nowrap @max-[460px]/felt:gap-x-[18px]">
            <p className="col-span-full grid gap-2 @max-[460px]/felt:gap-1">
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
              <span className={figLabel}>{t("table.outer")}</span>
              <span className={figure}>
                {houseEdgeBps != null ? (
                  <PrintedFigure value={cupMultiplier(risk, 0, houseEdgeBps)} suffix="×" />
                ) : (
                  "–"
                )}
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.middle")}</span>
              <span className={figure}>
                {houseEdgeBps != null ? (
                  <PrintedFigure value={cupMultiplier(risk, CUPS >> 1, houseEdgeBps)} suffix="×" />
                ) : (
                  "–"
                )}
              </span>
            </p>
          </div>
          <div
            role="group"
            aria-labelledby={riskId}
            className="grid gap-2 @max-[460px]/felt:grid-cols-[auto_minmax(0,1fr)] @max-[460px]/felt:items-center @max-[460px]/felt:gap-2.5"
          >
            <p id={riskId} className={figLabel}>
              {t("table.risk")}
            </p>
            <div className="table-tabs">
              {RISKS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={level === risk}
                  aria-label={t("table.riskLabel", { name: t(`table.riskName.${level}`) })}
                  disabled={locked}
                  onClick={() => chooseRisk(level)}
                >
                  {t(`table.riskName.${level}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 [grid-area:board] @max-[620px]/felt:w-full @max-[620px]/felt:max-w-[440px] @max-[620px]/felt:justify-self-center">
          <div className="table-well">
            <PlinkoBoard
              refs={boardRefs}
              balls={balls}
              counts={counts}
              now={marks.now}
              win={marks.win}
            />
          </div>
          <div ref={cupsRef}>
            <PlinkoCups
              risk={risk}
              houseEdgeBps={houseEdgeBps}
              now={marks.now}
              win={marks.win}
              paidCup={paid?.cup ?? null}
              paidRef={paidRef}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-2.5 [grid-area:foot]">
          {net && paid ? (
            <p
              aria-hidden="true"
              data-big={paid.win.big || undefined}
              className={`table-pay-glow text-[34px] leading-none whitespace-nowrap text-print @max-[620px]/felt:text-[28px] @max-[460px]/felt:hidden ${
                paid.win.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[1.45em] max-w-[22em] text-note leading-normal text-print-soft @max-[460px]/felt:hidden"
          >
            {status}
          </p>
          <div className="flex min-w-0 items-center gap-2.5">
            <SoundButton
              sound={sound}
              compact="w-8 flex-none justify-center px-0! [&_[data-label]]:sr-only @max-[460px]/felt:size-[30px]"
            />
            <div className="min-w-0">
              <p id={historyId} className="sr-only">
                {t("table.history")}
              </p>
              <ol
                aria-labelledby={historyId}
                className="m-0 flex max-h-[30px] list-none flex-wrap gap-x-1.5 gap-y-2 overflow-hidden p-0"
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
                        className="table-tile min-w-11 px-[7px]"
                      >
                        <span className="sr-only">
                          {t("table.tileLabel", { m: item.multiple })}
                        </span>
                        <span aria-hidden="true">{t("table.tile", { m: item.multiple })}</span>
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <PaidChips
          key={`${paid.cup}-${history.length}`}
          count={paid.win.chips}
          feltRef={feltRef}
          spotRef={paidRef}
          sound={soundEngine}
        />
      ) : null}
    </section>
  );
}
