import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { PrototypeHeader } from "../components/PrototypeHeader";

export default function BetsListPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      
      {/* 1. Global Product Header */}
      <PrototypeHeader activeRoute="bets" />

      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 relative z-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">My Tickets</h1>
            <p className="text-white/40 text-sm font-mono tracking-widest uppercase">Decentralized Wagering Ledger</p>
          </div>
          
          <div className="flex gap-2 p-1.5 bg-[#050505] border border-white/10 rounded-[1.25rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
             <button className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-white/30 hover:text-white hover:bg-white/5 uppercase tracking-widest">Open</button>
             <button className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-green-500/40 hover:text-green-400 hover:bg-green-500/10 uppercase tracking-widest">Won</button>
             <button className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-white/30 hover:text-white hover:bg-white/5 uppercase tracking-widest">Lost</button>
             <button className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] uppercase tracking-widest border border-white/20">All Tickets</button>
          </div>
        </div>

        {/* Global Audit View using standard component */}
        <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-b from-[#0a0a0a] to-[#020202] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
          
          <AuditTabs activeColorClass="border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/10">
             <AuditTableHeader>
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] text-white/30 font-bold uppercase tracking-[0.2em] text-[10px] pb-4 border-b border-white/5 mb-4">
                    <div>Timestamp / Block</div>
                    <div>Protocol / Target</div>
                    <div>Capital At Risk</div>
                    <div>Settlement</div>
                    <div>Status</div>
                    <div className="text-right">Action</div>
                </div>
             </AuditTableHeader>

             {/* Deep Dark Rows */}
             <div className="flex flex-col gap-3">
               <Link href="/prototype/ui-ux-v2-bet-detail">
                 <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all hover:bg-[#0a0a0a] hover:border-blue-500/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] cursor-pointer group">
                    <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-white/80 font-mono text-sm group-hover:text-white transition-colors">Mar 14, 2026 14:02 PM</span>
                          <span className="text-[10px] font-mono text-white/20 hidden sm:block uppercase tracking-widest">BLK: 182304112</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-blue-100 font-bold tracking-tight">European Roulette</span>
                          <span className="text-[10px] font-mono text-blue-400/50 uppercase tracking-widest animate-pulse">Awaiting VRF Node...</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-sm font-bold text-white/80">10.00 USDC</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-sm text-white/20">PENDING</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="py-1.5 px-3 border border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold text-[10px] uppercase tracking-widest rounded-lg animate-[pulse_2s_infinite] shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                            In Progress
                         </span>
                      </AuditTableCell>
                      <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/20 group-hover:text-blue-400 font-bold uppercase text-[10px] tracking-widest">
                         Decrypt ↗
                      </AuditTableCell>
                    </div>
                 </div>
               </Link>
               
               <Link href="/prototype/ui-ux-v2-bet-detail">
                 <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all hover:bg-[#0a0a0a] hover:border-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.1)] cursor-pointer group">
                    <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-white/80 font-mono text-sm group-hover:text-white transition-colors">Mar 14, 2026 13:45 PM</span>
                          <span className="text-[10px] font-mono text-white/20 hidden sm:block uppercase tracking-widest">BLK: 182303800</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-green-50 font-bold tracking-tight">Precision Dice</span>
                          <span className="text-[10px] font-mono text-white/30 truncate max-w-[120px]">0xebd9cc...2a1f</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-sm font-bold text-white/80">50.00 USDC</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-lg font-bold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">+98.50 USDC</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="py-1.5 px-3 border border-green-500/30 bg-green-500/10 text-green-400 font-bold text-[10px] uppercase tracking-widest rounded-lg shrink-0 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                            Confirmed
                         </span>
                      </AuditTableCell>
                      <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/20 group-hover:text-green-400 font-bold uppercase text-[10px] tracking-widest">
                         Receipt ↗
                      </AuditTableCell>
                    </div>
                 </div>
               </Link>

               <Link href="/prototype/ui-ux-v2-bet-detail">
                 <div className="rounded-[1.5rem] border border-white/5 bg-[#020202] p-4 transition-all hover:bg-[#050505] hover:border-white/20 hover:shadow-[0_0_25px_rgba(255,255,255,0.05)] cursor-pointer group opacity-70 hover:opacity-100">
                    <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-white/50 font-mono text-sm group-hover:text-white/80 transition-colors">Mar 14, 2026 10:15 AM</span>
                          <span className="text-[10px] font-mono text-white/20 hidden sm:block uppercase tracking-widest">BLK: 182290111</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-white/70 font-bold tracking-tight">Coin Toss</span>
                          <span className="text-[10px] font-mono text-white/30 truncate max-w-[120px]">0x44c112...99ee</span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-sm font-bold text-white/50">100.00 USDC</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="font-mono text-sm text-white/20">-100.00 USDC</span>
                      </AuditTableCell>
                      <AuditTableCell>
                         <span className="py-1.5 px-3 border border-white/10 bg-white/5 text-white/40 font-bold text-[10px] uppercase tracking-widest rounded-lg shrink-0">
                            Burned
                         </span>
                      </AuditTableCell>
                      <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/20 group-hover:text-white/50 font-bold uppercase text-[10px] tracking-widest">
                         Archive ↗
                      </AuditTableCell>
                    </div>
                 </div>
               </Link>
             </div>
          </AuditTabs>
        </div>

      </main>
    </div>
  );
}
