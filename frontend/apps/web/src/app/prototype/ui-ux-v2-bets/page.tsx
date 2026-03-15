import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function BetsListPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      
      {/* 1. Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">Games</Link>
            <Link href="/prototype/ui-ux-v2-bets" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">Bets</Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">Liquidity</Link>
            <Link href="/prototype/ui-ux-v2-claims" className="hover:text-white transition-colors">Claims</Link>
            <Link href="/prototype/ui-ux-v2-referral" className="hover:text-white transition-colors">Affiliates</Link>
            <Link href="/prototype/ui-ux-v2-account" className="hover:text-white transition-colors">Account</Link>
            <Link href="/prototype/ui-ux-v2-ops" className="hover:text-white transition-colors">Ops</Link>
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
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">My Tickets</h1>
            <p className="text-white/50 text-lg">Your complete wagering history across all ArbiGameFi smart contracts.</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-[#0a0a0a] border border-white/5 rounded-xl">
             <button className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-white/40 hover:text-white hover:bg-white/5">Open</button>
             <button className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-white/40 hover:text-white hover:bg-white/5">Won</button>
             <button className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-white/40 hover:text-white hover:bg-white/5">Lost</button>
             <button className="px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white/10 text-white shadow">All Tickets</button>
          </div>
        </div>

        {/* Global Audit View using standard component */}
        <AuditTabs activeColorClass="border-blue-400 text-blue-400">
           <AuditTableHeader>
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Date / Block</div>
                  <div>Game / Result Hash</div>
                  <div>Wager</div>
                  <div>Payout</div>
                  <div>Status</div>
                  <div className="text-right">Action</div>
              </div>
           </AuditTableHeader>

           {/* Dummy Rows with Link navigation to details */}
           <Link href="/prototype/ui-ux-v2-bet-detail">
             <AuditTableRow className="cursor-pointer group">
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">Mar 14, 2026 14:02 PM</span>
                      <span className="text-[10px] font-mono text-white/30 hidden sm:block">Block: 182,304,112</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-bold">European Roulette</span>
                      <span className="text-[10px] font-mono text-white/40">Waiting for VRF...</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm">10.00 USDC</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm text-white/40">--</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="py-1 px-2 border border-blue-500/20 bg-blue-500/10 text-blue-400 font-bold text-[10px] uppercase rounded-md animate-pulse shrink-0">
                        In Progress
                     </span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/30 group-hover:text-white">
                     View Receipt →
                  </AuditTableCell>
                </div>
             </AuditTableRow>
           </Link>
           
           <Link href="/prototype/ui-ux-v2-bet-detail">
             <AuditTableRow className="cursor-pointer group">
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">Mar 14, 2026 13:45 PM</span>
                      <span className="text-[10px] font-mono text-white/30 hidden sm:block">Block: 182,303,800</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-bold">Precision Dice</span>
                      <span className="text-[10px] font-mono text-white/40">0xebd9cc...2a1f</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm">50.00 USDC</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm font-bold text-green-400">98.50 USDC</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="py-1 px-2 border border-green-500/20 bg-green-500/10 text-green-400 font-bold text-[10px] uppercase rounded-md shrink-0">
                        Won
                     </span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/30 group-hover:text-white">
                     View Receipt →
                  </AuditTableCell>
                </div>
             </AuditTableRow>
           </Link>

           <Link href="/prototype/ui-ux-v2-bet-detail">
             <AuditTableRow className="cursor-pointer group opacity-60 hover:opacity-100">
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">Mar 14, 2026 10:15 AM</span>
                      <span className="text-[10px] font-mono text-white/30 hidden sm:block">Block: 182,290,111</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-bold">Coin Toss</span>
                      <span className="text-[10px] font-mono text-white/40">0x44c112...99ee</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm">100.00 USDC</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="font-mono text-sm text-white/40">0.00 USDC</span>
                  </AuditTableCell>
                  <AuditTableCell>
                     <span className="py-1 px-2 border border-white/10 bg-white/5 text-white/40 font-bold text-[10px] uppercase rounded-md shrink-0">
                        Lost
                     </span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/30 group-hover:text-white">
                     View Receipt →
                  </AuditTableCell>
                </div>
             </AuditTableRow>
           </Link>
        </AuditTabs>

      </main>
    </div>
  );
}
