import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { CopyButton } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon, ArrowTopRightOnSquareIcon, ShareIcon } from "@heroicons/react/24/outline";

export default function ReferralPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      
      {/* Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
             <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">Games</Link>
             <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">Liquidity</Link>
             <Link href="/prototype/ui-ux-v2-referral" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">Affiliates</Link>
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
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Affiliate Program</h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Build your network on-chain. Earn a portion of the house edge from every player you invite. 
            No caps, paid instantly.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          
          {/* Main Earner Card */}
          <GlassCard glowColor="bg-orange-600/20" padding="lg" className="flex flex-col gap-6 lg:row-span-2 lg:col-span-1 justify-between">
             <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Earnings</span>
                <span className="text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-yellow-600">
                  4,250.00 USDC
                </span>
                <div className="flex gap-2">
                  <span className="text-orange-400 text-sm font-medium">+$142.50 this week</span>
                </div>
             </div>

             <div className="flex flex-col gap-3 p-4 bg-black/50 border border-white/5 rounded-2xl">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-white/50">Available to claim</span>
                   <span className="font-mono font-bold">142.50 USDC</span>
                </div>
                <button className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(234,88,12,0.3)]">
                  Claim Earnings
                </button>
             </div>
          </GlassCard>

          {/* Stats Cards */}
          <GlassCard padding="md" className="flex flex-col gap-2">
             <div className="flex justify-between items-start">
               <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Network Volume</span>
               <span className="p-2 bg-white/5 rounded-lg text-white/50"><ArrowTopRightOnSquareIcon className="w-4 h-4"/></span>
             </div>
             <span className="text-3xl font-mono font-bold mt-2">$845,200</span>
             <span className="text-white/40 text-sm mt-1">Total wagered by invited players</span>
          </GlassCard>

          <GlassCard padding="md" className="flex flex-col gap-2">
             <div className="flex justify-between items-start">
               <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Active Referees</span>
               <span className="p-2 bg-white/5 rounded-lg text-white/50"><UserCircleIcon className="w-4 h-4"/></span>
             </div>
             <span className="text-3xl font-mono font-bold mt-2">124</span>
             <span className="text-green-400 text-sm mt-1">+12 this week</span>
          </GlassCard>

          {/* Build Link Card */}
          <GlassCard padding="lg" className="flex flex-col gap-6 lg:col-span-2 border-orange-500/20 shadow-[0_0_40px_rgba(234,88,12,0.05)]">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">Your Default Invite Link</h3>
                  <p className="text-sm text-white/50">Share this link to bind players to your address.</p>
                </div>
                {/* Fee Setting */}
                <div className="flex items-center gap-3 p-1.5 bg-[#050505] rounded-xl border border-white/10">
                   <div className="px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-bold flex flex-col items-center">
                     <span className="text-[10px] uppercase tracking-wider text-orange-400/60">You Get</span>
                     <span>50%</span>
                   </div>
                   <div className="px-4 py-2 text-white/40 text-sm font-bold flex flex-col items-center">
                     <span className="text-[10px] uppercase tracking-wider">Friend Gets</span>
                     <span>50%</span>
                   </div>
                   <button className="text-[10px] uppercase font-bold px-3 py-2 text-white/40 hover:text-white transition-colors">Edit</button>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <div className="flex-1 flex items-center bg-[#050505] border border-white/10 rounded-xl px-4 py-3 font-mono text-sm overflow-hidden select-all text-white/70">
                   arbigame.fi/?ref=0x12...34af
                </div>
                <CopyButton value="arbigame.fi/?ref=0x1234567890abcdef1234567890abcdef123434af" className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold flex items-center justify-center gap-2 transition-transform active:scale-95" />
             </div>
          </GlassCard>
        </div>

        {/* Network Activity Table */}
        <div>
           <div className="flex justify-between items-end mb-6">
              <h3 className="text-xl font-bold tracking-tight">Recent Network Activity</h3>
           </div>
           
           <AuditTabs activeColorClass="border-orange-400 text-orange-400">
             <AuditTableHeader>
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Time / Hash</div>
                  <div>Referee Address</div>
                  <div>Volume</div>
                  <div>Your Fee (USDC)</div>
                  <div className="text-right">Chain</div>
                </div>
             </AuditTableHeader>

             {/* Dummy Rows */}
             {[
               { time: '2 mins ago', hash: '0xebd9...2a1f', addr: '0x99cc...e33d', vol: '100.00', fee: '+1.50' },
               { time: '45 mins ago', hash: '0x44bf...11d2', addr: '0xabc1...4a92', vol: '50.00', fee: '+0.75' },
               { time: '3 hours ago', hash: '0xaa14...60f3', addr: '0x99cc...e33d', vol: '10.00', fee: '+0.15' },
               { time: '1 day ago', hash: '0x76b2...cd10', addr: '0x88bb...77cc', vol: '250.00', fee: '+3.75' },
             ].map((r, i) => (
                <AuditTableRow key={i}>
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_80px] items-center">
                    <AuditTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-white">{r.time}</span>
                        <span className="text-xs font-mono text-white/30 hover:text-white cursor-pointer transition-colors">{r.hash}</span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                       <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 border border-white/5">{r.addr}</span>
                    </AuditTableCell>
                    <AuditTableCell>
                       <span className="font-mono text-white/60">{r.vol} USDC</span>
                    </AuditTableCell>
                    <AuditTableCell>
                       <span className="font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                          {r.fee}
                       </span>
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
