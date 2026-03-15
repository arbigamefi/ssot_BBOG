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
    <div className={cn("flex flex-col gap-4 mx-auto w-full max-w-[800px] overflow-x-auto", className)}>
      {/* 3x12 Grid + Zero */}
      <div className="flex bg-[#050505] p-2 md:p-4 rounded-xl md:rounded-3xl border border-white/5 shadow-2xl min-w-[600px] justify-center">
        {/* Zero */}
        <button 
          onClick={() => handleBet({ kind: 'straight', number: 0 })}
          className={cn(
            "flex-shrink-0 w-12 md:w-16 flex items-center justify-center border border-white/10 rounded-l-lg md:rounded-l-2xl hover:bg-green-500/20 transition-all text-white font-bold text-lg md:text-2xl pt-2 pb-2",
            isSelected({ kind: 'straight', number: 0 }) && "bg-green-500/30 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          )}
          style={{ backgroundImage: "linear-gradient(to bottom, transparent, rgba(34, 197, 94, 0.1))" }}
        >
          <span className="-rotate-90">0</span>
        </button>
        
        {/* Main Grid: Rows are dynamically ordered for European Roulette visual layout */}
        <div className="flex-1 grid grid-cols-12 gap-1 md:gap-2 px-1 md:px-2">
           {/* Top Row: 3, 6, 9... */}
           {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
              <button 
                key={n} 
                onClick={() => handleBet({ kind: 'straight', number: n })}
                className={cn(
                  "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-all",
                  RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
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
                 "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-all",
                 RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
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
                 "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-all",
                 RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
                 isSelected({ kind: 'straight', number: n }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
               )}
             >
               {n}
             </button>
           ))}
        </div>
        
        {/* 2-to-1 Column Bets */}
        <div className="flex-shrink-0 w-12 md:w-16 grid grid-rows-3 gap-1 md:gap-2">
           <button onClick={() => handleBet({ kind: 'column', column: 3 })} className={cn("flex items-center justify-center border border-white/10 rounded-tr-lg md:rounded-tr-2xl hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs", isSelected({ kind: 'column', column: 3 }) && "bg-white/20 border-white/40 text-white")}>2:1</button>
           <button onClick={() => handleBet({ kind: 'column', column: 2 })} className={cn("flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs", isSelected({ kind: 'column', column: 2 }) && "bg-white/20 border-white/40 text-white")}>2:1</button>
           <button onClick={() => handleBet({ kind: 'column', column: 1 })} className={cn("flex items-center justify-center border border-white/10 rounded-br-lg md:rounded-br-2xl hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs", isSelected({ kind: 'column', column: 1 }) && "bg-white/20 border-white/40 text-white")}>2:1</button>
        </div>
      </div>
      
      {/* Outside Bets Zone */}
      <div className="flex flex-col gap-2 min-w-[600px] px-12 md:px-16 w-full">
        <div className="grid grid-cols-3 gap-2">
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 1 })} className={cn("py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base", isSelected({ kind: 'dozen', dozen: 1 }) && "bg-white/20 border-white/40 text-white")}>1st 12</button>
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 2 })} className={cn("py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base", isSelected({ kind: 'dozen', dozen: 2 }) && "bg-white/20 border-white/40 text-white")}>2nd 12</button>
           <button onClick={() => handleBet({ kind: 'dozen', dozen: 3 })} className={cn("py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base", isSelected({ kind: 'dozen', dozen: 3 }) && "bg-white/20 border-white/40 text-white")}>3rd 12</button>
        </div>
        <div className="grid grid-cols-6 gap-2">
           <button onClick={() => handleBet({ kind: 'low' })} className={cn("py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm", isSelected({ kind: 'low' }) && "bg-white/20 border-white/40 text-white")}>1-18</button>
           <button onClick={() => handleBet({ kind: 'even' })} className={cn("py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm", isSelected({ kind: 'even' }) && "bg-white/20 border-white/40 text-white")}>EVEN</button>
           <button onClick={() => handleBet({ kind: 'red' })} className={cn("py-2 md:py-3 bg-red-600/80 border-red-500 rounded-xl hover:bg-red-500 transition-all", isSelected({ kind: 'red' }) && "scale-105 border-white shadow-[0_0_15px_rgba(239,68,68,0.4)] z-10")}></button>
           <button onClick={() => handleBet({ kind: 'black' })} className={cn("py-2 md:py-3 bg-zinc-800 border-zinc-700 rounded-xl hover:bg-zinc-700 transition-all", isSelected({ kind: 'black' }) && "scale-105 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10")}></button>
           <button onClick={() => handleBet({ kind: 'odd' })} className={cn("py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm", isSelected({ kind: 'odd' }) && "bg-white/20 border-white/40 text-white")}>ODD</button>
           <button onClick={() => handleBet({ kind: 'high' })} className={cn("py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm", isSelected({ kind: 'high' }) && "bg-white/20 border-white/40 text-white")}>19-36</button>
        </div>
      </div>
    </div>
  );
}
