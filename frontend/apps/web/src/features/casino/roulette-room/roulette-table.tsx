"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { fractionDigits, splitAmount } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import { rouletteCoveredNumbers } from "../room/params";
import type { PlaceBetButtonPhase } from "../room/place-bet-phase";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { RouletteBoard, type BoardMarks } from "./roulette-board";
import { PocketBall, useRouletteCopy } from "./roulette-copy";
import { rouletteMultiplier, winningSpot } from "./roulette-model";
import { drawWheel, RouletteWheel } from "./roulette-wheel";
import { createWheelMotion, type WheelMotion } from "./wheel-motion";

type RouletteOutcome = Extract<CasinoOutcome, { kind: "roulette" }>;
type Landed = { value: number; won: boolean };

/** How long "No more bets" stays over the layout once a bet is placed. */
const CALL_MS = 1_500;
/** The last results the table shows, newest first: this visit only. */
const HISTORY = 12;
const NO_MARKS: BoardMarks = { dolly: null, hit: false, paid: null };

/**
 * The roulette table: the tilted wheel under the lamp, the bet's figures and the last results
 * beside it, the layout printed below. The ball follows the bet's chain state (wheel-motion.ts):
 * it circles the track until the random number arrives, then drops into that pocket. A net win is
 * paid on the felt; the slip beside it is the proof, and the table never holds it up.
 */
