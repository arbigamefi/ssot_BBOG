"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface SharedBetSlipProps {
  /** The theme glow color class (e.g. "bg-purple-500/10") */
  glowColorClass?: string;
  /** Primary action color class (e.g. "bg-purple-600 hover:bg-purple-500") */
  primaryActionClass?: string;
  /** Inner content specifically for game-specific summaries (multipliers, chance, etc.) */
  summaryContent?: React.ReactNode;
  
  /** Quick pick chips (e.g. ['Min', '1/2', 'Max'] or ['10', '50', '100']) */
  quickChips?: string[];
  onQuickChip?: (chip: string) => void;
  
  /** Amount input control */
  amountValue?: string;
  onAmountChange?: (val: string) => void;
  
  /** Asset selection */
  assetSymbol?: string;
  assetOptions?: { address: string; symbol: string }[];
  selectedAsset?: string;
  onAssetChange?: (val: string) => void;
  balanceHint?: React.ReactNode;

  /** Action button */
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;

  /** Extra content rendered below the slip (e.g. advanced limits, rounds) */
  children?: React.ReactNode;
  className?: string;
}

export function SharedBetSlip({
  glowColorClass = "bg-blue-500/10",
  primaryActionClass = "bg-blue-600 hover:bg-blue-500",
  summaryContent,
  quickChips = ["Min", "1/2", "2x", "Max"],
  onQuickChip,
  amountValue,
  onAmountChange,
  assetSymbol = "USDC",
  assetOptions,
  selectedAsset,
  onAssetChange,
  balanceHint,
  actionLabel = "Connect to Play",
  actionDisabled = false,
  onAction,
  children,
  className,
}: SharedBetSlipProps) {
  const [mode, setMode] = useState<"Manual" | "Auto">("Manual");

  return (
    <div className={cn("rounded-2xl bg-[#0a0a0a] border border-white/10 p-5 flex flex-col gap-6", className)}>
      
      {/* Mode Switch */}
      <div className="flex rounded-lg bg-[#050505] p-1 border border-white/5">
        <button 
          onClick={() => setMode("Manual")}
          disabled
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-colors cursor-default",
            mode === "Manual" ? "text-white bg-white/10" : "text-white/40 hover:text-white"
          )}
        >
          Manual
        </button>
        <button 
          onClick={() => setMode("Auto")}
          disabled
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-colors cursor-not-allowed",
            mode === "Auto" ? "text-white bg-white/10" : "text-white/40 opacity-50"
          )}
        >
          Auto
        </button>
      </div>
      
      {/* Amount Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50 font-medium">Bet Amount</span>
          {balanceHint ? (
            <span className="text-white/60">{balanceHint}</span>
          ) : (
            <span className="text-white/60 font-mono">0.00 {assetSymbol}</span>
          )}
        </div>
        <div className="relative flex items-center bg-[#050505] border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
          <input 
            type="text" 
            value={amountValue} 
            onChange={(e) => onAmountChange?.(e.target.value)}
            className="w-full bg-transparent py-3 px-4 text-left font-mono font-bold text-lg focus:outline-none placeholder:text-white/20" 
            placeholder="0.00"
          />
          {assetOptions && assetOptions.length > 0 ? (
            <select
              value={selectedAsset}
              onChange={(e) => onAssetChange?.(e.target.value)}
              className="bg-transparent text-white/50 font-semibold text-sm outline-none px-3 cursor-pointer hover:text-white transition-colors"
            >
              {assetOptions.map((opt) => (
                <option key={opt.address} value={opt.address} className="bg-[#050505]">
                  {opt.symbol}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-white/30 font-semibold text-sm px-3">{assetSymbol}</div>
          )}
        </div>
      </div>

      {/* Quick Chips */}
      {quickChips && quickChips.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {quickChips.map((chip, idx) => (
            <button 
              key={idx} 
              onClick={() => onQuickChip?.(chip)}
              className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-bold text-white/70 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Game Specific Summary Area */}
      {summaryContent && (
        <div className={cn("flex flex-col gap-2 p-4 rounded-xl border opacity-90 relative overflow-hidden", glowColorClass)}>
          <div className="relative z-10">
            {summaryContent}
          </div>
        </div>
      )}

      {/* Children elements (Rounds slider, advanced limits, etc.) */}
      {children}

      {/* CTA */}
      <button 
        onClick={onAction}
        disabled={actionDisabled}
        className={cn(
          "w-full text-white py-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:-translate-y-0",
          primaryActionClass
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
}
