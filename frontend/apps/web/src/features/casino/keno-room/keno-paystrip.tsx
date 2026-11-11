"use client";

import * as React from "react";

import { PrintedFigure } from "../../home/printed-figure";
import { useKenoCopy } from "./keno-copy";
import { hitMultiplier, hitOdds, paysMore } from "./keno-model";

/**
 * The pay strip printed on the felt: for the numbers picked, a column for each number of hits,
 * with what it pays per round after the house edge and how often it comes up. A pay below the
 * stake is printed soft, so a partial refund never reads as a win. The column a result hits
 * lights; a net win's chips are paid onto it (`paidRef`).
 */
export function KenoPaystrip({
  picked,
  houseEdgeBps,
  now,
  paidRef
}: {
  picked: number;
  houseEdgeBps: number | undefined;
  /** The number of hits a result lit, and whether it paid more than the stake. */
  now: { hits: number; win: boolean } | null;
  paidRef: React.RefObject<HTMLSpanElement>;
}) {
  const { t } = useKenoCopy();
  if (picked < 1) return null;
  const columns = Array.from({ length: picked + 1 }, (_, hits) => hits);
  const lit = (hits: number) =>
    now?.hits === hits ? { "data-now": "", "data-win": now.win ? "" : undefined } : {};
  return (
    <table className="table-paystrip mt-3 @max-[460px]/felt:mt-3.5">
      <caption className="sr-only">{t("table.paystrip")}</caption>
      <tbody>
        <tr data-row="hits">
          <th scope="row">{t("table.rows.hits")}</th>
          {columns.map((hits) => (
            <td key={hits} {...lit(hits)}>
              {hits}
            </td>
          ))}
        </tr>
        <tr data-row="pays">
          <th scope="row">{t("table.rows.pays")}</th>
          {columns.map((hits) => (
            <td
              key={hits}
              data-under={
                houseEdgeBps == null || !paysMore(picked, hits, houseEdgeBps) || undefined
              }
              className="relative"
              {...lit(hits)}
            >
              {now?.hits === hits && now.win ? (
                <span
                  ref={paidRef}
                  aria-hidden="true"
                  className="absolute bottom-full left-1/2 size-(--chip-size) -translate-x-1/2"
                />
              ) : null}
              <b>
                {houseEdgeBps == null ? (
                  "–"
                ) : (
                  <PrintedFigure value={hitMultiplier(picked, hits, houseEdgeBps)} suffix="×" />
                )}
              </b>
            </td>
          ))}
        </tr>
        <tr data-row="odds">
          <th scope="row">{t("table.rows.odds")}</th>
          {columns.map((hits) => {
            const odds = hitOdds(picked, hits);
            return (
              <td key={hits} {...lit(hits)}>
                {odds.kind === "percent"
                  ? t("table.percent", { value: odds.value })
                  : t("table.oneIn", { n: odds.value })}
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
