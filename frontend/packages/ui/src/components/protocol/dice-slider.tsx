"use client";

import React, { useState } from "react";
import { cn } from "../../lib/utils";

interface DiceSliderProps {
  className?: string;
  value?: number;
  initialValue?: number;
  direction?: "under" | "over";
  onValueChange?: (val: number, dir: "under" | "over") => void;
}

export function DiceSlider({
  className,
  value,
  initialValue = 50,
  direction = "under",
  onValueChange
}: DiceSliderProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [selectedDir, setSelectedDir] = useState<"under"|"over">(direction);
  
  const displayValue = value !== undefined ? value : internalValue;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setInternalValue(val);
    onValueChange?.(val, selectedDir);
  };

  const setDir = (dir: "under" | "over") => {
    setSelectedDir(dir);
    onValueChange?.(displayValue, dir);
  };

  // Calculates percentage for red/green visual split
  const isUnder = selectedDir === "under";
  const greenPercentage = isUnder ? displayValue : (100 - displayValue);

  return (
    <div className={cn("flex flex-col gap-12 w-full mx-auto max-w-[800px] mt-8", className)}>
      
      {/* Direction Toggle */}
      <div className="flex bg-[#050505] p-2 rounded-2xl border border-white/10 self-center w-64 shadow-xl">
        <button 
          onClick={() => setDir("under")}
          className={cn(
            "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
             isUnder ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
          )}
        >
          Roll Under
        </button>
        <button 
           onClick={() => setDir("over")}
          className={cn(
            "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
             !isUnder ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
          )}
        >
          Roll Over
        </button>
      </div>

      {/* The Giant Slider Engine */}
      <div className="relative px-8 md:px-12 py-16 bg-[#050505]/50 rounded-[40px] border border-white/5">
        
        {/* Value Display Float */}
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 px-8 py-4 bg-[#111] border border-white/20 rounded-2xl shadow-2xl flex items-baseline gap-2"
        >
           <span className="text-white/50 text-xl font-bold">{isUnder ? "<" : ">"}</span>
           <span className="text-5xl md:text-7xl font-mono font-bold text-white tracking-tighter">{displayValue.toFixed(2)}</span>
        </div>

        {/* Track Background Line */}
        <div className="relative h-6 bg-[#111] rounded-full overflow-hidden shadow-inner border border-white/5">
          {/* Win / Loss fill */}
          <div 
            className="absolute top-0 bottom-0 left-0 transition-all duration-150 rounded-full"
            style={{ 
              width: `${isUnder ? displayValue : 100}%`,
              backgroundColor: isUnder ? '#22c55e' : '#ef4444',
              boxShadow: isUnder ? '0 0 20px rgba(34,197,94,0.4)' : 'none'
            }}
          />
          <div 
            className="absolute top-0 bottom-0 transition-all duration-150 rounded-full"
            style={{ 
              left: `${isUnder ? displayValue : 0}%`,
              width: `${isUnder ? (100 - displayValue) : displayValue}%`,
              backgroundColor: isUnder ? '#ef4444' : '#22c55e',
              boxShadow: !isUnder ? '0 0 20px rgba(34,197,94,0.4)' : 'none'
            }}
          />
        </div>

        {/* Invisible Native Input Overlay */}
        <input 
          type="range" 
          min="0.01" 
          max="99.99" 
          step="0.01"
          value={displayValue}
          onChange={handleSliderChange}
          className="absolute top-1/2 -translate-y-1/2 left-8 md:left-12 right-8 md:right-12 h-16 opacity-0 cursor-pointer z-10 w-[calc(100%-4rem)] md:w-[calc(100%-6rem)]"
        />

        {/* Number Scale */}
        <div className="absolute left-8 md:left-12 right-8 md:right-12 top-28 flex justify-between px-2 pointer-events-none opacity-40 font-mono text-xs md:text-sm font-bold text-white">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}
