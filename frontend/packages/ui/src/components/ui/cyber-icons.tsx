import React from "react";
import { cn } from "../../lib/utils";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

export const DiceMiniIcon = () => (
  <div className="relative w-32 h-32 flex items-center justify-center group-hover:scale-110 transition-transform duration-700" style={{ perspective: '800px' }}>
    <div className="w-20 h-20 relative animate-[spin_6s_linear_infinite]" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(45deg)' }}>
      {/* Front Face */}
      <div className="absolute inset-0 bg-purple-600/90 border-2 border-purple-300 rounded-xl shadow-[inset_0_0_20px_rgba(168,85,247,0.8)] flex items-center justify-center" style={{ transform: 'translateZ(40px)', backfaceVisibility: 'hidden' }}>
         <span className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_10px_white]">42</span>
      </div>
      {/* Back Face */}
      <div className="absolute inset-0 bg-purple-900/90 border-2 border-purple-500 rounded-xl flex items-center justify-center" style={{ transform: 'rotateY(180deg) translateZ(40px)', backfaceVisibility: 'hidden' }} />
      {/* Right Face */}
      <div className="absolute inset-0 bg-purple-700/90 border-2 border-purple-400 rounded-xl flex items-center justify-center flex-col gap-1" style={{ transform: 'rotateY(90deg) translateZ(40px)', backfaceVisibility: 'hidden' }}>
         <div className="w-3 h-3 bg-purple-200 rounded-full shadow-[0_0_5px_white]" />
         <div className="w-3 h-3 bg-purple-200 rounded-full shadow-[0_0_5px_white]" />
      </div>
      {/* Left Face */}
      <div className="absolute inset-0 bg-purple-800/90 border-2 border-purple-500 rounded-xl flex items-center justify-center" style={{ transform: 'rotateY(-90deg) translateZ(40px)', backfaceVisibility: 'hidden' }} />
      {/* Top Face */}
      <div className="absolute inset-0 bg-purple-500/90 border-2 border-purple-300 rounded-xl flex items-center justify-center" style={{ transform: 'rotateX(90deg) translateZ(40px)', backfaceVisibility: 'hidden' }} />
      {/* Bottom Face */}
      <div className="absolute inset-0 bg-purple-950/90 border-2 border-purple-700 rounded-xl flex items-center justify-center" style={{ transform: 'rotateX(-90deg) translateZ(40px)', backfaceVisibility: 'hidden' }} />
    </div>
    <div className="absolute bottom-0 w-24 h-4 bg-purple-500/30 blur-xl rounded-full" />
  </div>
);

export const RouletteMiniIcon = () => (
  <div className="relative w-32 h-32 flex items-center justify-center group-hover:scale-110 transition-transform duration-700 shadow-[0_20px_40px_rgba(0,0,0,0.8)] rounded-full border-4 border-[#222]">
    {/* Mahogany Rim */}
    <div className="absolute inset-0 rounded-full border-[6px] border-[#2C1810] shadow-[inset_0_0_15px_black] ring-2 ring-[#B8860B] bg-[#111]" />
    
    {/* Conic Rotating Inner Drum */}
    <div className="w-[82%] h-[82%] rounded-full absolute group-hover:animate-[spin_2s_cubic-bezier(0.1,0.7,0.1,1)_infinite] overflow-hidden border border-[#B8860B]/50 flex items-center justify-center"
         style={{ background: 'repeating-conic-gradient(#b91c1c 0 9.72deg, #1a1a1a 9.72deg 19.45deg)' }}
    >
       {/* Small green zero slot */}
       <div className="absolute inset-0 bg-[conic-gradient(from_-4.86deg,#059669_0_9.72deg,transparent_9.72deg_360deg)]" />
       
       {/* Turret */}
       <div className="w-[35%] h-[35%] rounded-full absolute bg-[radial-gradient(circle_at_30%_30%,#FDE047,#B8860B_70%,#4527A0)] shadow-[0_0_15px_black] border-[3px] border-[#222]" />
    </div>

    {/* Spinning Ball Orbit */}
    <div className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite] group-hover:animate-[spin_1s_linear_infinite_reverse]">
      <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_white]" />
    </div>
  </div>
);

export const CoinTossMiniIcon = () => (
  <div className="relative w-32 h-32 flex items-center justify-center group-hover:scale-110 transition-transform duration-700" style={{ perspective: '800px' }}>
    <div className="w-24 h-24 relative group-hover:animate-[spin_1.5s_linear_infinite]" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(20deg) rotateY(15deg)' }}>
       
       {/* True 3D Edge Thickness */}
       {Array.from({ length: 6 }).map((_, i) => (
          <div 
             key={i}
             className="absolute inset-0 rounded-full border-[6px] border-[#B45309] pointer-events-none" 
             style={{ transform: `translateZ(-${i}px)`, backfaceVisibility: 'hidden' }} 
          />
       ))}

       {/* Front Face (Heads) */}
       <div className="absolute inset-0 rounded-full border-[6px] border-amber-300 bg-[radial-gradient(ellipse_at_top_right,#fbbf24,#b45309_70%)] flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(120,53,15,0.8)] overflow-hidden" style={{ transform: 'translateZ(1px)', backfaceVisibility: 'hidden' }}>
          <div className="w-14 h-14 rounded-full border-[3px] border-amber-200/50 flex flex-col items-center justify-center shadow-[inset_0_0_10px_rgba(120,53,15,0.8)] relative z-10 bg-amber-500/20 backdrop-blur-md">
             <SparklesIcon className="w-6 h-6 text-amber-100" />
          </div>
       </div>

       {/* Back Face (Tails) */}
       <div className="absolute inset-0 rounded-full border-[6px] border-indigo-300 bg-[radial-gradient(ellipse_at_top_right,#818cf8,#3730a3_70%)] flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(49,46,129,0.8)] overflow-hidden" style={{ transform: 'rotateY(180deg) translateZ(6px)', backfaceVisibility: 'hidden' }}>
          <div className="w-14 h-14 rounded-full border-[3px] border-indigo-200/50 flex flex-col items-center justify-center shadow-[inset_0_0_10px_rgba(49,46,129,0.8)] relative z-10 bg-indigo-500/20 backdrop-blur-md">
             <ShieldCheckIcon className="w-6 h-6 text-indigo-100" />
          </div>
       </div>
    </div>
    <div className="absolute bottom-1 w-24 h-4 rounded-[100%] border border-amber-500/20 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.3)] blur-[1px]" />
  </div>
);

export const KenoMiniIcon = () => (
  <div className="relative w-32 h-32 flex flex-wrap items-center justify-center gap-[4px] bg-[#050505] border border-white/5 rounded-2xl p-3 group-hover:scale-110 transition-transform duration-700 shadow-[inset_0_0_20px_rgba(217,70,239,0.1)]">
    {Array.from({ length: 16 }).map((_, i) => {
       const isHit = i === 2 || i === 5 || i === 10 || i === 13;
       return (
         <div 
           key={i} 
           className={cn(
             "w-[22%] aspect-square rounded-[4px] border flex items-center justify-center font-mono text-[8px] font-bold shadow-inner transition-colors duration-300",
             isHit ? "bg-fuchsia-500 border-fuchsia-300 text-white shadow-[0_0_15px_rgba(217,70,239,0.8)] group-hover:animate-pulse" : "bg-white/5 border-white/10 text-white/30"
           )}
         >
           {i+1}
         </div>
       );
    })}
  </div>
);
