"use client";

import * as React from "react";
import type { PlinkoRisk } from "@ssot/ssot/encoding";

import { PrintedFigure } from "../../home/printed-figure";
import { usePlinkoCopy } from "./plinko-copy";
import { cupFigure, cupOdds, CUP_LIST, paysMore } from "./plinko-model";

/**
 * What each cup pays and how often a ball lands there, printed on the felt in a column under its
 * cup. Pays are per ball after the house edge, cut to three figures; a pay below the stake is
 * printed soft, so a partial refund never reads as a win. The cups a result landed in light; a
 * net win's chips are paid onto its cup's label (`paidRef`), below the ball, never over it.
 */
export function PlinkoCups({
  risk,
  houseEdgeBps,
  now,
  win,
  paidCup,
  paidRef
}: {
  risk: PlinkoRisk;
  houseEdgeBps: number | undefined;
  now: readonly number[];
  win: readonly number[];
  /** The cup a net win's chips are paid onto. */
  paidCup: number | null;
  paidRef: React.RefObject<HTMLSpanElement>;
}) {
  const { t } = usePlinkoCopy();
  const lit = (cup: number) =>
    now.includes(cup) ? { "data-now": "", "data-win": win.includes(cup) ? "" : undefined } : {};
  return (
    <table className="table-cups">
      <caption className="sr-only">{t("table.cups")}</caption>
      <tbody>
        <tr data-row="pays">
          {CUP_LIST.map((cup) => (
            <td
              key={cup}
              data-under={houseEdgeBps == null || !paysMore(risk, cup, houseEdgeBps) || undefined}
              {...lit(cup)}
            >
              <b>
                {houseEdgeBps == null ? (
                  "–"
                ) : (
                  <>
                    <PrintedFigure value={cupFigure(risk, cup, houseEdgeBps)} />
                    <span data-x="" className="text-[0.75em]">
                      ×
                    </span>
                  </>
                )}
              </b>
            </td>
          ))}
        </tr>
        <tr data-row="odds">
          {CUP_LIST.map((cup) => (
            <td key={cup} className="relative" {...lit(cup)}>
              {paidCup === cup ? (
                <span
                  ref={paidRef}
                  aria-hidden="true"
                  className="absolute bottom-0.5 left-1/2 size-(--chip-size) -translate-x-1/2"
                />
              ) : null}
              {t("table.percent", { value: cupOdds(cup) })}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
