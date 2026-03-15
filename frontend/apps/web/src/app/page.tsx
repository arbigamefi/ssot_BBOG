"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import type { BetRow } from "@ssot/ssot/indexer";
import { Button, GameCard, StatusBadge, type BetStatus } from "@ssot/ui";

import { PageTransition } from "../components/PageTransition";
import { ArbiGameFiLockup, ArbiGameFiMark } from "../components/ArbiGameFiBrand";
import { useRelease } from "../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../ssot/sdk";
import { useSSOTRuntime } from "../ssot/runtime";
import { useBets } from "../features/bets/useBets";
import { getGamePresentation } from "../features/games/presentation";
import { useIndexer } from "../features/ops/useIndexer";
import { formatUnits } from "../features/betting/model/units";

type AssetOverview = {
  address: Address;
  bank: Address;
  symbol: string;
  decimals: number;
  totalAssets: bigint;
  totalReserved: bigint;
  freeLiquidity: bigint;
  protocolFeesPayable?: bigint;
  externalPayablesTotal?: bigint;
  minLiquidityBps?: number;
  updatedAtBlock?: bigint;
};

function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 2
) {
  if (value == null) return "—";
  const raw = formatUnits(value, decimals);
  const neg = raw.startsWith("-");
  const normalized = neg ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  const body = `${neg ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "just now";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (normalized.includes("won") || normalized.includes("win")) return "won";
  if (normalized.includes("lost") || normalized.includes("lose")) return "lost";
  if (normalized.includes("settled") || normalized.includes("resolved") || normalized.includes("final")) {
    return "settled";
  }
  if (normalized.includes("refund")) return "cancelled";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("placed")) return "placed";
  return "pending";
}

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function HeroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  );
}

import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions, GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import { UserCircleIcon, WalletIcon, RocketLaunchIcon, KeyIcon, ClockIcon } from "@heroicons/react/24/outline";

export default function HomePage() {
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { db } = useSSOTRuntime();
  const { indexerStatus } = useIndexer();
  
  // 1. Live Bets Hook
  const { data: latestBets = [] } = useBets(15); // Show latest 15 bets in the audit trail

  // 2. Total Indexed Bets
  const { data: indexedBetCount = 0 } = useQuery({
    queryKey: ["ssot", "home", "bet-count", release?.chainId],
    enabled: Boolean(db && release),
    queryFn: async () => {
      if (!db || !release) return 0;
      return await db.bets.where("chainId").equals(release.chainId).count();
    },
    refetchInterval: 5_000,
  });

  // 3. Bankroll Snapshot (TVL)
  const { data: assetOverviews = [] } = useQuery({
    queryKey: ["ssot", "home", "asset-overview", release?.releaseDigest],
    enabled: Boolean(release && sdk && ready),
    queryFn: async (): Promise<AssetOverview[]> => {
      if (!release || !sdk) return [];
      return await Promise.all(
        release.assets.map(async (asset) => {
          const snapshot = await sdk.bank.getSnapshot(asset.address as Address);
          return {
            address: asset.address as Address,
            bank: asset.bank as Address,
            symbol: asset.symbol,
            decimals: asset.decimals,
            totalAssets: snapshot.totalAssets,
            totalReserved: snapshot.totalReserved,
            freeLiquidity: snapshot.totalAssets - snapshot.totalReserved,
            protocolFeesPayable: snapshot.protocolFeesPayable,
            externalPayablesTotal: snapshot.externalPayablesTotal,
            minLiquidityBps: snapshot.minLiquidityBps,
            updatedAtBlock: snapshot.updatedAtBlock,
          };
        })
      );
    },
    refetchInterval: 15_000,
  });

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.label);
    }
    return map;
  }, [release?.gamesMeta]);

  // Derive metrics
  const primaryAsset = assetOverviews[0];
  const totalTvl = assetOverviews.reduce((sum, a) => sum + (a.totalAssets || 0n), 0n);
  const tvlFormatted = primaryAsset ? formatTokenAmount(totalTvl, primaryAsset.decimals, primaryAsset.symbol) : "Loading...";
  const featuredGames = React.useMemo(() => (release?.gamesMeta ?? []).slice(0, 4), [release?.gamesMeta]);
  return (
    <PageTransition pageKey="home">
      <div className="fixed left-[-10%] top-[-20%] h-[50vw] w-[50vw] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none -z-1" />
      <div className="fixed right-[-10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-600/8 blur-[120px] pointer-events-none -z-1" />

      <main className="pt-24 lg:pt-32 max-w-[1280px] mx-auto px-6 relative z-10 w-full mb-24">
          
          {/* 1. Hero Section */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-32 pt-4">
            <div className="lg:col-span-6 flex flex-col gap-8 lg:pt-6">
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 w-fit">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
                    Protocol Native Game Rooms
                  </span>
                </div>
                <h1 className="text-5xl lg:text-8xl font-black tracking-tighter leading-[0.9] text-white">
                  Play on-chain<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-fuchsia-500">
                    without losing the room feel.
                  </span>
                </h1>
                <p className="text-lg text-white/50 max-w-xl leading-relaxed font-medium">
                  Choose a room, place a ticket, and follow settlement through transparent rails built for readable trust. Settled at the speed of Arbitrum.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/games" className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-full font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-center">
                  Open Rooms
                </Link>
                <Link href="/games" className="px-10 py-5 rounded-full font-bold text-white/80 hover:text-white hover:bg-white/5 transition-all border border-white/10 text-center backdrop-blur-sm">
                  How It Works
                </Link>
              </div>

              <div className="grid max-w-2xl gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6 backdrop-blur-xl">
                   <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35 mb-4">Room Lifecycle</div>
                   <div className="grid grid-cols-3 gap-3">
                     {[
                       { label: "01", title: "Choose room" },
                       { label: "02", title: "Build ticket" },
                       { label: "03", title: "Follow" },
                     ].map((step) => (
                       <div key={step.label} className="rounded-2xl border border-white/8 bg-black/40 px-3 py-4">
                         <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-400">{step.label}</div>
                         <div className="mt-2 text-xs font-bold text-white/80">{step.title}</div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="rounded-[2rem] border border-white/8 bg-black/40 p-6 backdrop-blur-xl">
                   <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35 mb-4">Live Proof</div>
                   <div className="space-y-4">
                     <div>
                       <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">Bankroll TVL</div>
                       <div className="mt-1 text-sm font-mono font-bold text-emerald-400">{tvlFormatted}</div>
                     </div>
                     <div>
                       <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">Calls Indexed</div>
                       <div className="mt-1 text-sm font-mono font-bold text-indigo-300">{indexedBetCount.toLocaleString()}</div>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative aspect-square lg:aspect-auto lg:h-[620px] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-fuchsia-500/10 to-white/5 rounded-[3rem] border border-white/10 shadow-2xl" />
              <div className="relative w-[92%] h-[92%] bg-[#080808] rounded-[2.5rem] border border-white/10 shadow-inner p-8 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-2">
                     <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-blue-400">Featured</span>
                     <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       Live
                     </span>
                   </div>
                   <span className="text-[10px] font-mono font-bold text-white/30 tracking-widest uppercase">Network Protocol Trace</span>
                </div>

                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="max-w-[320px]">
                    <h2 className="text-4xl font-black tracking-tighter text-white">Active Settlement</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/45 font-medium">Standard European table layout with a compact ticket rail and readable settlement.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right backdrop-blur-md">
                    <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">Status</div>
                    <div className="mt-2 text-2xl font-mono font-bold text-white uppercase">{release?.name || "Active"}</div>
                    <div className="mt-1 text-[10px] font-mono text-white/30">{indexerStatus?.lagBlocks ? `${indexerStatus.lagBlocks} blocks lag` : "Head healthy"}</div>
                  </div>
                </div>

                <div className="flex-1 rounded-[1.8rem] border border-white/8 bg-black/50 p-6 flex flex-col gap-4">
                  {latestBets.slice(0, 4).map((bet) => {
                    const gameLabel = gameLabelById.get((bet.gameId ?? "").toLowerCase()) ?? "Network Room";
                    const status = mapBetState(bet.state);
                    return (
                      <div key={bet.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-lg shadow-inner">🎲</div>
                            <div>
                               <div className="text-sm font-bold text-white tracking-tight">{gameLabel}</div>
                               <div className="text-[10px] font-mono text-white/30">{shortHex(bet.player)}</div>
                            </div>
                         </div>
                         <div className="text-right flex flex-col items-end gap-1">
                            <StatusBadge status={status} label={bet.state} />
                            <span className="text-[9px] font-mono text-white/20">{formatRelativeTime(bet.updatedAt)}</span>
                         </div>
                      </div>
                    );
                  })}
                  {latestBets.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 italic font-mono text-sm py-12">
                      Waiting for protocol activity...
                    </div>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between rounded-[1.8rem] border border-white/8 bg-white/[0.04] px-6 py-5 backdrop-blur-xl">
                   <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">Quick Start</div>
                      <div className="mt-1 text-sm text-white/60 font-medium">Sign a ticket to enter the room.</div>
                   </div>
                   <Link href="/games" className="rounded-full bg-white px-6 py-3 text-xs font-bold text-black transition-all hover:scale-105 active:scale-95 shadow-lg">
                      Enter Room
                   </Link>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Featured Rooms */}
          <section className="mb-32">
            <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-16">
              <div className="max-w-3xl">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-4">Room Directory</div>
                <h2 className="text-5xl lg:text-6xl font-black tracking-tighter text-white leading-none">
                  Choose a room and get straight to the table.
                </h2>
                <p className="mt-6 text-xl text-white/45 max-w-2xl leading-relaxed">Each room is designed to make the game legible first, while keeping the trust layer close when you need it.</p>
              </div>
              <Link href="/games" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors border-b-2 border-indigo-400/20 pb-1 text-sm tracking-widest uppercase">
                Browse All Tables →
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-8">
              {featuredGames.length > 0 && (
                <>
                  <div className="group relative rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-10 min-h-[480px] flex flex-col justify-between overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 blur-[100px] -z-10 group-hover:bg-blue-500/20 transition-all duration-700" />
                    <div className="relative flex items-start justify-between gap-4">
                       <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-400">Flagship Experience</span>
                       <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Open Now</span>
                       </div>
                    </div>
                    <div className="relative max-w-2xl py-8">
                      {(() => {
                        const game = featuredGames[0]!;
                        const pres = getGamePresentation(game.slug, game.label);
                        return (
                          <>
                            <h3 className="text-6xl font-black tracking-tighter text-white">{game.label}</h3>
                            <p className="mt-6 text-xl text-white/50 leading-relaxed font-medium">{pres.roomSummary}</p>
                            <div className="mt-8 flex flex-wrap gap-3 text-[10px] font-bold tracking-widest uppercase">
                               <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60 backdrop-blur-md">{pres.roomLabel}</span>
                               <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60 backdrop-blur-md">Instant Proof</span>
                               <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-indigo-400 backdrop-blur-md">Arbitrum L2</span>
                            </div>
                            <div className="mt-12 flex items-center gap-6">
                              <Link href={`/games/${game.slug}`} className="rounded-full bg-white px-10 py-5 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 shadow-xl">
                                Enter Flagship Table
                              </Link>
                              <span className="text-xs font-mono text-white/30">Readable trust layer active</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {featuredGames.slice(1, 4).map((game) => {
                      const pres = getGamePresentation(game.slug, game.label);
                      return (
                        <Link href={`/games/${game.slug}`} key={game.slug} className="group flex flex-col justify-between min-h-[160px] rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 hover:bg-white/[0.06] transition-all relative overflow-hidden backdrop-blur-sm">
                           <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 blur-[50px] -z-10 group-hover:bg-purple-500/15 transition-all" />
                           <div className="flex items-start justify-between gap-4">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/30">{pres.roomLabel}</span>
                              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white group-hover:scale-110 transition-all">→</div>
                           </div>
                           <div>
                              <h3 className="text-2xl font-black text-white tracking-tight">{game.label}</h3>
                              <p className="text-sm text-white/40 mt-2 font-medium line-clamp-1">{pres.listDescription}</p>
                           </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 3. Deep Infrastructure */}
          <section className="mb-40 pt-12 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
               <div className="flex flex-col gap-8">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400">Readable Settlement</div>
                  <h2 className="text-5xl lg:text-7xl font-black tracking-tighter text-white leading-[0.9]">
                    The trust layer stays close.
                  </h2>
                  <p className="text-xl text-white/45 leading-relaxed font-medium">
                    Skip the deposit-heavy flow. Use an auditable path from room entry to session finality. No opaque backends, just verifiable protocol calls.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-4">
                    {[
                      { icon: "👛", title: "Wallet-native", desc: "No deposits needed. Tickets start and stay in your wallet." },
                      { icon: "📜", title: "Opaque-free", desc: "Every flip and spin is a protocol event you can trace." },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner">{item.icon}</div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{item.title}</h4>
                        <p className="text-sm text-white/40 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-6">
                  <GlassCard padding="lg" glowColor="bg-indigo-500/10" className="flex flex-col gap-6 scale-105 shadow-2xl">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Architecture Audit</span>
                        <div className="px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase">Verifiable</div>
                     </div>
                     <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center group cursor-pointer hover:border-indigo-500/30 transition-colors">
                           <div className="flex items-center gap-3">
                              <span className="text-white/30 font-mono text-xs">01</span>
                              <span className="text-sm font-bold text-white/80">VRF Entropy Request</span>
                           </div>
                           <span className="text-indigo-400 text-xs">Chain Head →</span>
                        </div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <span className="text-white/30 font-mono text-xs">02</span>
                              <span className="text-sm font-bold text-white/80">On-chain Fullfillment</span>
                           </div>
                           <span className="text-emerald-400 text-xs">Fulfilled</span>
                        </div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center opacity-40">
                           <div className="flex items-center gap-3">
                              <span className="text-white/30 font-mono text-xs">03</span>
                              <span className="text-sm font-bold text-white/80">Asset Reconciliation</span>
                           </div>
                           <span className="text-white/40 text-xs text-right">Settled</span>
                        </div>
                     </div>
                     <p className="text-[10px] font-medium text-white/30 italic text-center leading-relaxed">
                       This trace represents a live settlement call on the Arbitrum network. Every step is public.
                     </p>
                  </GlassCard>
               </div>
            </div>
          </section>

          {/* 4. Global Protocol Trace */}
          <section className="mb-40">
             <div className="flex flex-col md:flex-row items-baseline justify-between gap-8 mb-12">
               <div>
                 <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-4">Protocol Feed</div>
                 <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white">Live Activity Trace</h2>
               </div>
               <div className="text-white/40 font-mono text-xs backdrop-blur-md bg-white/5 px-4 py-2 rounded-full border border-white/5">
                 {indexerStatus?.lagBlocks ? `Trailer: ${indexerStatus.lagBlocks} blocks` : "Network: Head aligned"}
               </div>
             </div>
             
             <AuditTabs activeColorClass="border-blue-400 text-blue-400">
                <div className="overflow-x-auto custom-scrollbar">
                  <div className="min-w-[1000px]">
                    <AuditTableHeader>
                      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px] text-white/30 font-bold uppercase tracking-widest text-[9px] px-4 py-4 border-b border-white/5">
                        <div>Game & Ticket ID</div>
                        <div>Identity</div>
                        <div>Settlement Time</div>
                        <div>State</div>
                        <div className="text-right">Action</div>
                      </div>
                    </AuditTableHeader>
                    <div className="flex flex-col">
                      {latestBets.map(bet => {
                        const gameLabel = gameLabelById.get((bet.gameId ?? "").toLowerCase()) ?? "Network Room";
                        const status = mapBetState(bet.state);
                        const presentation = getGamePresentation((bet.gameId ?? "").toLowerCase(), gameLabel);
                        
                        return (
                          <AuditTableRow key={bet.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] group">
                            <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px] items-center px-4 py-6">
                              <AuditTableCell>
                                <Link href={`/bets/${bet.betId}`} className="flex items-center gap-4 group/item">
                                   <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg border border-white/5 group-hover/item:border-blue-500/30 transition-all shadow-inner">
                                     {presentation?.icon ?? "🕹️"}
                                   </div>
                                   <div>
                                     <div className="font-bold text-white group-hover/item:text-blue-400 transition-colors tracking-tight">{gameLabel}</div>
                                     <div className="text-[10px] font-mono text-white/20 tracking-tighter uppercase">ID {shortHex(bet.betId)}</div>
                                   </div>
                                </Link>
                              </AuditTableCell>
                              
                              <AuditTableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px]">👤</div>
                                  <span className="font-mono text-sm text-white/70">{shortHex(bet.player)}</span>
                                </div>
                              </AuditTableCell>
  
                              <AuditTableCell>
                                <div className="flex flex-col items-start justify-center gap-1">
                                  <span className="text-sm font-bold text-white/80">{formatRelativeTime(bet.updatedAt)}</span>
                                  <span className="text-[10px] font-mono text-white/20">Block {bet.updatedBlock}</span>
                                </div>
                              </AuditTableCell>
  
                              <AuditTableCell>
                                 <StatusBadge status={status} label={bet.state} size="sm" />
                              </AuditTableCell>
  
                              <AuditTableCell className="justify-end py-1">
                                 <Link href={`/bets/${bet.betId}`} className="w-10 h-10 flex items-center justify-center rounded-full border border-white/0 hover:border-white/5 hover:bg-white/5 text-white/30 hover:text-white transition-all">
                                   ↗
                                 </Link>
                              </AuditTableCell>
                            </div>
                          </AuditTableRow>
                        );
                      })}
                      {latestBets.length === 0 && (
                        <div className="py-24 text-center text-white/20 font-mono text-sm tracking-widest uppercase bg-white/[0.01]">
                          <span className="animate-pulse">Awaiting live block reconciliation...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
             </AuditTabs>
          </section>

          {/* 5. Final CTA */}
          <section className="relative rounded-[3rem] overflow-hidden bg-blue-600/10 border border-blue-500/20 flex flex-col items-center justify-center py-32 px-6 text-center mb-16 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-fuchsia-500/10" />
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_70%)]" />
            <div className="relative z-10 max-w-3xl">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 text-white leading-[0.9]">Ready to step into a room?</h2>
              <p className="text-xl text-white/40 mb-12 max-w-xl mx-auto font-medium">Start with the directory, choose the room that fits your style, and keep the trust layer available when you need it.</p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                <Link href="/games" className="inline-block bg-white text-black px-12 py-6 rounded-full font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                  Enter Rooms Now
                </Link>
                <Link href="/liquidity" className="rounded-full border border-white/10 px-10 py-5 font-bold text-white/60 transition-all hover:bg-white/5 hover:text-white backdrop-blur-md">
                  View Bankroll Stats
                </Link>
              </div>
            </div>
          </section>

          {/* 6. High-Fidelity Footer */}
          <footer className="mt-20 pt-16 border-t border-white/5 grid grid-cols-1 lg:grid-cols-12 gap-16 pb-12">
             <div className="lg:col-span-5 flex flex-col gap-8">
                <div className="flex flex-col gap-2">
                   <ArbiGameFiLockup className="h-7 w-auto" />
                   <p className="text-sm font-medium text-white/30 max-w-sm mt-4 leading-relaxed italic">
                     Digital game rooms on the Arbitrum network. Built for readable trust and wallet-native transparency.
                   </p>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase text-white/20">
                   <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Arbitrum One</span>
                   <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> SSOT Protocol</span>
                </div>
             </div>
             <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-12">
                <div className="flex flex-col gap-5">
                   <span className="font-bold text-white/50 uppercase tracking-[0.2em] text-[10px]">Core Index</span>
                   <Link href="/games" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Rooms Directory</Link>
                   <Link href="/liquidity" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Bankroll Stats</Link>
                   <Link href="/referral" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Affiliate Hub</Link>
                </div>
                <div className="flex flex-col gap-5">
                   <span className="font-bold text-white/50 uppercase tracking-[0.2em] text-[10px]">Session Audit</span>
                   <Link href="/bets" className="text-sm text-white/40 hover:text-white transition-colors font-medium">My Active Bets</Link>
                   <Link href="/account" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Account Integrity</Link>
                   <Link href="/ops" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Indexer Pulse</Link>
                </div>
                <div className="flex flex-col gap-5">
                   <span className="font-bold text-white/50 uppercase tracking-[0.2em] text-[10px]">Connection</span>
                   <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Twitter Pulse</a>
                   <a href="https://discord.com" target="_blank" rel="noreferrer" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Discord Room</a>
                   <a href="https://docs.arbigamefi.com" target="_blank" rel="noreferrer" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Protocol Mirror</a>
                </div>
             </div>
             <div className="lg:col-span-12 pt-8 flex border-t border-white/[0.02] justify-between items-center text-[10px] text-white/20 font-mono tracking-tighter">
                <span>© 2026 ARBIGAMEFI LABS. FULLY DECENTRALIZED.</span>
                <span>V2.1 FLAGSHIP DEPLOYMENT</span>
             </div>
          </footer>

        </main>
    </PageTransition>
  );
}

