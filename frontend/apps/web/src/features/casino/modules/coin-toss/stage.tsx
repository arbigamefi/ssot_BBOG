import * as React from "react";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import type { CoinSide } from "../../room/params";

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
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-brand/5 to-transparent pointer-events-none" />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-1000",
          isPending ? "bg-accent" : "bg-brand"
        )}
      />

      <div className="relative h-56 w-56 md:h-72 md:w-72" style={{ perspective: "1200px" }}>
        <div
          className={cn(
            "relative h-full w-full transition-[transform] ease-out",
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
                borderColor: i % 2 === 0 ? "hsl(var(--brand) / 0.35)" : "hsl(var(--accent) / 0.28)",
                filter: "brightness(0.8)"
              }}
            />
          ))}

          <div
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-brand/35 bg-brand/20 shadow-e3 backface-hidden"
            style={{ transform: "translateZ(1px)" }}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-brand/25 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.35),hsl(var(--surface-1)/0.95))]">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <SparklesIcon className="h-24 w-24 p-4 text-fg" />
              <span className="mt-[-10px] text-3xl font-black tracking-[0.2em] text-fg">HEADS</span>
            </div>
          </div>

          <div
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-accent/35 bg-accent/20 shadow-e3 backface-hidden"
            style={{ transform: "rotateY(180deg) translateZ(30px)" }}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-accent/25 bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.30),hsl(var(--surface-1)/0.95))]">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <ShieldCheckIcon className="h-24 w-24 p-4 text-fg" />
              <span className="mt-[-10px] text-3xl font-black tracking-[0.2em] text-fg">TAILS</span>
            </div>
          </div>
        </div>
      </div>

      {!isPending && !showResult && (
        <div className="absolute bottom-16 flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in duration-500">
          <span className="mb-4 text-[10px] uppercase tracking-[0.4em] text-fg-subtle">
            Awaiting Toss Selection
          </span>
          <div className="flex w-72 items-center justify-center gap-4 rounded-xl border border-border bg-surface-1/85 px-8 py-4 shadow-e2 backdrop-blur-xl">
            <div
              className={cn(
                "h-3 w-3 rounded-full animate-pulse",
                coinSide === "HEADS" ? "bg-brand" : "bg-accent"
              )}
            />
            <span className="font-mono text-xl font-black uppercase tracking-widest text-fg">
              {coinSide} SELECTED
            </span>
          </div>
        </div>
      )}

      {isPending && (
        <div className="absolute bottom-16 flex flex-col items-center animate-pulse">
          <span className="text-sm font-black uppercase tracking-[0.3em] text-fg">
            Waiting for VRF Oracle...
          </span>
        </div>
      )}
    </div>
  );
}
