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
            <span className="rounded-md border border-success/20 bg-success-soft px-3 py-1 text-xs font-semibold uppercase leading-none tracking-widest text-success">
              Live
            </span>
          )}
          <span className="rounded-md border border-border-soft bg-surface-2 px-3 py-1 font-mono text-xs leading-none text-fg-subtle shadow-e1">
            House edge: {edgePercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Network Sync Indicator */}
      <div className="flex items-center gap-2 text-xs font-medium text-fg-subtle">
        <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
        <span className="hidden sm:inline">Synchronized to Arbitrum</span>
        <span className="sm:hidden">Arbitrum</span>
      </div>
    </div>
  );
}
