import React from "react";
import { PrototypeHeader } from "../components/PrototypeHeader";
import { cn } from "@ssot/ui";
import { 
  BanknotesIcon, 
  ArrowTrendingUpIcon, 
  ShieldExclamationIcon,
  CircleStackIcon,
  ChartBarIcon,
  ArrowsRightLeftIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

export default function LiquidityPrototype3() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-emerald-500/30">
      <PrototypeHeader activeRoute="liquidity" />

      {/* Grid Pattern Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)] pointer-events-none z-0" />
      
      {/* Top Emerald Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-emerald-600/10 blur-[120px] pointer-events-none rounded-full z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-8 md:py-12">
        
        {/* HEADER SECTION */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                <CircleStackIcon className="w-4 h-4" /> USDC Isolated Bankroll
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
                 Provide Liquidity.<br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Earn the Mathematical Edge.</span>
              </h1>
              <p className="text-lg text-white/50 leading-relaxed max-w-2xl mt-4">
                 ArbiGameFi operates on protocol-owned Isolated Banks. When players lose against the pure-function games, the strictly regulated Bank wins. No black box pools, just transparent reserves.
              </p>
           </div>
           
           <div className="flex flex-col gap-2 p-5 rounded-2xl border-2 border-emerald-500/20 bg-[#020202] min-w-[300px] shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none opacity-20" />
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold flex justify-between relative z-10">
                 <span>Contract Address</span>
                 <span className="text-emerald-400 drop-shadow-[0_0_5px_#34d399] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified</span>
              </div>
              <div className="font-mono text-sm text-white/90 bg-[#050505] border border-white/5 rounded px-3 py-2 cursor-copy hover:border-emerald-500/50 hover:text-emerald-300 transition-colors text-center shadow-[inset_0_2px_5px_rgba(0,0,0,1)] relative z-10">
                 0x8B32df...f10A49
              </div>
           </div>
        </header>

         {/* METRICS DASHBOARD */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {/* Metric 1 */}
            <div className="p-6 rounded-[1.5rem] border border-emerald-500/30 bg-[#050505] shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)] relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
               <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-400 mb-4 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Current APY</div>
               <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-emerald-200 to-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] relative z-10 cursor-default">
                  24.50%
               </div>
               <div className="mt-3 text-xs text-emerald-400/80 font-mono tracking-tighter flex items-center gap-1 relative z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]" />
                  7-Day Rolling Average
               </div>
            </div>

            {/* Metric 2 */}
            <div className="p-6 rounded-[1.5rem] border border-blue-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(59,130,246,0.05)] group hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1),inset_0_2px_15px_rgba(59,130,246,0.05)] transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full pointer-events-none" />
               <CircleStackIcon className="w-6 h-6 text-blue-400 mb-4 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Total Free Capital (R)</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  $2,450,112
               </div>
               <div className="mt-3 text-xs text-white/40 font-medium relative z-10">
                  Ready to underwrite bets
               </div>
            </div>

            {/* Metric 3 */}
            <div className="p-6 rounded-[1.5rem] border border-amber-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(245,158,11,0.05)] group hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1),inset_0_2px_15px_rgba(245,158,11,0.05)] transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none" />
               <ClockIcon className="w-6 h-6 text-amber-400 mb-4 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" />
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Pending Liabilities</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  $45,230
               </div>
               <div className="mt-3 text-xs text-amber-400/60 font-medium relative z-10">
                  Locked for unsettled module tickets
               </div>
            </div>

            {/* Metric 4 */}
            <div className="p-6 rounded-[1.5rem] border border-purple-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(168,85,247,0.05)] group hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.1),inset_0_2px_15px_rgba(168,85,247,0.05)] transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[50px] rounded-full pointer-events-none" />
               <ChartBarIcon className="w-6 h-6 text-purple-400 mb-4 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Max Ticket Cap (1.5% R)</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  $36,751
               </div>
               <div className="mt-3 text-xs text-white/40 font-medium relative z-10">
                  Dynamic max payout bound
               </div>
            </div>
         </div>

        {/* CORE INTERACTION SPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
           
           {/* Left: Charts and Deep Dive */}
           <div className="flex flex-col gap-8">
              {/* Performance Chart Mock */}
              <div className="rounded-[2rem] border border-white/5 bg-[#050505] p-6 lg:p-8 flex flex-col min-h-[400px] relative overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.02),0_20px_40px_rgba(0,0,0,0.8)]">
                 <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                       <h3 className="text-xl font-bold mb-1 text-white">Bankroll Equity Curve</h3>
                       <p className="text-sm text-emerald-500/80 font-mono tracking-tighter">Historical growth driven by strict mathematical edge.</p>
                    </div>
                    <div className="flex bg-[#020202] rounded-xl p-1 border border-white/10 shadow-[inset_0_2px_5px_rgba(0,0,0,1)]">
                       {['1W', '1M', '3M', 'ALL'].map((tf, i) => (
                          <button key={tf} className={cn("px-5 py-1.5 text-xs font-bold rounded-lg transition-all", i === 1 ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2),inset_0_1px_2px_rgba(255,255,255,0.2)] border border-emerald-500/30" : "text-white/40 hover:text-white hover:bg-white/5 border border-transparent")}>
                             {tf}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Simulated Graph */}
                 <div className="flex-1 w-full bg-[#020202] rounded-2xl border border-white/10 relative flex items-end justify-between px-2 pt-20 shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
                    
                    {/* SVG Curve Mock */}
                    <svg className="absolute inset-x-0 bottom-0 w-full h-full text-emerald-500/20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
                          <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>
                      <path d="M0,100 L0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5 L100,100 Z" fill="url(#grad1)" />
                      <path d="M0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5" fill="none" stroke="#34d399" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 5px rgba(52,211,153,0.8))' }} />
                    </svg>

                    {/* Bar scatter */}
                    {[...Array(24)].map((_, i) => {
                       const h = 20 + Math.random() * 60 + i;
                       return (
                         <div key={i} className="w-[3%] bg-emerald-500/20 border-t border-emerald-400/50 rounded-t-sm hover:bg-emerald-400 hover:shadow-[0_0_15px_#34d399] transition-all relative group z-10" style={{ height: `${h}%` }}>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#020202] border border-emerald-500/50 text-emerald-400 text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-mono whitespace-nowrap pointer-events-none shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                               +${Math.floor(Math.random() * 5000)}
                            </div>
                         </div>
                       );
                    })}
                 </div>
              </div>

              {/* Risk Engine Panel */}
              <div className="rounded-[2rem] border-2 border-orange-500/30 bg-[#0a0a0a] shadow-[0_0_30px_rgba(249,115,22,0.05),inset_0_2px_15px_rgba(249,115,22,0.05)] p-6 flex gap-6 items-start relative overflow-hidden">
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-50" />
                 <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0 relative z-10 shadow-[inset_0_2px_5px_rgba(255,255,255,0.2)]">
                    <ShieldExclamationIcon className="w-7 h-7 text-orange-400 drop-shadow-[0_0_5px_#fb923c]" />
                 </div>
                 <div className="relative z-10">
                    <h3 className="text-orange-400 font-bold mb-2 flex items-center gap-2 drop-shadow-[0_0_5px_#fb923c]">SSOT Risk Engine is Active <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /></h3>
                    <p className="text-sm text-white/50 leading-relaxed font-mono tracking-tighter">
                       This bank uses rigid upper-bound risk checks. Payouts for un-settled tickets are strictly locked from the free capital pool. Withdrawals are instant but naturally capped by un-finalized protocol liabilities.
                    </p>
                 </div>
              </div>
           </div>

           {/* Right: Interaction Terminal */}
           <div className="flex flex-col">
              <div className="rounded-[2.5rem] border border-blue-500/20 bg-[#020202] shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_2px_15px_rgba(255,255,255,0.02)] p-2 relative overflow-hidden h-full">
                 <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
                 
                 <div className="bg-[#050505] rounded-[2.2rem] border border-white/5 h-full p-6 md:p-8 flex flex-col relative z-10 shadow-[inner_0_0_20px_rgba(0,0,0,1)]">
                    
                    {/* Tabs */}
                    <div className="flex mb-8 bg-[#020202] rounded-xl p-1 border border-white/5 shadow-[inset_0_2px_5px_rgba(0,0,0,1)]">
                       <button className="flex-1 py-3 text-sm font-bold text-emerald-400 bg-emerald-500/10 rounded-lg shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] border border-emerald-500/20">Deposit USDC</button>
                       <button className="flex-1 py-3 text-sm font-bold text-white/40 hover:text-white transition-colors rounded-lg border border-transparent">Redeem</button>
                    </div>

                    <p className="text-white/40 text-sm mb-6 leading-relaxed font-mono tracking-tighter">Deposit USDC into the house bankroll to begin accruing real yield from global game settlements.</p>

                    {/* Input Field */}
                    <div className="bg-[#020202] border border-emerald-500/30 shadow-[inset_0_2px_15px_rgba(0,0,0,1)] rounded-2xl p-5 mb-6 focus-within:border-emerald-400 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.2),inset_0_2px_15px_rgba(0,0,0,1)] transition-all group">
                       <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 group-focus-within:text-emerald-400">Amount</span>
                          <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10">Balance: 14,500.00</span>
                       </div>
                       <div className="flex items-center gap-4">
                          <BanknotesIcon className="w-8 h-8 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                          <input 
                             type="text" 
                             placeholder="0.00" 
                             className="bg-transparent border-none outline-none text-4xl font-mono font-extrabold text-white w-full placeholder:text-white/10"
                          />
                          <button className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-xs font-extrabold text-emerald-400 transition-colors border border-emerald-500/30 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)]">MAX</button>
                       </div>
                    </div>

                    {/* Transaction Preview */}
                    <div className="rounded-xl border border-white/5 bg-[#020202] p-5 flex flex-col gap-4 mb-8 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]">
                       <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                          <span className="text-white/40 font-bold tracking-wide">Expected APY</span>
                          <span className="text-emerald-400 font-extrabold drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">~24.50%</span>
                       </div>
                       <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                          <span className="text-white/40 font-bold tracking-wide">Lockup Period</span>
                          <span className="text-white font-mono font-bold">0 Epochs (Instant)</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-white/40 font-bold tracking-wide">Network Fee</span>
                          <span className="text-white font-mono font-bold flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />
                             $0.02
                          </span>
                       </div>
                    </div>

                    {/* Action Button */}
                    <button className="mt-auto w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] transition-all active:scale-[0.98] text-lg flex items-center justify-center gap-2 border border-emerald-300 pointer-events-auto">
                       Supply Liquidity <ArrowsRightLeftIcon className="w-5 h-5" strokeWidth={3} />
                    </button>
                    <p className="text-center text-[10px] text-emerald-500/50 pt-5 font-mono uppercase tracking-widest font-bold">Smart Contract Fully Audited</p>

                 </div>
              </div>
           </div>

        </div>
      </main>
    </div>
  );
}
