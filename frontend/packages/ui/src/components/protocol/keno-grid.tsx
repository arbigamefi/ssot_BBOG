"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

interface KenoGridProps {
  className?: string;
  maxSelections?: number;
  value?: number[];
  onSelectionChange?: (selectedNumbers: number[]) => void;
}

export function KenoGrid({
  className,
  maxSelections = 10,
  value,
  onSelectionChange
}: KenoGridProps) {
  const [internalSelected, setInternalSelected] = useState<number[]>(value || []);
  const selected = value !== undefined ? value : internalSelected;
  
  const toggleNumber = (num: number) => {
    let newSelection;
    if (selected.includes(num)) {
      newSelection = selected.filter(n => n !== num);
    } else {
      if (selected.length >= maxSelections) return;
      newSelection = [...selected, num];
    }
    setInternalSelected(newSelection);
    onSelectionChange?.(newSelection);
  };
  
  const clearSelection = () => {
    setInternalSelected([]);
    onSelectionChange?.([]);
  };
  
  const quickPick = () => {
    const nums: number[] = [];
    while(nums.length < maxSelections) {
      const r = Math.floor(Math.random() * 40) + 1;
      if (!nums.includes(r)) nums.push(r);
    }
    setInternalSelected(nums);
    onSelectionChange?.(nums);
  };

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-2xl mx-auto", className)}>
      
      {/* 40 Numbers Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 md:gap-3 bg-[#0a0a0a] p-4 md:p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-fuchsia-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        {Array.from({length: 40}, (_, i) => i + 1).map(num => {
          const isSelected = selected.includes(num);
          return (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              disabled={!isSelected && selected.length >= maxSelections}
              className={cn(
                "aspect-square rounded-lg md:rounded-xl font-bold text-sm md:text-lg transition-all duration-200 relative z-10",
                isSelected 
                  ? "bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.5)] border-2 border-fuchsia-400 scale-105" 
                  : "bg-zinc-900/80 text-white/40 border border-white/5 hover:bg-zinc-800 hover:text-white/80",
                !isSelected && selected.length >= maxSelections && "opacity-30 cursor-not-allowed"
              )}
            >
              {num}
            </button>
          )
        })}
      </div>

      {/* Grid Controls */}
      <div className="flex items-center justify-between px-2">
         <div className="text-white/60 text-sm font-medium">
           Selected: <span className="text-white font-bold">{selected.length}</span> / {maxSelections}
         </div>
         <div className="flex gap-3">
           <button onClick={clearSelection} className="text-xs font-bold text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">
              Clear
           </button>
           <button onClick={quickPick} className="text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors px-3 py-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10">
              Quick Pick
           </button>
         </div>
      </div>

    </div>
  );
}
