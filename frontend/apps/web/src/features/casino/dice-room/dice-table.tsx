"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { PrintedFigure } from "../../home/printed-figure";
import { diceTargetBounds, type DiceDirection } from "../room/payouts";
import { diceLoseRange, diceMultiplier, diceWinRange, diceWins } from "./slip-model";
import { LINE_BUTTON } from "./styles";

export type DiceRoll = { value: number; won: boolean };

const SCALE = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100] as const;

/**
 * The table is a strip of paper with a printed scale. The winning side is printed in ink dots, the
 * losing side stays blank, and the line is a dashed cut with an ink tab to drag. Rolls are punched
 * into the strip: one big hole with the number, or a small hole per round along the lower edge.
 */
export function DiceTable({
  direction,
  line,
  houseEdgeBps,
  locked,
  rolls,
  onDirectionChange,
  onLineChange,
  onPunched
}: {
  direction: DiceDirection;
  line: number;
  houseEdgeBps: number | undefined;
  locked: boolean;
  rolls?: readonly DiceRoll[];
  onDirectionChange: (direction: DiceDirection) => void;
  onLineChange: (line: number) => void;
  /** The punch has landed; the room counts the reveal as done. */
  onPunched?: () => void;
}) {
  const t = useTranslations("casino.dice.table");
  const tapeRef = React.useRef<HTMLDivElement>(null);
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const dragging = React.useRef(false);
  const [min, max] = diceTargetBounds(direction);
  const wins = diceWins(direction, line);
  const [winFrom, winTo] = diceWinRange(direction, line);
  const [loseFrom, loseTo] = diceLoseRange(direction, line);
  const pays = houseEdgeBps == null ? undefined : diceMultiplier(wins, houseEdgeBps);
  const paysText = pays ? `${pays.whole}.${pays.fraction}` : "—";
  const lowSide = direction === "under";
  const bigRoll = rolls?.length === 1 ? rolls[0] : undefined;

  const lineAt = (clientX: number) => {
    const box = tapeRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return line;
    return Math.round(((clientX - box.left) / box.width) * 100);
  };

  // A zone label is shown only where it fits its zone and the big punch is clear of it.
  const winLabel = useFits(tapeRef, wins, bigRoll?.value, lowSide ? "start" : "end");
  const loseLabel = useFits(tapeRef, 100 - wins, bigRoll?.value, lowSide ? "end" : "start");

  React.useEffect(() => {
    if (!rolls?.length || !onPunched) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    const timer = window.setTimeout(onPunched, reduced ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [rolls, onPunched]);

  const zone = (win: boolean) => {
    const atStart = win === lowSide;
    const width = win ? wins : 100 - wins;
    const fits = win ? winLabel : loseLabel;
    return (
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 grid place-items-center overflow-hidden ${win ? "print-dots" : ""}`}
        style={atStart ? { left: 0, width: `${width}%` } : { left: `${100 - width}%`, right: 0 }}
      >
        <span
          ref={fits.ref}
          className={`rounded-print bg-paper px-2 py-0.5 text-note whitespace-nowrap ${
            win ? "font-semibold text-ink" : "text-faded"
          } ${fits.shown ? "" : "invisible"}`}
        >
          {win
            ? t("winOn", { from: winFrom, to: winTo })
            : t("loseOn", { from: loseFrom, to: loseTo })}
        </span>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="dice-table-title"
      className="rounded-sheet bg-paper px-4 pt-5 pb-5 text-ink md:p-8"
    >
      <h2 id="dice-table-title" className="sr-only">
        {t("title")}
      </h2>
      {/* Chance before price, at the same size. */}
      <div className="flex gap-10 md:gap-12">
        <p className="grid gap-2">
          <span className="text-note text-faded">{t("chance")}</span>
          <span className="font-print text-total font-extrabold tabular-nums">{wins}%</span>
        </p>
        <p className="grid gap-2">
          <span className="text-note text-faded">{t("pays")}</span>
          {pays ? (
            <PrintedFigure value={pays} suffix="×" className="text-total" />
          ) : (
            <span className="text-total">—</span>
          )}
        </p>
      </div>

      <div
        ref={tapeRef}
        className={`relative mt-12 h-16 touch-pan-y rounded-print border border-thermal select-none md:mt-14 md:h-[72px] ${
          locked ? "" : "cursor-ew-resize"
        }`}
        onPointerDown={(event) => {
          if (locked) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          rangeRef.current?.focus({ preventScroll: true });
          onLineChange(lineAt(event.clientX));
        }}
        onPointerMove={(event) => {
          if (dragging.current) onLineChange(lineAt(event.clientX));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {zone(true)}
        {zone(false)}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-9 -bottom-px z-10 -translate-x-px border-l-2 border-dashed border-ink md:-top-10"
          style={{ left: `${line}%` }}
        >
          <span className="absolute top-0 left-0 grid h-8 min-w-11 -translate-x-1/2 place-items-center rounded-print bg-ink px-2.5 text-note font-extrabold text-paper tabular-nums">
            {line}
          </span>
        </div>
        {rolls?.length ? (
          <div aria-hidden="true">
            {rolls.length === 1 ? (
              <span
                className="absolute top-1/2 z-20 grid size-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-paper font-print text-price font-extrabold text-ink motion-safe:animate-punch md:size-[60px]"
                style={{ left: `${rolls[0]!.value - 0.5}%` }}
              >
                {rolls[0]!.value}
              </span>
            ) : (
              rolls.map((roll, index) => (
                <span
                  key={index}
                  className={`absolute top-[calc(100%-12px)] z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink motion-safe:animate-punch ${
                    roll.won ? "bg-ink" : "bg-paper"
                  }`}
                  style={{ left: `${roll.value - 0.5}%` }}
                />
              ))
            )}
          </div>
        ) : null}
        <input
          ref={rangeRef}
          type="range"
          min={min}
          max={max}
          step={1}
          value={line}
          disabled={locked}
          aria-label={t("line")}
          aria-valuetext={t("valueText", {
            from: winFrom,
            to: winTo,
            chance: wins,
            pays: paysText
          })}
          onChange={(event) => onLineChange(Number(event.target.value))}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-9 hidden -translate-x-1/2 rounded-print outline-2 outline-offset-2 outline-ink peer-focus-visible:block md:-top-10"
          style={{ left: `${line}%`, width: "2.75rem", height: "2rem" }}
        />
      </div>

      <div aria-hidden="true" className="relative h-9">
        <div className="print-ticks absolute inset-x-0 top-0 h-2.5 [--tick-major:25%] [--tick-minor:5%] md:[--tick-major:10%] md:[--tick-minor:1%]" />
        {SCALE.map((at) => (
          <span
            key={at}
            className={`absolute top-4 text-note leading-none text-faded tabular-nums ${
              at === 0 ? "" : at === 100 ? "-translate-x-full" : "-translate-x-1/2"
            } ${at === 25 || at === 75 ? "md:hidden" : at % 50 === 0 ? "" : "hidden md:block"}`}
            style={{ left: `${at}%` }}
          >
            {at}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <fieldset className="inline-flex" disabled={locked}>
          <legend className="sr-only">{t("side")}</legend>
          {(["under", "over"] as const).map((side) => (
            <label key={side} className="relative">
              <input
                type="radio"
                name="dice-side"
                value={side}
                checked={direction === side}
                onChange={() => onDirectionChange(side)}
                className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-default"
              />
              <span
                className={`grid h-10 place-items-center border border-ink px-4 font-semibold text-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink md:px-5 ${
                  side === "under" ? "rounded-l-print" : "-ml-px rounded-r-print"
                } ${locked && direction !== side ? "text-thermal" : ""}`}
              >
                {side === "under" ? t("low") : t("high")}
              </span>
            </label>
          ))}
        </fieldset>
        <div role="group" aria-label={t("line")} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="mr-2 hidden text-note text-faded md:inline">
            {t("line")}
          </span>
          <button
            type="button"
            disabled={locked || line <= min}
            aria-label={t("lineDown")}
            onClick={() => onLineChange(line - 1)}
            className={`${LINE_BUTTON} size-10 px-0 text-lede`}
          >
            −
          </button>
          <output className="w-12 text-center font-semibold tabular-nums">{line}</output>
          <button
            type="button"
            disabled={locked || line >= max}
            aria-label={t("lineUp")}
            onClick={() => onLineChange(line + 1)}
            className={`${LINE_BUTTON} size-10 px-0 text-lede`}
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Whether a zone label fits its zone (with 8px each side) and stays clear of the big punch. Measured
 * after layout, and again when the tape resizes.
 */
function useFits(
  tapeRef: React.RefObject<HTMLDivElement | null>,
  widthPercent: number,
  punchAt: number | undefined,
  edge: "start" | "end"
) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(true);
  const measure = React.useCallback(() => {
    const tape = tapeRef.current;
    const label = ref.current;
    if (!tape || !label) return;
    const width = tape.clientWidth;
    const zone = (widthPercent / 100) * width;
    const labelWidth = label.offsetWidth;
    let covered = false;
    if (punchAt != null) {
      const zoneStart = edge === "start" ? 0 : width - zone;
      const labelStart = zoneStart + (zone - labelWidth) / 2;
      const hole = ((punchAt - 0.5) / 100) * width;
      covered = hole + 30 > labelStart && hole - 30 < labelStart + labelWidth;
    }
    setShown(!covered && labelWidth + 16 <= zone);
  }, [edge, punchAt, tapeRef, widthPercent]);

  React.useLayoutEffect(measure);
  React.useEffect(() => {
    const tape = tapeRef.current;
    if (!tape || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(tape);
    return () => observer.disconnect();
  }, [measure, tapeRef]);
  return { ref, shown };
}
