import * as React from "react";
import { useTranslations } from "next-intl";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "./model";
import type { CoinSide } from "./params";

const ROULETTE_NAMED_SPOTS = [
  "RED",
  "BLACK",
  "EVEN",
  "ODD",
  "1-18",
  "19-36",
  "1st 12",
  "2nd 12",
  "3rd 12"
];

function pickKenoSpots(count: number): number[] {
  const spots: number[] = [];
  while (spots.length < count) {
    const n = Math.floor(Math.random() * 40) + 1;
    if (!spots.includes(n)) spots.push(n);
  }
  return spots;
}

export function RouletteSelectionPanel({
  spots,
  onClear
}: {
  spots: readonly string[];
  onClear: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="relative mb-6 flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface-0 p-5 shadow-inner-e1">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
      <div className="z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-xl font-black text-fg">
          {spots.length}{" "}
          <span className="mt-1 text-xs uppercase tracking-widest text-fg-subtle">
            {t("casino.room.selection.roulette.bets")}
          </span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-border bg-surface-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-fg-subtle transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
        >
          {t("casino.room.selection.roulette.clearAll")}
        </button>
      </div>
      <div className="custom-scrollbar z-10 mt-2 flex max-h-[140px] flex-wrap gap-1.5 overflow-y-auto border-t border-border-soft pt-2 pr-2">
        {spots.length === 0 ? (
          <span className="py-2 text-xs font-bold italic text-fg-subtle">
            {t("casino.room.selection.roulette.empty")}
          </span>
        ) : (
          spots.map((spot) => (
            <div
              key={spot}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 font-mono text-xs font-bold shadow-e1"
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full shadow-inner-e1",
                  spot === "0"
                    ? "bg-success"
                    : ROULETTE_NAMED_SPOTS.includes(spot)
                      ? "bg-fg-subtle"
                      : RED_NUMBER_SET.has(parseInt(spot))
                        ? "bg-danger"
                        : "bg-surface-3"
                )}
              />
              <span className="text-fg-muted">{spot.toUpperCase()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CoinSideSelector({
  coinSide,
  onChange
}: {
  coinSide: CoinSide;
  onChange: (side: CoinSide) => void;
}) {
  const t = useTranslations();

  return (
    <div className="relative mb-6 flex flex-col gap-2">
      <label className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
        <SparklesIcon className="h-3 w-3" /> {t("casino.room.selection.coin.selectFace")}
      </label>
      <div className="relative flex rounded-xl border border-border bg-surface-0 p-1.5 shadow-inner-e1">
        <div
          className={cn(
            "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-lg bg-brand shadow-glow transition-[left] duration-[400ms] ease-out",
            coinSide === "HEADS" ? "left-1.5" : "left-[calc(50%+4.5px)]"
          )}
        />
        <button
          type="button"
          onClick={() => onChange("HEADS")}
          className={cn(
            "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            coinSide === "HEADS" ? "font-black text-fg" : "text-fg-subtle hover:text-fg"
          )}
        >
          {t("casino.room.selection.coin.heads")}
        </button>
        <button
          type="button"
          onClick={() => onChange("TAILS")}
          className={cn(
            "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            coinSide === "TAILS" ? "font-black text-fg" : "text-fg-subtle hover:text-fg"
          )}
        >
          {t("casino.room.selection.coin.tails")}
        </button>
      </div>
    </div>
  );
}

export function KenoSelectionPanel({
  spots,
  onChange,
  onResetResult
}: {
  spots: readonly number[];
  onChange: (spots: number[]) => void;
  onResetResult: () => void;
}) {
  const t = useTranslations();
  const sortedSpots = [...spots].sort((a, b) => a - b);

  return (
    <div className="relative mb-6 flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface-0 p-5 shadow-inner-e1">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
      <div className="z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-xl font-black text-fg">
          {spots.length}{" "}
          <span className="mt-1 text-xs uppercase tracking-widest text-fg-subtle">
            {t("casino.room.selection.keno.spotsLabel")}
          </span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(pickKenoSpots(10));
              onResetResult();
            }}
            className="rounded-lg border border-brand/40 bg-brand-soft px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition-colors hover:bg-brand/20"
          >
            {t("casino.room.selection.keno.autoPick")}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange([]);
              onResetResult();
            }}
            className="rounded-lg border border-border bg-surface-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {t("casino.room.selection.keno.clear")}
          </button>
        </div>
      </div>
      <div className="z-10 mt-2 flex flex-wrap gap-1.5 border-t border-border-soft pt-2">
        {spots.length === 0 && (
          <span className="py-2 text-xs font-bold italic text-fg-subtle">
            {t("casino.room.selection.keno.empty")}
          </span>
        )}
        {sortedSpots.map((n) => (
          <div
            key={n}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-brand/40 bg-brand text-fg font-mono text-xs font-black shadow-glow"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
