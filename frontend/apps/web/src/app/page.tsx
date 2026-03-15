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
  const tvl = primaryAsset ? formatTokenAmount(primaryAsset.totalAssets, primaryAsset.decimals, primaryAsset.symbol) : "Loading...";
  const featuredGames = React.useMemo(() => (release?.gamesMeta ?? []).slice(0, 4), [release?.gamesMeta]);

  return (
    <PageTransition pageKey="home">
      <div className="text-white font-sans selection:bg-blue-500/30 overflow-x-hidden w-full pb-24 relative">
        {/* Background Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

        <main className="pt-24 lg:pt-32 max-w-[1280px] mx-auto px-6 relative z-10 w-full">

          {/* 1. Hero Section */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 min-h-[70vh] items-center mb-24">
            <div className="lg:col-span-6 flex flex-col gap-8">
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 w-fit">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-semibold tracking-wide text-white/80 uppercase">Arbitrum Native</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                  Provably Fair.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    Instant Settlement.
                  </span>
                </h1>
                <p className="text-lg text-white/60 max-w-md leading-relaxed">
                  Experience the next generation of on-chain gaming. Non-custodial, mathematically sound, and settled at the speed of Arbitrum.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/games" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] text-center">
                  Start Playing
                </Link>
                <Link href="/games" className="px-8 py-4 rounded-full font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-all border border-white/10 text-center">
                  Explore Rooms
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm font-medium text-white/40 pt-4 flex-wrap">
                <div className="flex items-center gap-2">✓ Non-custodial</div>
                <div className="flex items-center gap-2">✓ On-chain settlement</div>
                <div className="flex items-center gap-2">✓ Provable math</div>
              </div>
            </div>

            <div className="lg:col-span-6 relative aspect-square lg:aspect-auto lg:h-[600px] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-[2.5rem] border border-white/10 overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#0a0a0a] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-6 p-8 transition-transform duration-500 group-hover:scale-105">
                  <div className="w-24 h-24 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                  <div className="text-center">
                    <div className="text-2xl font-bold">Protocol Sync</div>
                    <div className="text-blue-400 mt-2 font-mono">{release?.name ?? "Network"} • ACTIVE</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Proof Ribbon */}
          <section className="py-8 border-y border-white/10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-8 mb-32">
            {[
              { label: "Live Rooms", value: String(release?.gamesMeta?.length ?? 0) },
              { label: "Total Bankroll", value: tvl },
              { label: "Indexed Proofs", value: indexedBetCount.toLocaleString() },
              { label: "Network", value: release?.name ?? "—" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-1 w-[45%] lg:w-auto">
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wider">{stat.label}</div>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              </div>
            ))}
          </section>

          {/* 3. Featured Rooms */}
          <section className="mb-32">
            <div className="flex items-baseline justify-between mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Featured Rooms</h2>
              <Link href="/games" className="hidden sm:block text-blue-400 font-medium hover:text-blue-300 transition-colors">View All Directory →</Link>
            </div>

            {featuredGames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Primary Large Card */}
                {(() => {
                  const game = featuredGames[0]!;
                  const pres = getGamePresentation(game.slug, game.label);
                  return (
                    <div className="lg:col-span-2 group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex flex-col justify-end p-8 min-h-[400px]">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] -z-10 group-hover:bg-blue-500/30 transition-colors" />
                      <div className="absolute top-6 left-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-blue-400 border border-white/10">
                        {pres.roomLabel}
                      </div>
                      <div className="mt-auto max-w-md relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                           <span className="text-4xl">{pres.icon}</span>
                           <h3 className="text-3xl font-bold">{game.label}</h3>
                        </div>
                        <p className="text-white/60 mb-6 line-clamp-2">{pres.roomSummary}</p>
                        <Link href={`/games/${game.slug}`} className="inline-block bg-white text-black px-6 py-3 rounded-full font-medium text-sm hover:bg-white/90 transition-colors">
                          Enter Room
                        </Link>
                      </div>
                    </div>
                  );
                })()}

                {/* Smaller Support Cards */}
                <div className="flex flex-col gap-6">
                  {featuredGames.slice(1, 3).map((game) => {
                    const pres = getGamePresentation(game.slug, game.label);
                    return (
                      <Link href={`/games/${game.slug}`} key={game.slug} className="group relative rounded-3xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-6 flex flex-col flex-1 h-[190px]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] -z-10 group-hover:bg-purple-500/20 transition-colors" />
                        <div className="flex items-center gap-2 mb-3">
                           <span className="text-xl">{pres.icon}</span>
                           <div className="inline-block px-2 py-0.5 bg-white/5 rounded text-[10px] font-semibold uppercase tracking-wider text-white/50">{pres.roomLabel}</div>
                        </div>
                        <h3 className="text-xl font-bold mb-1">{game.label}</h3>
                        <p className="text-white/50 text-sm mb-4 line-clamp-2">{pres.listDescription}</p>
                        <div className="mt-auto text-blue-400 font-medium text-sm group-hover:translate-x-1 transition-transform inline-block w-fit">
                           Play Now →
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
               <div className="text-white/40 py-12 text-center text-sm">No featured games configured on this network.</div>
            )}
          </section>

          {/* 4. How It Works */}
          <section className="mb-32">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">How it Works</h2>
              <p className="text-white/50 max-w-xl mx-auto">Skip the deposits. Play directly from your wallet with zero counterparty risk.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-[28%] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10" />
              {[
                { num: "01", title: "Choose a Room", desc: "Pick your game style. From classic tables to fast binary plays." },
                { num: "02", title: "Set Your Ticket", desc: "Place your chips entirely on-chain without trusting a house." },
                { num: "03", title: "Settle On-Chain", desc: "Instant transparent payouts straight to your wallet." }
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-xl font-mono font-bold text-blue-400 mb-6 shadow-xl">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed max-w-[250px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Why Trust This */}
          <section className="mb-32">
            <div className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8 md:p-12 lg:p-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-4 flex flex-col justify-center">
                  <h2 className="text-3xl font-bold tracking-tight mb-4">Built on Proof,<br />Not Promises.</h2>
                  <p className="text-white/50">Our architecture removes the need to trust us. Verify everything on Arbitrum.</p>
                </div>
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
                  {[
                    { icon: "🛡️", title: "Self Custody", desc: "Your keys, your chips. Never deposit into a centralized hot wallet again." },
                    { icon: "⚡", title: "Smart Settlement", desc: "Immutable smart contracts guarantee deterministic payout execution." },
                    { icon: "📜", title: "Room Truth", desc: "Every spin, flip, and roll is cryptographically verifiable." }
                  ].map((pillar, i) => (
                    <div key={i} className="flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl border border-white/10">{pillar.icon}</div>
                      <h3 className="text-lg font-semibold">{pillar.title}</h3>
                      <p className="text-sm text-white/50 leading-relaxed">{pillar.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 6. Live Activity Trace */}
          <section className="mb-32">
             <div className="flex items-baseline justify-between mb-8">
               <h2 className="text-3xl font-bold tracking-tight">Live Activity Proof</h2>
               <div className="hidden sm:block text-white/40 text-sm">
                 {indexerStatus?.lagBlocks ? `Trailer lag: ${indexerStatus.lagBlocks} blocks` : "Up to date with chain head"}
               </div>
             </div>
             <AuditTabs tabs={["Live Protocol Network", "My Bets"]} activeTab="Live Protocol Network" onTabChange={() => {}}>
               <div className="overflow-x-auto">
                 <div className="min-w-[800px]">
                   <AuditTableHeader>
                     <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                       <div>Game & Ticket ID</div>
                       <div>Player</div>
                       <div>Time</div>
                       <div>Status</div>
                       <div className="text-right">Action</div>
                     </div>
                   </AuditTableHeader>
                   <div className="flex flex-col">
                     {latestBets.map(bet => {
                       const gameLabel = gameLabelById.get((bet.gameId ?? "").toLowerCase()) ?? "Network Room";
                       const status = mapBetState(bet.state);
                       const presentation = getGamePresentation((bet.gameId ?? "").toLowerCase(), gameLabel);
                       
                       return (
                         <AuditTableRow key={bet.id}>
                           <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_100px] items-center">
                             <AuditTableCell>
                               <Link href={`/bets/${bet.betId}`} className="flex items-center gap-3 group">
                                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-sm group-hover:bg-white/10 transition-colors">
                                    {presentation?.icon ?? "🕹️"}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{gameLabel}</div>
                                    <div className="text-[10px] font-mono text-white/40">ID {shortHex(bet.betId)}</div>
                                  </div>
                               </Link>
                             </AuditTableCell>
                             
                             <AuditTableCell>
                               <div className="flex items-center gap-2">
                                 <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">👤</div>
                                 <span className="font-mono text-sm text-white/80">{shortHex(bet.player)}</span>
                               </div>
                             </AuditTableCell>
 
                             <AuditTableCell>
                               <div className="flex flex-col items-start justify-center gap-1">
                                 <span className="text-sm text-white">{formatRelativeTime(bet.updatedAt)}</span>
                                 <span className="text-[10px] text-white/30 truncate">Block {bet.updatedBlock}</span>
                               </div>
                             </AuditTableCell>
 
                             <AuditTableCell>
                                <StatusBadge status={status} label={bet.state} />
                             </AuditTableCell>
 
                             <AuditTableCell className="justify-end transition-transform hover:translate-x-1 cursor-pointer text-white/30 hover:text-white">
                                <Link href={`/bets/${bet.betId}`}>↗</Link>
                             </AuditTableCell>
                           </div>
                         </AuditTableRow>
                       );
                     })}
                     {latestBets.length === 0 && (
                       <div className="py-12 text-center text-white/40 font-mono text-sm">Waiting for live block indexer...</div>
                     )}
                   </div>
                 </div>
               </div>
             </AuditTabs>
          </section>

          {/* 7. Final CTA */}
          <section className="relative rounded-[2.5rem] overflow-hidden bg-blue-600/10 border border-blue-500/20 flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 relative z-10">Ready to enter the rooms?</h2>
            <Link href="/games" className="relative z-10 inline-block bg-white text-black px-10 py-5 rounded-full font-bold text-lg hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              Start Playing Now
            </Link>
          </section>

        </main>
      </div>
    </PageTransition>
  );
}
