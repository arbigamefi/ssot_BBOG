"use client";

import * as React from "react";

import { useKenoCopy } from "./keno-copy";
import { MAX_PICKS, POOL } from "./keno-model";

/**
 * Keno's board, printed on the felt: fifteen numbers in three rows of five. A tap puts a chip on a
 * number or takes it off; a sixth pick is refused with a hint. Drawn numbers get a printed ring,
 * and the player's drawn numbers light with a red chip.
 */
export function KenoBoard({
  picks,
  onPicksChange,
  locked,
  drawn,
  hits,
  onFull
}: {
  picks: readonly number[];
  onPicksChange: (picks: number[]) => void;
  locked: boolean;
  /** The numbers drawn so far this round. */
  drawn: readonly number[];
  /** The player's numbers of this round's draw. */
  hits: readonly number[];
  /** A sixth number was tapped. */
  onFull: () => void;
}) {
  const { t } = useKenoCopy();
  const labelId = React.useId();
  const full = picks.length >= MAX_PICKS;
  const toggle = (n: number) => {
    if (locked) return;
    if (picks.includes(n)) onPicksChange(picks.filter((p) => p !== n));
    else if (full) onFull();
    else onPicksChange([...picks, n].sort((a, b) => a - b));
  };
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="grid grid-cols-5 gap-2 @max-[460px]/felt:gap-1.5"
    >
      <span id={labelId} className="sr-only">
        {t("table.board")}
      </span>
      {Array.from({ length: POOL }, (_, i) => {
        const n = i + 1;
        const on = picks.includes(n);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            aria-label={on ? t("table.spotPicked", { n }) : String(n)}
            disabled={locked}
            data-dim={(full && !on) || undefined}
            data-drawn={drawn.includes(n) || undefined}
            data-hit={hits.includes(n) || undefined}
            onClick={() => toggle(n)}
            className="table-pick"
          >
            <span aria-hidden="true">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
