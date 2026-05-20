import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "../../room/params";
import { DiceCubeDisplay } from "./dice-cube-display";
import { DiceRangeControl } from "./dice-range-control";

function clampRoll(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function DiceRollMeter({
  isRevealing,
  showResult,
  resultNum,
  diceDirection,
  diceTarget
}: {
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const finalRoll = clampRoll(resultNum);
  const [displayRoll, setDisplayRoll] = React.useState(() =>
    showResult && resultNum != null ? finalRoll : diceTarget
  );
  const resultVisible = showResult && resultNum != null;
  const won =
    resultNum == null
      ? false
      : diceDirection === "under"
        ? finalRoll <= diceTarget
        : finalRoll > diceTarget;

  React.useEffect(() => {
    if (!isRevealing || resultNum == null) {
      setDisplayRoll(showResult && resultNum != null ? finalRoll : diceTarget);
      return;
    }

    if (prefersReducedMotion) {
      setDisplayRoll(finalRoll);
      return;
    }

    let frame = 0;
    const interval = window.setInterval(() => {
      frame += 1;
      const phase = frame / 16;
      if (phase >= 1) {
        setDisplayRoll(finalRoll);
        window.clearInterval(interval);
        return;
      }
      const wave = Math.sin(phase * Math.PI * 4) * (1 - phase) * 26;
      const drift = diceTarget + (finalRoll - diceTarget) * phase;
      setDisplayRoll(clampRoll(drift + wave));
    }, 80);

    return () => window.clearInterval(interval);
  }, [diceTarget, finalRoll, isRevealing, prefersReducedMotion, resultNum, showResult]);

  return (
    <div className="relative z-20 mt-6 w-full max-w-3xl px-6" aria-label="Dice roll meter">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-1/90 px-5 py-4 shadow-e2 backdrop-blur-xl">
        <div className="relative h-20">
          <div className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-full border-2 border-border-soft bg-surface-0 shadow-inner-e1">
            <div
              className={cn(
                "absolute inset-y-0",
                diceDirection === "under" ? "bg-success" : "bg-danger"
              )}
              style={{ left: "0%", width: `${diceTarget}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0",
                diceDirection === "under" ? "bg-danger" : "bg-success"
              )}
              style={{ left: `${diceTarget}%`, width: `${100 - diceTarget}%` }}
            />
          </div>

          <div
            className="absolute top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-brand bg-fg font-mono text-xl font-semibold text-surface-0 shadow-e3 transition-[left,transform] duration-200 ease-out"
            style={{ left: `${displayRoll}%` }}
          >
            {displayRoll}
          </div>

          <div
            className="absolute top-1/2 z-0 h-14 w-px -translate-y-1/2 bg-fg/55"
            style={{ left: `${diceTarget}%` }}
            aria-hidden
          />
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 font-mono text-xs font-semibold text-fg-subtle">
          <span>1</span>
          <span
            className={cn(
              "rounded-full border px-3 py-1 uppercase tracking-[0.16em]",
              resultVisible
                ? won
                  ? "border-success/40 bg-success-soft text-success"
                  : "border-danger/40 bg-danger-soft text-danger"
                : "border-border bg-surface-0 text-fg-subtle"
            )}
          >
            {diceDirection === "under" ? `≤ ${diceTarget}` : `> ${diceTarget}`}
          </span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

export function DiceStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
  onRevealComplete?: () => void;
}) {
  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 1_600);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-8 pt-12 md:pt-16">
      <DiceCubeDisplay
        isPending={isPending || Boolean(isRevealing)}
        showResult={showResult && !isRevealing}
        resultNum={resultNum}
        targetNum={diceTarget}
      />
      {(isRevealing || (showResult && resultNum != null)) && (
        <DiceRollMeter
          isRevealing={isRevealing}
          showResult={showResult}
          resultNum={resultNum}
          diceDirection={diceDirection}
          diceTarget={diceTarget}
        />
      )}
      <DiceRangeControl
        isPending={isPending || Boolean(isRevealing)}
        diceDirection={diceDirection}
        diceTarget={diceTarget}
        multiplier={multiplier}
        winChance={winChance}
        onDirectionChange={onDirectionChange}
        onTargetChange={onTargetChange}
      />
    </div>
  );
}
