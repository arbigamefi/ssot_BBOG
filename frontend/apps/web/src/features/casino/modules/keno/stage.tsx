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
// ones readable without overflowing the payout chip.
function formatKenoPay(multiplier: number): string {
  if (multiplier >= 1000) return `${Math.round(multiplier).toLocaleString("en-US")}x`;
  return `${multiplier.toFixed(2)}x`;
}

/** Hairline section divider that fades out at both ends. */
function Divider() {
  return (
    <div
      aria-hidden
      className="mx-5 h-px"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)" }}
    />
  );
}

type KenoCellState =
  | "idle"
  | "selected"
  | "shuffling"
  | "revealing"
  | "win"
  | "drawnMiss"
  | "missedPick";

const CELL_CLASS: Record<KenoCellState, string> = {
  idle: "bg-surface-3 text-fg-muted shadow-e1 ring-1 ring-inset ring-border-soft",
  selected: "-translate-y-0.5 bg-brand text-fg-inverse shadow-glow ring-1 ring-inset ring-brand",
  shuffling: "bg-brand/80 text-fg-inverse ring-1 ring-inset ring-brand",
  revealing:
    "-translate-y-0.5 animate-[keno-ball-reveal_320ms_ease-out] bg-accent text-fg-inverse ring-1 ring-inset ring-accent",
  win: "-translate-y-0.5 animate-[keno-ball-reveal_360ms_ease-out] bg-success text-fg-inverse",
  drawnMiss: "bg-surface-2 text-fg ring-1 ring-inset ring-accent/70",
  missedPick: "bg-brand-soft text-brand opacity-55 ring-1 ring-inset ring-brand/25"
};

// Colour glows can't come from the token shadow scale (it is brand-only), so
// the success/accent blooms are inline — still token-driven, no hex literals.
const CELL_GLOW: Partial<Record<KenoCellState, string>> = {
  win: "0 0 0 1px hsl(var(--success) / 0.6), 0 12px 28px -6px hsl(var(--success) / 0.5)",
  revealing: "0 0 0 1px hsl(var(--accent) / 0.6), 0 12px 28px -6px hsl(var(--accent) / 0.5)"
};

function KenoCell({
  n,
  state,
  disabled,
  onClick
}: {
  n: number;
  state: KenoCellState;
  disabled: boolean;
  onClick: () => void;
}) {
  const glow = CELL_GLOW[state];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={glow ? { boxShadow: glow } : undefined}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg font-mono text-2xl font-bold transition-[transform,box-shadow,background-color,color] duration-150 md:text-[1.7rem]",
        CELL_CLASS[state],
        state === "idle" && !disabled
          ? "hover:-translate-y-0.5 hover:text-fg hover:shadow-e2 hover:ring-brand/40"
          : "",
        disabled && "cursor-default"
      )}
    >
      <span className="drop-shadow-sm">{n}</span>
    </button>
  );
}

