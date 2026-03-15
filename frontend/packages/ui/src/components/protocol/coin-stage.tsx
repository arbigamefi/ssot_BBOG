"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

interface CoinStageProps {
  className?: string;
  value?: "HEADS" | "TAILS" | null;
  onSelect?: (side: "HEADS" | "TAILS") => void;
}

export function CoinStage({ className, value = null, onSelect }: CoinStageProps) {
  const [internalSelected, setInternalSelected] = useState<"HEADS" | "TAILS" | null>(value);
  const selected = value !== undefined ? value : internalSelected;

  const handleSelect = (side: "HEADS" | "TAILS") => {
    setInternalSelected(side);
    onSelect?.(side);
  };

  return (
    <div className={cn("flex items-center justify-center gap-8 md:gap-16 max-w-2xl mx-auto w-full py-12 md:py-24", className)}>
      
      {/* Heads */}
      <button 
        onClick={() => handleSelect('HEADS')}
        className={cn(
          "relative group w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-300 pointer-events-auto shadow-2xl overflow-hidden",
          selected === 'HEADS' 
            ? "scale-110 shadow-[0_0_60px_rgba(234,179,8,0.4)]" 
            : selected === 'TAILS' 
              ? "opacity-30 scale-95" 
              : "hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full" />
        <div className="absolute inset-1 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center border-4 border-yellow-200/50">
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border border-yellow-200/50 bg-yellow-400/30 flex items-center justify-center">
            <span className="text-yellow-100 font-bold text-lg md:text-2xl drop-shadow-md tracking-wider">HEADS</span>
          </div>
        </div>
        {/* Glow */}
        {selected === 'HEADS' && <div className="absolute inset-0 border-4 border-white/40 rounded-full animate-pulse" />}
      </button>

      {/* Tails */}
      <button 
        onClick={() => handleSelect('TAILS')}
        className={cn(
          "relative group w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-300 pointer-events-auto shadow-2xl overflow-hidden",
          selected === 'TAILS' 
            ? "scale-110 shadow-[0_0_60px_rgba(168,162,158,0.4)]" 
            : selected === 'HEADS' 
              ? "opacity-30 scale-95" 
              : "hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-stone-400 to-stone-600 rounded-full" />
        <div className="absolute inset-1 bg-gradient-to-br from-stone-300 to-stone-500 rounded-full flex items-center justify-center border-4 border-stone-200/50">
           <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border border-stone-200/50 bg-stone-400/30 flex items-center justify-center">
            <span className="text-stone-100 font-bold text-lg md:text-2xl drop-shadow-md tracking-wider">TAILS</span>
          </div>
        </div>
        {/* Glow */}
        {selected === 'TAILS' && <div className="absolute inset-0 border-4 border-white/40 rounded-full animate-pulse" />}
      </button>
      
    </div>
  );
}
