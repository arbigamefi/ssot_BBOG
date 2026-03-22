"use client";

import React, { useState } from "react";
import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell, cn } from "@ssot/ui";
import { PrototypeGameLayout } from "../components/PrototypeGameLayout";
import { 
  CurrencyDollarIcon, WalletIcon, ChartBarIcon
} from "@heroicons/react/24/outline";

export default function KenoRoomPrototype3() {
  const [betAmount, setBetAmount] = useState("5.00");
  const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [drawnSpots, setDrawnSpots] = useState<number[]>([]);
  const [animatingSpots, setAnimatingSpots] = useState<number[]>([]);

  const handleAmountChange = (val: number) => {
     let rounded = Math.floor(val);
     if (rounded < 1) rounded = 1;
     if (rounded > 1450) rounded = 1450;
     setBetAmount(rounded.toFixed(2));
  };

  React.useEffect(() => {
     let interval: NodeJS.Timeout;
     if (isDrawing) {
        interval = setInterval(() => {
           // Hyper-kinetic strobe flashing effect mimicking a quantum scanner
           const rnd: number[] = [];
           while (rnd.length < 8) { // Flash 8 random tiles per frame
              const num = Math.floor(Math.random() * 40) + 1;
              if (!rnd.includes(num)) rnd.push(num);
           }
           setAnimatingSpots(rnd);
        }, 80); // very fast flash rates
     } else {
        setAnimatingSpots([]);
     }
     return () => clearInterval(interval);
  }, [isDrawing]);

  const toggleSpot = (num: number) => {
     if (isDrawing || showResult) return;
     if (selectedSpots.includes(num)) {
        setSelectedSpots(selectedSpots.filter(n => n !== num));
     } else {
        if (selectedSpots.length < 10) {
           setSelectedSpots([...selectedSpots, num]);
        }
     }
  };

  const autoPick = () => {
     if (isDrawing || showResult) return;
     const newPicks: number[] = [];
     while (newPicks.length < 10) {
        const num = Math.floor(Math.random() * 40) + 1;
        if (!newPicks.includes(num)) newPicks.push(num);
     }
     setSelectedSpots(newPicks);
  };

  const handleDraw = () => {
     setShowResult(false);
     setIsDrawing(true);
     setDrawnSpots([]);
     
     setTimeout(() => {
        // Generate 10 winning numbers
        const hits: number[] = [];
        while (hits.length < 10) {
           const num = Math.floor(Math.random() * 40) + 1;
           if (!hits.includes(num)) hits.push(num);
        }
        setDrawnSpots(hits);
        setIsDrawing(false);
        setAnimatingSpots([]); // Ensure anim stops
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
     }, 2500);
  };

  const matchCount = selectedSpots.filter(s => drawnSpots.includes(s)).length;
  // Dummy payout calc
  const mockMultiplier = matchCount >= 4 ? 100 : matchCount >= 3 ? 10 : matchCount >= 2 ? 2 : 0;
  const payout = parseFloat(betAmount) * mockMultiplier;

  const LeftPane = (
    <>
      <div className="flex justify-between items-center mb-6">
         <span className="text-sm font-bold text-white/60 flex items-center gap-2">
            <WalletIcon className="w-4 h-4" /> Wallet Balance
         </span>
         <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">1,450.00 USDC</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-[#050505] border border-white/10 p-4">
         <div className="flex justify-between items-center">
            <div className="flex flex-col">
               <span className="text-[10px] uppercase font-bold text-fuchsia-400 tracking-widest">Spots Picked</span>
               <span className="text-xl font-bold font-mono">{selectedSpots.length} <span className="text-white/30 text-sm">/ 10</span></span>
            </div>
            <div className="flex gap-2">
               <button onClick={autoPick} className="px-4 py-2 rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/30 text-xs font-bold transition-all shadow-[0_0_15px_rgba(217,70,239,0.2)]">Auto Pick</button>
               <button onClick={() => setSelectedSpots([])} className="px-4 py-2 rounded-xl bg-[#111] border border-white/5 text-white/40 hover:text-white hover:bg-[#222] text-xs font-bold transition-all shadow-inner">Clear</button>
            </div>
         </div>
         {selectedSpots.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
               {selectedSpots.sort((a,b)=>a-b).map(n => (
                  <div key={n} className="w-7 h-7 flex items-center justify-center rounded-md bg-fuchsia-600 text-white font-mono text-[10px] font-bold shadow-inner border border-fuchsia-400">
                     {n}
                  </div>
               ))}
            </div>
         ) : (
            <div className="text-xs text-white/20 italic mt-2">Pick up to 10 numbers on the board.</div>
         )}
      </div>

      <div className="mb-6">
         <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Bet Amount</label>
         <div className="bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative group focus-within:border-fuchsia-500/50 transition-colors shadow-inner">
            <div className="flex items-center px-4 pt-2">
               <CurrencyDollarIcon className="w-6 h-6 text-fuchsia-500/50" />
               <input 
                  type="text" 
                  value={betAmount}
                  onChange={(e) => {
                     const val = parseFloat(e.target.value);
                     if (!isNaN(val)) setBetAmount(e.target.value);
                  }}
                  className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right placeholder:text-white/20"
               />
            </div>
            <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
               <button onClick={() => handleAmountChange(1)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">Min</button>
               <button onClick={() => handleAmountChange(parseFloat(betAmount) / 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">1/2</button>
               <button onClick={() => handleAmountChange(parseFloat(betAmount) * 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">2x</button>
               <button onClick={() => handleAmountChange(1450)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">Max</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
         <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner col-span-2">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2 items-center flex gap-1">Hit Payouts ({selectedSpots.length} Picks) <ChartBarIcon className="w-3 h-3"/></span>
            {selectedSpots.length > 0 ? (
               <div className="flex justify-between text-xs font-mono font-bold">
                  <span className="text-white/40 text-[10px]">1 Hit: 0x</span>
                  <span className="text-white/60 text-[10px]">{(selectedSpots.length/4).toFixed(0)} Hits: 2x</span>
                  <span className="text-fuchsia-300 text-[10px]">{(selectedSpots.length/2).toFixed(0)} Hits: 10x</span>
                  <span className="text-fuchsia-400 text-[10px]">{selectedSpots.length} Hits: 100x</span>
               </div>
            ) : (
               <span className="text-xs text-white/20 italic">Select spots to view payout table</span>
            )}
         </div>
      </div>

      <button 
         onClick={handleDraw}
         disabled={selectedSpots.length === 0 || isDrawing}
         className={cn(
            "mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-[0_0_40px_rgba(217,70,239,0.3)] transition-all active:scale-[0.98] border-b-[4px] active:border-b hover:shadow-[0_0_60px_rgba(217,70,239,0.5)]",
            selectedSpots.length === 0 ? "bg-fuchsia-900 border-fuchsia-900 text-white/30 shadow-none hover:shadow-none" : "bg-fuchsia-600 hover:bg-fuchsia-500 border-fuchsia-400"
         )}>
         {isDrawing ? "DRAWING TICKETS..." : "DRAW TICKETS"}
      </button>
    </>
  );

  const RightPane = (
    <>
      <div className={cn("relative z-10 w-full max-w-[800px] bg-[#020202] rounded-[2.5rem] border border-white/5 p-6 md:p-8 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_2px_20px_rgba(255,255,255,0.02)] transition-all duration-700", isDrawing ? "scale-[0.98] blur-[0.5px]" : "")}>
         {/* Subtle scanline overlay to emphasize electronic draft nature */}
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none rounded-[2.5rem]" />
         
         <div className="grid grid-cols-10 gap-2 md:gap-3 relative z-10">
            {Array.from({ length: 40 }).map((_, i) => {
               const num = i + 1;
               const isSelected = selectedSpots.includes(num);
               const isDrawn = showResult && drawnSpots.includes(num);
               const isHit = isSelected && isDrawn;
               const isAnimating = isDrawing && animatingSpots.includes(num);

               return (
                  <button 
                     key={num} 
                     onClick={() => toggleSpot(num)}
                     className={cn(
                       "aspect-square rounded-xl flex items-center justify-center font-mono font-bold text-sm md:text-xl transition-all relative",
                       isHit       ? "bg-emerald-500 text-black font-extrabold shadow-[0_0_40px_rgba(16,185,129,1),inset_0_2px_10px_rgba(255,255,255,0.8)] border-[3px] border-emerald-200 scale-110 z-20 animate-pulse" :
                       isDrawn     ? "bg-[#222] text-white/40 border-b-[3px] border-[#111] scale-95 opacity-60 shadow-inner z-10" :
                       isAnimating ? "bg-fuchsia-300 text-fuchsia-950 font-extrabold shadow-[0_0_30px_rgba(232,121,249,1),inset_0_2px_10px_rgba(255,255,255,0.9)] border-[3px] border-white scale-110 z-30" :
                       isSelected  ? "bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 text-white shadow-[0_5px_20px_rgba(217,70,239,0.5),inset_0_2px_5px_rgba(255,255,255,0.4)] border-b-[4px] border-r-[2px] border-fuchsia-900 scale-105" : 
                       "bg-[#0a0a0a] border-b-[3px] border-r-[2px] border-t border-l border-white/5 text-white/40 hover:bg-[#151515] hover:text-white shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]"
                     )}
                  >
                     {num}
                  </button>
               );
            })}
         </div>
      </div>

      {showResult && (
         <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="p-8 rounded-[2rem] border border-white/10 bg-[#050505] shadow-2xl flex flex-col items-center text-center">
               <h3 className="text-xl font-bold text-white/60 uppercase tracking-widest mb-2">Draw Results</h3>
               <div className="text-5xl font-extrabold mb-4 text-fuchsia-400">{matchCount} <span className="text-2xl text-white/40">HITS</span></div>
               {payout > 0 ? (
                  <div className="flex flex-col items-center">
                     <span className="text-emerald-400 font-bold mb-1">YOU WON</span>
                     <span className="text-3xl font-mono text-emerald-300">+{payout.toFixed(2)} USDC</span>
                  </div>
               ) : (
                  <div className="flex flex-col items-center">
                     <span className="text-red-500 font-bold mb-1">NO PAYOUT</span>
                     <span className="text-xl font-mono text-red-400">-{betAmount} USDC</span>
                  </div>
               )}
            </div>
         </div>
      )}
    </>
  );

  const AuditLedger = (
   <AuditTabs activeColorClass="border-fuchsia-400 text-fuchsia-400">
      <AuditTableHeader>
         <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] text-white/30 font-bold uppercase tracking-widest text-[10px] px-4">
           <div>Time / Player</div>
           <div>Game Module</div>
           <div>Logic & Wager</div>
           <div>Settlement</div>
           <div className="text-right">Verify</div>
         </div>
      </AuditTableHeader>
      <AuditTableRow className="hover:bg-white/[0.02] transition-colors border-b border-white/5 py-4 px-4">
         <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] items-center">
           <AuditTableCell><div className="flex flex-col"><span className="text-white font-mono text-xs">14:02:11</span><span className="text-[10px] font-mono text-white/40">0xeb...2a1f</span></div></AuditTableCell>
           <AuditTableCell><span className="font-bold text-white/80">Keno Draft</span></AuditTableCell>
           <AuditTableCell><div className="flex flex-col"><span className="text-fuchsia-300 font-bold font-mono text-[10px] mb-1 truncate">PICKS: {selectedSpots.length > 0 ? selectedSpots.join(",") : "N/A"}</span><span className="text-xs text-white/50 font-mono">5.00 USDC</span></div></AuditTableCell>
           <AuditTableCell><span className="py-1.5 px-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 font-mono text-[10px] uppercase font-bold animate-pulse">Awaiting VRF...</span></AuditTableCell>
           <AuditTableCell className="justify-end"><button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">↗</button></AuditTableCell>
         </div>
      </AuditTableRow>
   </AuditTabs>
  );

  return (
    <PrototypeGameLayout 
      gameName="Keno Draft"
      themeColor="fuchsia"
      houseEdge="1.50%"
      maxPayout="500,000 USDC"
      isInteractive={true}
      leftPaneContent={LeftPane}
      rightPaneContent={RightPane}
      auditLedgerContent={AuditLedger}
    />
  );
}
