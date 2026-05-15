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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-20 mb-8 w-full max-w-[800px] overflow-hidden rounded-xl border border-border bg-surface-1/90 p-4 shadow-e2 backdrop-blur-3xl">
        <div className="absolute bottom-0 left-0 top-0 w-32 bg-gradient-to-r from-brand/10 to-transparent pointer-events-none" />
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <div
            className="mr-4 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-brand"
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
                  "flex h-16 min-w-[70px] flex-col items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color]",
                  isCurrentTarget
                    ? "scale-105 border-brand bg-brand-soft shadow-e2"
                    : pay > 0
                      ? "border-border-soft bg-surface-2"
                      : "bg-transparent border-transparent opacity-40"
                )}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase font-bold tracking-widest mb-1",
                    isCurrentTarget ? "text-brand" : "text-fg-subtle"
                  )}
                >
                  {hits} Hits
                </span>
                <span
                  className={cn(
                    "text-sm font-mono font-black",
                    isCurrentTarget ? "text-fg" : pay > 0 ? "text-brand" : "text-fg-subtle"
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
          "relative z-10 w-full max-w-[800px] rounded-xl border border-border bg-surface-1/95 p-8 shadow-e3 backdrop-blur-3xl transition-transform md:p-12",
          isPending ? "scale-[0.98] shadow-glow" : ""
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
                  "group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 font-mono text-xl font-black transition-[transform,border-color,background-color,color] md:text-2xl",
                  isAnimating
                    ? "z-20 scale-110 border-brand bg-brand text-fg-inverse shadow-glow duration-75"
                    : isDrawnWinner
                      ? "z-30 scale-110 border-success bg-success text-fg-inverse shadow-glow animate-[pulse_1s_ease-in-out_infinite]"
                      : isDrawnMiss
                        ? "z-20 scale-105 border-border bg-surface-3 text-fg shadow-e2"
                        : isMissedPick
                          ? "scale-95 border-brand/20 bg-brand-soft text-brand opacity-50 shadow-inner"
                          : isSelected
                            ? "z-10 border-brand bg-brand text-fg-inverse shadow-e2 hover:-translate-y-1 hover:scale-105"
                            : "border-border-soft bg-surface-2 text-fg-subtle shadow-inner hover:border-border hover:bg-surface-3 hover:text-fg"
                )}
              >
                <span className="relative z-10 drop-shadow-md">{n}</span>
                {isSelected && !isDrawnWinner && !isMissedPick && (
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-0/20 to-transparent pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {!isPending && !showResult && spots.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="rounded-full border border-border bg-surface-1/80 px-12 py-5 text-sm font-black uppercase tracking-[0.4em] text-fg-muted shadow-e2 backdrop-blur-xl">
              Select 1 to 10 Spots
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
