"use client";

import * as React from "react";

import { PrintedFigure } from "../../home/printed-figure";
import { SlotGlyph, useSlotsCopy } from "./slots-copy";
import { lineMultiplier, OUTCOMES, PAY_LINES, SEVEN, type SlotsLine } from "./slots-model";

/**
 * The pay table printed on the felt: each line's tiles, its name, how often it comes up and what
 * it pays, the stake included and the house edge taken. The line a result hits lights up; a net
 * win's chips are paid next to its figure (`paidRef`).
 */
export function SlotsPaytable({
  houseEdgeBps,
  hit,
  paidRef
}: {
  houseEdgeBps: number | undefined;
  hit: SlotsLine | null;
  paidRef: React.RefObject<HTMLSpanElement>;
}) {
  const { t } = useSlotsCopy();
  const any = t("table.any");
  const tiles = (key: SlotsLine) =>
    key === "jackpot" ? (
      [0, 1, 2].map((k) => (
        <span key={k} className="slot-tile">
          <SlotGlyph s={SEVEN} />
        </span>
      ))
    ) : (
      <>
        <span className="slot-tile">{any}</span>
        <span className="slot-tile">{any}</span>
        {key === "three" ? (
          <span className="slot-tile">{any}</span>
        ) : (
          <span data-blank="" className="slot-tile" />
        )}
      </>
    );

  return (
    <table className="mt-[26px] w-full border-separate border-spacing-0 tabular-nums @max-[460px]/felt:mt-4">
      <caption className="sr-only">{t("table.paytable")}</caption>
      <tbody>
        {PAY_LINES.map((line) => {
          const odds = t("table.odds", { count: line.count, total: OUTCOMES });
          const on = hit === line.key;
          const cell =
            "h-[50px] border-t-[1.5px] border-print-faint px-3.5 align-middle text-print @max-[460px]/felt:h-[42px] @max-[460px]/felt:px-1.5";
          return (
            <tr
              key={line.key}
              data-hit={on || undefined}
              className={`transition-colors duration-300 last:[&>td]:border-b-[1.5px] ${on ? "bg-paper/8" : ""}`}
            >
              <td className={`${cell} w-[1%] pl-1 whitespace-nowrap @max-[460px]/felt:pl-1`}>
                <span
                  aria-hidden="true"
                  className="inline-flex gap-[3px] @max-[460px]/felt:gap-0.5"
                >
                  {tiles(line.key)}
                </span>
              </td>
              <td className={cell}>
                <span className="font-semibold @max-[460px]/felt:text-note">
                  {t(`table.lines.${line.key}`)}
                </span>
                <small className="mt-0.5 hidden text-[12px] text-print-soft @max-[460px]/felt:block">
                  {odds}
                </small>
              </td>
              <td
                className={`${cell} text-note whitespace-nowrap text-print-soft @max-[460px]/felt:hidden`}
              >
                {odds}
              </td>
              <td className={`${cell} relative w-[1%] pr-1 text-right whitespace-nowrap`}>
                {on ? (
                  <span
                    ref={paidRef}
                    aria-hidden="true"
                    className="absolute top-1/2 right-full mr-1 size-(--chip-size) -translate-y-1/2"
                  />
                ) : null}
                <b
                  className={`font-print text-[26px] leading-none font-extrabold @max-[460px]/felt:text-[20px] ${
                    on ? "motion-safe:animate-print-glow" : ""
                  }`}
                >
                  {houseEdgeBps == null ? (
                    "–"
                  ) : (
                    <PrintedFigure value={lineMultiplier(line.multiple, houseEdgeBps)} suffix="×" />
                  )}
                </b>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
