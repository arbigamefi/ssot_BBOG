import * as React from "react";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "../../room/params";

/**
 * DiceBar — the threshold control beneath the hero die.
 *
 * Single horizontal bar: a coloured win/lose split at the threshold, with a
 * draggable handle. It is purely the "pick your line" control — the rolled
 * result is shown on the 3D die, not here, so this bar stays calm.
 *
 * The native range input is layered invisibly on top so keyboard and pointer
 * both drive the threshold; the visible handle is rendered under it.
 */

const TICKS = [0, 25, 50, 75, 100];

export function DiceBar({
  direction,
  target,
  isLocked,
  onTargetChange,
  targetAriaLabel
}: {
  direction: DiceDirection;
  target: number;
  isLocked: boolean;
  onTargetChange: (target: number) => void;
  targetAriaLabel: string;
}) {
  const winLeft = direction === "under" ? 0 : target;
  const winWidth = direction === "under" ? target : 100 - target;
  const loseLeft = direction === "under" ? target : 0;
  const loseWidth = direction === "under" ? 100 - target : target;

  return (
    <div className="w-full select-none">
      <div className="relative h-16">
        {/* Track: win zone + lose zone split at the threshold. */}
        <div className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-full border border-border bg-surface-0">
          <div
            className="absolute inset-y-0 bg-success/85 transition-[left,width] duration-200 ease-out"
            style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
          />
          <div
            className="absolute inset-y-0 bg-danger/75 transition-[left,width] duration-200 ease-out"
            style={{ left: `${loseLeft}%`, width: `${loseWidth}%` }}
          />
        </div>

        <input
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={isLocked}
          aria-label={targetAriaLabel}
          onChange={(e) => onTargetChange(Number.parseInt(e.target.value, 10))}
          className="absolute inset-x-0 top-1/2 z-30 h-10 w-full -translate-y-1/2 cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
        />

        {/* Visible threshold handle. */}
        <div
          aria-hidden
          className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-200 ease-out"
          style={{ left: `${target}%` }}
        >
          <div
            className={cn(
              "flex h-11 w-6 items-center justify-center rounded-md border-2 border-brand bg-surface-1 shadow-e2",
              isLocked && "opacity-70"
            )}
          >
            <span className="flex gap-[3px]">
              <span className="h-4 w-[2px] rounded-full bg-brand/60" />
              <span className="h-4 w-[2px] rounded-full bg-brand/60" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-1 flex justify-between font-mono text-[10px] font-medium tabular-nums text-fg-subtle">
        {TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}
