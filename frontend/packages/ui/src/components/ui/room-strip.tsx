import React from "react";
import { cn } from "../../lib/utils";

interface RoomStripProps {
  title: string;
  edgePercentage?: number;
  isLive?: boolean;
  className?: string;
}

export function RoomStrip({
  title,
  edgePercentage = 1.0,
  isLive = true,
  className
}: RoomStripProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        
        {/* Status / Edge Badges */}
        <div className="hidden sm:flex items-center gap-2">
          {isLive && (
            <span className="px-3 py-1 rounded-md bg-green-500/10 text-green-400 text-[10px] md:text-xs font-semibold border border-green-500/20 uppercase tracking-widest leading-none">
              Live
            </span>
          )}
          <span className="px-3 py-1 rounded-md bg-white/5 text-white/50 text-[10px] md:text-xs font-mono border border-white/10 shadow-sm leading-none">
            House edge: {edgePercentage.toFixed(1)}%
          </span>
        </div>
      </div>
      
      {/* Network Sync Indicator */}
      <div className="flex items-center gap-2 text-[10px] md:text-xs font-medium text-white/40">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="hidden sm:inline">Synchronized to Arbitrum</span>
        <span className="sm:hidden">Arbitrum</span>
      </div>
    </div>
  );
}
