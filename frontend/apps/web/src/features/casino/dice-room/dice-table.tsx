"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { splitAmount, fractionDigits } from "../../home/receipts";
import { PrintedFigure } from "../../home/printed-figure";
import type { CasinoOutcome } from "../room/outcome";
import { diceTargetBounds, type DiceDirection } from "../room/payouts";
import type { PlaceBetButtonPhase } from "../room/place-bet-phase";
import { at, createBallMotion, numberAt, type BallMotion } from "./ball-motion";
import { formatRolls } from "../table-room/room-receipt";
import { PaidChips, reducedMotion, SoundButton, useTableSound } from "../table-room/table-controls";
import { awaitsNumber, celebrate, type Celebration } from "../table-room/table-model";
import { diceMultiplier, diceWinRange, diceWins } from "./dice-model";

type DiceOutcome = Extract<CasinoOutcome, { kind: "dice" }>;
type Pin = { value: number; won: boolean };

/** The lane's padding: the scale runs from 6px in from each end. */
const INSET = 6;
const TICKS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
/** Where a number or the line sits along the lane, as CSS. */
const along = (fraction: number) => `calc(${INSET}px + ${fraction} * (100% - ${2 * INSET}px))`;

/**
 * The dice table: indigo felt in a padded rail under one lamp, the layout printed on it, an ivory
 * ball in a carved lane. The ball follows the bet's chain state (ball-motion.ts); a net win is
 * paid on the felt. The slip beside it is the proof; the table never waits for it.
 */
