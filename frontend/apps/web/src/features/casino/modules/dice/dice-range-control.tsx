import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "../../room/params";

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
  const t = useTranslations();

  return (
    <div className="absolute bottom-8 z-20 w-full max-w-3xl px-6">
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-xl border border-border bg-surface-1/95 p-4 shadow-e2 backdrop-blur-3xl sm:gap-6 sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="relative flex h-12 w-full rounded-lg border border-border bg-surface-2 p-1.5 shadow-e1 sm:w-64">
            <div
              className={cn(
                "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-md bg-brand shadow-e2 transition-[left] duration-300",
                diceDirection === "under" ? "left-1.5" : "left-[calc(50%+4px)]"
              )}
            />
            <button
              onClick={() => onDirectionChange("under")}
              className={cn(
                "relative z-10 flex-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
                diceDirection === "under" ? "text-fg-inverse" : "text-fg-subtle"
              )}
            >
              {t("casino.room.selection.dice.rollUnder")}
            </button>
            <button
              onClick={() => onDirectionChange("over")}
              className={cn(
                "relative z-10 flex-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
                diceDirection === "over" ? "text-fg-inverse" : "text-fg-subtle"
              )}
            >
              {t("casino.room.selection.dice.rollOver")}
            </button>
          </div>

          <div className="flex flex-col items-start sm:items-end sm:text-right">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              {t("casino.room.selection.dice.targetRange")}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-4 py-1.5 font-mono">
              <span className="text-fg-subtle">0</span>
              <span className="font-bold text-brand">
                {diceDirection === "under" ? `≤ ${diceTarget}` : `> ${diceTarget}`}
              </span>
              <span className="text-fg-subtle">100</span>
            </div>
          </div>
        </div>

        <div className="group relative z-20 mx-2 mb-2 mt-1 flex h-20 items-center sm:mx-4 sm:mt-2 sm:h-24">
          <div className="absolute inset-x-0 h-6 overflow-hidden rounded-full border-[3px] border-border-soft bg-surface-0 shadow-e1">
            <div
              className={cn(
                "absolute inset-y-0 transition-[left,width] ease-out",
                diceDirection === "under" ? "bg-success" : "bg-danger"
              )}
              style={{ left: "0%", width: `${diceTarget}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0 transition-[left,width] ease-out",
                diceDirection === "under" ? "bg-danger" : "bg-success"
              )}
              style={{ left: `${diceTarget}%`, width: `${100 - diceTarget}%` }}
            />
          </div>

          <input
            type="range"
            aria-label={t("casino.room.selection.dice.targetAria")}
            min="2"
            max="98"
            value={diceTarget}
            onChange={(e) => onTargetChange(parseInt(e.target.value))}
            disabled={isPending}
            className="absolute inset-x-0 w-full h-[60px] opacity-0 cursor-ew-resize z-30"
          />

          <div
            className="absolute z-10 flex h-24 w-24 -ml-12 flex-col items-center justify-center transition-[left] ease-out pointer-events-none"
            style={{ left: `${diceTarget}%` }}
          >
            <div className="absolute bottom-[80%] mb-4 hidden min-w-[130px] flex-col items-center rounded-lg border border-brand/35 bg-surface-1/95 px-4 py-3 shadow-e2 backdrop-blur-md sm:flex">
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                {t("casino.room.selection.dice.target")}
              </span>
              <span className="font-mono text-4xl font-semibold text-fg">{diceTarget}</span>

              <div className="mt-2 flex w-full justify-between gap-4 border-t border-border-soft px-1 pt-2">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-fg-subtle">
                    {t("casino.room.selection.dice.multiplier")}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-brand">
                    {multiplier.toFixed(2)}x
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-fg-subtle">
                    {t("casino.room.selection.dice.winChance")}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-accent">
                    {winChance.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[10px] border-transparent border-t-surface-1" />
            </div>

            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-[6px] bg-fg shadow-e2 outline outline-2 outline-surface-0/30 transition-colors group-hover:bg-brand/20",
                diceDirection === "under" ? "border-brand" : "border-accent"
              )}
            >
              <div className="flex gap-0.5">
                <div className="h-3 w-[2px] rounded-full bg-surface-0/20" />
                <div className="h-3 w-[2px] rounded-full bg-surface-0/20" />
                <div className="h-3 w-[2px] rounded-full bg-surface-0/20" />
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 inset-x-4 flex justify-between px-1 font-mono text-[9px] font-semibold tracking-widest text-fg-subtle/70">
            {[0, 25, 50, 75, 100].map((val) => (
              <div key={val} className="flex flex-col items-center opacity-70">
                <div className="mb-1 h-1.5 w-0.5 rounded-full bg-border" />
                {val}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
