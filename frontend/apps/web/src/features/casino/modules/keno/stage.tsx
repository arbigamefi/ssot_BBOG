import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@ssot/ui";
import { useTranslations } from "next-intl";

import { KenoDrawMachine } from "./keno-machine";

function pickKenoSpots(count: number): number[] {
  const spots: number[] = [];
  while (spots.length < count) {
    const n = Math.floor(Math.random() * 40) + 1;
    if (!spots.includes(n)) spots.push(n);
  }
  return spots.sort((a, b) => a - b);
}

export function KenoStage({
  isPending,
  isRevealing,
  showResult,
  spots,
  animatingSpots,
  resultDrawn,
  onChange,
  onResetResult,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  spots: readonly number[];
  animatingSpots: readonly number[];
  resultDrawn: readonly number[];
  onChange: (spots: number[]) => void;
  onResetResult: () => void;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const controlsDisabled = isPending || isRevealing || showResult;
  const resultKey = resultDrawn.join(",");
  const [revealedCount, setRevealedCount] = React.useState(() =>
    showResult ? resultDrawn.length : 0
  );
  const visibleDrawn = isRevealing ? resultDrawn.slice(0, revealedCount) : resultDrawn;

  React.useEffect(() => {
    if (!isRevealing || resultDrawn.length === 0) {
      setRevealedCount(showResult ? resultDrawn.length : 0);
      return;
    }

    setRevealedCount(0);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(callback, delay);
      timeouts.push(timeout);
    };

    if (prefersReducedMotion) {
      setRevealedCount(resultDrawn.length);
      schedule(() => onRevealComplete?.(), 180);
      return () => {
        timeouts.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    resultDrawn.forEach((_, index) => {
      schedule(() => setRevealedCount(index + 1), 240 + index * 280);
    });
    schedule(() => onRevealComplete?.(), 240 + resultDrawn.length * 280 + 260);

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [
    isRevealing,
    onRevealComplete,
    prefersReducedMotion,
    resultDrawn.length,
    resultKey,
    showResult
  ]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-5 pb-6 pt-10">
      <div className="relative z-20 mb-4 flex w-full max-w-[820px] flex-col gap-3 rounded-xl border border-border bg-surface-1/90 p-4 shadow-e2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-3xl font-semibold text-fg">
            {spots.length}{" "}
            <span className="text-sm uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.selection.keno.spotsLabel")}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {spots.length === 0
              ? t("casino.room.selection.keno.empty")
              : [...spots].sort((a, b) => a - b).join(" / ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => {
              onChange(pickKenoSpots(10));
              onResetResult();
            }}
            className="rounded-lg border border-brand/40 bg-brand-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand transition-colors hover:bg-brand/20 disabled:cursor-default disabled:opacity-50"
          >
            {t("casino.room.selection.keno.autoPick")}
          </button>
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => {
              onChange([]);
              onResetResult();
            }}
            className="rounded-lg border border-border bg-surface-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50"
          >
            {t("casino.room.selection.keno.clear")}
          </button>
        </div>
      </div>

      <div className="relative z-20 mb-4 w-full max-w-[820px] overflow-hidden rounded-xl border border-border bg-surface-1/90 p-3 shadow-e2 backdrop-blur-xl">
        <div className="mb-3">
          <KenoDrawMachine
            drawn={visibleDrawn}
            spots={spots}
            agitated={isPending || Boolean(isRevealing)}
            animateEntry={Boolean(isRevealing)}
            reduced={Boolean(prefersReducedMotion)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {Array.from({ length: Math.max(5, spots.length + 1) }).map((_, hits) => {
            const pay =
              hits === 0 ? 0 : Math.pow(Math.max(1, hits - Math.floor(spots.length / 3)), 1.8);
            const isCurrentTarget = spots.length > 0 && hits === spots.length;
            return (
              <div
                key={hits}
                className={cn(
                  "flex h-14 min-w-[66px] flex-col items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color]",
                  isCurrentTarget
                    ? "border-brand bg-brand-soft shadow-e2"
                    : pay > 0
                      ? "border-border-soft bg-surface-2"
                      : "bg-transparent border-transparent opacity-40"
                )}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase font-semibold tracking-widest mb-1",
                    isCurrentTarget ? "text-brand" : "text-fg-subtle"
                  )}
                >
                  {hits} Hits
                </span>
                <span
                  className={cn(
                    "text-sm font-mono font-semibold",
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
          "relative z-10 w-full max-w-[820px] rounded-xl border border-border bg-surface-1/95 p-5 shadow-e3 backdrop-blur-xl md:p-8",
          isPending ? "opacity-95" : ""
        )}
      >
        <div className="grid grid-cols-8 md:grid-cols-10 gap-3 relative z-10">
          {Array.from({ length: 40 }).map((_, i) => {
            const n = i + 1;
            const isSelected = spots.includes(n);
            const isAnimating = isPending && animatingSpots.includes(n);
            const isRevealDraw = isRevealing && visibleDrawn.at(-1) === n;
            const isDrawnWinner =
              !isPending && showResult && visibleDrawn.includes(n) && isSelected;
            const isDrawnMiss = !isPending && showResult && visibleDrawn.includes(n) && !isSelected;
            const isMissedPick =
              !isPending && showResult && !isRevealing && !visibleDrawn.includes(n) && isSelected;

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
                  "group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 font-mono text-xl font-semibold transition-[border-color,background-color,color] md:text-2xl",
                  isRevealDraw
                    ? "z-30 animate-[keno-ball-reveal_320ms_ease-out] border-accent bg-accent text-fg-inverse shadow-e2"
                    : isAnimating
                      ? "z-20 border-brand bg-brand text-fg-inverse shadow-e2 duration-75"
                      : isDrawnWinner
                        ? "z-30 border-success bg-success text-fg-inverse shadow-e2 animate-[pulse_1s_ease-in-out_infinite]"
                        : isDrawnMiss
                          ? "z-20 border-border bg-surface-3 text-fg shadow-e2"
                          : isMissedPick
                            ? "border-brand/20 bg-brand-soft text-brand opacity-50 shadow-inner"
                            : isSelected
                              ? "z-10 border-brand bg-brand text-fg-inverse shadow-e2"
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
      </div>
    </div>
  );
}
