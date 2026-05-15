import * as React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

export function BetAdvancedSection({
  advancedOpen,
  stopGain,
  stopLoss,
  onAdvancedOpenChange,
  onStopGainChange,
  onStopLossChange
}: {
  advancedOpen: boolean;
  stopGain: number;
  stopLoss: number;
  onAdvancedOpenChange: (open: boolean) => void;
  onStopGainChange: (amount: number) => void;
  onStopLossChange: (amount: number) => void;
}) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => onAdvancedOpenChange(!advancedOpen)}
        className="flex w-full items-center justify-between border-b border-border-soft pb-2 text-[10px] font-bold uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <span>Advanced</span>
        <ChevronDownIcon
          className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")}
        />
      </button>
      {advancedOpen && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              Stop Gain (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopGain}
              onChange={(event) => onStopGainChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-success/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-fg-subtle">
              Stop Loss (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopLoss}
              onChange={(event) => onStopLossChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-danger/40 focus:outline-none"
            />
          </div>
          {(stopGain > 0 || stopLoss > 0) && (
            <div className="col-span-2 font-mono text-[9px] text-fg-subtle">
              {stopGain > 0 && <span className="text-success">Gain stop at +{stopGain} USDC</span>}
              {stopGain > 0 && stopLoss > 0 && <span className="mx-2">|</span>}
              {stopLoss > 0 && <span className="text-danger">Loss stop at {stopLoss} USDC</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
