"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface CyberSliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftColorHex?: string; // e.g. '#22c55e'
  rightColorHex?: string; // e.g. '#ef4444'
  splitPercentage?: number; // 0-100, determines where the color switch happens
  leftNode?: React.ReactNode;
  rightNode?: React.ReactNode;
  formatValue?: (val: number) => string;
}

export function CyberSlider({
  className,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  leftColorHex = "#22c55e",
  rightColorHex = "#ef4444",
  splitPercentage = 50,
  leftNode,
  rightNode,
  formatValue = (v) => v.toFixed(2),
  ...props
}: CyberSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(parseFloat(e.target.value));
  };

  return (
    <div className={cn("relative px-8 md:px-12 py-20 bg-[#0a0a0a]/40 rounded-[40px] border border-white/5 w-full", className)}>
      
      {/* Value Display Float */}
      <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-10 py-6 bg-[#0a0a0a] border border-white/10 rounded-[28px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex items-center justify-center gap-3 min-w-[300px]">
        {leftNode && <span className="text-white/30 text-3xl font-black">{leftNode}</span>}
        <span className="text-7xl md:text-8xl font-mono font-bold text-white tracking-tighter leading-none select-none">
          {formatValue(value)}
        </span>
        {rightNode && <span className="text-white/30 text-3xl font-black">{rightNode}</span>}
      </div>

      {/* Track Background Line */}
      <div className="relative h-10 bg-[#050505] rounded-full overflow-hidden border border-white/5 p-1">
        {/* Left fill */}
        <div 
          className="absolute top-1 bottom-1 left-1 transition-all duration-300 ease-out rounded-full"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: leftColorHex,
            boxShadow: `0 0 40px ${leftColorHex}40`
          }}
        />
        {/* Right fill */}
        <div 
          className="absolute top-1 bottom-1 transition-all duration-300 ease-out rounded-full"
          style={{ 
            left: `calc(1px + ${percentage}%)`,
            width: `${100 - percentage}%`,
            backgroundColor: rightColorHex,
            boxShadow: `0 0 40px ${rightColorHex}40`
          }}
        />
      </div>

      {/* Invisible Native Input Overlay */}
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={value}
        onChange={handleSliderChange}
        className="absolute top-1/2 -translate-y-1/2 left-8 md:left-12 right-8 md:right-12 h-20 opacity-0 cursor-pointer z-10 w-[calc(100%-4rem)] md:w-[calc(100%-6rem)]"
        {...props}
      />

      {/* Number Scale */}
      <div className="absolute left-10 md:left-14 right-10 md:right-14 bottom-6 flex justify-between px-2 pointer-events-none opacity-20 font-mono text-[10px] md:text-xs font-black text-white uppercase tracking-tighter">
        <span>{min}</span>
        <span>{((max - min) * 0.25).toFixed(0)}</span>
        <span>{((max - min) * 0.50).toFixed(0)}</span>
        <span>{((max - min) * 0.75).toFixed(0)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
