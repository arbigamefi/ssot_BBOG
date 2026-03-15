import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions, cn } from "@ssot/ui";
import { GlassCard } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function LiquidityPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      
      {/* 1. Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">Games</Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">Liquidity</Link>
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

      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        {/* Page Intro */}
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">House Liquidity</h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Provide USDC to the community bankroll to earn yield from the protocol's edge. 
            Liquidity providers are the house.
          </p>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 flex flex-col gap-2">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Total Pool Value (TVL)</span>
            <span className="text-3xl font-mono font-bold">$2,145,000.00</span>
            <span className="text-blue-400 text-sm font-medium mt-1">+12.4% 30d</span>
          </div>
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Est. APY</span>
            <span className="text-3xl font-mono font-bold text-green-400">18.5%</span>
            <span className="text-white/30 text-sm font-medium mt-1">Based on 7d moving average</span>
          </div>
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 flex flex-col gap-2">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">My Position</span>
            <span className="text-3xl font-mono font-bold">12,500.00 <span className="text-lg text-white/50">hUSDC</span></span>
            <span className="text-white/50 text-sm font-medium mt-1">≈ $12,625.00</span>
          </div>
        </div>

        {/* Main Interaction Area */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          
          {/* Chart / Deep Stats Area */}
          <GlassCard glowColor="bg-blue-500/20" glowPosition="top-left" padding="xl" className="min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-bold">Performance History</h3>
               <div className="flex bg-[#050505] rounded-lg border border-white/5 p-1">
                 {["1W", "1M", "ALL"].map((p, i) => (
                    <button key={p} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-colors", i === 1 ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}>{p}</button>
                 ))}
               </div>
            </div>
            
            {/* Placeholder for real chart */}
            <div className="w-full h-[300px] flex items-end justify-between px-2 pb-2 relative">
               {/* Grid lines */}
               <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                 {[1,2,3,4,5].map(i => <div key={i} className="w-full border-t border-white/10 border-dashed" />)}
               </div>
               
               {/* Fake bars */}
               {[30, 45, 20, 60, 80, 55, 90, 70, 85, 100].map((h, i) => (
                 <div key={i} className="w-[8%] bg-blue-500/20 rounded-t-sm hover:bg-blue-500/40 transition-colors relative group" style={{ height: `${h}%` }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black whitespace-nowrap px-2 py-1 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
                      +${(h * 12).toFixed(2)}
                    </div>
                 </div>
               ))}
            </div>
            
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-white/40 text-[10px] font-bold uppercase">hUSDC Price</span>
                <span className="font-mono text-white/90">1.010 USDC</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-white/40 text-[10px] font-bold uppercase">Target Utilization</span>
                 <span className="font-mono text-white/90">65.0%</span>
              </div>
               <div className="flex flex-col">
                 <span className="text-white/40 text-[10px] font-bold uppercase">Current Utilization</span>
                 <span className="font-mono text-white/90">42.1%</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-white/40 text-[10px] font-bold uppercase">Max Risk Per Bet</span>
                 <span className="font-mono text-white/90">0.5% TVL</span>
              </div>
            </div>
          </GlassCard>

          {/* Deposit / Withdraw Terminal */}
          <GlassCard padding="md" className="flex flex-col !bg-[#050505]">
            <div className="flex border-b border-white/10 mb-6">
              <button className="flex-1 pb-3 text-sm font-bold text-white border-b-2 border-blue-500">Deposit</button>
              <button className="flex-1 pb-3 text-sm font-bold text-white/40 hover:text-white transition-colors border-b-2 border-transparent">Redeem</button>
            </div>

            <div className="flex flex-col gap-6">
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between text-xs text-white/60">
                   <span>Amount</span>
                   <span>Balance: <span className="text-white font-mono">15,000.00 USDC</span></span>
                 </div>
                 <div className="relative">
                   <input type="text" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-4 px-4 font-mono text-xl focus:border-blue-500/50 focus:outline-none transition-colors" defaultValue="1000.00" />
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-white/60 transition-colors">MAX</button>
                      <span className="text-white/50 font-bold text-sm">USDC</span>
                   </div>
                 </div>
               </div>

               <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex flex-col gap-3">
                 <div className="flex justify-between text-sm">
                   <span className="text-white/50">You will receive approx.</span>
                   <span className="font-mono text-white font-bold tracking-tight">990.09 hUSDC</span>
                 </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-white/40">Exchange Rate</span>
                   <span className="font-mono text-white/60">1 hUSDC = 1.010 USDC</span>
                 </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-white/40">Network Fee</span>
                   <span className="font-mono text-white/60">~$0.04</span>
                 </div>
               </div>

               <button className="w-full mt-auto py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all active:scale-[0.98]">
                 Supply USDC
               </button>
               <p className="text-center text-[10px] text-white/30">
                 Deposits are subject to a 24-hour mandatory lockup to prevent front-running.
               </p>
            </div>
          </GlassCard>

        </div>
      </main>
    </div>
  );
}
