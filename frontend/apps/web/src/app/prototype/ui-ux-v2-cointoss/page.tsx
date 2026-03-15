import { ShellHeader, ShellHeaderBrand } from "@ssot/ui";
import { RoomStrip, SharedBetSlip, CoinStage, AuditTabs } from "@ssot/ui";
import { AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { cn } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function CoinTossPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30">
      
      {/* 1. Minimal Room Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-6">
          <ShellHeaderBrand name="ArbiGameFi" />
          <div className="hidden sm:block border-l border-white/10 h-6 pl-6">
            <Link href="/prototype/ui-ux-v2-directory" className="text-white/40 hover:text-white transition-colors text-sm font-bold flex items-center gap-2">
              <span>←</span>
              <span>All Games</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-white/70" />
          </button>
           <button className="flex items-center gap-2 bg-white/10 border border-white/10 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-white/20 transition-transform active:scale-95">
            <WalletIcon className="w-4 h-4" />
            <span>0x12...34af</span>
          </button>
        </div>
      </ShellHeader>

      <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col gap-6">
        
        {/* 2. Room Strip */}
        <RoomStrip title="Coin Toss" edgePercentage={1.0} isLive={true} />

        {/* 3. Main Stage Container */}
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[600px]">
          
          {/* L: Bet Slip Area */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
             <SharedBetSlip 
                glowColorClass="bg-amber-500/10 border-amber-500/20"
                primaryActionClass="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-amber-950 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                quickChips={["Min", "1/2", "2x", "Max"]}
                amountValue="10.00"
                summaryContent={
                   <div className="flex justify-between items-center px-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider">Potential Win</span>
                        <span className="text-sm font-mono font-bold text-amber-500">19.80 USDC</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Win Chance</span>
                        <span className="text-sm font-bold">49.50%</span>
                      </div>
                   </div>
                }
             />
             
             {/* Last results */}
             <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0a0a0a]">
                <div className="text-xs font-bold text-white/40 tracking-widest uppercase">Recent</div>
                <div className="flex gap-2">
                   {["H", "T", "T", "H", "H"].map((res, i) => (
                      <div key={i} className={cn(
                         "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                         res === 'H' 
                           ? "bg-yellow-400/20 text-yellow-500 border-yellow-500/50" 
                           : "bg-stone-500/20 text-stone-400 border-stone-500/50"
                      )}>
                         {res}
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* R: Coin Game Surface */}
          <div className="flex-1 rounded-2xl md:rounded-3xl border border-white/10 bg-[#0a0a0a] min-h-[500px] relative overflow-hidden flex flex-col p-4 md:p-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="relative w-full h-full flex flex-col items-center justify-center">
                <CoinStage />
            </div>
          </div>
        </div>

        {/* 4. Downstairs: Audit & Explanations */}
        <AuditTabs activeColorClass="border-amber-400 text-amber-400">
             <AuditTableHeader>
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Time / Hash</div>
                  <div>Game</div>
                  <div>Bet Info</div>
                  <div>Result</div>
                  <div className="text-right">Tx</div>
                </div>
             </AuditTableHeader>

             <AuditTableRow className="opacity-70">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px]">
                  <AuditTableCell>14:01:45</AuditTableCell>
                  <AuditTableCell>Coin Toss</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">HEADS</span>
                      <span className="text-xs text-white/40">100.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="text-green-500 font-bold font-mono text-xs bg-green-500/10 px-2 py-1 rounded">Won 198.00</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
        </AuditTabs>

      </main>
    </div>
  );
}
