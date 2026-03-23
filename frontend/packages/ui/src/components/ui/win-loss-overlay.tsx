import * as React from "react";
import { cn } from "../../lib/utils";

export interface WinLossOverlayProps {
  isVisible: boolean;
  isWin: boolean;
  resultValue: React.ReactNode;
  payoutText?: React.ReactNode;
  wagerText?: React.ReactNode;
  winTitle?: string;
  lossTitle?: string;
  headerTitle?: string;
  className?: string;
}

export function WinLossOverlay({
  isVisible,
  isWin,
  resultValue,
  payoutText,
  wagerText,
  winTitle = "TARGET HIT",
  lossTitle = "TARGET MISSED",
  headerTitle = "Verification Result",
  className
}: WinLossOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn("absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300", className)}>
      <div className="p-10 rounded-[3rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden">
        
        {/* Result background glow */}
        <div className={cn("absolute inset-0 blur-[80px] opacity-20 pointer-events-none", isWin ? "bg-emerald-500" : "bg-red-500")} />

        <h3 className="text-xl font-bold text-white/60 uppercase tracking-widest mb-4 relative z-10">
          {headerTitle}
        </h3>
        
        <div className={cn(
          "text-7xl font-extrabold mb-6 font-mono w-48 h-32 rounded-[2rem] flex items-center justify-center border-4 shadow-2xl relative z-10 transition-transform scale-110", 
          isWin 
            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.5)]" 
            : "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
        )}>
          {resultValue}
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {isWin ? (
            <>
              <span className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/> 
                {winTitle}
              </span>
              <span className="text-4xl font-mono text-emerald-300 font-extrabold">
                {payoutText}
              </span>
            </>
          ) : (
            <>
              <span className="text-red-500 font-bold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"/> 
                {lossTitle}
              </span>
              <span className="text-2xl font-mono text-white/30 font-bold">
                {wagerText}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
