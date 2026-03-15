"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface RouletteBoardProps {
  className?: string;
  onBetPlaced?: (type: string, value: string) => void;
}

export function RouletteBoard({ className, onBetPlaced }: RouletteBoardProps) {
  // Constants for board rendering
  const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
  
  const handleBet = (type: string, val: string) => {
    onBetPlaced?.(type, val);
  };

  return (
    <div className={cn("flex flex-col gap-4 mx-auto w-full max-w-[800px] overflow-x-auto", className)}>
      {/* 3x12 Grid + Zero */}
      <div className="flex bg-[#050505] p-2 md:p-4 rounded-xl md:rounded-3xl border border-white/5 shadow-2xl min-w-[600px] justify-center">
        {/* Zero */}
        <button 
          onClick={() => handleBet('straight', '0')}
          className="flex-shrink-0 w-12 md:w-16 flex items-center justify-center border border-white/10 rounded-l-lg md:rounded-l-2xl hover:bg-green-500/20 transition-colors text-white font-bold text-lg md:text-2xl pt-2 pb-2"
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
                onClick={() => handleBet('straight', n.toString())}
                className={cn(
                  "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-colors",
                  RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                )}
              >
                {n}
              </button>
           ))}
           {/* Middle Row: 2, 5, 8... */}
           {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
             <button 
               key={n} 
               onClick={() => handleBet('straight', n.toString())}
               className={cn(
                 "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-colors",
                 RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
               )}
             >
               {n}
             </button>
           ))}
           {/* Bottom Row: 1, 4, 7... */}
           {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
             <button 
               key={n} 
               onClick={() => handleBet('straight', n.toString())}
               className={cn(
                 "aspect-[4/3] flex items-center justify-center rounded-sm md:rounded-md text-sm md:text-lg font-bold border transition-colors",
                 RED_NUMBERS.includes(n) ? "bg-red-600/80 border-red-500 hover:bg-red-500 text-white" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
               )}
             >
               {n}
             </button>
           ))}
        </div>
        
        {/* 2-to-1 Column Bets */}
        <div className="flex-shrink-0 w-12 md:w-16 grid grid-rows-3 gap-1 md:gap-2">
           <button onClick={() => handleBet('column', '3')} className="flex items-center justify-center border border-white/10 rounded-tr-lg md:rounded-tr-2xl hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs">2:1</button>
           <button onClick={() => handleBet('column', '2')} className="flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs">2:1</button>
           <button onClick={() => handleBet('column', '1')} className="flex items-center justify-center border border-white/10 rounded-br-lg md:rounded-br-2xl hover:bg-white/10 transition-colors text-white/60 font-medium text-[10px] md:text-xs">2:1</button>
        </div>
      </div>
      
      {/* Outside Bets Zone */}
      <div className="flex flex-col gap-2 min-w-[600px] px-12 md:px-16 w-full">
        <div className="grid grid-cols-3 gap-2">
           <button onClick={() => handleBet('dozen', '1')} className="py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base">1st 12</button>
           <button onClick={() => handleBet('dozen', '2')} className="py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base">2nd 12</button>
           <button onClick={() => handleBet('dozen', '3')} className="py-2 md:py-3 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white/80 font-bold text-sm md:text-base">3rd 12</button>
        </div>
        <div className="grid grid-cols-6 gap-2">
           <button onClick={() => handleBet('half', '1-18')} className="py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm">1-18</button>
           <button onClick={() => handleBet('evenodd', 'EVEN')} className="py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm">EVEN</button>
           <button onClick={() => handleBet('color', 'RED')} className="py-2 md:py-3 bg-red-600/80 border-red-500 rounded-xl hover:bg-red-500 transition-colors"></button>
           <button onClick={() => handleBet('color', 'BLACK')} className="py-2 md:py-3 bg-zinc-800 border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors"></button>
           <button onClick={() => handleBet('evenodd', 'ODD')} className="py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm">ODD</button>
           <button onClick={() => handleBet('half', '19-36')} className="py-2 md:py-3 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white/80 font-bold text-xs md:text-sm">19-36</button>
        </div>
      </div>
    </div>
  );
}
