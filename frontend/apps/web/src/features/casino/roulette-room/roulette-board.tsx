"use client";

import * as React from "react";

import { useRouletteCopy } from "./roulette-copy";
import { pocketColour, rouletteSpot, ROULETTE_SPOTS, type RouletteSpot } from "./roulette-model";

/** How long a press on a touch screen takes to preview a spot instead of placing a chip. */
const LONG_PRESS_MS = 380;

export type BoardMarks = {
  /** The number that came up last: a paper dolly marks it, win or lose. */
  dolly: number | null;
  /** It won: the number lights with its pocket. */
  hit: boolean;
  /** The spot a net win is paid on. */
  paid: string | null;
};

/**
 * The layout printed on the felt, the same on every screen: 0 on the left, three rows of twelve,
 * the columns at the right end, the dozens and the even-money bets along the front. A tap puts a
 * chip on a spot or takes it off; every chip adds its numbers to the one bet. Hover, keyboard focus
 * or a long press shows the numbers a spot covers, and a long press places nothing.
 */
export function RouletteBoard({
  spots,
  covered,
  locked,
  marks,
  call,
  paidRef,
  onToggle,
  titleId
}: {
  spots: readonly string[];
  covered: ReadonlySet<number>;
  locked: boolean;
  marks: BoardMarks;
  /** "No more bets" shows over the layout. */
  call: boolean;
  paidRef: React.RefObject<HTMLButtonElement>;
  onToggle: (key: string) => void;
  titleId: string;
}) {
  const copy = useRouletteCopy();
  const { t } = copy;
  const [preview, setPreview] = React.useState<string | null>(null);
  const press = React.useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean }>({
    held: false
  });
  React.useEffect(() => () => clearTimeout(press.current.timer), []);
  React.useEffect(() => {
    if (locked) setPreview(null);
  }, [locked]);

  const previewed = React.useMemo(
    () => new Set(preview ? (rouletteSpot(preview)?.numbers ?? []) : []),
    [preview]
  );
  const show = (key: string | null) => setPreview(locked ? null : key);
  const release = () => {
    clearTimeout(press.current.timer);
    if (press.current.held) setPreview(null);
  };

  const label = (spot: RouletteSpot) => {
    if (spot.kind === "number") {
      const n = spot.numbers[0]!;
      const colour = pocketColour(n);
      return colour === "zero"
        ? t("table.zeroLabel")
        : t("table.numberLabel", { n, colour: t(`colour.${colour}`) });
    }
    return t("table.spotLabel", {
      name: copy.spotName(spot.name, "short"),
      count: spot.numbers.length
    });
  };

  const face = (spot: RouletteSpot) => {
    if (spot.kind === "number") return spot.numbers[0];
    if (spot.kind === "column")
      return (
        <>
          <span className="@max-[460px]/felt:hidden">{t("table.column")}</span>
          <span className="hidden @max-[460px]/felt:inline">{t("table.columnShort")}</span>
        </>
      );
    if (spot.name.key === "red" || spot.name.key === "black")
      return (
        <i
          className={`block h-4 w-7 [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] @max-[460px]/felt:h-3 @max-[460px]/felt:w-5 ${
            spot.name.key === "red" ? "bg-pocket-red" : "bg-pocket-black"
          }`}
        />
      );
    return copy.spotName(spot.name, "short");
  };

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      data-chips={covered.size > 0 ? "" : undefined}
      onPointerLeave={() => show(null)}
      onContextMenu={(event) => {
        if (press.current.held) event.preventDefault();
      }}
      className="relative mt-3.5 grid touch-manipulation grid-cols-[minmax(0,1.2fr)_repeat(12,minmax(0,1fr))_minmax(0,1.35fr)] grid-rows-[repeat(3,38px)_32px_32px] select-none [--chip-size:24px] [-webkit-touch-callout:none] @max-[460px]/felt:mt-2.5 @max-[460px]/felt:grid-cols-[minmax(0,0.9fr)_repeat(12,minmax(0,1fr))_minmax(0,0.9fr)] @max-[460px]/felt:grid-rows-[repeat(3,46px)_38px_38px] @max-[460px]/felt:[--chip-size:18px]"
    >
      {ROULETTE_SPOTS.map((spot) => {
        const n = spot.kind === "number" ? spot.numbers[0]! : null;
        const pressed = spots.includes(spot.key);
        const size =
          n === 0
            ? "text-[16px] font-bold @max-[460px]/felt:text-[14px]"
            : spot.kind === "number"
              ? "text-[14px] font-bold @max-[460px]/felt:text-[12px] @max-[460px]/felt:tracking-[-0.02em]"
              : spot.kind === "column"
                ? "text-[11px] font-semibold"
                : "text-[13px] font-semibold @max-[460px]/felt:text-[11px]";
        return (
          <button
            key={spot.key}
            ref={marks.paid === spot.key ? paidRef : undefined}
            type="button"
            aria-pressed={pressed}
            aria-label={label(spot)}
            disabled={locked}
            data-c={n == null ? undefined : pocketColour(n)}
            data-covered={n != null && covered.has(n) ? "" : undefined}
            data-preview={preview === spot.key || (n != null && previewed.has(n)) ? "" : undefined}
            data-dolly={n != null && marks.dolly === n ? "" : undefined}
            data-hit={n != null && marks.dolly === n && marks.hit ? "" : undefined}
            data-paid={marks.paid === spot.key ? "" : undefined}
            style={{ gridRow: spot.row, gridColumn: spot.column }}
            className={`table-spot ${size}`}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") show(spot.key);
            }}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) show(spot.key);
            }}
            onBlur={() => show(null)}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse") return;
              clearTimeout(press.current.timer);
              press.current.held = false;
              press.current.timer = setTimeout(() => {
                press.current.held = true;
                show(spot.key);
              }, LONG_PRESS_MS);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onClick={() => {
              // A long press only shows what the spot covers; it places no chip.
              if (press.current.held) {
                press.current.held = false;
                return;
              }
              if (!locked) onToggle(spot.key);
            }}
          >
            {face(spot)}
          </button>
        );
      })}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-3 m-0 grid place-items-center bg-felt-edge/62 text-[30px] leading-none font-extrabold text-paper transition-opacity duration-300 @max-[460px]/felt:text-[22px] ${
          call ? "opacity-100" : "opacity-0"
        }`}
      >
        {t("table.call")}
      </p>
    </div>
  );
}
