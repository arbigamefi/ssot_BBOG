import React from "react";
import Link from "next/link";
import { PrototypeHeader } from "../components/PrototypeHeader";
import { DiceMiniIcon, RouletteMiniIcon, CoinTossMiniIcon, KenoMiniIcon } from "../components/PrototypeGameIcons";
import { cn } from "@ssot/ui";
import { 
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  PlayCircleIcon,
  SparklesIcon,
  TrophyIcon
} from "@heroicons/react/24/outline";

// Advanced Room Data
const games = [
  {
    title: "Precision Dice",
    tag: "Binary",
    color: "purple",
    glow: "group-hover:border-purple-500/80 group-hover:shadow-[0_0_50px_rgba(168,85,247,0.3),inset_0_2px_20px_rgba(168,85,247,0.1)]",
    buttonHover: "group-hover:bg-purple-400 group-hover:border-purple-300",
    icon: <DiceMiniIcon />,
    promise: "1-99 sizing in seconds.",
    live: 124,
    href: "/prototype/ui-ux-v2-dice"
  },
  {
    title: "European Roulette",
    tag: "Table",
    color: "emerald",
    glow: "group-hover:border-emerald-500/80 group-hover:shadow-[0_0_50px_rgba(16,185,129,0.3),inset_0_2px_20px_rgba(16,185,129,0.1)]",
    buttonHover: "group-hover:bg-emerald-400 group-hover:border-emerald-300",
    icon: <RouletteMiniIcon />,
    promise: "Classic 37-slot physical mechanics.",
    live: 312,
    href: "/prototype/ui-ux-v2-roulette"
  },
  {
    title: "Coin Toss",
    tag: "Binary",
    color: "amber",
    glow: "group-hover:border-amber-500/80 group-hover:shadow-[0_0_50px_rgba(245,158,11,0.3),inset_0_2px_20px_rgba(245,158,11,0.1)]",
    buttonHover: "group-hover:bg-amber-400 group-hover:border-amber-300",
    icon: <CoinTossMiniIcon />,
    promise: "High-speed 50/50 resolution.",
    live: 89,
    href: "/prototype/ui-ux-v2-cointoss"
  },
  {
    title: "Keno Draft",
    tag: "Lottery",
    color: "fuchsia",
    glow: "group-hover:border-fuchsia-500/80 group-hover:shadow-[0_0_50px_rgba(217,70,239,0.3),inset_0_2px_20px_rgba(217,70,239,0.1)]",
    buttonHover: "group-hover:bg-fuchsia-400 group-hover:border-fuchsia-300",
    icon: <KenoMiniIcon />,
    promise: "Pick multi-spots for massive multipliers.",
    live: 45,
    href: "/prototype/ui-ux-v2-keno"
  }
];

