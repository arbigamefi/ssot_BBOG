import { ShellHeader, ShellHeaderBrand } from "@ssot/ui";
import { RoomStrip, SharedBetSlip, RouletteBoard, AuditTabs } from "@ssot/ui";
import { AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { cn } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

export default function RouletteRoomPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-green-500/30">
      
      {/* 1. Minimal Room Header (No heavy navigation) */}
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
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#0a0a0a] border border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-white/40">USDC:</span>
              <span className="text-white font-bold">1,420.50</span>
            </div>
          </div>
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
        <RoomStrip title="European Roulette" edgePercentage={2.7} isLive={true} />

        {/* 3. Main Stage Container */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* L: Bet Slip Area */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
             {/* Use generic shared bet slip */}
             <SharedBetSlip 
                glowColorClass="bg-green-500/10 border-green-500/20"
                primaryActionClass="bg-green-600 hover:bg-green-500"
                quickChips={["Min", "1/2", "2x", "Max"]}
                amountValue="10.00"
                summaryContent={
                   <div className="flex justify-between items-center px-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-green-400/70 font-bold uppercase tracking-wider">Est. Payout</span>
                        <span className="text-sm font-mono font-bold text-green-400">360.00 USDC</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Win Chance</span>
                        <span className="text-sm font-bold">2.7%</span>
                      </div>
                   </div>
                }
             />
             
             {/* Last results mini strip */}
             <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#0a0a0a]">
                <div className="text-xs font-bold text-white/40 tracking-widest uppercase">Last Results</div>
                <div className="flex gap-2">
                   {[{n: 14, c: 'red'}, {n: 2, c: 'black'}, {n: 0, c: 'green'}, {n: 35, c: 'black'}, {n: 3, c: 'red'}].map((res, i) => (
                      <div key={i} className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        res.c === 'red' ? "bg-red-500 border-2 border-red-600/50" : 
                        res.c === 'black' ? "bg-zinc-800 border-2 border-zinc-900/50" :
                        "bg-green-500 border-2 border-green-600/50"
                      )}>
                        {res.n}
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* R: Roulette Game Surface */}
          <div className="flex-1 rounded-2xl md:rounded-3xl border border-white/10 bg-[#0a0a0a] min-h-[500px] relative overflow-hidden flex flex-col items-center justify-center p-4">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            {/* Table wrapper constraints */}
            <div className="relative w-full overflow-x-auto pb-4 custom-scrollbar lg:pb-0">
               {/* Use extracted component */}
               <RouletteBoard />
            </div>
          </div>
        </div>

        {/* 4. Downstairs: Audit & Explanations */}
        <AuditTabs activeColorClass="border-green-400 text-green-400">
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
                  <AuditTableCell>European Roulette</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">Straight 14 (<span className="text-red-400">RED</span>)</span>
                      <span className="text-xs text-white/40">10.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <div className="flex items-center gap-2">
                      <span className="py-1 px-2 rounded bg-white/5 border border-white/10 text-white font-mono text-xs">Waiting...</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
             
             <AuditTableRow className="opacity-70">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px]">
                  <AuditTableCell>14:01:45</AuditTableCell>
                  <AuditTableCell>European Roulette</AuditTableCell>
                  <AuditTableCell>
                    <div className="flex flex-col">
                      <span className="text-white">Color <span className="text-red-400">RED</span></span>
                      <span className="text-xs text-white/40">50.00 USDC</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="text-green-400 font-bold">+100.00</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end">→</AuditTableCell>
                </div>
             </AuditTableRow>
        </AuditTabs>

      </main>
    </div>
  );
}