/**
 * Payout reference: one chip per possible hit count for the current pick size.
 * While picking it marks the all-hit jackpot chip; once a draw settles it marks
 * the chip actually landed on. Multipliers come from the on-chain gain table.
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
    <div
      className={cn("flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1", className)}
    >
      {Array.from({ length: spots.length + 1 }).map((_, hits) => {
        const pay = kenoMultiplier(spots.length, hits);
        const isSettled = settledHits === hits;
        const isTarget = settledHits == null && hits === spots.length;
        return (
          <div
            key={hits}
            style={
              isSettled
                ? {
                    boxShadow:
                      "0 0 0 1px hsl(var(--accent) / 0.55), 0 8px 20px -6px hsl(var(--accent) / 0.4)"
                  }
                : undefined
            }
            className={cn(
              "flex min-w-[58px] shrink-0 flex-col items-center justify-center rounded-lg px-3 py-1 transition-[background-color,box-shadow]",
              isSettled
                ? "bg-surface-3"
                : isTarget
                  ? "bg-brand-soft ring-1 ring-inset ring-brand/40"
                  : "bg-surface-2"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                isSettled ? "text-accent" : isTarget ? "text-brand" : "text-fg-subtle"
              )}
            >
              {hitLabel(hits)}
            </span>
            <span
              className={cn(
                "font-mono text-sm font-bold",
                isSettled || isTarget ? "text-fg" : "text-fg-muted"
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
  // Hit count actually achieved once the draw has settled — used to mark the
  // matching payout chip so the odds table connects to the result.
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
    <div className="absolute inset-0 z-10 overflow-y-auto custom-scrollbar">
      {/* Stage atmosphere — a top-down lift and a soft brand bloom so the scene
          reads as a lit space rather than flat black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 80% at 50% -8%, hsl(var(--surface-2)), hsl(var(--surface-0)) 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[440px] w-[660px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.13), transparent 68%)" }}
      />

      {/* One cohesive console rather than a stack of detached cards. */}
      <div className="relative flex min-h-full items-center justify-center px-4 py-3">
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          {/* top edge sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />

          {/* Header — pick count, selection, and quick actions. */}
          <div className="flex items-center justify-between gap-3 px-5 pb-2.5 pt-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold leading-none text-fg">
                  {spots.length}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                  {t("casino.room.selection.keno.spotsLabel")}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-fg-muted">
                {spots.length === 0
                  ? t("casino.room.selection.keno.empty")
                  : [...spots].sort((a, b) => a - b).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => {
                  onChange(pickKenoSpots(5));
                  onResetResult();
                }}
                className="rounded-md bg-brand-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand/20 disabled:opacity-40"
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
                className="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted ring-1 ring-inset ring-border transition-colors hover:text-fg disabled:opacity-40"
              >
                {t("casino.room.selection.keno.clear")}
              </button>
            </div>
          </div>

          <Divider />

          {/* Draw machine — lights up while a draw is live. The ~396px machine
              row is uniformly scaled down on phones so it never overflows the
              console; physics/animation are untouched (scale is a transform). */}
          <div className="flex justify-center px-5 py-3">
            <div className="relative h-[80px] w-[246px] sm:h-[128px] sm:w-[396px]">
              <div className="absolute left-0 top-0 origin-top-left scale-[0.62] sm:scale-100">
                <KenoDrawMachine
                  drawn={visibleDrawn}
                  spots={spots}
                  agitated={isPending || Boolean(isRevealing)}
                  animateEntry={Boolean(isRevealing)}
                  reduced={Boolean(prefersReducedMotion)}
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Number board — recessed playfield. */}
          <div className="px-5 py-3">
            <div
              className="rounded-lg p-2.5"
              style={{
                background: "hsl(var(--surface-0))",
                boxShadow: "inset 0 2px 12px hsl(var(--surface-0) / 0.55)"
              }}
            >
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 15 }).map((_, i) => {
                  const n = i + 1;
                  const isSelected = spots.includes(n);
                  const isShuffling = isPending && animatingSpots.includes(n);
                  const isRevealDraw = isRevealing && visibleDrawn.at(-1) === n;
                  const isDrawnWinner =
                    !isPending && showResult && visibleDrawn.includes(n) && isSelected;
                  const isDrawnMiss =
                    !isPending && showResult && visibleDrawn.includes(n) && !isSelected;
                  const isMissedPick =
                    !isPending &&
                    showResult &&
                    !isRevealing &&
                    !visibleDrawn.includes(n) &&
                    isSelected;

                  let state: KenoCellState = "idle";
                  if (isRevealDraw) state = "revealing";
                  else if (isShuffling) state = "shuffling";
                  else if (isDrawnWinner) state = "win";
                  else if (isDrawnMiss) state = "drawnMiss";
                  else if (isMissedPick) state = "missedPick";
                  else if (isSelected) state = "selected";

                  return (
                    <KenoCell
                      key={n}
                      n={n}
                      state={state}
                      disabled={isPending || showResult}
                      onClick={() => {
                        if (isSelected) onChange(spots.filter((x) => x !== n));
                        else if (spots.length < 5) onChange([...spots, n]);
                        onResetResult();
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {spots.length > 0 && (
            <>
              <Divider />
              <div className="px-3 pb-3 pt-2.5">
                <KenoPayoutTable
                  spots={spots}
                  settledHits={settledHits}
                  hitLabel={hitLabel}
                  className="justify-center"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
