import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { cn } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function AccountPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30">
      
      {/* 1. Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">Games</Link>
            <Link href="/prototype/ui-ux-v2-bets" className="hover:text-white transition-colors">Bets</Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">Liquidity</Link>
            <Link href="/prototype/ui-ux-v2-claims" className="hover:text-white transition-colors">Claims</Link>
            <Link href="/prototype/ui-ux-v2-referral" className="hover:text-white transition-colors">Affiliates</Link>
            <Link href="/prototype/ui-ux-v2-account" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">Account</Link>
            <Link href="/prototype/ui-ux-v2-ops" className="hover:text-white transition-colors">Ops</Link>
          </ShellHeaderNav>
        </div>
        <ShellHeaderActions>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Arbitrum
          </div>
          <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-indigo-400" />
          </button>
          <button className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-2 rounded-full font-bold text-sm">
            <WalletIcon className="w-4 h-4" />
            <span>0x12...34af</span>
          </button>
        </ShellHeaderActions>
      </ShellHeader>

      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16 flex flex-col gap-12">
        
        {/* Account Header Section */}
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-indigo-500/20 border-2 border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
               <UserCircleIcon className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-white flex items-center gap-3">
                0x12...34af
                <button className="text-sm px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors font-sans text-white/50 hover:text-white">Copy</button>
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/50">
                 <span>Joined Mar 2026</span>
                 <span>•</span>
                 <span className="text-green-400">Arbiscan ↗</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors">Deposit / Withdraw</button>
          </div>
        </div>

        {/* Global Balances */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <GlassCard glowColor="bg-indigo-500/20" padding="md" className="flex flex-col gap-2 relative">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total Vault Value</span>
              <span className="text-3xl font-mono font-bold">$16,501.20</span>
              <span className="text-indigo-400 text-sm font-medium">All assets combined</span>
           </GlassCard>

           <GlassCard padding="md" className="flex flex-col gap-2 justify-between col-span-1 md:col-span-3">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Asset Breakdown</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                 <div className="flex flex-col">
                    <span className="font-mono text-2xl font-bold">4,001.20 USDC</span>
                    <span className="text-white/40 text-sm mt-1">Ready to play</span>
                 </div>
                 <div className="flex flex-col border-l border-white/10 pl-8">
                    <span className="font-mono text-2xl font-bold text-blue-400">12,500.00 hUSDC</span>
                    <span className="text-white/40 text-sm mt-1">Providing Liquidity</span>
                 </div>
                 <div className="flex flex-col border-l border-white/10 pl-8">
                    <span className="font-mono text-2xl font-bold text-amber-500">24.50 vAGF</span>
                    <span className="text-white/40 text-sm mt-1">Unclaimed Rewards</span>
                 </div>
              </div>
           </GlassCard>
        </div>

        {/* Audit / Journal Section */}
        <div>
           <h2 className="text-2xl font-bold tracking-tight mb-6">Transaction Journal</h2>
           
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
