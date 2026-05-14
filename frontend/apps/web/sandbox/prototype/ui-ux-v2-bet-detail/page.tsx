import { GlassCard } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { PrototypeHeader } from "../components/PrototypeHeader";

export default function BetDetailPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      {/* 1. Global Product Header */}
      <PrototypeHeader activeRoute="bets" />

      <main className="max-w-2xl mx-auto px-6 py-12 md:py-24">
        <Link
          href="/prototype/ui-ux-v2-bets"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors font-bold text-sm mb-8"
        >
          <span>←</span> Back to Tickets
        </Link>

        {/* Cinematic Cyber Receipt Container */}
        <div className="relative mx-auto rounded-[2.5rem] border-2 border-green-500/20 bg-gradient-to-b from-[#0a0505] to-[#020502] p-10 shadow-[inset_0_0_60px_rgba(34,197,94,0.05),0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Decorative watermark & lighting */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[180px] font-bold text-green-500/[0.02] pointer-events-none select-none rotate-12 tracking-tighter">
            WON
          </div>

          {/* Header Section */}
          <div className="flex flex-col items-center justify-center border-b border-white/10 pb-10 mb-10 relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_infinite] shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
              <span className="text-green-500/70 text-[10px] font-bold font-mono uppercase tracking-[0.3em]">
                Network Verified
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] tracking-tight">
              Precision Dice
            </h1>
            <span className="text-white/40 font-mono text-sm tracking-widest bg-[#050505] border border-white/10 px-4 py-1.5 rounded-lg shadow-inner">
              TICKET_ID: #209384
            </span>
          </div>

          {/* Core Figures - Deep Inset */}
          <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
            <div className="bg-[#050505] p-6 rounded-[2rem] border border-white/5 shadow-inner flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                Capital At Risk
              </span>
              <span className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                50.00 <span className="text-lg text-white/50">USDC</span>
              </span>
            </div>
            <div className="bg-[#020502] p-6 rounded-[2rem] border-2 border-green-500/20 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)] flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 blur-[30px] group-hover:bg-green-500/20 transition-colors" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
              <span className="text-green-500/60 text-[10px] font-bold uppercase tracking-widest mb-2">
                Gross Settlement
              </span>
              <span className="text-3xl font-mono font-bold text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                +98.50 <span className="text-lg text-green-500/50">USDC</span>
              </span>
            </div>
          </div>

          {/* Parameters & Truth Matrix - Cyber Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 border border-white/5 bg-[#080808] p-8 rounded-[2rem]">
            {/* Logic Params */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <div className="w-1 h-1 bg-white/40 rounded-full" /> Execution Logic
              </h3>
              <div className="flex flex-col font-mono text-sm gap-1">
                <div className="flex justify-between py-3 border-b border-white/5 bg-white/[0.01] px-3 rounded-t-xl hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    Condition
                  </span>
                  <span className="text-white font-bold">ROLL &lt; 50.00</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5 bg-white/[0.01] px-3 hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    Target Volatility
                  </span>
                  <span className="text-white font-bold">50.00%</span>
                </div>
                <div className="flex justify-between py-3 bg-white/[0.01] px-3 rounded-b-xl hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    Base Multiplier
                  </span>
                  <span className="text-white font-bold">1.97x</span>
                </div>
              </div>
            </div>

            {/* Truth Matrix */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-green-400/60 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,1)]" />{" "}
                Provable Truth
              </h3>
              <div className="flex flex-col font-mono text-sm gap-1">
                <div className="flex justify-between py-3 border-b border-white/5 bg-green-500/[0.02] px-3 rounded-t-xl border-l-[3px] border-l-green-500/50">
                  <span className="text-green-500/50 uppercase text-[10px] tracking-widest mt-0.5">
                    Final Generation
                  </span>
                  <span className="text-green-400 font-bold drop-shadow-[0_0_5px_rgba(34,197,94,0.3)]">
                    45.12
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5 bg-white/[0.01] px-3 hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    Actor Auth
                  </span>
                  <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer truncate max-w-[120px]">
                    0x12...34af
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5 bg-white/[0.01] px-3 hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    Block Anchor
                  </span>
                  <span className="text-white">182303800</span>
                </div>
                <div className="flex justify-between py-3 bg-white/[0.01] px-3 rounded-b-xl hover:bg-white/[0.03] transition-colors">
                  <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">
                    State Tx
                  </span>
                  <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer truncate max-w-[120px]">
                    0xebd9...2a1f
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Share/Verify Actions */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 relative z-10">
            <button className="flex-1 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors uppercase tracking-widest text-[10px] shadow-inner border border-white/5">
              Verify Source
            </button>
            <button className="flex-1 py-4 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-bold transition-colors uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              Share Triumph
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
