import * as React from "react";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "./model";

export type GameHistoryEntry = {
  val: number;
  win: boolean;
};

export type RecentBetSummary = {
  id: string;
  betId: string | number | bigint;
  state: string;
};

function getRecentLabel(gameSlug: string) {
  if (gameSlug === "dice") return "RECENT ROLLS";
  if (gameSlug === "roulette") return "RECENT NUMBERS";
  if (gameSlug === "keno") return "RECENT DRAWS";
  return "RECENT FLIPS";
}

function getBetStateLabel(state: string) {
  if (state === "finalized") return "SETTLED";
  if (state === "refunded") return "REFUNDED";
  if (state === "randomReady") return "VRF READY";
  return "PLACED";
}

function getBetStateClass(state: string) {
  if (state === "finalized") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (state === "refunded") return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (state === "randomReady") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

function HistoryValue({ gameSlug, value }: { gameSlug: string; value: number }) {
  if (gameSlug === "coin-toss") return value === 1 ? "H" : "T";
  if (gameSlug === "keno") return value;
  if (gameSlug === "roulette") {
    return (
      <span
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[8px]",
          value === 0 ? "bg-emerald-500" : RED_NUMBER_SET.has(value) ? "bg-red-600" : "bg-zinc-700"
        )}
      >
        {value}
      </span>
    );
  }
  return value;
}

export function GameRoomHistoryWidget({
  gameSlug,
  gameHistory,
  recentBets
}: {
  gameSlug: string;
  gameHistory: readonly GameHistoryEntry[];
  recentBets: readonly RecentBetSummary[];
}) {
  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
      <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/90 backdrop-blur-xl shadow-2xl min-w-[200px] max-w-[260px]">
        <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1 w-full">
          {getRecentLabel(gameSlug)}
        </div>
        {gameHistory.length > 0 && (
          <div className="flex gap-1.5 justify-end flex-wrap w-full">
            {gameHistory.map((res, i) => (
              <div
                key={i}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border",
                  res.win
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                <HistoryValue gameSlug={gameSlug} value={res.val} />
              </div>
            ))}
          </div>
        )}
        {recentBets.length > 0 && (
          <div className="w-full border-t border-white/5 pt-2 mt-1 flex flex-col gap-1">
            {recentBets.slice(0, 3).map((bet) => (
              <div key={bet.id} className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-white/30">
                  #{bet.betId.toString().slice(-6)}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                    getBetStateClass(bet.state)
                  )}
                >
                  {getBetStateLabel(bet.state)}
                </span>
              </div>
            ))}
          </div>
        )}
        {gameHistory.length === 0 && recentBets.length === 0 && (
          <span className="text-[10px] text-white/10 px-2 py-1">Waiting for first play...</span>
        )}
      </div>
    </div>
  );
}
