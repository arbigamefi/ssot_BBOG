import React from "react";
import Link from "next/link";
import { PrototypeHeader } from "../components/PrototypeHeader";
import {
  DiceMiniIcon,
  RouletteMiniIcon,
  CoinTossMiniIcon,
  KenoMiniIcon
} from "../components/PrototypeGameIcons";
import { cn } from "@ssot/ui";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  CircleStackIcon,
  WalletIcon,
  ShareIcon,
  CodeBracketSquareIcon,
  CubeTransparentIcon,
  BoltIcon
} from "@heroicons/react/24/outline";

// Mock Data for Live Feed
const liveBets = [
  { user: "0x7F...4a21", game: "Precision Dice", w: true, amt: "1,250 USDC", time: "just now" },
  { user: "0x22...9b0c", game: "European Roulette", w: false, amt: "50 USDC", time: "12s ago" },
  { user: "0x91...cc11", game: "Coin Toss", w: true, amt: "400 USDC", time: "45s ago" },
  { user: "0x4A...ff89", game: "Keno Draft", w: true, amt: "8,500 USDC", time: "1m ago" },
  { user: "0x11...2b33", game: "Precision Dice", w: false, amt: "100 USDC", time: "2m ago" }
];

export default function FlagshipPrototype3() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white overflow-x-hidden selection:bg-blue-500/30">
      <PrototypeHeader variant="transparent" />

      {/* 1. HERO SECTION: The SSOT Engine */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 flex flex-col items-center justify-center text-center">
        {/* Massive Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[700px] bg-gradient-to-b from-blue-600/10 via-emerald-600/5 to-transparent blur-[120px] pointer-events-none rounded-full" />

        {/* Floating Architectual Elements (SSOT Concept) */}
        <div className="absolute top-32 left-[5%] w-72 h-40 bg-[#050505]/90 border border-emerald-500/20 rounded-2xl backdrop-blur-3xl -rotate-6 hidden xl:block opacity-90 overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_2px_0_0_#10b981,0_20px_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <div className="p-5 flex flex-col gap-3 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <CircleStackIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-bold">
                Isolated Bank
              </span>
            </div>
            <div className="h-2 w-full bg-emerald-500/20 rounded border border-emerald-500/30 overflow-hidden">
              <div className="w-[85%] h-full bg-emerald-500/50" />
            </div>
            <div className="flex justify-between text-[10px] text-white/40 font-mono">
              <span>Free: $1.2M</span>
              <span>PF: $45K</span>
            </div>
          </div>
        </div>

        <div className="absolute top-48 right-[5%] w-72 h-32 bg-[#050505]/90 border border-blue-500/20 rounded-2xl backdrop-blur-3xl rotate-6 hidden xl:block opacity-90 overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_-2px_0_0_#3b82f6,0_20px_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/10 to-transparent" />
          <div className="p-5 flex flex-col gap-2 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShareIcon className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] uppercase tracking-widest text-blue-400/80 font-bold">
                Zero-Recon Referral
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border border-blue-500/50 bg-blue-500/20 flex items-center justify-center text-blue-300 text-[10px]">
                P1
              </div>
              <ArrowRightIcon className="w-3 h-3 text-white/30" />
              <div className="w-6 h-6 rounded-full border border-purple-500/50 bg-purple-500/20 flex items-center justify-center text-purple-300 text-[10px]">
                C1
              </div>
              <ArrowRightIcon className="w-3 h-3 text-white/30" />
              <div className="flex-1 border-b border-dashed border-white/20" />
              <span className="text-xs text-white/60 font-mono">+$45</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 text-xs font-bold tracking-widest mb-8 uppercase backdrop-blur-md hover:bg-white/10 transition-colors cursor-default">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            SSOT Architecture v1.0
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-8">
            <span className="text-white">The Settlement Engine</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-cyan-400">
              for On-Chain Games.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mb-12 leading-relaxed">
            Not just a casino. ArbiGameFi is an infrastructure-grade non-custodial gaming protocol
            featuring isolated liquidity banks, VRF-secured settlement, and zero-reconciliation
            referral budgets.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/prototype/ui-ux-v2-directory">
              <button className="px-8 py-4 rounded-full bg-blue-500 hover:bg-blue-400 text-black font-extrabold text-lg transition-all active:scale-95 shadow-[0_0_40px_rgba(59,130,246,0.3),inset_0_2px_4px_rgba(255,255,255,0.5)] flex items-center gap-2 border border-blue-400/50">
                Enter Rooms <ArrowRightIcon className="w-5 h-5" strokeWidth={3} />
              </button>
            </Link>
            <Link href="/prototype/ui-ux-v2-liquidity">
              <button className="px-8 py-4 rounded-full bg-[#0a0a0a] border border-emerald-500/30 text-emerald-400 font-bold text-lg hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all active:scale-95">
                Audit Protocol
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. STATS TICKER: Institutional Trust */}
      <section className="border-y border-white/5 bg-[#0a0a0a] overflow-hidden">
        <div className="max-w-[1440px] mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-12 md:gap-24">
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <CircleStackIcon className="w-3 h-3" /> Bankroll Reserves (R)
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">
              $2,450,112
            </span>
          </div>
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-blue-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <BoltIcon className="w-3 h-3" /> Settlement Volume
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
              $18,104,890
            </span>
          </div>
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-purple-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <ShareIcon className="w-3 h-3" /> Active Partners
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-purple-400 transition-colors">
              412 Organics
            </span>
          </div>
        </div>
      </section>

      {/* 3. THE TRIAD: Value Propositions */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              A Platform for the Entire Ecosystem
            </h2>
            <p className="text-white/50 text-lg">
              Whether you're playing, providing liquidity, or referring traffic, the SSOT
              architecture enforces your rights on-chain. No platform privilege.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Player Pillar */}
            <div className="rounded-[2rem] border border-blue-500/20 bg-[#050505] p-10 group hover:border-blue-500/50 transition-all shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_40px_rgba(59,130,246,0.1),inset_0_2px_20px_rgba(59,130,246,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-8 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <WalletIcon className="w-8 h-8 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-200">
                For Players
              </h3>
              <ul className="space-y-4 text-white/60 relative z-10">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1 drop-shadow-[0_0_3px_rgba(59,130,246,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Wallet Native:</strong> No deposits. Retain full
                    custody of your funds until the bet is placed.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1 drop-shadow-[0_0_3px_rgba(59,130,246,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Verifiable Rules:</strong> Every game logic is a
                    pure function. You can run the exact bytecode yourself.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1 drop-shadow-[0_0_3px_rgba(59,130,246,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Refund Paths:</strong> If the oracle fails, you
                    are guaranteed a timeout refund.
                  </span>
                </li>
              </ul>
            </div>

            {/* LP Pillar */}
            <div className="rounded-[2rem] border border-emerald-500/20 bg-[#050505] p-10 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_40px_rgba(16,185,129,0.1),inset_0_2px_20px_rgba(16,185,129,0.05)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-8 relative z-10 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <CircleStackIcon className="w-8 h-8 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-200">
                For Liquidity Providers
              </h3>
              <ul className="space-y-4 text-white/60 relative z-10">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 mt-1 drop-shadow-[0_0_3px_rgba(16,185,129,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Isolated Banks:</strong> USDC is never pooled
                    with other assets. Total risk isolation.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 mt-1 drop-shadow-[0_0_3px_rgba(16,185,129,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Explicit Reserves:</strong> The system explicitly
                    tracks pending liabilities vs free bankroll.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 mt-1 drop-shadow-[0_0_3px_rgba(16,185,129,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Real Yield:</strong> Earn strict mathematical
                    edge, not inflationary token emissions.
                  </span>
                </li>
              </ul>
            </div>

            {/* Partner Pillar */}
            <div className="rounded-[2rem] border border-purple-500/20 bg-[#050505] p-10 group hover:border-purple-500/50 transition-all shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_40px_rgba(168,85,247,0.1),inset_0_2px_20px_rgba(168,85,247,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[50px] rounded-full group-hover:bg-purple-500/10 transition-colors pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-8 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <ShareIcon className="w-8 h-8 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-200">
                For Partners & Channels
              </h3>
              <ul className="space-y-4 text-white/60 relative z-10">
                <li className="flex items-start gap-3">
                  <span className="text-purple-400 mt-1 drop-shadow-[0_0_3px_rgba(168,85,247,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Zero Reconciliation:</strong> Budgets are split
                    on-chain during settlement. No manual auditing.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-400 mt-1 drop-shadow-[0_0_3px_rgba(168,85,247,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">Skyline Pricing:</strong> Dynamic, programmatic
                    payouts based on transparent on-chain tiers.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-400 mt-1 drop-shadow-[0_0_3px_rgba(168,85,247,1)]">
                    ✓
                  </span>{" "}
                  <span>
                    <strong className="text-white">First-Touch Binding:</strong> Provable referral
                    links locked into the smart contract state.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. GAMES GALLERY (The Playability) */}
      <section className="bg-[#0a0a0a] py-24 border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <CubeTransparentIcon className="w-4 h-4" /> The Execution Layer
              </div>
              <h2 className="text-4xl font-bold tracking-tight">Pure functional rooms.</h2>
            </div>
            <Link
              href="/prototype/ui-ux-v2-directory"
              className="text-white/50 hover:text-white font-bold transition-colors flex items-center gap-2"
            >
              View Directory <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Dice Card */}
            <Link
              href="/prototype/ui-ux-v2-dice"
              className="group relative rounded-3xl border border-white/10 bg-[#050505] overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] flex flex-col min-h-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <DiceMiniIcon />
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02] relative z-10 backdrop-blur-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-bold text-white">Precision Dice</h3>
                </div>
                <p className="text-white/40 text-sm">Under/over sizing in seconds.</p>
              </div>
            </Link>

            {/* Roulette Card */}
            <Link
              href="/prototype/ui-ux-v2-roulette"
              className="group relative rounded-3xl border border-white/10 bg-[#050505] overflow-hidden transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] flex flex-col min-h-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <RouletteMiniIcon />
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02] relative z-10 backdrop-blur-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-bold text-white">Roulette</h3>
                </div>
                <p className="text-white/40 text-sm">European table & ticket flow.</p>
              </div>
            </Link>

            {/* Coin Toss Card */}
            <Link
              href="/prototype/ui-ux-v2-cointoss"
              className="group relative rounded-3xl border border-white/10 bg-[#050505] overflow-hidden transition-all hover:border-amber-500/50 hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] flex flex-col min-h-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <CoinTossMiniIcon />
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02] relative z-10 backdrop-blur-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-bold text-white">Coin Toss</h3>
                </div>
                <p className="text-white/40 text-sm">Fast 50/50 binary action.</p>
              </div>
            </Link>

            {/* Keno Card */}
            <Link
              href="/prototype/ui-ux-v2-keno"
              className="group relative rounded-3xl border border-white/10 bg-[#050505] overflow-hidden transition-all hover:border-fuchsia-500/50 hover:shadow-[0_0_40px_rgba(217,70,239,0.15)] flex flex-col min-h-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <KenoMiniIcon />
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02] relative z-10 backdrop-blur-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-bold text-white">Keno Draft</h3>
                </div>
                <p className="text-white/40 text-sm">Multi-pick board play.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. DEFI YIELD & LIVE FEED */}
      <section className="bg-black/50 py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)] pointer-events-none" />

        <div className="max-w-[1440px] mx-auto px-6 grid grid-cols-1 xl:grid-cols-2 gap-16 lg:gap-24 relative z-10">
          {/* L: The Yield Farm (DeFi aspect) */}
          <div className="flex flex-col justify-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Real Yield.
              <br />
              Mathematical Edge.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-8">
              ArbiGameFi is powered by protocol-owned Isolated Banks. There are no black box pools.
              When players lose against the pure-function games, the strictly regulated Bank wins.
              Provide liquidity and earn a direct share of the protocol's mathematical edge in USDC.
            </p>

            <div className="p-8 rounded-[2rem] border-2 border-emerald-500/30 bg-[#050505] shadow-[0_0_50px_rgba(16,185,129,0.15),inset_0_2px_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
              <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-colors pointer-events-none" />

              <div className="text-emerald-400/80 font-bold uppercase text-xs tracking-widest mb-4 flex flex-col gap-1 relative z-10 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl w-fit drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />{" "}
                  Isolated USDC Bank
                </span>
                <span className="text-[10px] text-emerald-300/80 font-mono font-normal">
                  0x8B32df...f10A49
                </span>
              </div>

              <div className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-emerald-200 to-emerald-500 mb-8 drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] mt-8 relative z-10 tracking-tight">
                24.50% <span className="text-4xl">APY</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 relative z-10">
                <Link href="/prototype/ui-ux-v2-liquidity">
                  <button className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] transition-all active:scale-95 text-lg">
                    Deposit to Bank
                  </button>
                </Link>
                <div className="text-sm font-bold text-white/50 md:border-l md:border-emerald-500/30 md:pl-6 py-2 flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-emerald-500 font-mono tracking-widest">
                    Status
                  </span>
                  <div className="flex items-center gap-2 text-white">Accepting Deposits</div>
                </div>
              </div>
            </div>
          </div>

          {/* R: Live Bets Feed */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]" />
                Live Settlement Feed
              </h3>
              <Link
                href="/prototype/ui-ux-v2-bets"
                className="text-sm font-bold text-white/40 hover:text-white transition-colors"
              >
                View Ledger →
              </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#050505] p-2 flex flex-col gap-1 overflow-hidden h-[400px]">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1.5fr_1fr_80px] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30 border-b border-white/5">
                <div>Player</div>
                <div>Module</div>
                <div className="text-right">Settlement</div>
                <div className="text-right">Block</div>
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-1 relative flex-1 h-full overflow-hidden">
                {/* Fading bottom edge mask */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#050505] to-transparent z-10 pointer-events-none" />

                {liveBets.map((bet, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1.5fr_1fr_80px] px-4 py-4 rounded-xl items-center hover:bg-white/5 transition-colors cursor-default border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <UserCircleIcon className="w-5 h-5 text-white/20" />
                      <span className="font-mono text-sm tracking-tight">{bet.user}</span>
                    </div>
                    <div className="text-sm font-bold text-white/80">{bet.game}</div>
                    <div className="text-right">
                      {bet.w ? (
                        <span className="inline-block px-2 py-1 rounded bg-green-500/10 text-green-400 font-mono font-bold text-xs border border-green-500/20">
                          +{bet.amt}
                        </span>
                      ) : (
                        <span className="text-white/40 font-mono font-bold text-xs">{bet.amt}</span>
                      )}
                    </div>
                    <div className="text-right text-xs text-white/30 font-mono tracking-tighter">
                      {bet.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. THE TRUST ENGINE (Technical Proof) */}
      <section className="bg-[#050505] py-24 md:py-32 border-t border-white/5">
        <div className="max-w-[1440px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] items-center gap-16 lg:gap-24">
          {/* Terminal Window */}
          <div className="rounded-2xl border border-blue-500/30 bg-[#020202] shadow-[0_0_50px_rgba(59,130,246,0.1),inset_0_2px_20px_rgba(255,255,255,0.02)] relative overflow-hidden order-2 lg:order-1">
            <div className="border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-[#050505] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(234,179,8,0.8)]" />
                <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
              </div>
              <span className="text-xs font-mono text-blue-400 drop-shadow-[0_0_5px_#3b82f6]">
                vrf_fulfillment.sol
              </span>
            </div>

            {/* Terminal Code Area */}
            <div className="p-6 overflow-x-auto text-[13px] font-mono leading-relaxed bg-[#020202] relative">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-20" />
              <div className="relative z-10 text-white/80">
                <span className="text-blue-400 font-bold">function</span>{" "}
                <span className="text-yellow-300 drop-shadow-[0_0_5px_rgba(253,224,71,0.5)]">
                  fulfillRandomWords
                </span>
                (
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256</span> requestId,
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256[]</span>{" "}
                <span className="text-blue-400">memory</span> randomWords
                <br />) <span className="text-blue-400 font-bold">internal override</span> {"{"}
                <br />
                &nbsp;&nbsp;Ticket <span className="text-blue-400">memory</span> t = globalHub.
                <span className="text-cyan-300">getTicket</span>(requestId);
                <br />
                &nbsp;&nbsp;
                <span className="text-white/30 italic">// Pure deterministic execution</span>
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256</span> payout = gameModule.
                <span className="text-cyan-300">resolve</span>(t, randomWords[0]);
                <br />
                &nbsp;&nbsp;
                <br />
                &nbsp;&nbsp;<span className="text-fuchsia-400 font-bold">if</span> (payout {">"} 0){" "}
                {"{"}
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;isolatedBank.<span className="text-cyan-300">payout</span>
                (t.player, payout);
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-400 font-bold">emit</span>{" "}
                <span className="text-emerald-300 drop-shadow-[0_0_5px_rgba(110,231,183,0.5)]">
                  TicketSettled
                </span>
                (t.player, payout);
                <br />
                &nbsp;&nbsp;{"}"}
                <br />
                {"}"}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-bold uppercase tracking-widest mb-6 w-fit">
              <CodeBracketSquareIcon className="w-4 h-4" /> Open Source Verification
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Don't trust us.
              <br />
              Trust the bytecode.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-8">
              ArbiGameFi explicitly separates custody, game logic, and randomness into strictly
              audited components. Every ticket is routed through the Global Hub and resolved
              securely by VRF verification.
            </p>

            <div className="flex flex-col gap-4">
              <Link
                href="/prototype/ui-ux-v2-ops"
                className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between hover:bg-white/[0.05] transition-colors group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <ShieldCheckIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-lg mb-1">SSOT Ops & Audits</div>
                    <div className="text-sm text-white/40">Trace exact release bytecode.</div>
                  </div>
                </div>
                <ArrowRightIcon className="w-5 h-5 text-white/30 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#050505] py-12 text-center text-white/40 text-sm">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">
            Games
          </Link>
          <span className="w-1 h-1 bg-white/20 rounded-full" />
          <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">
            Isolated Bank
          </Link>
          <span className="w-1 h-1 bg-white/20 rounded-full" />
          <Link href="/prototype/ui-ux-v2-ops" className="hover:text-white transition-colors">
            Ops Proof
          </Link>
        </div>
        <p>ArbiGameFi SSOT Engine &copy; 2026. Fully On-Chain Settlement Protocol.</p>
      </footer>
    </div>
  );
}
