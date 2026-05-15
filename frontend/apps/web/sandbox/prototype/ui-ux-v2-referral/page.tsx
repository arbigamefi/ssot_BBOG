import React from "react";
import { PrototypeHeader } from "../components/PrototypeHeader";
import { cn } from "@ssot/ui";
import {
  UsersIcon,
  LinkIcon,
  CurrencyDollarIcon,
  ShareIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
  ArrowTrendingUpIcon,
  ChartPieIcon,
  CubeTransparentIcon
} from "@heroicons/react/24/outline";

export default function ReferralPrototype3() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-purple-500/30">
      <PrototypeHeader activeRoute="referral" />

      {/* Global Background Ambience - Purple */}
      <div className="fixed top-0 right-0 w-[800px] h-[600px] bg-purple-900/10 blur-[150px] pointer-events-none rounded-full z-0" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[500px] bg-blue-900/10 blur-[120px] pointer-events-none rounded-full z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        {/* LOBBY HEADER */}
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-bold uppercase tracking-widest mb-6">
              <ShareIcon className="w-4 h-4" /> Zero-Reconciliation Engine
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">
              Distribute & Earn On-Chain
            </h1>
            <p className="text-lg text-white/50 leading-relaxed">
              Traditional platforms rely on manual spreadsheets and delayed payouts. Our SSOT
              architecture splits marketing budgets at the exact block a bet is settled. Fully
              transparent, instantly claimable.
            </p>
          </div>

          <div className="flex gap-4">
            <button className="px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-colors flex items-center gap-2">
              Generate Link <LinkIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* METRICS DASHBOARD - Cyber Terminal Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="p-8 rounded-[2rem] border-2 border-purple-500/20 bg-gradient-to-br from-[#0c051a] to-[#050505] shadow-[inset_0_0_40px_rgba(168,85,247,0.05),0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-purple-500/40 transition-colors">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 blur-[50px] rounded-full group-hover:bg-purple-500/20 transition-all" />
            <CurrencyDollarIcon className="w-8 h-8 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] mb-6" />
            <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" /> Total Earned (USDC)
            </div>
            <div className="text-3xl lg:text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-between">
              $12,450.50
              <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
          </div>

          <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-fuchsia-500/30 transition-colors">
            <UsersIcon className="w-8 h-8 text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)] mb-6" />
            <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2">
              Active Organics
            </div>
            <div className="text-3xl lg:text-4xl font-mono font-bold text-white flex items-end gap-2 group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
              1,240{" "}
              <span className="text-sm text-white/30 font-sans font-medium mb-1">wallets</span>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-blue-500/30 transition-colors">
            <ChartPieIcon className="w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] mb-6" />
            <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2">
              Direct Network Volume
            </div>
            <div className="text-3xl lg:text-4xl font-mono font-bold text-white group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
              $850,210
            </div>
          </div>

          <div className="p-8 rounded-[2rem] border-2 border-emerald-500/10 bg-[#050510] shadow-[inset_0_0_40px_rgba(16,185,129,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-emerald-500/40 transition-colors">
            <CubeTransparentIcon className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] mb-6" />
            <div className="text-[10px] uppercase font-bold text-emerald-400/50 tracking-widest mb-2">
              Unclaimed Rebates
            </div>
            <div className="flex justify-between items-end">
              <div className="text-3xl lg:text-4xl font-mono font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                $450.00
              </div>
              <button className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/40 hover:text-emerald-300 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] mb-1">
                Claim All
              </button>
            </div>
          </div>
        </div>

        {/* ARCHITECTURE & LINKS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
          {/* Left: 3D Holographic Network Tree */}
          <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#080311] to-[#040208] p-8 relative overflow-hidden h-[500px] flex flex-col shadow-[inset_0_2px_40px_rgba(0,0,0,0.8)]">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold mb-1">Skyline Isometric Map</h3>
                <p className="text-sm text-white/40">
                  Visualizing your on-chain downline and rebate splits in realtime.
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.2)] backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-[pulse_1s_infinite]" />{" "}
                LIVE
              </div>
            </div>

            {/* Advanced 3D Abstract Tree Visual */}
            <div className="flex-1 relative flex items-center justify-center perspective-[1200px]">
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "rotateX(60deg) rotateZ(-30deg)"
                }}
              >
                {/* Center Node (You) */}
                <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/80 to-fuchsia-600/80 border-[4px] border-purple-300 z-30 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.8),inset_0_0_20px_rgba(255,255,255,0.5)] transform -translate-Z-10 animate-[bounce_4s_ease-in-out_infinite]">
                  <span
                    className="font-extrabold text-2xl drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]"
                    style={{ transform: "rotateX(-60deg) rotateZ(30deg)" }}
                  >
                    YOU
                  </span>
                </div>

                {/* 3D Holographic Rings */}
                <div
                  className="absolute w-[250px] h-[250px] rounded-full border-[2px] border-purple-500/30 z-10 animate-[spin_10s_linear_infinite]"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="absolute inset-0 rounded-full border-[6px] border-purple-500/10 translate-Z-2" />
                </div>
                <div
                  className="absolute w-[450px] h-[450px] rounded-full border-[2px] border-fuchsia-500/20 border-dashed z-10 animate-[spin_20s_linear_infinite_reverse]"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="absolute inset-0 rounded-full border-[4px] border-fuchsia-500/5 translate-Z-4" />
                </div>

                {/* Tier 1 Glowing Nodes */}
                {[0, 90, 180, 270].map((deg, i) => (
                  <div
                    key={i}
                    className="absolute w-14 h-14 rounded-full bg-purple-900/80 border-2 border-purple-400 z-20 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.6)] origin-center"
                    style={{ transform: `rotate(${deg}deg) translate(125px) rotate(-${deg}deg)` }}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_10px_white]" />
                  </div>
                ))}

                {/* Connecting Lines */}
                <div className="absolute w-[250px] h-1 bg-gradient-to-r from-purple-500 to-transparent rotate-0 z-10 rounded-full blur-[1px] opacity-80" />
                <div className="absolute w-[250px] h-1 bg-gradient-to-r from-purple-500 to-transparent rotate-90 z-10 rounded-full blur-[1px] opacity-80" />
                <div className="absolute w-[250px] h-1 bg-gradient-to-r from-transparent to-purple-500 rotate-[180deg] z-10 rounded-full blur-[1px] opacity-80" />
                <div className="absolute w-[250px] h-1 bg-gradient-to-r from-transparent to-purple-500 rotate-[270deg] z-10 rounded-full blur-[1px] opacity-80" />
              </div>
            </div>
          </div>

          {/* Right: Link Generation & Settings */}
          <div className="flex flex-col gap-6">
            {/* Military Grade Key Generator Pane */}
            <div className="rounded-[2.5rem] border-2 border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 to-[#050505] p-8 flex flex-col relative overflow-hidden group shadow-[inset_0_2px_20px_rgba(217,70,239,0.05),0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-fuchsia-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-fuchsia-500/20 transition-colors" />

              <h3 className="text-xl font-bold mb-6 text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
                Master Protocol Link
              </h3>

              <div className="bg-[#050505] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6 relative z-10 hover:border-fuchsia-500/50 transition-colors shadow-inner group/copy cursor-pointer">
                <span className="font-mono text-sm text-fuchsia-100 group-hover/copy:text-white transition-colors truncate drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
                  arbigamefi.io/ref/0x7F...4a21
                </span>
                <button className="p-2 rounded-xl bg-white/5 group-hover/copy:bg-fuchsia-500/20 group-hover/copy:border-fuchsia-500/50 text-white/50 group-hover/copy:text-fuchsia-300 transition-all border border-transparent shadow-[0_0_10px_rgba(0,0,0,0)] group-hover/copy:shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                  <DocumentDuplicateIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-sm mb-6 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <span className="text-white/40 uppercase tracking-widest text-[10px] font-bold">
                  Default Split Rate
                </span>
                <span className="font-mono text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                  40% YOU / 10% TGT
                </span>
              </div>

              <button className="w-full py-4 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold border border-fuchsia-400 transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] active:scale-[0.98]">
                Configure Rebate Rules
              </button>
            </div>

            {/* Data Table Preview */}
            <div className="rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] p-8 flex-1 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <h3 className="text-lg font-bold mb-6">Recent Network Activity</h3>

              <div className="flex-1 flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 rounded-xl bg-[#050505] border border-white/5 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all group/row"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-white/80 group-hover/row:text-white transition-colors">
                        0x22...9b{i}c
                      </span>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">
                        Played European Roulette
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-purple-400 font-bold drop-shadow-[0_0_5px_rgba(168,85,247,0.3)]">
                        +$2.45
                      </div>
                      <div className="text-[10px] text-emerald-500/70 font-mono tracking-widest">
                        BLK 481920{i}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full text-center text-xs font-bold text-white/40 hover:text-white pt-6 mt-4 border-t border-white/5 transition-colors uppercase tracking-[0.2em]">
                View Full Ledger ↗
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
