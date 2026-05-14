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
        className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-white/25 hover:text-white/50 transition-colors pb-2 border-b border-white/5"
      >
        <span>Advanced</span>
        <ChevronDownIcon
          className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")}
        />
      </button>
      {advancedOpen && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
              Stop Gain (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopGain}
              onChange={(event) => onStopGainChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-emerald-500/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
              Stop Loss (USDC)
            </label>
            <input
              type="number"
              min={0}
              value={stopLoss}
              onChange={(event) => onStopLossChange(Math.max(0, parseInt(event.target.value) || 0))}
              placeholder="0 = off"
              className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-red-500/40 focus:outline-none"
            />
          </div>
          {(stopGain > 0 || stopLoss > 0) && (
            <div className="col-span-2 text-[9px] text-white/20 font-mono">
              {stopGain > 0 && (
                <span className="text-emerald-400/50">Gain stop at +{stopGain} USDC</span>
              )}
              {stopGain > 0 && stopLoss > 0 && <span className="mx-2">|</span>}
              {stopLoss > 0 && (
                <span className="text-red-400/50">Loss stop at {stopLoss} USDC</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
