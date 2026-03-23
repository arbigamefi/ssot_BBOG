"use client";

import React from "react";
import { cn } from "../../lib/utils";

import { type RouletteSelection } from "./roulette-params-form";

interface RouletteBoardProps {
  className?: string;
  selection?: RouletteSelection;
  onBetPlaced?: (selection: RouletteSelection) => void;
  variant?: "default" | "prototype";
}

export function RouletteBoard({
  className,
  selection,
  onBetPlaced,
  variant = "default"
}: RouletteBoardProps) {
  // Constants for board rendering
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isPrototypeVariant = variant === "prototype";

  const handleBet = (s: RouletteSelection) => {
    onBetPlaced?.(s);
  };

  const isSelected = (s: RouletteSelection) => {
    if (!selection) return false;
    if (selection.kind !== s.kind) return false;

    switch (s.kind) {
      case "straight":
        return selection.kind === "straight" && selection.number === s.number;
      case "dozen":
        return selection.kind === "dozen" && selection.dozen === s.dozen;
      case "column":
        return selection.kind === "column" && selection.column === s.column;
      case "red":
      case "black":
      case "odd":
      case "even":
      case "low":
      case "high":
        return selection.kind === s.kind;
      // Note: split, street, corner, sixLine are harder to highlight on this simple board
      // without more complex hit-testing. We skip perfect highlighting for them for now.
      default:
        return false;
    }
  };

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-4 overflow-x-auto",
        isPrototypeVariant ? "max-w-[1180px]" : "max-w-[980px]",
        className
      )}
    >
      {/* 3x12 Grid + Zero */}
      <div
        className={cn(
          "relative flex min-w-[820px] justify-center overflow-hidden",
          isPrototypeVariant
            ? "rounded-[1.4rem] border-4 border-[#222] bg-[#0b1a12] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.8)] md:p-4"
            : "rounded-[1.4rem] border border-white/6 bg-[#11192d]/68 p-3 md:p-4"
        )}
      >
        {isPrototypeVariant ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_42%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%,transparent_80%,rgba(0,0,0,0.26))]" />
          </>
        ) : null}
        {/* Zero */}
        <button
          onClick={() => handleBet({ kind: "straight", number: 0 })}
          className={cn(
            isPrototypeVariant
              ? "flex w-[68px] flex-shrink-0 items-center justify-center rounded-l-lg border border-[#105e3a] bg-[#093d25] px-0 py-4 text-2xl font-bold text-emerald-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.35)] transition-all hover:bg-[#0c4e30] md:w-[78px] md:text-4xl"
              : "flex w-16 flex-shrink-0 items-center justify-center rounded-l-[1.2rem] border border-white/5 bg-emerald-500/80 px-0 py-3 text-xl font-bold text-white transition-all hover:bg-emerald-400/80 md:w-[74px] md:rounded-l-[1.4rem] md:text-3xl",
            isSelected({ kind: "straight", number: 0 }) &&
              "bg-green-500/30 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          )}
        >
          <span className="-rotate-90">0</span>
        </button>

        {/* Main Grid: Rows are dynamically ordered for European Roulette visual layout */}
        <div
          className={cn(
            "grid flex-1 grid-cols-12 px-1 md:px-1.5",
            isPrototypeVariant ? "gap-1" : "gap-2"
          )}
        >
          {/* Top Row: 3, 6, 9... */}
          {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((n) => (
            <button
              key={n}
              onClick={() => handleBet({ kind: "straight", number: n })}
              className={cn(
                isPrototypeVariant
                  ? "aspect-[4/3] flex items-center justify-center rounded-[0.45rem] border text-base font-bold transition-all md:text-[1.55rem]"
                  : "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                RED_NUMBERS.includes(n)
                  ? "border-[#991b1b] bg-[#7f1d1d] text-red-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#991b1b]"
                  : "border-[#374151] bg-[#1f2937] text-gray-200 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#374151]",
                isSelected({ kind: "straight", number: n }) &&
                  "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
              )}
            >
              {n}
            </button>
          ))}
          {/* Middle Row: 2, 5, 8... */}
          {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map((n) => (
            <button
              key={n}
              onClick={() => handleBet({ kind: "straight", number: n })}
              className={cn(
                isPrototypeVariant
                  ? "aspect-[4/3] flex items-center justify-center rounded-[0.45rem] border text-base font-bold transition-all md:text-[1.55rem]"
                  : "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                RED_NUMBERS.includes(n)
                  ? "border-[#991b1b] bg-[#7f1d1d] text-red-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#991b1b]"
                  : "border-[#374151] bg-[#1f2937] text-gray-200 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#374151]",
                isSelected({ kind: "straight", number: n }) &&
                  "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
              )}
            >
              {n}
            </button>
          ))}
          {/* Bottom Row: 1, 4, 7... */}
          {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map((n) => (
            <button
              key={n}
              onClick={() => handleBet({ kind: "straight", number: n })}
              className={cn(
                isPrototypeVariant
                  ? "aspect-[4/3] flex items-center justify-center rounded-[0.45rem] border text-base font-bold transition-all md:text-[1.55rem]"
                  : "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                RED_NUMBERS.includes(n)
                  ? "border-[#991b1b] bg-[#7f1d1d] text-red-100 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#991b1b]"
                  : "border-[#374151] bg-[#1f2937] text-gray-200 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)] hover:bg-[#374151]",
                isSelected({ kind: "straight", number: n }) &&
                  "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {/* 2-to-1 Column Bets */}
        <div
          className={cn(
            "grid flex-shrink-0 grid-rows-3",
            isPrototypeVariant ? "w-[54px] gap-1 md:w-[70px]" : "w-14 gap-2 md:w-[76px]"
          )}
        >
          <button
            onClick={() => handleBet({ kind: "column", column: 3 })}
            className={cn(
              isPrototypeVariant
                ? "flex items-center justify-center rounded-[0.45rem] border border-white/10 bg-white/5 text-[11px] font-bold uppercase text-white/60 transition-colors hover:bg-white/10 md:text-sm"
                : "flex items-center justify-center rounded-r-[0.95rem] border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg",
              isSelected({ kind: "column", column: 3 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            2:1
          </button>
          <button
            onClick={() => handleBet({ kind: "column", column: 2 })}
            className={cn(
              isPrototypeVariant
                ? "flex items-center justify-center rounded-[0.45rem] border border-white/10 bg-white/5 text-[11px] font-bold uppercase text-white/60 transition-colors hover:bg-white/10 md:text-sm"
                : "flex items-center justify-center border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg",
              isSelected({ kind: "column", column: 2 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            2:1
          </button>
          <button
            onClick={() => handleBet({ kind: "column", column: 1 })}
            className={cn(
              isPrototypeVariant
                ? "flex items-center justify-center rounded-[0.45rem] border border-white/10 bg-white/5 text-[11px] font-bold uppercase text-white/60 transition-colors hover:bg-white/10 md:text-sm"
                : "flex items-center justify-center rounded-r-[0.95rem] border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg",
              isSelected({ kind: "column", column: 1 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            2:1
          </button>
        </div>
      </div>

      {/* Outside Bets Zone */}
      <div
        className={cn(
          "flex w-full min-w-[820px] flex-col",
          isPrototypeVariant ? "gap-1 px-[72px] md:px-[88px]" : "gap-2 px-[78px] md:px-[94px]"
        )}
      >
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => handleBet({ kind: "dozen", dozen: 1 })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-lg font-bold text-white/60 transition-colors hover:bg-white/10 md:text-xl"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "dozen", dozen: 1 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            1st 12
          </button>
          <button
            onClick={() => handleBet({ kind: "dozen", dozen: 2 })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-lg font-bold text-white/60 transition-colors hover:bg-white/10 md:text-xl"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "dozen", dozen: 2 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            2nd 12
          </button>
          <button
            onClick={() => handleBet({ kind: "dozen", dozen: 3 })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-lg font-bold text-white/60 transition-colors hover:bg-white/10 md:text-xl"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "dozen", dozen: 3 }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            3rd 12
          </button>
        </div>
        <div className={cn("grid grid-cols-6 gap-1", isPrototypeVariant ? "gap-1" : "gap-2")}>
          <button
            onClick={() => handleBet({ kind: "low" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-base font-bold text-white/60 transition-colors hover:bg-white/10 md:text-lg"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "low" }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            1-18
          </button>
          <button
            onClick={() => handleBet({ kind: "even" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-base font-bold text-white/60 transition-colors hover:bg-white/10 md:text-lg"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "even" }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            Even
          </button>
          <button
            onClick={() => handleBet({ kind: "red" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-[#991b1b] bg-[#7f1d1d]/70 py-3 transition-all"
                : "rounded-[1rem] border border-rose-500/60 bg-rose-600/85 py-3 transition-all",
              isSelected({ kind: "red" }) &&
                "scale-105 border-red-300 bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.5)] z-10"
            )}
          ></button>
          <button
            onClick={() => handleBet({ kind: "black" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-[#374151] bg-[#1f2937]/70 py-3 transition-all"
                : "rounded-[1rem] border border-slate-700 bg-[#2d3d73] py-3 transition-all",
              isSelected({ kind: "black" }) &&
                "scale-105 border-white bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.45)] z-10"
            )}
          ></button>
          <button
            onClick={() => handleBet({ kind: "odd" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-base font-bold text-white/60 transition-colors hover:bg-white/10 md:text-lg"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "odd" }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            Odd
          </button>
          <button
            onClick={() => handleBet({ kind: "high" })}
            className={cn(
              isPrototypeVariant
                ? "rounded-[0.5rem] border border-white/10 bg-white/5 py-3 text-base font-bold text-white/60 transition-colors hover:bg-white/10 md:text-lg"
                : "rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]",
              isSelected({ kind: "high" }) &&
                "border-blue-300 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.5)]"
            )}
          >
            19-36
          </button>
        </div>
      </div>
    </div>
  );
}