export default function DirectoryPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-blue-500/30">
      <PrototypeHeader />

      {/* Global Background Ambience */}
      <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/10 via-[#050505]/50 to-[#050505] pointer-events-none z-0" />
      
      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        {/* LOBBY HEADER */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-bold uppercase tracking-widest mb-6">
                <SparklesIcon className="w-4 h-4" /> Global Access Lobby
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                 Select Game Module
              </h1>
              <p className="text-lg text-white/50 leading-relaxed">
                 All modules are 100% on-chain, verifiable, and connected directly to the isolated reserve bank. Connect wallet to enter.
              </p>
           </div>

           {/* Stats summary */}
           <div className="flex gap-6 rounded-2xl border-2 border-emerald-500/20 bg-[#020202] shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)] p-4 px-6 select-none relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none opacity-20" />
              <div className="flex flex-col relative z-10">
                 <span className="text-[10px] text-emerald-500/80 uppercase tracking-widest font-bold mb-1">Live Players</span>
                 <span className="text-xl font-mono text-emerald-400 flex items-center gap-2 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">
                   <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute opacity-80" />
                   <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                   570
                 </span>
              </div>
              <div className="w-px bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.5)] relative z-10" />
              <div className="flex flex-col relative z-10">
                 <span className="text-[10px] text-amber-500/80 uppercase tracking-widest font-bold mb-1">Max Win (24h)</span>
                 <span className="text-xl font-mono text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">$12,400</span>
              </div>
           </div>
        </header>

        {/* SEARCH & FILTERS */}
        <div className="mb-10 flex flex-col sm:flex-row items-center gap-4">
           {/* Search Bar */}
           <div className="relative w-full sm:w-96 group">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400/50 group-focus-within:text-blue-400 transition-colors z-10" />
              <input 
                 type="text" 
                 placeholder="Search modules..." 
                 className="w-full bg-[#020202] border border-blue-500/30 rounded-2xl pl-12 pr-4 py-4 text-sm text-blue-50 placeholder:text-blue-500/30 focus:outline-none focus:border-blue-400 focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_2px_15px_rgba(0,0,0,1)] transition-all shadow-[inset_0_4px_15px_rgba(0,0,0,0.8)] relative z-0"
              />
           </div>

           {/* Filter Tabs */}
           <div className="flex-1 flex overflow-x-auto hide-scrollbar gap-2 w-full sm:w-auto p-1 bg-[#050505] rounded-[1.25rem] border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
              <button className="px-6 py-3.5 rounded-xl bg-blue-500 text-black text-sm font-extrabold flex-shrink-0 transition-transform shadow-[0_0_20px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)]">All Modules</button>
              <button className="px-6 py-3.5 rounded-xl bg-transparent text-white/40 hover:text-blue-300 hover:bg-blue-500/10 text-sm font-bold flex-shrink-0 transition-all border border-transparent hover:border-blue-500/30">Table Games</button>
              <button className="px-6 py-3.5 rounded-xl bg-transparent text-white/40 hover:text-blue-300 hover:bg-blue-500/10 text-sm font-bold flex-shrink-0 transition-all border border-transparent hover:border-blue-500/30">Binary / Fast</button>
              <button className="px-6 py-3.5 rounded-xl bg-transparent text-white/40 hover:text-blue-300 hover:bg-blue-500/10 text-sm font-bold flex-shrink-0 transition-all border border-transparent hover:border-blue-500/30">Lottery</button>
              <button className="px-4 py-3.5 rounded-xl bg-[#0a0a0a] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all ml-auto shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
                 <AdjustmentsHorizontalIcon className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* GAMES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
           {games.map((game) => (
             <Link 
               key={game.title} 
               href={game.href} 
               className={cn(
                 "group relative rounded-[2rem] border border-white/5 bg-[#050505] overflow-hidden transition-all flex flex-col min-h-[400px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.02),0_20px_40px_rgba(0,0,0,0.8)]",
                 game.glow
               )}
             >
               {/* Ambient Hover Gradient */}
               <div className={cn("absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none", `from-${game.color}-500/10`, "to-transparent")} />
               
               {/* Badges area */}
               <div className="absolute top-5 left-5 right-5 flex justify-between items-start z-20 pointer-events-none">
                  <div className="px-3 py-1.5 rounded-full bg-[#020202]/90 border border-white/10 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {game.tag}
                  </div>
                  <div className={cn("px-3 py-1.5 rounded-lg bg-[#020202]/90 border shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] backdrop-blur-md flex items-center gap-2", `border-${game.color}-500/40`)}>
                     <span className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]", `bg-${game.color}-500 text-${game.color}-500`)} />
                     <span className="text-xs font-mono font-bold text-white tracking-widest">{game.live}</span>
                  </div>
               </div>

               {/* Center Graphic */}
               <div className="flex-1 p-6 relative z-10 flex items-center justify-center mt-10 group-hover:scale-105 transition-transform duration-500">
                  {game.icon}
               </div>

               {/* Info Card */}
               <div className="p-6 border-t border-white/10 bg-[#0a0a0a]/90 relative z-20 backdrop-blur-xl shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] pt-8">
                 <h3 className={cn("text-2xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white", `to-${game.color}-200`)}>{game.title}</h3>
                 <p className="text-white/40 text-sm mb-6 h-10 leading-relaxed font-medium">{game.promise}</p>
                 <button className={cn(
                   "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] border border-white/10",
                   "bg-[#050505] text-white/80 group-hover:shadow-[0_0_30px_rgba(currentColor,0.4),inset_0_2px_5px_rgba(255,255,255,0.5)] group-hover:text-black",
                   game.buttonHover
                 )}>
                    Enter Module <PlayCircleIcon className="w-5 h-5 flex-shrink-0" />
                 </button>
               </div>
             </Link>
           ))}
        </div>

        {/* BOTTOM METRICS BANNER */}
        <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-[#0a0a0a] p-1 relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
           <div className="rounded-[2.4rem] bg-[#050505]/80 backdrop-blur-2xl px-8 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)] flex-shrink-0">
                    <TrophyIcon className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-bold mb-1">Global Prize Pool</h3>
                    <p className="text-white/40 text-sm">Synchronized across all SSOT modules instantly.</p>
                 </div>
              </div>
              <div className="text-4xl md:text-5xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                 $2,450,112
              </div>
           </div>
        </div>

      </main>
    </div>
  );
}
