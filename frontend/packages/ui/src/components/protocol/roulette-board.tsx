"use client";

import React from "react";
import { cn } from "../../lib/utils";

import { type RouletteSelection } from "./roulette-params-form";

interface RouletteBoardProps {
  className?: string;
  selection?: RouletteSelection;
  onBetPlaced?: (selection: RouletteSelection) => void;
}

export function RouletteBoard({ className, selection, onBetPlaced }: RouletteBoardProps) {
  // Constants for board rendering
  const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  
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
    <div className={cn("mx-auto flex w-full max-w-[980px] flex-col gap-4 overflow-x-auto", className)}>
      {/* 3x12 Grid + Zero */}
      <div className="flex min-w-[780px] justify-center rounded-[1.4rem] border border-white/6 bg-[#11192d]/68 p-3 md:p-4">
        {/* Zero */}
        <button 
          onClick={() => handleBet({ kind: 'straight', number: 0 })}
          className={cn(
            "flex w-16 flex-shrink-0 items-center justify-center rounded-l-[1.2rem] border border-white/5 bg-emerald-500/80 px-0 py-3 text-xl font-bold text-white transition-all hover:bg-emerald-400/80 md:w-[74px] md:rounded-l-[1.4rem] md:text-3xl",
            isSelected({ kind: 'straight', number: 0 }) && "bg-green-500/30 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          )}
        >
          <span className="-rotate-90">0</span>
        </button>
        
        {/* Main Grid: Rows are dynamically ordered for European Roulette visual layout */}
        <div className="grid flex-1 grid-cols-12 gap-2 px-2 md:px-3">
           {/* Top Row: 3, 6, 9... */}
           {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
              <button 
                key={n} 
                onClick={() => handleBet({ kind: 'straight', number: n })}
                className={cn(
                  "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                  RED_NUMBERS.includes(n) ? "border-rose-500/45 bg-rose-600/85 hover:bg-rose-500 text-white" : "border-slate-700/80 bg-[#2d3d73] hover:bg-[#384c8d] text-white",
                  isSelected({ kind: 'straight', number: n }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
                )}
              >
                {n}
              </button>
           ))}
           {/* Middle Row: 2, 5, 8... */}
           {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
             <button 
               key={n} 
               onClick={() => handleBet({ kind: 'straight', number: n })}
               className={cn(
                  "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                  RED_NUMBERS.includes(n) ? "border-rose-500/45 bg-rose-600/85 hover:bg-rose-500 text-white" : "border-slate-700/80 bg-[#2d3d73] hover:bg-[#384c8d] text-white",
                 isSelected({ kind: 'straight', number: n }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
               )}
             >
               {n}
             </button>
           ))}
           {/* Bottom Row: 1, 4, 7... */}
           {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
             <button 
               key={n} 
               onClick={() => handleBet({ kind: 'straight', number: n })}
               className={cn(
                  "aspect-[4/3] flex items-center justify-center rounded-[0.95rem] border text-base font-bold transition-all md:text-[1.55rem]",
                  RED_NUMBERS.includes(n) ? "border-rose-500/45 bg-rose-600/85 hover:bg-rose-500 text-white" : "border-slate-700/80 bg-[#2d3d73] hover:bg-[#384c8d] text-white",
                 isSelected({ kind: 'straight', number: n }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
               )}
             >
               {n}
             </button>
           ))}
        </div>
        
        {/* 2-to-1 Column Bets */}
        <div className="grid w-14 flex-shrink-0 grid-rows-3 gap-2 md:w-[76px]">
           <button onClick={() => handleBet({ kind: 'column', column: 3 })} className={cn("flex items-center justify-center rounded-r-[0.95rem] border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg", isSelected({ kind: 'column', column: 3 }) && "border-white/40 bg-white/20")}>2:1</button>
           <button onClick={() => handleBet({ kind: 'column', column: 2 })} className={cn("flex items-center justify-center border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg", isSelected({ kind: 'column', column: 2 }) && "border-white/40 bg-white/20")}>2:1</button>
           <button onClick={() => handleBet({ kind: 'column', column: 1 })} className={cn("flex items-center justify-center rounded-r-[0.95rem] border border-white/8 bg-[#1e2947] text-sm font-bold text-white transition-colors hover:bg-[#26365f] md:text-lg", isSelected({ kind: 'column', column: 1 }) && "border-white/40 bg-white/20")}>2:1</button>
        </div>
      </div>
      
      {/* Outside Bets Zone */}
      <div className="flex w-full min-w-[780px] flex-col gap-2 px-[78px] md:px-[94px]">
        <div className="grid grid-cols-3 gap-2">
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 1 })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'dozen', dozen: 1 }) && "border-white/40 bg-white/20 text-white")}>1 to 12</button>
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 2 })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'dozen', dozen: 2 }) && "border-white/40 bg-white/20 text-white")}>13 to 24</button>
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 3 })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'dozen', dozen: 3 }) && "border-white/40 bg-white/20 text-white")}>25 to 36</button>
        </div>
        <div className="grid grid-cols-6 gap-2">
           <button onClick={() => handleBet({ kind: 'low' })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'low' }) && "border-white/40 bg-white/20 text-white")}>1 to 18</button>
           <button onClick={() => handleBet({ kind: 'even' })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'even' }) && "border-white/40 bg-white/20 text-white")}>Even</button>
           <button onClick={() => handleBet({ kind: 'red' })} className={cn("rounded-[1rem] border border-rose-500/60 bg-rose-600/85 py-3 transition-all", isSelected({ kind: 'red' }) && "scale-105 border-white shadow-[0_0_15px_rgba(239,68,68,0.4)] z-10")}></button>
           <button onClick={() => handleBet({ kind: 'black' })} className={cn("rounded-[1rem] border border-slate-700 bg-[#2d3d73] py-3 transition-all", isSelected({ kind: 'black' }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10")}></button>
           <button onClick={() => handleBet({ kind: 'odd' })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'odd' }) && "border-white/40 bg-white/20 text-white")}>Odd</button>
           <button onClick={() => handleBet({ kind: 'high' })} className={cn("rounded-[1rem] border border-white/10 bg-[#141d34] py-3 text-lg font-bold text-white transition-colors hover:bg-[#1b2642]", isSelected({ kind: 'high' }) && "border-white/40 bg-white/20 text-white")}>19 to 36</button>
        </div>
      </div>
    </div>
  );
}
