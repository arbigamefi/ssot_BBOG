import * as React from "react";
import { cn } from "@ssot/ui";

import type { CoinSide } from "./params";

export function GameRoomResultOverlay({
  gameSlug,
  coinSide,
  resultNum,
  expectedPayout
}: {
  gameSlug: string;
  coinSide: CoinSide;
  resultNum: number | null;
  expectedPayout: number;
}) {
  return (
    <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in pointer-events-auto">
      <div className="p-12 rounded-[4rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden transition-all scale-110">
        <div className="absolute inset-0 blur-[100px] opacity-20 bg-emerald-500 animate-pulse" />
        <h3 className="text-xl font-bold text-white/40 uppercase tracking-[0.3em] mb-6">
          Verification Success
        </h3>
        <div
          className={cn(
            "text-7xl font-mono font-black mb-8 w-64 h-36 rounded-[2.5rem] flex items-center justify-center border-4 bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(52,211,153,0.3)]"
          )}
        >
          {gameSlug === "coin-toss"
            ? coinSide === "TAILS"
              ? "TAILS"
              : "HEADS"
            : (resultNum ?? 42)}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-emerald-400 font-black text-lg tracking-widest mb-2 flex items-center gap-2">
            DIRECT PREDICTION HIT{" "}
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_emerald]" />
          </span>
          <span className="text-5xl font-mono text-white font-black">
            +{expectedPayout.toFixed(2)} <span className="text-xl opacity-30">USDC</span>
          </span>
        </div>
      </div>
    </div>
  );
}
