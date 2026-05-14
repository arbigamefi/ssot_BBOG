import * as React from "react";
import { cn } from "@ssot/ui";

export function KenoStage({
  isPending,
  showResult,
  spots,
  animatingSpots,
  resultDrawn,
  onChange,
  onResetResult
}: {
  isPending: boolean;
  showResult: boolean;
  spots: readonly number[];
  animatingSpots: readonly number[];
  resultDrawn: readonly number[];
  onChange: (spots: number[]) => void;
  onResetResult: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-[800px] mb-8 bg-[#0a0a0a]/90 backdrop-blur-3xl rounded-[2rem] border border-white/10 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative z-20">
        <div className="absolute top-0 left-0 bottom-0 w-32 bg-gradient-to-r from-fuchsia-900/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <div
            className="text-[10px] text-fuchsia-500/70 font-black uppercase tracking-widest mr-4 flex-shrink-0"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Payouts
          </div>
          {Array.from({ length: Math.max(5, spots.length + 1) }).map((_, hits) => {
            const pay =
              hits === 0 ? 0 : Math.pow(Math.max(1, hits - Math.floor(spots.length / 3)), 1.8);
            const isCurrentTarget = spots.length > 0 && hits === spots.length;
            return (
              <div
                key={hits}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[70px] h-16 rounded-[1rem] border-2 transition-all",
                  isCurrentTarget
                    ? "bg-fuchsia-600/20 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.3)] scale-105"
                    : pay > 0
                      ? "bg-[#111] border-white/5"
                      : "bg-transparent border-transparent opacity-40"
                )}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase font-bold tracking-widest mb-1",
                    isCurrentTarget ? "text-fuchsia-300" : "text-white/40"
                  )}
                >
                  {hits} Hits
                </span>
                <span
                  className={cn(
                    "text-sm font-mono font-black",
                    isCurrentTarget
                      ? "text-white drop-shadow-[0_0_8px_white]"
                      : pay > 0
                        ? "text-fuchsia-400"
                        : "text-white/20"
                  )}
                >
                  {pay.toFixed(2)}x
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 w-full max-w-[800px] bg-[#050505]/95 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_2px_20px_rgba(255,255,255,0.05)] transition-all",
          isPending ? "scale-[0.98] drop-shadow-[0_0_50px_rgba(217,70,239,0.2)]" : ""
        )}
      >
        <div className="grid grid-cols-8 md:grid-cols-10 gap-3 relative z-10">
          {Array.from({ length: 40 }).map((_, i) => {
            const n = i + 1;
            const isSelected = spots.includes(n);
            const isAnimating = isPending && animatingSpots.includes(n);
            const isDrawnWinner = !isPending && showResult && resultDrawn.includes(n) && isSelected;
            const isDrawnMiss = !isPending && showResult && resultDrawn.includes(n) && !isSelected;
            const isMissedPick = !isPending && showResult && !resultDrawn.includes(n) && isSelected;

            return (
              <button
                key={n}
                disabled={isPending || showResult}
                onClick={() => {
                  if (isSelected) onChange(spots.filter((x) => x !== n));
                  else if (spots.length < 10) onChange([...spots, n]);
                  onResetResult();
                }}
                className={cn(
                  "aspect-square rounded-2xl flex items-center justify-center font-mono font-black text-xl md:text-2xl transition-all border-2 relative overflow-hidden group",
                  isAnimating
                    ? "bg-fuchsia-400 text-black shadow-[0_0_30px_rgba(217,70,239,0.8),inset_0_0_10px_white] z-20 scale-110 border-white duration-75"
                    : isDrawnWinner
                      ? "bg-emerald-500 border-white text-black shadow-[0_0_40px_rgba(16,185,129,0.8),inset_0_0_15px_white] scale-110 z-30 animate-[pulse_1s_ease-in-out_infinite]"
                      : isDrawnMiss
                        ? "bg-white/20 border-white/40 text-white z-20 shadow-lg scale-105"
                        : isMissedPick
                          ? "bg-fuchsia-900/40 border-fuchsia-900 text-fuchsia-800 opacity-50 shadow-inner scale-95"
                          : isSelected
                            ? "bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 text-white border-fuchsia-300 shadow-[0_10px_20px_rgba(217,70,239,0.4),inset_0_2px_10px_rgba(255,255,255,0.2)] hover:scale-105 hover:-translate-y-1 z-10"
                            : "bg-[#0B0B0B] border-white/5 text-white/20 hover:bg-[#1f1f1f] hover:border-white/20 hover:text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                )}
              >
                <span className="relative z-10 drop-shadow-md">{n}</span>
                {isSelected && !isDrawnWinner && !isMissedPick && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {!isPending && !showResult && spots.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-[#050505]/80 backdrop-blur-xl px-12 py-5 rounded-full border border-white/10 text-white/50 font-black tracking-[0.4em] uppercase text-sm shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
              Select 1 to 10 Spots
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
