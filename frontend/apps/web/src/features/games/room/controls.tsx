import * as React from "react";
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
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-[#050505] border border-white/10 p-5 mb-6 shadow-inner relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 to-amber-500" />
      <div className="flex justify-between items-center z-10">
        <span className="text-xl font-black font-mono text-white flex gap-2 items-center">
          {spots.length}{" "}
          <span className="text-white/30 text-xs tracking-widest uppercase mt-1">Bets</span>
        </span>
        <button
          onClick={onClear}
          className="px-4 py-2 rounded-xl bg-[#111] hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-white/40 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Clear All
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 z-10 pt-2 border-t border-white/5 mt-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-2">
        {spots.length === 0 ? (
          <span className="text-xs text-white/20 font-bold italic py-2">
            No bets placed. Click the felt to bet.
          </span>
        ) : (
          spots.map((spot) => (
            <div
              key={spot}
              className="bg-[#111] px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border border-white/10 flex items-center gap-1.5 shadow-sm"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full shadow-inner",
                  spot === "0"
                    ? "bg-emerald-500"
                    : ROULETTE_NAMED_SPOTS.includes(spot)
                      ? "bg-white/40"
                      : RED_NUMBER_SET.has(parseInt(spot))
                        ? "bg-red-500"
                        : "bg-zinc-800"
                )}
              />
              <span className="text-white/80">{spot.toUpperCase()}</span>
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
  return (
    <div className="mb-6 flex flex-col gap-2 relative">
      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2 mb-1">
        <SparklesIcon className="w-3 h-3" /> Select Face
      </label>
      <div className="flex bg-[#030303] border border-white/5 p-1.5 rounded-2xl relative shadow-inner">
        <div
          className={cn(
            "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-[400ms] ease-out shadow-[0_0_20px_rgba(0,0,0,1),inset_0_2px_10px_rgba(255,255,255,0.2)]",
            coinSide === "HEADS"
              ? "bg-gradient-to-b from-amber-400 to-amber-600 left-1.5"
              : "bg-gradient-to-b from-indigo-500 to-indigo-700 left-[calc(50%+4.5px)]"
          )}
        />
        <button
          onClick={() => onChange("HEADS")}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold uppercase tracking-widest text-xs relative z-10 transition-colors flex items-center justify-center gap-2",
            coinSide === "HEADS"
              ? "text-amber-950 font-black drop-shadow-md"
              : "text-white/30 hover:text-white"
          )}
        >
          Heads
        </button>
        <button
          onClick={() => onChange("TAILS")}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold uppercase tracking-widest text-xs relative z-10 transition-colors flex items-center justify-center gap-2",
            coinSide === "TAILS"
              ? "text-white font-black drop-shadow-md"
              : "text-white/30 hover:text-white"
          )}
        >
          Tails
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
  const sortedSpots = [...spots].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-[#050505] border border-white/10 p-5 mb-6 shadow-inner relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-600 to-fuchsia-400" />
      <div className="flex justify-between items-center z-10">
        <span className="text-xl font-black font-mono text-white flex gap-2 items-center">
          {spots.length}{" "}
          <span className="text-white/30 text-xs tracking-widest uppercase mt-1">/ 10 Spots</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onChange(pickKenoSpots(10));
              onResetResult();
            }}
            className="px-4 py-2 rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300 text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-500/20 transition-all shadow-[0_0_15px_rgba(217,70,239,0.1)]"
          >
            Auto Pick
          </button>
          <button
            onClick={() => {
              onChange([]);
              onResetResult();
            }}
            className="px-4 py-2 rounded-xl bg-[#111] hover:bg-white/10 border border-white/5 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 z-10 pt-2 border-t border-white/5 mt-2">
        {spots.length === 0 && (
          <span className="text-xs text-white/20 font-bold italic py-2">
            No spots selected. Click the grid to pick numbers.
          </span>
        )}
        {sortedSpots.map((n) => (
          <div
            key={n}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-fuchsia-600 border border-fuchsia-400 text-white font-mono text-xs font-black shadow-[0_0_10px_rgba(217,70,239,0.4)]"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
