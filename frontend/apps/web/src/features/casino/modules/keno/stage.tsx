import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@ssot/ui";
import { kenoMultiplier } from "@ssot/ssot/domain";
import { useTranslations } from "next-intl";

import { KenoDrawMachine } from "./keno-machine";

function pickKenoSpots(count: number): number[] {
  const spots: number[] = [];
  while (spots.length < count) {
    const n = Math.floor(Math.random() * 15) + 1;
    if (!spots.includes(n)) spots.push(n);
  }
  return spots.sort((a, b) => a - b);
}

// Keno multipliers span 0.42x to 500.5x — keep small ones precise and large
// ones readable without overflowing the payout tile.
function formatKenoPay(multiplier: number): string {
  if (multiplier >= 1000) return `${Math.round(multiplier).toLocaleString("en-US")}x`;
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Payout reference: one tile per possible hit count for the current pick size.
 * While picking it marks the all-hit jackpot row; once a draw settles it marks
 * the row actually landed on. Multipliers come from the on-chain gain table.
 */
function KenoPayoutTable({
  spots,
  settledHits,
  hitLabel,
  className
}: {
  spots: readonly number[];
  settledHits: number | null;
  hitLabel: (hits: number) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1", className)}>
      {Array.from({ length: spots.length + 1 }).map((_, hits) => {
        const pay = kenoMultiplier(spots.length, hits);
        const isSettled = settledHits === hits;
        const isTarget = settledHits == null && hits === spots.length;
        return (
          <div
            key={hits}
            className={cn(
              "flex h-14 min-w-[66px] flex-col items-center justify-center rounded-md border-2 transition-[border-color,background-color]",
              isSettled
                ? "border-accent bg-surface-3 shadow-e2"
                : isTarget
                  ? "border-brand bg-brand-soft shadow-e2"
                  : "border-border-soft bg-surface-2"
            )}
          >
            <span
              className={cn(
                "mb-1 text-[9px] font-semibold uppercase tracking-widest",
                isSettled ? "text-accent" : isTarget ? "text-brand" : "text-fg-subtle"
              )}
            >
              {hitLabel(hits)}
            </span>
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                isSettled || isTarget ? "text-fg" : "text-brand"
              )}
            >
              {formatKenoPay(pay)}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  const hitLabel = React.useCallback(
    (hits: number) => t("casino.room.selection.keno.hits", { hits }),
    [t]
  );
  const prefersReducedMotion = useReducedMotion();
  const controlsDisabled = isPending || isRevealing || showResult;
  const resultKey = resultDrawn.join(",");
  const [revealedCount, setRevealedCount] = React.useState(() =>
    showResult ? resultDrawn.length : 0
  );
  const visibleDrawn = isRevealing ? resultDrawn.slice(0, revealedCount) : resultDrawn;
  // Protagonist by state: while picking, the 15-cell board leads and the
  // machine waits compactly; once a draw is live or its result is up, the
  // machine becomes the hero and the board recedes to a reference scoreboard.
  const phase: "pick" | "draw" = isPending || isRevealing || showResult ? "draw" : "pick";
  // Hit count actually achieved once the draw has settled — used to mark the
  // matching payout row so the odds table connects to the result.
  const settledHits =
    showResult && !isRevealing ? spots.filter((spot) => resultDrawn.includes(spot)).length : null;

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
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-y-auto custom-scrollbar px-5 pb-6 pt-10">
      <div className="relative z-20 mb-4 flex w-full max-w-[560px] shrink-0 flex-col gap-3 rounded-xl border border-border bg-surface-1/90 p-4 shadow-e2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
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
              onChange(pickKenoSpots(5));
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

      <div
        className={cn(
          "relative z-20 mb-4 w-full max-w-[560px] shrink-0 overflow-hidden rounded-xl border bg-surface-1/90 backdrop-blur-xl transition-[padding,box-shadow] duration-300",
          phase === "draw" ? "border-border-strong p-5 shadow-e3" : "border-border p-3 shadow-e1"
        )}
      >
        {phase === "draw" ? (
          <>
            <KenoDrawMachine
              drawn={visibleDrawn}
              spots={spots}
              agitated={isPending || Boolean(isRevealing)}
              animateEntry={Boolean(isRevealing)}
              reduced={Boolean(prefersReducedMotion)}
              variant="active"
            />
            {spots.length > 0 && (
              <KenoPayoutTable
                spots={spots}
                settledHits={settledHits}
                hitLabel={hitLabel}
                className="mt-3"
              />
            )}
          </>
        ) : (
          <div className="flex items-center gap-4 sm:gap-6">
            <KenoDrawMachine
              drawn={visibleDrawn}
              spots={spots}
              agitated={false}
              animateEntry={false}
              reduced={Boolean(prefersReducedMotion)}
              variant="idle"
            />
            {spots.length > 0 && (
              <KenoPayoutTable
                spots={spots}
                settledHits={settledHits}
                hitLabel={hitLabel}
                className="min-w-0 flex-1"
              />
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative z-10 w-full shrink-0 rounded-xl border border-border bg-surface-1/95 backdrop-blur-xl transition-[max-width,padding,box-shadow] duration-300",
          phase === "draw" ? "max-w-[440px] p-4 shadow-e1" : "max-w-[560px] p-5 shadow-e3"
        )}
      >
        <div className="grid grid-cols-5 gap-3 relative z-10">
          {Array.from({ length: 15 }).map((_, i) => {
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
                  else if (spots.length < 5) onChange([...spots, n]);
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
