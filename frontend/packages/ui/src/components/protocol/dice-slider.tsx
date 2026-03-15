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
      
      {/* Direction Toggle - Refined for Minimalist V2 */}
      <div className="flex bg-[#050505] p-1.5 rounded-2xl border border-white/5 self-center w-64">
        <button 
          onClick={() => setDir("under")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
             isUnder ? "bg-white/10 text-white shadow-sm" : "text-white/20 hover:text-white"
          )}
        >
          Roll Under
        </button>
        <button 
           onClick={() => setDir("over")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
             !isUnder ? "bg-white/10 text-white shadow-sm" : "text-white/20 hover:text-white"
          )}
        >
          Roll Over
        </button>
      </div>

      {/* The Giant Slider Engine - Refined for V2 */}
      <div className="relative px-8 md:px-12 py-20 bg-[#0a0a0a]/40 rounded-[40px] border border-white/5 w-full">
        
        {/* Value Display Float - Massive V2 Style */}
        <div 
          className="absolute -top-14 left-1/2 -translate-x-1/2 px-10 py-6 bg-[#0a0a0a] border border-white/10 rounded-[28px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex items-center justify-center gap-3 min-w-[300px]"
        >
           <span className="text-white/30 text-3xl font-black">{isUnder ? "<" : ">"}</span>
           <span className="text-7xl md:text-8xl font-mono font-bold text-white tracking-tighter leading-none select-none">{displayValue.toFixed(2)}</span>
        </div>

        {/* Track Background Line - High Contrast V2 */}
        <div className="relative h-10 bg-[#050505] rounded-full overflow-hidden border border-white/5 p-1">
          {/* Win / Loss fill */}
          <div 
            className="absolute top-1 bottom-1 left-1 transition-all duration-300 ease-out rounded-full"
            style={{ 
              width: `${isUnder ? displayValue : 100}%`,
              backgroundColor: isUnder ? '#22c55e' : '#ef4444',
              boxShadow: isUnder ? '0 0 40px rgba(34,197,94,0.15)' : 'none'
            }}
          />
          <div 
            className="absolute top-1 bottom-1 transition-all duration-300 ease-out rounded-full"
            style={{ 
              left: `calc(1px + ${isUnder ? displayValue : 0}%)`,
              width: `${isUnder ? (100 - displayValue) : displayValue}%`,
              backgroundColor: isUnder ? '#ef4444' : '#22c55e',
              boxShadow: !isUnder ? '0 0 40px rgba(34,197,94,0.15)' : 'none'
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
          className="absolute top-1/2 -translate-y-1/2 left-8 md:left-12 right-8 md:right-12 h-20 opacity-0 cursor-pointer z-10 w-[calc(100%-4rem)] md:w-[calc(100%-6rem)]"
        />

        {/* Number Scale */}
        <div className="absolute left-10 md:left-14 right-10 md:right-14 bottom-6 flex justify-between px-2 pointer-events-none opacity-20 font-mono text-[10px] md:text-xs font-black text-white uppercase tracking-tighter">
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
