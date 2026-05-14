import * as React from "react";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import type { CoinSide } from "./params";

export function CoinTossStage({
  isPending,
  showResult,
  resultNum,
  coinSide
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-1000",
          isPending ? "bg-amber-500" : coinSide === "HEADS" ? "bg-amber-600" : "bg-indigo-600"
        )}
      />

      <div className="relative w-56 h-56 md:w-72 md:h-72" style={{ perspective: "1200px" }}>
        <div
          className={cn(
            "w-full h-full relative transition-[transform] ease-out",
            isPending ? "animate-[spin-coin-fast_0.5s_linear_infinite]" : "duration-700"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform:
              !isPending && showResult
                ? `rotateX(15deg) rotateY(${resultNum === 1 ? 0 : 180}deg)`
                : isPending
                  ? "none"
                  : `rotateX(15deg) rotateY(${coinSide === "TAILS" ? 180 : 0}deg)`
          }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-[6px]"
              style={{
                transform: `translateZ(-${i}px)`,
                borderColor: i % 2 === 0 ? "#8B6508" : "#DAA520",
                filter: "brightness(0.8)"
              }}
            />
          ))}

          <div
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_45deg,#FFD700,#B8860B,#FFD700,#F0E68C,#FFD700)] shadow-[inset_0_0_30px_rgba(139,69,19,0.8),inset_0_2px_15px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center border-2 border-yellow-200 overflow-hidden backface-hidden"
            style={{ transform: "translateZ(1px)" }}
          >
            <div className="absolute inset-4 rounded-full border border-[#B8860B]/40 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[radial-gradient(circle_at_center,#DAA520,#8B6508)] flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <SparklesIcon className="w-24 h-24 text-white p-4 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" />
              <span className="text-3xl font-black text-white/90 tracking-[0.2em] [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] mt-[-10px]">
                HEADS
              </span>
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_45deg,#C0C0C0,#708090,#C0C0C0,#E6E6FA,#C0C0C0)] shadow-[inset_0_0_30px_rgba(47,79,79,0.8),inset_0_2px_15px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center border-2 border-white/80 overflow-hidden backface-hidden"
            style={{ transform: "rotateY(180deg) translateZ(30px)" }}
          >
            <div className="absolute inset-4 rounded-full border border-gray-500/40 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[radial-gradient(circle_at_center,#778899,#2F4F4F)] flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <ShieldCheckIcon className="w-24 h-24 text-white p-4 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" />
              <span className="text-3xl font-black text-white/90 tracking-[0.2em] [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] mt-[-10px]">
                TAILS
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isPending && !showResult && (
        <div className="absolute bottom-16 flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in duration-500">
          <span className="text-[10px] text-white/30 tracking-[0.4em] uppercase mb-4">
            Awaiting Toss Selection
          </span>
          <div className="bg-black/60 backdrop-blur-xl rounded-[2rem] border border-white/10 px-8 py-4 flex items-center justify-center gap-4 w-72 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div
              className={cn(
                "w-3 h-3 rounded-full animate-pulse",
                coinSide === "HEADS"
                  ? "bg-amber-400 shadow-[0_0_10px_amber]"
                  : "bg-indigo-400 shadow-[0_0_10px_indigo]"
              )}
            />
            <span
              className={cn(
                "font-mono text-xl font-black uppercase tracking-widest",
                coinSide === "HEADS" ? "text-amber-400" : "text-indigo-400"
              )}
            >
              {coinSide} SELECTED
            </span>
          </div>
        </div>
      )}

      {isPending && (
        <div className="absolute bottom-16 flex flex-col items-center animate-pulse">
          <span className="text-sm text-white font-black tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
            Waiting for VRF Oracle...
          </span>
        </div>
      )}
    </div>
  );
}
