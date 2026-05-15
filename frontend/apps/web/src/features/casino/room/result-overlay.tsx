import * as React from "react";
import { cn } from "@ssot/ui";

import type { CoinSide } from "./params";

export function GameRoomResultOverlay({
  gameSlug,
  coinSide,
  resultNum,
  expectedPayout
}: {
  gameSlug: string;
  coinSide: CoinSide;
  resultNum: number | null;
  expectedPayout: number;
}) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-surface-0/80 backdrop-blur-md animate-in fade-in zoom-in pointer-events-auto">
      <div className="relative flex w-full max-w-sm scale-110 flex-col items-center overflow-hidden rounded-xl border border-border bg-surface-1 p-12 text-center shadow-e3 transition-transform">
        <div className="absolute inset-0 bg-success/20 opacity-20 blur-[100px] animate-pulse" />
        <h3 className="mb-6 text-xl font-bold uppercase tracking-[0.3em] text-fg-subtle">
          Verification Success
        </h3>
        <div
          className={cn(
            "mb-8 flex h-36 w-64 items-center justify-center rounded-lg border-4 border-success/50 bg-success-soft font-mono text-7xl font-black text-success shadow-e2"
          )}
        >
          {gameSlug === "coin-toss"
            ? coinSide === "TAILS"
              ? "TAILS"
              : "HEADS"
            : (resultNum ?? 42)}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="mb-2 flex items-center gap-2 text-lg font-black tracking-widest text-success">
            DIRECT PREDICTION HIT <div className="h-2 w-2 rounded-full bg-success shadow-glow" />
          </span>
          <span className="font-mono text-5xl font-black text-fg">
            +{expectedPayout.toFixed(2)} <span className="text-xl text-fg-subtle">USDC</span>
          </span>
        </div>
      </div>
    </div>
  );
}
