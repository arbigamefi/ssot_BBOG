import { ShellHeader, ShellHeaderBrand } from "@ssot/ui";
import { RoomStrip, SharedBetSlip, KenoGrid, AuditTabs } from "@ssot/ui";
import { AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function KenoRoomPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-fuchsia-500/30">
      
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
        <RoomStrip title="Keno Draft" edgePercentage={1.0} isLive={true} />

        {/* 3. Main Stage Container */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* L: Bet Slip Area */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
             <SharedBetSlip 
                glowColorClass="bg-fuchsia-500/10 border-fuchsia-500/20"
                primaryActionClass="bg-fuchsia-600 hover:bg-fuchsia-500 shadow-[0_0_20px_rgba(192,38,211,0.2)]"
                quickChips={["Min", "1/2", "2x", "Max"]}
                amountValue="5.00"
                summaryContent={
                   <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-fuchsia-400/80 font-bold uppercase tracking-wider px-1">Dynamic Payouts (for 5 picks)</span>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                         <div className="flex justify-between bg-black/50 px-2 py-1 rounded">
                            <span className="text-white/50">Match 0</span>
                            <span className="font-mono text-white/80">0.00x</span>
                         </div>
                         <div className="flex justify-between bg-black/50 px-2 py-1 rounded">
                            <span className="text-white/50">Match 1</span>
                            <span className="font-mono text-white/80">0.00x</span>
                         </div>
                         <div className="flex justify-between bg-black/50 px-2 py-1 rounded border border-fuchsia-500/20">
                            <span className="text-white/50">Match 2</span>
                            <span className="font-mono text-fuchsia-400 font-bold">1.50x</span>
                         </div>
                         <div className="flex justify-between bg-black/50 px-2 py-1 rounded border border-fuchsia-500/30">
                            <span className="text-white/50">Match 3</span>
                            <span className="font-mono text-fuchsia-400 font-bold">4.00x</span>
                         </div>
                         <div className="flex justify-between bg-black/50 px-2 py-1 rounded border border-fuchsia-500/50">
                            <span className="text-white/50">Match 4</span>
                            <span className="font-mono text-fuchsia-400 font-bold">15.00x</span>
                         </div>
                         <div className="flex justify-between bg-fuchsia-500/20 px-2 py-1 rounded border border-fuchsia-500 shadow-[0_0_10px_rgba(192,38,211,0.3)]">
                            <span className="text-white font-bold">Match 5</span>
                            <span className="font-mono text-white font-bold">50.00x</span>
                         </div>
                      </div>
                   </div>
                }
             />
             
             {/* Last results */}
             <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0a0a0a]">
                <div className="text-xs font-bold text-white/40 tracking-widest uppercase">Last Global Draw</div>
                <div className="flex flex-wrap gap-1">
                   {[3, 8, 12, 19, 24, 28, 31, 35, 39, 40].map((res, i) => (
                      <div key={i} className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                         {res}
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* R: Keno Game Surface */}
          <div className="flex-1 rounded-2xl md:rounded-3xl border border-white/10 bg-[#0a0a0a] min-h-[500px] relative overflow-hidden flex flex-col p-4 md:p-8 justify-center">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="relative w-full h-full flex flex-col items-center justify-center">
                <KenoGrid maxSelections={10} />
            </div>
          </div>
        </div>

        {/* 4. Downstairs: Audit & Explanations */}
        <AuditTabs activeColorClass="border-fuchsia-400 text-fuchsia-400">
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
                  <AuditTableCell>Keno Draft</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">Picked 5 nums</span>
                      <span className="text-xs text-white/40">10.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="text-white font-bold font-mono text-xs bg-white/10 px-2 py-1 rounded">Matched 0 (0.00 USDC)</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
             <AuditTableRow className="opacity-70">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px]">
                  <AuditTableCell>13:50:11</AuditTableCell>
                  <AuditTableCell>Keno Draft</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">Picked 5 nums</span>
                      <span className="text-xs text-white/40">10.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="text-green-400 font-bold font-mono text-xs bg-green-500/10 border border-green-500/20 px-2 py-1 rounded">Matched 3 (40.00 USDC)</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
        </AuditTabs>

      </main>
    </div>
  );
}
