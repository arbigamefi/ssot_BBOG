"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface SharedBetSlipProps {
  topMeta?: React.ReactNode;
  amountHeaderValue?: React.ReactNode;
  inputAccessory?: React.ReactNode;
  /** Whether to render the slip header block */
  showHeader?: boolean;
  /** Small uppercase label above the slip */
  slipLabel?: string;
  /** Primary slip heading */
  slipTitle?: string;
  /** Supporting slip copy */
  slipDescription?: string;
  /** The theme glow color class (e.g. "bg-purple-500/10") */
  glowColorClass?: string;
  /** Primary action color class (e.g. "bg-purple-600 hover:bg-purple-500") */
  primaryActionClass?: string;
  /** Inner content specifically for game-specific summaries (multipliers, chance, etc.) */
  summaryContent?: React.ReactNode;
  summaryBare?: boolean;
  summaryAfterChildren?: boolean;
  
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
  footerNote?: React.ReactNode;
  className?: string;
  showModeSwitch?: boolean;
}

export function SharedBetSlip({
  topMeta,
  amountHeaderValue,
  inputAccessory,
  showHeader = true,
  slipLabel = "Bet slip",
  slipTitle,
  slipDescription,
  glowColorClass = "bg-blue-500/10",
  primaryActionClass = "bg-blue-600 hover:bg-blue-500",
  summaryContent,
  summaryBare = false,
  summaryAfterChildren = false,
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
  footerNote,
  className,
  showModeSwitch = true,
}: SharedBetSlipProps) {
  const [mode, setMode] = useState<"Manual" | "Auto">("Manual");
  const chipGridClassName = quickChips.length <= 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[1.7rem] border border-white/8 bg-[#090b10] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.34)]",
        className
      )}
    >
      {showHeader ? (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">{slipLabel}</div>
          {slipTitle ? <div className="text-base font-semibold text-white">{slipTitle}</div> : null}
          {slipDescription ? <div className="text-sm leading-6 text-white/40">{slipDescription}</div> : null}
        </div>
      ) : null}

      {topMeta ? <div className="text-sm font-medium text-white/75">{topMeta}</div> : null}

      {showModeSwitch ? (
        <div className="flex rounded-xl border border-white/8 bg-black/30 p-1">
          <button
            onClick={() => setMode("Manual")}
            disabled
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.16em] shadow-sm transition-colors cursor-default",
              mode === "Manual" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setMode("Auto")}
            disabled
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.16em] shadow-sm transition-colors cursor-not-allowed",
              mode === "Auto" ? "bg-white/10 text-white" : "text-white/40 opacity-50"
            )}
          >
            Auto
          </button>
        </div>
      ) : null}
      
      {/* Amount Input */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">Bet amount</span>
          {amountHeaderValue ? (
            <span className="text-right text-white/60">{amountHeaderValue}</span>
          ) : balanceHint ? (
            <span className="text-right text-white/60">{balanceHint}</span>
          ) : (
            <span className="text-white/60 font-mono">0.00 {assetSymbol}</span>
          )}
        </div>
        <div className="relative flex items-center overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#050505] focus-within:border-white/20 transition-colors">
          <input 
            type="text" 
            value={amountValue} 
            onChange={(e) => onAmountChange?.(e.target.value)}
            className="w-full bg-transparent px-4 py-3.5 text-left font-mono text-[1.8rem] font-black tracking-[-0.04em] text-white focus:outline-none placeholder:text-white/20" 
            placeholder="0.00"
          />
          {inputAccessory ? (
            <div className="flex items-center gap-2 pr-3">{inputAccessory}</div>
          ) : assetOptions && assetOptions.length > 0 ? (
            <select
              value={selectedAsset}
              onChange={(e) => onAssetChange?.(e.target.value)}
              className="cursor-pointer bg-transparent px-3 text-sm font-semibold text-white/50 outline-none transition-colors hover:text-white"
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
        <div className={cn("grid gap-2", chipGridClassName)}>
          {quickChips.map((chip, idx) => (
            <button 
              key={idx} 
              onClick={() => onQuickChip?.(chip)}
              className="rounded-[1rem] border border-white/8 bg-white/[0.04] py-2.5 text-sm font-bold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Children elements (Rounds slider, advanced limits, etc.) */}
      {children}

      {/* Game Specific Summary Area */}
      {summaryContent && summaryAfterChildren ? (
        <div className={cn(summaryBare ? "" : "relative overflow-hidden rounded-xl border p-4 opacity-90", summaryBare ? undefined : glowColorClass)}>
          <div className={cn(summaryBare ? "" : "relative z-10")}>
            {summaryContent}
          </div>
        </div>
      ) : null}

      {summaryContent && !summaryAfterChildren ? (
        <div className={cn(summaryBare ? "" : "relative overflow-hidden rounded-xl border p-4 opacity-90", summaryBare ? undefined : glowColorClass)}>
          <div className={cn(summaryBare ? "" : "relative z-10")}>
            {summaryContent}
          </div>
        </div>
      ) : null}

      {/* CTA */}
      <button 
        onClick={onAction}
        disabled={actionDisabled}
        className={cn(
          "w-full rounded-[1rem] py-4 text-base font-black text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:-translate-y-0",
          primaryActionClass
        )}
      >
        {actionLabel}
      </button>

      {footerNote ? (
        <p className="text-center text-[10px] text-white/30">
          {footerNote}
        </p>
      ) : null}
    </div>
  );
}
