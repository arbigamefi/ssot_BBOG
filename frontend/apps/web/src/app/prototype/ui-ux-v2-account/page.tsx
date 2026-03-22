import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { cn } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { PrototypeHeader } from "../components/PrototypeHeader";

export default function AccountPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30">
      
      {/* 1. Global Product Header */}
      <PrototypeHeader activeRoute="account" />

      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16 flex flex-col gap-12">
        
        {/* Account Header Section */}
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end mb-4">
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 group cursor-pointer perspective-1000">
               {/* Holographic Glowing Base */}
               <div className="absolute inset-0 bg-indigo-500/10 blur-[20px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-500" />
               <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 group-hover:border-indigo-400 group-hover:animate-[spin_4s_linear_infinite] transition-all" />
               <div className="absolute inset-2 rounded-full border border-indigo-400/50 border-dashed animate-[spin_10s_linear_infinite_reverse]" />
               
               <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#111] rounded-full shadow-[inset_0_2px_15px_rgba(99,102,241,0.2)] border border-indigo-500/30 z-10 group-hover:scale-105 transition-transform duration-500">
                 <UserCircleIcon className="w-14 h-14 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
               </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Encrypted Identity
              </div>
              <h1 className="text-4xl md:text-5xl font-mono font-extrabold tracking-tight text-white flex items-center gap-3 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                0x12...34af
                <button className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-sans text-white/50 hover:text-white shadow-[0_0_10px_rgba(255,255,255,0)] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]">Copy</button>
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/50 font-medium">
                 <span>Joined Mar 2026</span>
                 <span className="text-white/20">•</span>
                 <span className="text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 transition-colors">Arbiscan ↗</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="px-8 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-black font-bold text-sm shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all active:scale-95 flex items-center gap-2">
               Deposit / Withdraw <WalletIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Balances - Cyber Terminal Style */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* Total Value Vault */}
           <div className="p-8 rounded-[2rem] border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-[#050505] shadow-[inset_0_0_40px_rgba(99,102,241,0.05),0_10px_40px_rgba(0,0,0,0.5)] flex flex-col justify-center relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 blur-[50px] rounded-full group-hover:bg-indigo-500/20 transition-all" />
              <span className="text-indigo-300/50 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                 <div className="w-2 h-2 rounded-sm bg-indigo-500/50" /> Total Vault Value
              </span>
              <span className="text-4xl md:text-5xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 drop-shadow-[0_0_20px_rgba(99,102,241,0.3)] mb-2">$16,501.20</span>
              <span className="text-indigo-400 max-w-[200px] text-xs font-medium leading-relaxed">Cryptographically secured combined assets.</span>
           </div>

           {/* Asset Breakdown Terminal */}
           <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between col-span-1 lg:col-span-3 relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-6">Asset Breakdown</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                 {/* USDC Free */}
                 <div className="flex flex-col group/item">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-3 h-3 rounded bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                       <span className="font-mono text-3xl font-bold text-white group-hover/item:text-shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all">4,001.20</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">USDC</span>
                    <span className="text-white/30 text-xs">Ready to underwrite games</span>
                 </div>
                 
                 {/* hUSDC LP */}
                 <div className="flex flex-col md:border-l border-white/5 md:pl-8 group/item">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-3 h-3 rounded bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                       <span className="font-mono text-3xl font-bold text-blue-400 group-hover/item:text-shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">12,500.00</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-400/50 mb-1">hUSDC</span>
                    <span className="text-white/30 text-xs">Generating bankroll yield</span>
                 </div>
                 
                 {/* vAGF Rewards */}
                 <div className="flex flex-col md:border-l border-white/5 md:pl-8 group/item">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-3 h-3 rounded bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse" />
                       <span className="font-mono text-3xl font-bold text-amber-500 group-hover/item:text-shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all">24.50</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-500/50 mb-1">vAGF</span>
                    <span className="text-white/30 text-xs">Unclaimed protocol rewards</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Audit / Journal Section */}
        <div className="mt-8">
           <div className="flex justify-between items-end mb-8">
              <div>
                 <h2 className="text-2xl font-bold tracking-tight mb-1">Transaction Journal</h2>
                 <p className="text-white/50 text-sm">Cryptographically verifiable on-chain actions mapped to your wallet.</p>
              </div>
           </div>
           
           <AuditTabs activeColorClass="border-indigo-400 text-indigo-400">
             <AuditTableHeader>
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Date / Hash</div>
                  <div>Event Type / Action</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div className="text-right">Chain</div>
                </div>
             </AuditTableHeader>
             
             {[
               { date: '15 Mins Ago', hash: '0xebd9...2a1f', type: 'Deposit USDC', module: 'Bank', amount: '+1,000.00 USDC', status: 'Confirmed', icon: 'green' },
               { date: '2 Hours Ago', hash: '0x12a4...fc99', type: 'Provide Liquidity', module: 'HousePool', amount: '-12,500.00 USDC', status: 'Confirmed', icon: 'green' },
               { date: 'Yesterday', hash: '0x44bf...11d2', type: 'Game Bet (Roulette)', module: 'GameEngine', amount: '-10.00 USDC', status: 'Confirmed', icon: 'green' },
               { date: 'Yesterday', hash: '0x99cc...e33d', type: 'Game Payout', module: 'Bank', amount: '+36.00 USDC', status: 'Confirmed', icon: 'green' },
             ].map((tx, i) => (
                <AuditTableRow key={i}>
                  <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] items-center">
                    <AuditTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-white">{tx.date}</span>
                        <span className="text-xs font-mono text-white/30 hover:text-white transition-colors cursor-pointer">{tx.hash}</span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-white font-medium">{tx.type}</span>
                        <span className="text-xs text-white/40">{tx.module}</span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className={cn("font-mono font-bold text-sm", tx.amount.startsWith('+') ? "text-green-400" : "text-white/60")}>
                         {tx.amount}
                      </span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className="py-1 px-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 font-mono text-[10px] uppercase font-bold tracking-widest">{tx.status}</span>
                    </AuditTableCell>
                    <AuditTableCell className="justify-end transition-transform hover:translate-x-1 cursor-pointer text-white/30 hover:text-white">
                      ↗
                    </AuditTableCell>
                  </div>
                </AuditTableRow>
             ))}
           </AuditTabs>
        </div>

      </main>
    </div>
  );
}
