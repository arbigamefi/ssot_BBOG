import { ShellHeader, ShellHeaderBrand } from "@ssot/ui";
import { RoomStrip, SharedBetSlip, DiceSlider, AuditTabs } from "@ssot/ui";
import { AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { cn } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function DiceRoomPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      
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
        <RoomStrip title="Precision Dice" edgePercentage={1.0} isLive={true} />

        {/* 3. Main Stage Container */}
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[600px]">
          
          {/* L: Bet Slip Area */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
             {/* Use generic shared bet slip */}
             <SharedBetSlip 
                glowColorClass="bg-purple-500/10 border-purple-500/20"
                primaryActionClass="bg-purple-600 hover:bg-purple-500"
                quickChips={["Min", "1/2", "2x", "Max"]}
                amountValue="10.00"
                summaryContent={
                   <div className="flex justify-between items-center px-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-purple-400/70 font-bold uppercase tracking-wider">Multiplier</span>
                        <span className="text-sm font-mono font-bold text-purple-400">1.98x</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Win Chance</span>
                        <span className="text-sm font-bold">50.00%</span>
                      </div>
                   </div>
                }
             />
             
             {/* Last results mini strip */}
             <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0a0a0a]">
                <div className="text-xs font-bold text-white/40 tracking-widest uppercase">Last Results</div>
                <div className="flex gap-2">
                   {[42.50, 89.12, 12.04, 76.99, 50.01].map((res, i) => (
                      <div key={i} className={cn(
                        "w-12 h-8 rounded-md flex items-center justify-center text-xs font-mono font-bold border transition-colors",
                        res < 50 ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}>
                        {res.toFixed(1)}
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* R: Dice Game Surface */}
          <div className="flex-1 rounded-2xl md:rounded-3xl border border-white/10 bg-[#0a0a0a] min-h-[500px] relative overflow-hidden flex flex-col p-4 md:p-8">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            {/* Table wrapper */}
            <div className="relative w-full h-full flex items-center justify-center">
               <DiceSlider initialValue={50} direction="under" />
            </div>
          </div>
        </div>

        {/* 4. Downstairs: Audit & Explanations */}
        <AuditTabs activeColorClass="border-purple-400 text-purple-400">
             <AuditTableHeader>
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Time / Hash</div>
                  <div>Game</div>
                  <div>Bet Info</div>
                  <div>Result</div>
                  <div className="text-right">Tx</div>
                </div>
             </AuditTableHeader>
             
             {/* Dummy Rows */}
             <AuditTableRow>
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px]">
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white font-mono">14:02:11</span>
                      <span className="text-xs font-mono text-white/30">0xebd9...2a1f</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>Precision Dice</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">UNDER 50.00</span>
                      <span className="text-xs text-white/40">10.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <div className="flex items-center gap-2">
                      <span className="py-1 px-2 rounded bg-white/5 border border-white/10 text-white font-mono text-xs animate-pulse text-purple-300">Rolling...</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
             
             <AuditTableRow className="opacity-70">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px]">
                  <AuditTableCell>14:01:45</AuditTableCell>
                  <AuditTableCell>Precision Dice</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">OVER 80.00</span>
                      <span className="text-xs text-white/40">50.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="text-red-500 font-bold font-mono text-xs bg-red-500/10 px-2 py-1 rounded">Rolled 45.12</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
        </AuditTabs>

      </main>
    </div>
  );
}