export function RouletteTable({
  spots,
  onSpotsChange,
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
  spots: readonly string[];
  onSpotsChange: (spots: string[]) => void;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: RouletteOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  /** The ball has started for the result; the receipt waits for it. */
  onRolling: () => void;
  /** Every round is in its pocket. */
  onLanded: () => void;
}) {
  const copy = useRouletteCopy();
  const { t } = copy;
  const tt = useTranslations("casino.table");
  const titleId = React.useId();
  const boardId = React.useId();
  const historyId = React.useId();
  const feltRef = React.useRef<HTMLElement>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const headRef = React.useRef<SVGGElement>(null);
  const ballRef = React.useRef<SVGGElement>(null);
  const paidRef = React.useRef<HTMLButtonElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<WheelMotion | null>(null);
  const playedRef = React.useRef<RouletteOutcome | null>(null);
  const spotsRef = React.useRef(spots);
  spotsRef.current = spots;
  const visibleRef = React.useRef(true);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  const [lit, setLit] = React.useState<number | null>(null);
  const [landed, setLanded] = React.useState<Landed[]>([]);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [done, setDone] = React.useState(false);
  const [marks, setMarks] = React.useState<BoardMarks>(NO_MARKS);
  const [paid, setPaid] = React.useState<{ key: string; win: Celebration } | null>(null);
  const [history, setHistory] = React.useState<Array<{ id: number; n: number }>>([]);
  const nextId = React.useRef(0);
  const record = React.useCallback((values: readonly number[]) => {
    setHistory((list) =>
      [...values.map((n) => ({ id: nextId.current++, n })).reverse(), ...list].slice(0, HISTORY)
    );
  }, []);
  const [call, setCall] = React.useState(false);

  const covered = React.useMemo(() => new Set(rouletteCoveredNumbers(spots)), [spots]);
  const k = covered.size;
  const tenths = Math.round((k * 1000) / 37);
  const pays =
    houseEdgeBps == null || k === 0 || k >= 37 ? null : rouletteMultiplier(k, houseEdgeBps);

  const render = React.useCallback(() => {
    const motion = motionRef.current;
    if (motion) drawWheel(headRef.current, ballRef.current, motion);
  }, []);

  // One frame loop: while the ball is in play, and while the idle wheel turns on screen.
  const loop = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) return;
      const speed = motion.tick(now);
      const playing = motion.mode === "spin" || motion.mode === "drop";
      soundEngine.current?.rolling(playing ? speed : 0);
      render();
      const inPlay = playing || motion.mode === "settle";
      if (inPlay || (motion.moving && visibleRef.current))
        frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [render, soundEngine]);

  // The latest callbacks, for the wheel's events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  // Puts the result on the table: the pocket lights, the big ball shows, the dolly goes down.
  const show = React.useCallback(
    (value: number, won: boolean) => {
      setLit(value);
      record([value]);
      setLanded((list) => [...list, { value, won }]);
      setMarks({ dolly: value, hit: won, paid: null });
    },
    [record]
  );

  // A net win is paid on the spot that covered the last winning number.
  const pay = React.useCallback((current: RouletteOutcome) => {
    const win = celebrate(current);
    if (!win) return;
    const value = [...current.rolls].reverse().find((roll) => roll.won)?.value;
    if (value == null) return;
    const key = winningSpot(spotsRef.current, value) ?? String(value);
    setPaid({ key, win });
    setMarks((m) => ({ ...m, paid: key }));
  }, []);

  React.useEffect(() => {
    const motion = createWheelMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onDeflect: () => soundEngine.current?.deflect(),
        onClack: () => soundEngine.current?.clack(),
        onPocket: () => soundEngine.current?.pocket(),
        onFret: (n) => soundEngine.current?.fret(n),
        onLand: (index, value) => {
          const current = playedRef.current;
          render();
          show(value, current?.rolls[index]?.won ?? false);
          if (current && index + 1 < current.rolls.length)
            setRound({ k: index + 2, n: current.rolls.length });
        },
        onDone: () => {
          const current = playedRef.current;
          soundEngine.current?.rolling(0);
          setRound(null);
          setDone(true);
          if (current) pay(current);
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    render();
    loop();
    const felt = feltRef.current;
    const observer =
      felt && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visibleRef.current = entry?.isIntersecting ?? true;
            if (visibleRef.current) loop();
          })
        : null;
    if (felt) observer?.observe(felt);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [loop, pay, render, show, soundEngine]);

  // Waiting for the random number: the ball circles the track. It stops for a refund, but keeps
  // circling when the number arrives, so it drops from the speed it has.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion || !waiting) {
      if (motion?.mode === "spin" && !hasOutcome) {
        motion.reset();
        soundEngine.current?.rolling(0);
      }
      return;
    }
    playedRef.current = null;
    setLit(null);
    setLanded([]);
    setRound(null);
    setDone(false);
    setMarks(NO_MARKS);
    setPaid(null);
    motion.wait();
    loop();
    // Bets are closed: the croupier's call, and on a phone the wheel and the layout come into view
    // above the docked slip.
    setCall(true);
    const timer = setTimeout(() => setCall(false), CALL_MS);
    const felt = feltRef.current;
    const board = boardRef.current;
    const slip = document.querySelector("[data-slip]");
    const bar =
      slip && getComputedStyle(slip).position === "fixed"
        ? slip.getBoundingClientRect().top
        : window.innerHeight;
    if (felt && board) {
      const top = felt.getBoundingClientRect().top;
      if (top < 0 || board.getBoundingClientRect().bottom > bar)
        felt.scrollIntoView?.({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
    return () => clearTimeout(timer);
  }, [hasOutcome, loop, soundEngine, waiting]);

  // The number is in: drop the ball into each round's pocket. A result shown before this table
  // mounted is placed.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
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
    const values = outcome.rolls.map((roll) => roll.value);
    setLanded([]);
    setPaid(null);
    setDone(false);
    if (revealing || motion.mode === "spin") {
      setLit(null);
      setRound(values.length > 1 ? { k: 1, n: values.length } : null);
      latest.current.onRolling();
      motion.play(values);
      loop();
    } else {
      const last = values.at(-1)!;
      motion.place(last);
      render();
      setLit(last);
      record(values);
      setLanded(outcome.rolls.map((roll) => ({ value: roll.value, won: roll.won })));
      setMarks({ dolly: last, hit: outcome.rolls.at(-1)!.won, paid: null });
      setDone(true);
      pay(outcome);
    }
    // `revealing` is read once per outcome.
  }, [loop, outcome, pay, record, render]);

  const toggle = (key: string) => {
    setPaid(null);
    setMarks(NO_MARKS);
    onSpotsChange(spots.includes(key) ? spots.filter((spot) => spot !== key) : [...spots, key]);
  };

  const status: React.ReactNode = waiting
    ? t("table.status.waiting")
    : round
      ? tt("round", { k: round.k, n: round.n })
      : done && landed.length > 0
        ? copy.rolledPrint(
            landed.map((roll) => roll.value),
            landed.filter((roll) => roll.won).length,
            "felt"
          )
        : locked
          ? ""
          : k >= 37
            ? t("table.status.all")
            : t("table.status.ready");
  const win = paid?.win;
  const net = win
    ? splitAmount(win.net, decimals, Math.max(2, fractionDigits(win.net, decimals)))
    : null;
  const figure =
    "font-print text-[32px] leading-none font-extrabold text-print @max-[460px]/felt:text-[22px]";
  const figLabel = "text-note leading-tight text-print-soft @max-[460px]/felt:text-[12px]";

  return (
    <section
      ref={feltRef}
      aria-labelledby={titleId}
      className="table-felt @container/felt relative isolate overflow-hidden px-8 pt-[18px] pb-4 max-[720px]:px-2 max-[720px]:pt-5"
    >
      <h2 id={titleId} className="sr-only">
        {t("table.title")}
      </h2>
      <div
        aria-hidden="true"
        className={`table-lamp pointer-events-none absolute inset-[-24%_8%_28%] -z-10 ${
          win
            ? win.big
              ? "motion-safe:animate-lamp-warm-big"
              : "motion-safe:animate-lamp-warm"
            : ""
        }`}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_224px] items-center gap-x-7 gap-y-5 @max-[620px]/felt:grid-cols-1 @max-[620px]/felt:justify-items-center @max-[460px]/felt:gap-2.5">
        <div className="table-wheel relative isolate aspect-[324/262] w-[min(100%,400px)] justify-self-center max-[720px]:w-[min(100%,330px)]">
          <RouletteWheel headRef={headRef} ballRef={ballRef} lit={lit} />
          <p
            aria-hidden="true"
            className={`absolute top-0 right-0 m-0 transition-[opacity,scale] duration-300 ease-[cubic-bezier(.2,.9,.3,1.3)] ${
              lit == null ? "scale-60 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            {lit == null ? null : (
              <PocketBall
                n={lit}
                size="lg"
                className="size-[68px] font-print text-[32px] @max-[460px]/felt:size-[52px] @max-[460px]/felt:text-[24px]"
              />
            )}
          </p>
        </div>

        <div className="grid min-w-0 content-center gap-3 @max-[620px]/felt:justify-items-center @max-[620px]/felt:text-center @max-[460px]/felt:w-full @max-[460px]/felt:grid-cols-[minmax(0,1fr)_auto] @max-[460px]/felt:items-center @max-[460px]/felt:gap-2 @max-[460px]/felt:text-left">
          <div className="grid grid-cols-[auto_auto] justify-start gap-x-[22px] gap-y-2.5 @max-[620px]/felt:flex @max-[620px]/felt:flex-wrap @max-[620px]/felt:justify-center @max-[620px]/felt:gap-x-6 @max-[620px]/felt:gap-y-2 @max-[620px]/felt:text-left @max-[460px]/felt:col-span-full @max-[460px]/felt:gap-x-[22px] @max-[460px]/felt:gap-y-1">
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.covered")}</span>
              <span className={figure}>{k}</span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.chance")}</span>
              <span className={figure}>
                {k === 0 ? (
                  "–"
                ) : (
                  <PrintedFigure
                    value={{
                      whole: String(Math.floor(tenths / 10)),
                      fraction: String(tenths % 10),
                      sign: ""
                    }}
                    suffix="%"
                  />
                )}
              </span>
            </p>
            <p className="grid gap-2 @max-[460px]/felt:gap-1">
              <span className={figLabel}>{t("table.pays")}</span>
              <span className={figure}>
                {pays ? <PrintedFigure value={pays} suffix="×" /> : "–"}
              </span>
            </p>
          </div>
          {net && win ? (
            <p
              aria-hidden="true"
              data-big={win.big || undefined}
              className={`table-pay-glow text-[36px] leading-none whitespace-nowrap text-print @max-[460px]/felt:col-span-full @max-[460px]/felt:justify-self-center @max-[460px]/felt:text-[26px] ${
                win.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p
            aria-hidden="true"
            className="min-h-[1.45em] text-note leading-normal text-print-soft @max-[460px]/felt:hidden"
          >
            {status}
          </p>
          <div className="grid gap-2 @max-[620px]/felt:justify-items-center @max-[460px]/felt:justify-items-start">
            <p
              id={historyId}
              className="text-note leading-tight text-print-soft @max-[460px]/felt:sr-only"
            >
              {t("table.history")}
            </p>
            <ol
              aria-labelledby={historyId}
              className="m-0 flex list-none flex-wrap gap-[5px] p-0 @max-[620px]/felt:justify-center @max-[460px]/felt:max-h-[26px] @max-[460px]/felt:justify-start @max-[460px]/felt:overflow-hidden"
            >
              {history.length === 0 ? (
                <li className="text-note text-print-faint">{t("table.noHistory")}</li>
              ) : (
                history.map(({ id, n }, index) => (
                  <li key={id} className="flex">
                    <PocketBall
                      n={n}
                      latest={index === 0}
                      words={copy.words(n)}
                      className="size-[26px] text-[12px]"
                    />
                  </li>
                ))
              )}
            </ol>
          </div>
          <div className="flex flex-wrap gap-2 @max-[620px]/felt:justify-center @max-[460px]/felt:flex-nowrap">
            <button
              type="button"
              disabled={locked || k === 0}
              onClick={() => {
                setPaid(null);
                setMarks(NO_MARKS);
                onSpotsChange([]);
              }}
              className="h-8 rounded-full border border-print-faint px-3.5 text-note text-print-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:opacity-40 @max-[460px]/felt:h-[30px] @max-[460px]/felt:px-2.5 @max-[460px]/felt:text-[12px]"
            >
              {t("table.clear")}
            </button>
            <SoundButton
              sound={sound}
              compact="@max-[460px]/felt:h-[30px] @max-[460px]/felt:px-2 @max-[460px]/felt:[&_[data-label]]:sr-only"
            />
          </div>
        </div>
      </div>

      <span id={boardId} className="sr-only">
        {t("table.board")}
      </span>
      <div ref={boardRef}>
        <RouletteBoard
          spots={spots}
          covered={covered}
          locked={locked}
          marks={marks}
          call={call}
          paidRef={paidRef}
          onToggle={toggle}
          titleId={boardId}
        />
      </div>
      <p className="mt-3 text-center text-note leading-snug text-print-soft max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <div className="contents [--chip-size:24px] @max-[460px]/felt:[--chip-size:18px]">
          <PaidChips
            key={`${paid.key}-${history.length}`}
            count={paid.win.chips}
            feltRef={feltRef}
            spotRef={paidRef}
            sound={soundEngine}
            from="end"
          />
        </div>
      ) : null}
    </section>
  );
}
