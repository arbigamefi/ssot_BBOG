import * as React from "react";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "./params";

export function DiceRangeControl({
  isPending,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange
}: {
  isPending: boolean;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
}) {
  return (
    <div className="absolute bottom-12 w-full max-w-3xl px-6 z-20">
      <div className="bg-[#050505]/95 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.8),inset_0_2px_15px_rgba(255,255,255,0.05)] flex flex-col gap-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />

        <div className="flex justify-between items-center relative z-10 px-4">
          <div className="flex bg-[#0a0a0a] p-1.5 rounded-2xl border border-white/10 relative h-12 w-64 shadow-inner">
            <div
              className={cn(
                "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 shadow-md",
                diceDirection === "under"
                  ? "bg-purple-600 left-1.5"
                  : "bg-emerald-600 left-[calc(50%+4px)]"
              )}
            />
            <button
              onClick={() => onDirectionChange("under")}
              className={cn(
                "flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px] relative z-10 transition-colors",
                diceDirection === "under" ? "text-white" : "text-white/40"
              )}
            >
              Roll Under
            </button>
            <button
              onClick={() => onDirectionChange("over")}
              className={cn(
                "flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px] relative z-10 transition-colors",
                diceDirection === "over" ? "text-white" : "text-white/40"
              )}
            >
              Roll Over
            </button>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase font-black tracking-widest block mb-1">
              Target Range
            </span>
            <div className="flex items-center gap-2 bg-[#0a0a0a] px-4 py-1.5 rounded-xl border border-white/5 font-mono">
              <span className="text-gray-500">0</span>
              <span className="text-purple-400 font-bold">
                {diceDirection === "under" ? `< ${diceTarget}` : `> ${diceTarget}`}
              </span>
              <span className="text-gray-500">100</span>
            </div>
          </div>
        </div>

        <div className="relative h-28 flex items-center group mt-4 mb-2 mx-4 z-20">
          <div className="absolute inset-x-0 h-6 bg-[#030303] rounded-full border-[3px] border-white/5 overflow-hidden shadow-[inset_0_4px_10px_rgba(0,0,0,1)]">
            <div
              className={cn(
                "absolute inset-y-0 transition-all ease-out",
                diceDirection === "under"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_20px_emerald]"
                  : "bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_20px_red]"
              )}
              style={{ left: "0%", width: `${diceTarget}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0 transition-all ease-out",
                diceDirection === "under"
                  ? "bg-gradient-to-r from-red-400 to-red-600 shadow-[0_0_20px_red]"
                  : "bg-gradient-to-r from-emerald-300 to-emerald-500 shadow-[0_0_20px_emerald]"
              )}
              style={{ left: `${diceTarget}%`, width: `${100 - diceTarget}%` }}
            />
          </div>

          <input
            type="range"
            min="2"
            max="98"
            value={diceTarget}
            onChange={(e) => onTargetChange(parseInt(e.target.value))}
            disabled={isPending}
            className="absolute inset-x-0 w-full h-[60px] opacity-0 cursor-ew-resize z-30"
          />

          <div
            className="absolute z-10 w-24 h-24 -ml-12 flex flex-col items-center justify-center transition-all ease-out pointer-events-none"
            style={{ left: `${diceTarget}%` }}
          >
            <div className="absolute bottom-[80%] bg-[#0f0f0f]/95 backdrop-blur-md rounded-2xl py-3 px-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)] border border-purple-500/40 flex flex-col items-center min-w-[130px] scale-100 group-hover:scale-[1.15] transition-transform mb-4">
              <span className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1 shadow-sm">
                Target
              </span>
              <span className="font-mono text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {diceTarget}
              </span>

              <div className="flex gap-4 mt-2 pt-2 border-t border-white/10 w-full justify-between px-1">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-white/30 tracking-widest uppercase font-bold">
                    Mult
                  </span>
                  <span className="text-[11px] font-mono text-purple-400 font-black">
                    {multiplier.toFixed(2)}x
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-white/30 tracking-widest uppercase font-bold">
                    Win
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-black">
                    {winChance.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-transparent border-t-[#0f0f0f] filter drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" />
            </div>

            <div
              className={cn(
                "w-10 h-10 rounded-full border-[6px] shadow-[0_0_30px_rgba(0,0,0,0.8)] outline outline-2 outline-black/30 bg-white group-hover:bg-purple-100 transition-colors flex items-center justify-center",
                diceDirection === "under" ? "border-purple-500" : "border-emerald-500"
              )}
            >
              <div className="flex gap-0.5">
                <div className="w-[2px] h-3 bg-black/20 rounded-full" />
                <div className="w-[2px] h-3 bg-black/20 rounded-full" />
                <div className="w-[2px] h-3 bg-black/20 rounded-full" />
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 inset-x-4 flex justify-between text-[9px] font-black text-white/20 px-1 font-mono tracking-widest">
            {[0, 25, 50, 75, 100].map((val) => (
              <div key={val} className="flex flex-col items-center opacity-70">
                <div className="w-0.5 h-1.5 bg-white/20 mb-1 rounded-full" />
                {val}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