export function DiceTable({
  direction,
  line,
  houseEdgeBps,
  houseEdgeRate,
  locked,
  phase,
  outcome,
  revealing,
  decimals,
  symbol,
  onDirectionChange,
  onLineChange,
  onRolling,
  onLanded
}: {
  direction: DiceDirection;
  line: number;
  houseEdgeBps: number | undefined;
  houseEdgeRate: string;
  locked: boolean;
  phase: PlaceBetButtonPhase;
  /** The bet's outcome, once the random number has been read. */
  outcome: DiceOutcome | null;
  /** The room waits for the table to show `outcome` before it prints the receipt. */
  revealing: boolean;
  decimals: number;
  symbol: string;
  onDirectionChange: (direction: DiceDirection) => void;
  onLineChange: (line: number) => void;
  /** The ball has started rolling to the result; the receipt waits for it. */
  onRolling: () => void;
  /** Every round has landed. */
  onLanded: () => void;
}) {
  const t = useTranslations("casino.dice");
  const tt = useTranslations("casino.table");
  const locale = useLocale();
  const feltRef = React.useRef<HTMLElement>(null);
  const grooveRef = React.useRef<HTMLDivElement>(null);
  const ballRef = React.useRef<HTMLDivElement>(null);
  const markRef = React.useRef<HTMLElement>(null);
  const readoutRef = React.useRef<HTMLDivElement>(null);
  const numberRef = React.useRef<HTMLSpanElement>(null);
  const spotRef = React.useRef<HTMLSpanElement>(null);
  const frameRef = React.useRef(0);
  const motionRef = React.useRef<BallMotion | null>(null);
  const playedRef = React.useRef<DiceOutcome | null>(null);
  const sound = useTableSound();
  const soundEngine = sound.engine;

  const [pins, setPins] = React.useState<Pin[]>([]);
  const [landed, setLanded] = React.useState<number | null>(null);
  const [round, setRound] = React.useState<{ k: number; n: number } | null>(null);
  const [paid, setPaid] = React.useState<{ outcome: DiceOutcome; win: Celebration } | null>(null);
  const [shown, setShown] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const wins = diceWins(direction, line);
  const [from, to] = diceWinRange(direction, line);
  const [lo, hi] = diceTargetBounds(direction);
  const pays = houseEdgeBps == null ? null : diceMultiplier(wins, houseEdgeBps);

  // Draw the ball and the number under it. Called every frame while the ball moves.
  const render = React.useCallback(() => {
    const motion = motionRef.current;
    const groove = grooveRef.current;
    const ball = ballRef.current;
    const readout = readoutRef.current;
    if (!motion || !groove || !ball || !readout) return;
    const width = groove.clientWidth;
    const size = ball.offsetWidth;
    const centre = INSET + motion.x * (width - 2 * INSET);
    ball.style.transform = `translateX(${centre - size / 2}px)`;
    if (markRef.current && size)
      markRef.current.style.transform = `rotate(${centre / (size / 2)}rad)`;
    if (numberRef.current && !readout.hasAttribute("data-landed")) {
      numberRef.current.textContent = String(numberAt(motion.x));
    }
    const rw = readout.offsetWidth;
    readout.style.transform = `translateX(${Math.max(0, Math.min(width - rw, centre - rw / 2))}px)`;
  }, []);

  const loop = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) return;
      const speed = motion.tick(now);
      soundEngine.current?.rolling(motion.mode === "rest" ? 0 : speed);
      render();
      if (motion.mode !== "rest") frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [render, soundEngine]);

  // The latest callbacks, for the ball's events.
  const latest = React.useRef({ onLanded, onRolling });
  latest.current = { onLanded, onRolling };

  React.useEffect(() => {
    const motion = createBallMotion({
      // Wrapped: a browser's timer functions throw when called as another object's method.
      timers: {
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (timer) => clearTimeout(timer)
      },
      reduced: reducedMotion(),
      events: {
        onBounce: () => soundEngine.current?.bounce(),
        onLand: (k, value) => {
          const current = playedRef.current;
          render();
          soundEngine.current?.land();
          setLanded(value);
          setPins((list) => [...list, { value, won: current?.rolls[k]?.won ?? false }]);
          if (current && k + 1 < current.rolls.length)
            setRound({ k: k + 2, n: current.rolls.length });
        },
        onDone: () => {
          const current = playedRef.current;
          soundEngine.current?.rolling(0);
          setRound(null);
          setDone(true);
          const win = current ? celebrate(current) : null;
          if (current && win) setPaid({ outcome: current, win });
          latest.current.onLanded();
        }
      }
    });
    motionRef.current = motion;
    render();
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      motion.dispose();
      motionRef.current = null;
    };
  }, [render, soundEngine]);

  // Waiting for the random number: the ball rolls back and forth. It stops for a refund, but
  // rolls on when the number arrives, so it keeps its speed and heading.
  const waiting = awaitsNumber(phase) && !outcome;
  const hasOutcome = Boolean(outcome);
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (waiting) {
      playedRef.current = null;
      setPins([]);
      setPaid(null);
      setLanded(null);
      setRound(null);
      setDone(false);
      setShown(!reducedMotion());
      motion.wait();
      loop();
    } else if (motion.mode === "wait" && !hasOutcome) {
      motion.reset();
      soundEngine.current?.rolling(0);
    }
  }, [hasOutcome, loop, soundEngine, waiting]);

  // The number is in: roll to each round's roll. A result shown before this table mounted is placed.
  React.useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    if (!outcome) {
      if (playedRef.current) {
        playedRef.current = null;
        motion.reset();
        setPins([]);
        setPaid(null);
        setRound(null);
        setDone(false);
      }
      return;
    }
    if (playedRef.current === outcome) return;
    playedRef.current = outcome;
    const values = outcome.rolls.map((roll) => roll.value);
    setShown(true);
    setPins([]);
    setPaid(null);
    setLanded(null);
    setDone(false);
    // The room waits for this result, or the ball was rolling for it: roll there.
    if (revealing || motion.mode === "wait") {
      setRound(values.length > 1 ? { k: 1, n: values.length } : null);
      latest.current.onRolling();
      motion.play(values);
      loop();
    } else {
      motion.place(values.at(-1)!);
      render();
      setLanded(values.at(-1)!);
      setPins(outcome.rolls.map((roll) => ({ value: roll.value, won: roll.won })));
      setDone(true);
      const win = celebrate(outcome);
      if (win) setPaid({ outcome, win });
    }
    // `revealing` is read once per outcome.
  }, [loop, outcome, render]);

  // Dragging the line along the lane.
  const dragging = React.useRef(false);
  const lineAt = (clientX: number) => {
    const box = grooveRef.current?.getBoundingClientRect();
    if (!box) return line;
    return ((clientX - box.left - INSET) / (box.width - 2 * INSET)) * 100;
  };
  const setLine = (value: number) => {
    const next = Math.max(lo, Math.min(hi, Math.round(value)));
    if (next !== line) onLineChange(next);
  };
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const drag = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (locked) return;
      dragging.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setLine(lineAt(event.clientX));
      rangeRef.current?.focus({ preventScroll: true });
      event.preventDefault();
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (dragging.current) setLine(lineAt(event.clientX));
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onPointerCancel: () => {
      dragging.current = false;
    }
  };

  const status = waiting
    ? t("table.status.waiting")
    : round
      ? tt("round", { k: round.k, n: round.n })
      : done && pins.length > 0
        ? pins.length > 1
          ? t("receipt.rolledRounds", {
              rolls: formatRolls(
                locale,
                pins.map((pin) => pin.value)
              ),
              won: pins.filter((pin) => pin.won).length,
              count: pins.length
            })
          : t("receipt.rolled", { rolls: String(pins[0]!.value) })
        : locked
          ? ""
          : t("table.status.ready");
  const win = paid?.win;
  const net = win
    ? splitAmount(win.net, decimals, Math.max(2, fractionDigits(win.net, decimals)))
    : null;

  return (
    <section
      ref={feltRef}
      aria-labelledby="dice-table-title"
      className="table-felt @container/felt relative isolate overflow-hidden px-11 pt-9 pb-7 max-[720px]:px-[18px] max-[720px]:pt-[22px] max-[720px]:pb-[18px]"
    >
      <h2 id="dice-table-title" className="sr-only">
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

      <div className="flex items-start gap-x-14 gap-y-3 @max-[640px]/felt:flex-wrap @max-[640px]/felt:gap-x-8 @max-[640px]/felt:gap-y-2">
        <p className="grid gap-2">
          <span className="text-note leading-tight text-print-soft">{t("table.chance")}</span>
          <span className="font-print text-[clamp(40px,9cqi,64px)] leading-none font-extrabold text-print">
            {wins}%
          </span>
        </p>
        <p className="grid gap-2">
          <span className="text-note leading-tight text-print-soft">{t("table.pays")}</span>
          <span className="text-[clamp(40px,9cqi,64px)] leading-none text-print">
            {pays ? <PrintedFigure value={pays} suffix="×" /> : "—"}
          </span>
        </p>
        <div className="ml-auto grid justify-items-end gap-2.5 text-right @max-[640px]/felt:ml-0 @max-[640px]/felt:basis-full @max-[640px]/felt:justify-items-start @max-[640px]/felt:gap-1.5 @max-[640px]/felt:text-left">
          <SoundButton
            sound={sound}
            compact="@max-[640px]/felt:absolute @max-[640px]/felt:top-3.5 @max-[640px]/felt:right-3.5 @max-[640px]/felt:pr-2.5 @max-[640px]/felt:[&_[data-label]]:sr-only"
          />
          {net && win ? (
            <p
              aria-hidden="true"
              data-big={win.big || undefined}
              className={`table-pay-glow text-[44px] leading-none whitespace-nowrap text-print @max-[640px]/felt:text-[32px] ${
                win.big ? "motion-safe:animate-pay-pulse" : "motion-safe:animate-pay-in"
              }`}
            >
              <PrintedFigure value={{ ...net, sign: "+" }} />
              <small className="ml-1.5 font-text text-note font-semibold">{symbol}</small>
            </p>
          ) : null}
          <p aria-hidden="true" className="min-h-[1.45em] text-note text-print-soft">
            {status}
          </p>
        </div>
      </div>

      <div className="group/lane relative mt-9 touch-pan-y pt-(--lane-top) select-none max-[720px]:mt-[18px]">
        <div
          ref={readoutRef}
          aria-hidden="true"
          data-landed={landed != null || undefined}
          className={`table-readout absolute top-0 left-0 z-4 grid h-[54px] min-w-[72px] place-items-center px-3 font-print text-[42px] leading-none font-extrabold text-print tabular-nums max-[720px]:h-11 max-[720px]:min-w-14 max-[720px]:text-[32px] ${
            shown ? "" : "opacity-0"
          }`}
        >
          <span
            key={landed ?? "rolling"}
            ref={numberRef}
            className={landed != null ? "motion-safe:animate-settle" : undefined}
          >
            {landed ?? numberAt(motionRef.current?.x ?? at(1))}
          </span>
        </div>
        <div
          ref={grooveRef}
          {...drag}
          className={`table-groove relative ${locked ? "cursor-default" : "cursor-ew-resize"}`}
        >
          <div
            aria-hidden="true"
            className={`table-zone absolute inset-y-1.5 ${win ? "brightness-130 motion-safe:animate-print-glow" : ""}`}
            style={
              direction === "under"
                ? { left: INSET, width: `calc(${line / 100} * (100% - ${2 * INSET}px))` }
                : { left: along(line / 100), right: INSET }
            }
          />
          <div aria-hidden="true">
            {pins.map((pin, k) => (
              <i
                key={k}
                className={`absolute -bottom-[13px] z-2 -ml-[4.5px] size-[9px] rounded-full border-[1.5px] border-print ${
                  pin.won ? "bg-print" : ""
                }`}
                style={{ left: along(at(pin.value)) }}
              />
            ))}
          </div>
          <div
            ref={ballRef}
            aria-hidden="true"
            className="table-ball absolute top-[calc((var(--groove-size)-var(--ball-size))/2)] left-0 z-3 will-change-transform"
          >
            <i ref={markRef} className="table-ball-mark absolute inset-0" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[calc(var(--lane-top)-10px)] z-2 h-[calc(var(--groove-size)+34px)] -translate-x-px border-l-2 border-dashed border-print"
          style={{ left: along(line / 100) }}
        >
          <span
            {...drag}
            className={`table-puck pointer-events-auto absolute -bottom-6 left-0 grid size-12 -translate-x-1/2 touch-none place-items-center text-body font-extrabold tabular-nums max-[720px]:-bottom-[22px] max-[720px]:size-11 max-[720px]:text-note ${
              locked ? "cursor-default" : "cursor-ew-resize"
            } outline-offset-3 outline-paper group-has-[input:focus-visible]/lane:outline-2`}
          >
            {line}
          </span>
        </div>
        <div aria-hidden="true" className="relative mx-1.5 h-[60px]">
          <div className="table-ticks absolute inset-x-0 top-2 h-2.5" />
          {TICKS.map((tick, k) => (
            <span
              key={tick}
              className={`absolute top-[26px] text-note leading-none text-print-soft tabular-nums ${
                k === 0 ? "" : k === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              } ${tick === 1 || tick === 50 || tick === 100 ? "" : "max-[720px]:hidden"}`}
              style={{ left: k === 0 ? 0 : `${tick}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <input
          ref={rangeRef}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={line}
          disabled={locked}
          aria-label={t("table.line")}
          aria-valuetext={t("table.valueText", {
            from,
            to,
            chance: wins,
            pays: pays ? `${pays.whole}.${pays.fraction}` : "—"
          })}
          onChange={(event) => setLine(Number(event.target.value))}
          className="sr-only"
        />
      </div>

      <fieldset className="mt-2 grid grid-cols-2 gap-5 max-[720px]:gap-3" disabled={locked}>
        <legend className="sr-only">{t("table.side")}</legend>
        {(["under", "over"] as const).map((side) => {
          const chosen = direction === side;
          const [a, b] = side === "under" ? [1, line] : [line + 1, 100];
          return (
            <label key={side} className="relative">
              <input
                type="radio"
                name="dice-side"
                value={side}
                checked={chosen}
                onChange={() => onDirectionChange(side)}
                className="peer absolute inset-0 z-2 m-0 cursor-pointer opacity-0 disabled:cursor-default"
              />
              <span
                className={`relative grid min-h-[92px] content-center gap-1 rounded-spot border-2 py-4 pr-5 pl-[76px] text-print peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-paper max-[720px]:min-h-[68px] max-[720px]:py-3 max-[720px]:pr-2.5 max-[720px]:pl-[52px] ${
                  chosen ? "border-print bg-paper/6" : "border-print-soft"
                }`}
              >
                <span
                  ref={chosen ? spotRef : undefined}
                  aria-hidden="true"
                  className={`absolute top-1/2 left-5 -translate-y-1/2 max-[720px]:left-3 ${
                    chosen
                      ? "table-chip"
                      : "size-(--chip-size) rounded-full border-2 border-dashed border-print-faint"
                  }`}
                />
                <b className="text-[24px] leading-tight font-extrabold max-[720px]:text-body">
                  {side === "under" ? t("table.under") : t("table.over")}
                </b>
                <small className="text-body text-print-soft tabular-nums max-[720px]:text-note">
                  {t("table.range", { from: a, to: b })}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-[22px] text-center text-note leading-snug text-print-soft max-[720px]:mt-4 max-[720px]:text-[12px]">
        {t("table.rule", { rate: houseEdgeRate })}
      </p>
      {paid ? (
        <PaidChips
          key={paid.outcome.rolls.map((roll) => roll.value).join(",")}
          count={paid.win.chips}
          feltRef={feltRef}
          spotRef={spotRef}
          sound={soundEngine}
        />
      ) : null}
    </section>
  );
}
