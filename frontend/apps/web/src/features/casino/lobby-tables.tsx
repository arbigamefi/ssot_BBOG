import * as React from "react";
import Link from "next/link";

import type { GameStub } from "./game-stubs";
import type { CasinoModuleSlug } from "./modules";
import { TableVignette, TableVignetteDefs } from "./table-vignettes";

/** The lobby's order, simplest game first. */
const LOBBY_ORDER: readonly CasinoModuleSlug[] = [
  "coin-toss",
  "dice",
  "roulette",
  "baccarat",
  "sic-bo",
  "slots",
  "plinko",
  "keno"
];

export type LobbyTable = GameStub & {
  name: string;
  /** One line on how to play. */
  line: string;
  /** The win chance range as printed, such as `2%–97%`. */
  chance: string;
  /** What a screen reader says for the whole table. */
  label: string;
};

/** Doto's own decimal point disappears at small sizes, so separators are set in the text face. */
function Printed({ text }: { text: string }) {
  return (
    <>
      {text.split(/([.,])/).map((part, i) =>
        part === "." || part === "," ? (
          <span key={i} className="font-text font-semibold">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * The games as small felt tables, four to a row on wide screens and two on narrower ones: each its
 * room's rail, felt and lamp with the game's piece at rest, and under it, printed on the felt, the
 * name, one line on how to play, the win chance and the most one bet pays.
 */
export function LobbyTables({
  tables,
  chanceLabel,
  pays,
  upTo
}: {
  tables: readonly LobbyTable[];
  chanceLabel: string;
  pays: string;
  upTo: string;
}) {
  const ordered = [...tables].sort(
    (a, b) => LOBBY_ORDER.indexOf(a.slug) - LOBBY_ORDER.indexOf(b.slug)
  );
  return (
    <>
      <TableVignetteDefs />
      <ul className="grid grid-cols-2 gap-3 min-[561px]:gap-[22px] min-[1101px]:grid-cols-4 lg:col-span-12">
        {ordered.map((table) => (
          <li key={table.slug} data-slug={table.slug} className="flex min-w-0">
            <Link
              href={table.href}
              aria-label={table.label}
              className="group table-tile grid min-w-0 flex-1 grid-rows-[auto_auto_1fr_auto] gap-1 px-2.5 pt-1.5 pb-3 text-print focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper min-[561px]:gap-1.5 min-[561px]:px-4 min-[561px]:pt-2.5 min-[561px]:pb-4"
            >
              <TableVignette slug={table.slug} />
              <h3 className="mt-1 text-[17px] leading-[1.15] font-extrabold decoration-1 underline-offset-[0.2em] group-hover:underline min-[561px]:text-[21px]">
                {table.name}
              </h3>
              <p className="text-[12px] leading-[1.4] text-print-soft min-[561px]:text-[13.5px]">
                {table.line}
              </p>
              <div
                aria-hidden="true"
                className="mt-1 grid grid-cols-1 items-end gap-1.5 border-t border-dashed border-print-faint pt-2 min-[561px]:mt-2 min-[561px]:grid-cols-[auto_auto] min-[561px]:justify-between min-[561px]:gap-x-3 min-[561px]:gap-y-1 min-[561px]:pt-2.5"
              >
                <p className="grid min-w-0 gap-[3px]">
                  <span className="text-[11px] leading-[1.2] text-print-soft min-[561px]:text-[12px]">
                    {chanceLabel}
                  </span>
                  <span className="font-print text-[16px] leading-none font-extrabold whitespace-nowrap min-[561px]:text-[20px]">
                    <Printed text={table.chance} />
                  </span>
                </p>
                <p className="grid min-w-0 gap-[3px] min-[561px]:text-right">
                  <span className="text-[11px] leading-[1.2] text-print-soft min-[561px]:text-[12px]">
                    {table.fixed ? pays : upTo}
                  </span>
                  <span className="font-print text-[16px] leading-none font-extrabold whitespace-nowrap min-[561px]:text-[20px]">
                    {table.multiplier.whole}
                    <span className="font-text font-semibold">.</span>
                    {table.multiplier.fraction.padEnd(2, "0")}
                    <small className="ml-px font-text text-[12px] font-semibold">×</small>
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
