import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { GlassCard } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function BetDetailPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      
      {/* 1. Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">Games</Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">Liquidity</Link>
            <Link href="/prototype/ui-ux-v2-referral" className="hover:text-white transition-colors">Affiliates</Link>
            <Link href="/prototype/ui-ux-v2-account" className="hover:text-white transition-colors">Account</Link>
          </ShellHeaderNav>
        </div>
        <ShellHeaderActions>
           <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Arbitrum
          </div>
          <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-white/70" />
          </button>
          <button className="flex items-center gap-2 bg-white/10 border border-white/10 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-white/20 transition-transform active:scale-95">
            <WalletIcon className="w-4 h-4" />
            <span>0x12...34af</span>
          </button>
        </ShellHeaderActions>
      </ShellHeader>

      <main className="max-w-2xl mx-auto px-6 py-12 md:py-24">
        
        <Link href="/prototype/ui-ux-v2-bets" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors font-bold text-sm mb-8">
           <span>←</span> Back to Tickets
        </Link>
        
        {/* Receipt Container */}
        <GlassCard glowColor="bg-green-500/20" glowPosition="top-left" padding="xl" className="border-t-4 border-t-green-500 relative shadow-[0_20px_60px_rgba(34,197,94,0.1)]">
           
           {/* Decorative watermark */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-white/[0.02] pointer-events-none select-none rotate-12">
             WON
           </div>

           {/* Header */}
           <div className="flex flex-col items-center justify-center border-b border-white/10 pb-8 mb-8 relative z-10">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4 px-3 py-1 bg-white/5 rounded-full border border-white/10">Ticket #209384</span>
              <h1 className="text-3xl font-bold mb-2 text-white">Precision Dice</h1>
              <span className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-md text-sm border border-green-500/20 uppercase tracking-widest">Settled & Won</span>
           </div>

           {/* Core Figures */}
           <div className="grid grid-cols-2 gap-4 mb-8 bg-[#050505] p-6 rounded-2xl border border-white/5 relative z-10">
              <div className="flex flex-col">
                 <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Wager Amount</span>
                 <span className="text-2xl font-mono font-bold mt-1">50.00 USDC</span>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-green-500/80 text-xs font-bold uppercase tracking-widest">Gross Payout</span>
                 <span className="text-2xl font-mono font-bold mt-1 text-green-400">98.50 USDC</span>
              </div>
           </div>

           {/* Parameters */}
           <div className="flex flex-col gap-4 border-b border-white/10 pb-8 mb-8 relative z-10">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Wager Parameters</h3>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Condition</span>
                <span className="font-mono text-white text-right">ROLL UNDER 50.00</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Target Chance</span>
                <span className="font-mono text-white text-right">50.00%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/40">Multiplier</span>
                <span className="font-mono text-white text-right">1.97x</span>
              </div>
           </div>

           {/* Provable Truth Matrix */}
           <div className="flex flex-col gap-4 relative z-10">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                 Provable Truth 
                 <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              </h3>
              
              <div className="flex flex-col p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl font-mono text-xs gap-3 text-white/60">
                 <div className="flex flex-col gap-1">
                   <span className="text-blue-400/60 font-sans text-[10px] uppercase font-bold tracking-wider">Final Result</span>
                   <span className="font-bold text-white text-base bg-blue-500/20 w-fit px-2 py-1 rounded inline-block">Rolled 45.12</span>
                 </div>
                 
                 <div className="w-full h-px bg-white/5 my-1" />

                 <div className="flex justify-between">
                   <span>Player Address</span>
                   <span className="text-blue-400 cursor-pointer hover:underline">0x12...34af</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Request Block</span>
                   <span className="text-white">182,303,800</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Settle Tx</span>
                   <span className="text-blue-400 cursor-pointer hover:underline">0xebd9...2a1f</span>
                 </div>
              </div>
           </div>

        </GlassCard>

      </main>
    </div>
  );
}
