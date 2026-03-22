"use client";

import React, { useState } from "react";
import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell, cn } from "@ssot/ui";
import { PrototypeGameLayout } from "../components/PrototypeGameLayout";
import { 
  CurrencyDollarIcon, WalletIcon, InformationCircleIcon, ChartBarIcon, ShieldCheckIcon, SparklesIcon
} from "@heroicons/react/24/outline";

export default function CoinTossRoomPrototype3() {
  const [betAmount, setBetAmount] = useState<number>(10);
  const [selectedTarget, setSelectedTarget] = useState<"HEADS" | "TAILS">("HEADS");
  const [isTossing, setIsTossing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultTarget, setResultTarget] = useState<"HEADS" | "TAILS">("HEADS");
  const [flipCount, setFlipCount] = useState(0);

  const handleAmountChange = (val: number) => {
     let rounded = Math.floor(val);
     if (rounded < 1) rounded = 1;
     if (rounded > 1450) rounded = 1450;
     setBetAmount(rounded);
  };

  const handleToss = () => {
     setShowResult(false);
     setIsTossing(true);
     
     // Determine result upfront to set animation
     const result = Math.random() > 0.5 ? "HEADS" : "TAILS";
     setResultTarget(result);
     
     // trigger strict 2.5s animation
     setFlipCount(prev => prev + 1);

     setTimeout(() => {
        setIsTossing(false);
        setShowResult(true);
        setTimeout(() => setShowResult(false), 4000); // hide after 4s
     }, 2500);
  };

  const isWin = resultTarget === selectedTarget;
  const theme = selectedTarget === "HEADS" ? "amber" : "fuchsia";

  const LeftPane = (
    <>
      <div className="flex justify-between items-center mb-6">
         <span className="text-sm font-bold text-white/60 flex items-center gap-2">
             <WalletIcon className="w-4 h-4" /> Wallet Balance
         </span>
         <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">1,450 USDC</span>
      </div>

      <div className="mb-6">
         <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Call The Coin</label>
         <div className="flex bg-[#050505] p-1.5 rounded-2xl border border-white/10 relative shadow-inner">
            <div 
               className={cn("absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-out shadow-[0_0_20px_rgba(0,0,0,0.8)]", selectedTarget === "HEADS" ? "bg-gradient-to-br from-amber-400 to-amber-600 left-1.5" : "bg-gradient-to-br from-indigo-400 to-indigo-600 left-[calc(50%+4px)]")} 
            />
            <button 
               onClick={() => setSelectedTarget("HEADS")}
               className={cn("flex-1 py-4 rounded-xl font-bold uppercase tracking-wider text-sm relative z-10 transition-colors flex items-center justify-center gap-2", selectedTarget === "HEADS" ? "text-amber-950 font-extrabold" : "text-white/40 hover:text-white")}>
               <SparklesIcon className={cn("w-5 h-5", selectedTarget === "HEADS" ? "text-amber-900" : "opacity-50")} />
               Heads
            </button>
            <button 
               onClick={() => setSelectedTarget("TAILS")}
               className={cn("flex-1 py-4 rounded-xl font-bold uppercase tracking-wider text-sm relative z-10 transition-colors flex items-center justify-center gap-2", selectedTarget === "TAILS" ? "text-indigo-950 font-extrabold" : "text-white/40 hover:text-white")}>
               <ShieldCheckIcon className={cn("w-5 h-5", selectedTarget === "TAILS" ? "text-indigo-900" : "opacity-50")} />
               Tails
            </button>
         </div>
      </div>

      <div className="mb-6">
         <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Bet Amount</label>
         <div className="bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative group focus-within:border-amber-500/50 transition-colors shadow-inner">
            <div className="flex items-center px-4 pt-2">
               <CurrencyDollarIcon className={cn("w-6 h-6 transition-colors", selectedTarget === 'HEADS' ? "text-amber-500/50" : "text-indigo-500/50")} />
               <input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                  className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right placeholder:text-white/20"
               />
            </div>
            <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
               <button onClick={() => handleAmountChange(1)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">Min</button>
               <button onClick={() => handleAmountChange(betAmount / 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">1/2</button>
               <button onClick={() => handleAmountChange(betAmount * 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">2x</button>
               <button onClick={() => handleAmountChange(1450)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10">Max</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
         <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">Multiplier <InformationCircleIcon className="w-3 h-3"/></span>
            <span className={cn("text-2xl font-mono font-bold transition-colors duration-500", selectedTarget === 'HEADS' ? "text-amber-400" : "text-indigo-400")}>1.98x</span>
         </div>
         <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">Win Chance <ChartBarIcon className="w-3 h-3"/></span>
            <span className="text-2xl font-mono font-bold text-white">50%</span>
         </div>
         <div className="col-span-2 bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1">Expected Payout</span>
            <span className="text-3xl font-mono font-extrabold text-emerald-400 flex items-baseline gap-2">
               {(betAmount * 1.98).toFixed(2)} <span className="text-sm font-bold text-emerald-500/50">USDC</span>
            </span>
         </div>
      </div>

      <button 
         onClick={handleToss}
         disabled={isTossing}
         className={cn(
            "mt-8 w-full py-6 rounded-2xl font-extrabold text-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all active:scale-[0.98] border-b-[4px] active:border-b hover:shadow-[0_0_60px_rgba(255,255,255,0.1)] group",
            isTossing 
               ? "bg-[#111] border-[#000] text-white/30 cursor-not-allowed shadow-none hover:shadow-none" 
               : selectedTarget === "HEADS" 
                  ? "bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 border-amber-700 text-amber-950 shadow-[0_0_40px_rgba(245,158,11,0.4)]"
                  : "bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 border-indigo-700 text-indigo-50 shadow-[0_0_40px_rgba(99,102,241,0.4)]"
         )}>
         {isTossing ? "TOSSING..." : "FLIP COIN"}
      </button>
    </>
  );

  // Animation math for standard coin rest state vs spinning state
  const flipBase = flipCount * 1800; // 5 full spins
  const targetRotation = resultTarget === "TAILS" ? flipBase + 180 : flipBase;
  
  // Create an animation name uniquely bound to this toss to force reflow/restart
  const tossAnimationName = `toss-anim-${flipCount}`;

  const RightPane = (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ${tossAnimationName} {
          0% { 
            transform: rotateX(20deg) rotateY(0deg) translateY(0px) scale(1);
          }
          20% {
             transform: rotateX(80deg) rotateY(360deg) translateY(-250px) scale(1.3);
          }
          50% { 
             transform: rotateX(10deg) rotateY(900deg) translateY(-400px) scale(1.5);
          }
          80% {
             transform: rotateX(80deg) rotateY(1440deg) translateY(-150px) scale(1.2);
          }
          100% { 
            transform: rotateX(20deg) rotateY(${targetRotation}deg) translateY(0px) scale(1);
          }
        }

        .coin-rest {
           transform: rotateX(20deg) rotateY(${targetRotation}deg);
           transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .coin-tossing {
           animation: ${tossAnimationName} 2.5s cubic-bezier(0.3, 0.1, 0.3, 1) forwards;
        }
      `}} />

      {/* Floating Recent Logs */}
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden sm:block">
         <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/80 backdrop-blur-xl shadow-2xl">
            <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-2">Recent Flips</div>
            <div className="flex gap-2">
               {['H', 'T', 'H', 'H', 'T'].map((res, i) => (
                  <div key={i} className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold border transition-all hover:scale-110 cursor-default",
                    res === 'H' ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  )}>
                     {res}
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Majestic Coin Presentation Platform */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none">
         
         {/* Holographic Base Ring underneath */}
         <div className={cn("absolute bottom-[10%] w-[80%] max-w-[500px] h-[100px] rounded-[100%] border-[2px] transition-all duration-1000 blur-[2px]", selectedTarget === "HEADS" ? "border-amber-500/20 bg-amber-500/5 shadow-[0_0_100px_rgba(245,158,11,0.15)]" : "border-indigo-500/20 bg-indigo-500/5 shadow-[0_0_100px_rgba(99,102,241,0.15)]")} style={{ transform: 'translateY(120px) scaleY(0.4)' }}>
             <div className="absolute inset-x-8 inset-y-8 rounded-full border border-white/10" />
         </div>

         {/* The 3D Vault / Coin Container */}
         <div className="relative w-full h-full flex items-center justify-center pb-8" style={{ perspective: '1500px' }}>
            
            {/* The Coin Object */}
            <div 
               className={cn("w-48 h-48 md:w-64 md:h-64 rounded-full relative shadow-[0_50px_100px_rgba(0,0,0,0.8)]", isTossing ? "coin-tossing" : "coin-rest")}
               style={{ transformStyle: 'preserve-3d' }}
            >
               
               {/* True 3D Edge Thickness (Stacking 12 rings along Z-axis) */}
               {Array.from({ length: 12 }).map((_, i) => (
                  <div 
                     key={i}
                     className="absolute inset-0 rounded-full border-[10px] pointer-events-none backface-hidden" 
                     style={{ 
                        transform: `translateZ(-${i}px)`, 
                        borderColor: isTossing ? '#9CA3AF' : (resultTarget === 'HEADS' ? '#92400E' : '#3730A3') // Metallic transition color
                     }} 
                  />
               ))}

               {/* Front (Heads - Gold Arbitrum/Star aesthetic) */}
               <div className="absolute inset-0 rounded-full border-[10px] border-amber-300 bg-[radial-gradient(ellipse_at_top_right,#fbbf24,#b45309_70%)] flex flex-col items-center justify-center shadow-[inset_0_0_40px_rgba(120,53,15,0.8)] overflow-hidden backface-hidden" style={{ transform: 'translateZ(1px)' }}>
                  {/* Etched geometric pattern */}
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                  <div className="w-full h-full absolute inset-0 flex items-center justify-center rotate-45 opacity-20">
                     <div className="w-[120%] h-[1px] bg-white" /><div className="w-[1px] h-[120%] bg-white absolute" />
                  </div>
                  
                  {/* Central Emblem */}
                  <div className="w-32 h-32 rounded-full border-[6px] border-amber-200/50 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.6),inset_0_0_15px_rgba(120,53,15,0.8)] relative z-10 bg-amber-500/20 backdrop-blur-md">
                     <SparklesIcon className="w-14 h-14 text-amber-100 mb-1" />
                     <span className="text-2xl font-extrabold text-amber-100 tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">HEADS</span>
                  </div>
               </div>

               {/* Back (Tails - Silver/Indigo Shield aesthetic) */}
               <div className="absolute inset-0 rounded-full border-[10px] border-indigo-300 bg-[radial-gradient(ellipse_at_top_right,#818cf8,#3730a3_70%)] flex flex-col items-center justify-center shadow-[inset_0_0_40px_rgba(49,46,129,0.8)] overflow-hidden backface-hidden" style={{ transform: 'rotateY(180deg) translateZ(12px)' }}>
                  {/* Etched geometric pattern */}
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                  <div className="w-full h-full absolute inset-0 flex items-center justify-center opacity-20 relative">
                     <div className="absolute inset-4 rounded-full border-[2px] border-dashed border-white" />
                  </div>
                  
                  {/* Central Emblem */}
                  <div className="w-32 h-32 rounded-full border-[6px] border-indigo-200/50 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(129,140,248,0.6),inset_0_0_15px_rgba(49,46,129,0.8)] relative z-10 bg-indigo-500/20 backdrop-blur-md">
                     <ShieldCheckIcon className="w-14 h-14 text-indigo-100 mb-1" />
                     <span className="text-2xl font-extrabold text-indigo-100 tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">TAILS</span>
                  </div>
               </div>

            </div>
         </div>

      </div>

      {/* Target Selection Interactive Hologram Label */}
      <div className={cn("absolute bottom-12 left-1/2 -translate-x-1/2 transition-all duration-700 pointer-events-none flex flex-col items-center", isTossing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0")}>
         <span className="text-[10px] text-white/30 tracking-[0.3em] uppercase mb-2">Awaiting Toss for Target</span>
         <div className={cn("px-8 py-3 rounded-full border backdrop-blur-md font-extrabold tracking-widest text-lg transition-colors duration-500 shadow-[0_0_40px_rgba(0,0,0,0.5)]", selectedTarget === "HEADS" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400")}>
            {selectedTarget} SELECTED
         </div>
      </div>

      {/* Win/Loss Result Overlay Screen */}
      {showResult && (
         <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="p-10 rounded-[3rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden">
               {/* Result background glow */}
               <div className={cn("absolute inset-0 blur-[80px] opacity-20", isWin ? "bg-emerald-500" : "bg-red-500")} />

               <h3 className="text-xl font-bold text-white/60 uppercase tracking-widest mb-4 relative z-10">Verification Result</h3>
               <div className={cn(
                  "text-4xl font-extrabold mb-6 font-sans tracking-widest w-64 h-32 rounded-[2rem] flex items-center justify-center border-4 shadow-2xl relative z-10 transition-transform scale-110", 
                  isWin ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.5)]" : "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
               )}>
                  {resultTarget}
               </div>

               <div className="relative z-10 flex flex-col items-center">
                  {isWin ? (
                     <>
                        <span className="text-emerald-400 font-bold mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/> PREDICTION CORRECT</span>
                        <span className="text-4xl font-mono text-emerald-300 font-extrabold">+{(betAmount * 1.98).toFixed(2)} <span className="text-lg">USDC</span></span>
                     </>
                  ) : (
                     <>
                        <span className="text-red-500 font-bold mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"/> PREDICTION INCORRECT</span>
                        <span className="text-2xl font-mono text-white/30 font-bold">-{betAmount.toFixed(2)} USDC</span>
                     </>
                  )}
               </div>
            </div>
         </div>
      )}
    </>
  );

  const AuditLedger = (
   <AuditTabs activeColorClass={selectedTarget === "HEADS" ? "border-amber-400 text-amber-400" : "border-indigo-400 text-indigo-400"}>
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
           <AuditTableCell>
             <div className="flex flex-col">
               <span className="text-white font-mono text-xs">14:02:11</span>
               <span className="text-[10px] font-mono text-white/40">0xeb...2a1f</span>
             </div>
           </AuditTableCell>
           <AuditTableCell>
              <span className="font-bold text-white/80">Coin Toss</span>
           </AuditTableCell>
           <AuditTableCell>
             <div className="flex flex-col">
               <span className={cn("font-bold font-mono text-xs mb-1", selectedTarget === "HEADS" ? "text-amber-400" : "text-indigo-400")}>{selectedTarget}</span>
               <span className="text-xs text-white/50 font-mono">{betAmount} USDC</span>
             </div>
           </AuditTableCell>
           <AuditTableCell>
             <div className="flex items-center gap-2">
               <span className={cn("py-1.5 px-3 rounded-lg border font-mono text-[10px] uppercase font-bold animate-pulse", selectedTarget === "HEADS" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400")}>
                  Awaiting VRF...
               </span>
             </div>
           </AuditTableCell>
           <AuditTableCell className="justify-end">
              <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">↗</button>
           </AuditTableCell>
         </div>
      </AuditTableRow>
   </AuditTabs>
  );

  return (
     <PrototypeGameLayout 
        gameName="Coin Toss"
        themeColor={theme as any}
        houseEdge="1.00%"
        maxPayout="25,000 USDC"
        isInteractive={true}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
     />
  );
}
