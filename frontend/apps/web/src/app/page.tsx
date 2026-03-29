"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
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

import { useRelease } from "../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../ssot/sdk";
import { useBets } from "../features/bets/useBets";
import { formatUnits } from "../features/betting/model/units";
import { getCatalogRooms } from "../features/games/catalog";
import {
  CoinTossMiniIcon,
  DiceMiniIcon,
  KenoMiniIcon,
  RouletteMiniIcon
} from "./prototype/components/PrototypeGameIcons";

type AssetOverview = {
  address: Address;
  symbol: string;
  decimals: number;
  totalAssets: bigint;
  totalReserved: bigint;
};

const ROOM_ICON_MAP: Record<string, React.ReactNode> = {
  dice: <CubeTransparentIcon className="w-full h-full text-purple-400" />,
  roulette: <CircleStackIcon className="w-full h-full text-emerald-400" />,
  "coin-toss": <ShieldCheckIcon className="w-full h-full text-amber-400" />,
  keno: <BoltIcon className="w-full h-full text-fuchsia-400" />
};

function formatTokenAmount(value: bigint | undefined, decimals: number, symbol?: string) {
  if (value == null) return "Syncing";
  const raw = formatUnits(value, decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const cleanedFrac = fracPart.slice(0, 2).replace(/0+$/, "");
  const amount = `${BigInt(intPart || "0").toLocaleString("en-US")}${cleanedFrac ? `.${cleanedFrac}` : ""}`;
  return symbol ? `${amount} ${symbol}` : amount;
}

function shortDigest(value?: string) {
  if (!value) return "Pending";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function timeAgo(value?: number) {
  if (!value) return "just now";
  const diffMs = Math.max(0, Date.now() - value);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 15) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function HomePage() {
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { data: latestBets = [] } = useBets(5);

  const { data: assetOverviews = [] } = useQuery({
    queryKey: ["ssot", "landing", "asset-overview", release?.releaseDigest],
    enabled: Boolean(release && sdk && ready),
    queryFn: async (): Promise<AssetOverview[]> => {
      if (!release || !sdk) return [];
      return await Promise.all(
        release.assets.map(async (asset) => {
          const snapshot = await sdk.bank.getSnapshot(asset.address as Address);
          return {
            address: asset.address as Address,
            symbol: asset.symbol,
            decimals: asset.decimals,
            totalAssets: snapshot.totalAssets,
            totalReserved: snapshot.totalReserved
          };
        })
      );
    }
  });

  const rooms = React.useMemo(
    () => getCatalogRooms(release?.gamesMeta as Array<{ slug: string; label: string }> | undefined),
    [release?.gamesMeta]
  );

  const primaryAsset = assetOverviews[0];
  const totalAssets = assetOverviews.reduce((sum, asset) => sum + asset.totalAssets, 0n);
  const totalReserved = assetOverviews.reduce((sum, asset) => sum + asset.totalReserved, 0n);
  const freeReserve = totalAssets > totalReserved ? totalAssets - totalReserved : 0n;
  const reserveFloor = primaryAsset
    ? formatTokenAmount(freeReserve, primaryAsset.decimals, primaryAsset.symbol)
    : "Awaiting reserve sync";
  const totalAssetsLabel = primaryAsset
    ? formatTokenAmount(totalAssets, primaryAsset.decimals, primaryAsset.symbol)
    : "Awaiting reserve sync";

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const gameMeta of release?.gamesMeta ?? []) {
      if (!gameMeta?.gameId || !gameMeta?.label) continue;
      map.set(String(gameMeta.gameId).toLowerCase(), String(gameMeta.label));
    }
    return map;
  }, [release?.gamesMeta]);

  const liveFeed = latestBets.slice(0, 5).map((b: any) => ({
    id: b.id,
    player: b.player ? `${b.player.slice(0, 6)}…${b.player.slice(-4)}` : "Wallet pending",
    game: b.gameId ? (gameLabelById.get(String(b.gameId).toLowerCase()) ?? "Room") : "Room",
    settlement: b.state ?? "Placed",
    time: timeAgo(typeof b.updatedAt === "number" ? b.updatedAt : undefined),
    amt:
      b.payout && typeof b.payout === "bigint" && b.payout > 0n && primaryAsset
        ? formatTokenAmount(b.payout, primaryAsset.decimals, primaryAsset.symbol)
        : b.wager && typeof b.wager === "bigint" && primaryAsset
          ? formatTokenAmount(b.wager, primaryAsset.decimals, primaryAsset.symbol)
          : "0",
    w: b.payout && typeof b.payout === "bigint" && b.payout > 0n
  }));

  const mockLiveFeed = [
    {
      id: "mock-1",
      player: "0x7F...4a21",
      game: "Precision Dice",
      w: true,
      amt: "12,500 USDC",
      time: "just now"
    },
    {
      id: "mock-2",
      player: "0x22...9b0c",
      game: "European Roulette",
      w: true,
      amt: "35,000 USDC",
      time: "12s ago"
    },
    {
      id: "mock-3",
      player: "0x91...cc11",
      game: "Coin Toss",
      w: true,
      amt: "400 USDC",
      time: "45s ago"
    },
    {
      id: "mock-4",
      player: "0x4A...ff89",
      game: "Keno Draft",
      w: true,
      amt: "8,500 USDC",
      time: "1m ago"
    },
    {
      id: "mock-5",
      player: "0x11...2b33",
      game: "Precision Dice",
      w: false,
      amt: "100 USDC",
      time: "2m ago"
    }
  ];

  const displayFeed = liveFeed.length > 0 ? liveFeed : mockLiveFeed;

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white overflow-x-hidden selection:bg-fuchsia-500/30">
      {/* 1. HERO SECTION: The Conversion Engine */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 flex flex-col items-center justify-center text-center">
        {/* Massive Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[700px] bg-gradient-to-b from-fuchsia-600/15 via-violet-600/10 to-transparent blur-[120px] pointer-events-none rounded-full" />

        {/* Floating Casino Elements */}
        <div className="absolute top-32 left-[5%] w-72 bg-[#050505]/95 border border-fuchsia-500/20 rounded-3xl backdrop-blur-3xl -rotate-6 hidden xl:block opacity-90 overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_2px_0_0_#d946ef,0_20px_40px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-transparent pointer-events-none" />
          <div className="p-6 flex flex-col gap-3 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-fuchsia-400 font-bold">
                Recent Big Win
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">
              35,000 <span className="text-fuchsia-500 text-lg">USDC</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-white/40 font-mono">0x22...9b0c</span>
              <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-white/60">
                Roulette
              </span>
            </div>
          </div>
        </div>

        <div className="absolute top-48 right-[5%] w-72 bg-[#050505]/95 border border-emerald-500/20 rounded-3xl backdrop-blur-3xl rotate-6 hidden xl:block opacity-90 overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_-2px_0_0_#10b981,0_20px_40px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-500">
          <div className="absolute inset-0 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none" />
          <div className="p-6 flex flex-col gap-2 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                Provably Fair
              </span>
            </div>
            <div className="text-sm text-white/70 font-medium leading-relaxed">
              100% on-chain randomness powered by Chainlink VRF. The house cannot cheat.
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 w-fit px-2 py-1 rounded">
              Verified Odds ✓
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs font-bold tracking-widest mb-8 uppercase backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
            </span>
            Live on Arbitrum Base Sepolia
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-8">
            <span className="text-white">No Deposits.</span>
            <br />
            <span className="text-white">No Blackboxes.</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400">
              Just Pure Odds.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mb-12 leading-relaxed">
            Experience the first truly immutable Web3 Casino. Play directly from your wallet.
            Verified on-chain randomness. Instant payouts the second you win.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Link href="/games">
              <button className="px-10 py-5 rounded-[1.5rem] bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-extrabold text-xl transition-all active:scale-95 shadow-[0_0_50px_rgba(217,70,239,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center gap-3 border border-fuchsia-400/50">
                Enter Casino <ArrowRightIcon className="w-6 h-6" strokeWidth={3} />
              </button>
            </Link>
            <Link href="/invest">
              <button className="px-10 py-5 rounded-[1.5rem] bg-white/5 border border-white/10 text-white font-bold text-xl hover:bg-white/10 hover:border-white/20 transition-all active:scale-95">
                Verify Fairness
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. STATS TICKER: Institutional Trust */}
      <section className="border-y border-white/5 bg-[#0a0a0a] overflow-hidden">
        <div className="max-w-[1440px] mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-16 md:gap-32">
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <CircleStackIcon className="w-3 h-3" /> Guaranteed Payout Bankroll
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-emerald-400 transition-colors drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
              {totalAssetsLabel}
            </span>
          </div>
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-blue-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <BoltIcon className="w-3 h-3" /> Provably Fair Matches
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
              1,452,093
            </span>
          </div>
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <div className="flex flex-col items-center md:items-start group cursor-default">
            <span className="text-fuchsia-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
              <ShareIcon className="w-3 h-3" /> Total Paid Out
            </span>
            <span className="text-3xl font-mono font-bold text-white group-hover:text-fuchsia-400 transition-colors">
              $10,245,600+
            </span>
          </div>
        </div>
      </section>

      {/* 3. THE TRIAD: Value Propositions */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Designed for the Player.
            </h2>
            <p className="text-white/50 text-lg">
              We stripped away the casino tricks. No deposits, no withdrawal limits, and no black
              box algorithms. Just transparent, verifiable odds directly on your wallet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="rounded-[2.5rem] border border-blue-500/20 bg-[#050505] p-10 group hover:border-blue-500/50 hover:-translate-y-2 transition-all duration-300 shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgba(59,130,246,0.1),inset_0_2px_20px_rgba(59,130,246,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full group-hover:bg-blue-500/20 transition-colors pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-8 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <WalletIcon className="w-10 h-10 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              </div>
              <h3 className="text-3xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-200">
                Wallet Native
              </h3>
              <p className="text-white/60 relative z-10 text-lg leading-relaxed mb-6">
                Never deposit funds to our platform. Retain 100% custody of your chips in your own
                wallet until the exact second you place a bet.
              </p>
              <div className="px-4 py-2 border border-blue-500/30 bg-blue-500/10 rounded-xl text-blue-300 text-sm font-bold w-fit">
                ZERO CUSTODY RISK
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-[2.5rem] border border-emerald-500/20 bg-[#050505] p-10 relative overflow-hidden group hover:border-emerald-500/50 hover:-translate-y-2 transition-all duration-300 shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1),inset_0_2px_20px_rgba(16,185,129,0.05)]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full group-hover:bg-emerald-500/20 transition-colors pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-8 relative z-10 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <CubeTransparentIcon className="w-10 h-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              </div>
              <h3 className="text-3xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-200">
                Verifiable Physics
              </h3>
              <p className="text-white/60 relative z-10 text-lg leading-relaxed mb-6">
                Every roll is driven by an irreversible Chainlink VRF proof on Arbitrum. We
                physically cannot intervene with the result.
              </p>
              <div className="px-4 py-2 border border-emerald-500/30 bg-emerald-500/10 rounded-xl text-emerald-300 text-sm font-bold w-fit">
                PROVABLY FAIR
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-[2.5rem] border border-fuchsia-500/20 bg-[#050505] p-10 group hover:border-fuchsia-500/50 hover:-translate-y-2 transition-all duration-300 shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgba(217,70,239,0.1),inset_0_2px_20px_rgba(217,70,239,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-fuchsia-500/10 blur-[60px] rounded-full group-hover:bg-fuchsia-500/20 transition-colors pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-8 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                <BoltIcon className="w-10 h-10 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]" />
              </div>
              <h3 className="text-3xl font-bold mb-4 relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-white to-fuchsia-200">
                Instant Settlement
              </h3>
              <p className="text-white/60 relative z-10 text-lg leading-relaxed mb-6">
                When you win, the smart contract automatically deposits USDC directly back into your
                wallet within seconds. No manual withdrawals.
              </p>
              <div className="px-4 py-2 border border-fuchsia-500/30 bg-fuchsia-500/10 rounded-xl text-fuchsia-300 text-sm font-bold w-fit">
                ZERO WITHDRAWAL DELAYS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. GAMES GALLERY (The Playability) */}
      <section className="bg-[#0a0a0a] py-24 border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <div className="text-fuchsia-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <CubeTransparentIcon className="w-4 h-4" /> Pick Your Room
              </div>
              <h2 className="text-4xl font-bold tracking-tight">The Classics, Elevated.</h2>
            </div>
            <Link
              href="/games"
              className="text-white/50 hover:text-white font-bold transition-colors flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10"
            >
              View Full Directory <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Dice Card */}
            <Link
              href="/dice"
              className="group relative rounded-[2rem] border border-white/10 bg-[#050505] overflow-hidden hover:-translate-y-2 transition-all duration-300 hover:border-purple-500/60 hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)] flex flex-col min-h-[360px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 right-4 bg-purple-500/20 border border-purple-500/50 text-purple-300 px-3 py-1 text-[10px] uppercase font-bold rounded-full backdrop-blur-md">
                1% House Edge
              </div>
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <div className="group-hover:scale-110 transition-transform duration-500">
                  <DiceMiniIcon />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0a0a0a] relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">Precision Dice</h3>
                <p className="text-white/50 text-sm">
                  Ultra-fast numbers game. Pick your target and roll for instant payouts up to 99x.
                </p>
              </div>
            </Link>

            {/* Roulette Card */}
            <Link
              href="/roulette"
              className="group relative rounded-[2rem] border border-white/10 bg-[#050505] overflow-hidden hover:-translate-y-2 transition-all duration-300 hover:border-emerald-500/60 hover:shadow-[0_20px_50px_rgba(16,185,129,0.2)] flex flex-col min-h-[360px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-3 py-1 text-[10px] uppercase font-bold rounded-full backdrop-blur-md">
                Max Payout 36x
              </div>
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <div className="group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                  <RouletteMiniIcon />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0a0a0a] relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">Roulette</h3>
                <p className="text-white/50 text-sm">
                  The classic European table. Place inside and outside bets with intuitive chip
                  mechanics.
                </p>
              </div>
            </Link>

            {/* Coin Toss Card */}
            <Link
              href="/cointoss"
              className="group relative rounded-[2rem] border border-white/10 bg-[#050505] overflow-hidden hover:-translate-y-2 transition-all duration-300 hover:border-amber-500/60 hover:shadow-[0_20px_50px_rgba(245,158,11,0.2)] flex flex-col min-h-[360px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 right-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3 py-1 text-[10px] uppercase font-bold rounded-full backdrop-blur-md">
                1% House Edge
              </div>
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <div className="group-hover:scale-110 group-hover:rotate-180 transition-transform duration-700">
                  <CoinTossMiniIcon />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0a0a0a] relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">Coin Toss</h3>
                <p className="text-white/50 text-sm">
                  The ultimate 50/50 showdown. Heads or Tails. Double your position in seconds.
                </p>
              </div>
            </Link>

            {/* Keno Card */}
            <Link
              href="/keno"
              className="group relative rounded-[2rem] border border-white/10 bg-[#050505] overflow-hidden hover:-translate-y-2 transition-all duration-300 hover:border-fuchsia-500/60 hover:shadow-[0_20px_50px_rgba(217,70,239,0.2)] flex flex-col min-h-[360px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 right-4 bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-300 px-3 py-1 text-[10px] uppercase font-bold rounded-full backdrop-blur-md">
                Huge 1,000x Win
              </div>
              <div className="flex-1 p-6 relative z-10 flex items-center justify-center">
                <div className="group-hover:scale-110 transition-transform duration-500">
                  <KenoMiniIcon />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0a0a0a] relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">Keno Draft</h3>
                <p className="text-white/50 text-sm">
                  Pick up to 10 numbers on the board. Hit the perfect combo for astronomical
                  multipliers.
                </p>
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
              Reserve floor, liabilities, and settlement paths stay visible while liquidity
              providers capture protocol edge.
            </p>

            <div className="p-8 rounded-[2rem] border-2 border-emerald-500/30 bg-[#050505] shadow-[0_0_50px_rgba(16,185,129,0.15),inset_0_2px_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
              <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-colors pointer-events-none" />

              <div className="text-emerald-400/80 font-bold uppercase text-xs tracking-widest mb-4 flex flex-col gap-1 relative z-10 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl w-fit drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />{" "}
                  Isolated {primaryAsset?.symbol ?? "Primary"} Bank
                </span>
                <span className="text-[10px] text-emerald-300/80 font-mono font-normal">
                  {shortDigest(release?.releaseDigest)}
                </span>
              </div>

              <div className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-emerald-200 to-emerald-500 mb-8 drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] mt-8 relative z-10 tracking-tight">
                {reserveFloor}
              </div>

              <div className="flex flex-wrap items-center gap-4 relative z-10">
                <Link href="/invest">
                  <button className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] transition-all active:scale-95 text-lg">
                    Deposit to Bank
                  </button>
                </Link>
                <div className="text-sm font-bold text-white/50 md:border-l md:border-emerald-500/30 md:pl-6 py-2 flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-emerald-500 font-mono tracking-widest">
                    Status
                  </span>
                  <div className="flex items-center gap-2 text-white">Visible reserve context</div>
                </div>
              </div>
            </div>
          </div>

          {/* R: Live Bets Feed */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-3 tracking-tight">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,1)] animate-pulse" />
                Live Winner Feed
              </h3>
              <Link
                href="/bets"
                className="px-4 py-2 border border-white/10 rounded-full text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
              >
                View All <ArrowRightIcon className="w-3 h-3" />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl p-3 flex flex-col gap-2 overflow-hidden h-[410px] shadow-2xl">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1.5fr_1.2fr_60px] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/5">
                <div>Player</div>
                <div>Game</div>
                <div className="text-right">Payout</div>
                <div className="text-right">Time</div>
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-2 relative flex-1 h-full overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

                {displayFeed.map((bet, i) => (
                  <div
                    key={bet.id ?? i}
                    className="grid grid-cols-[1fr_1.5fr_1.2fr_60px] px-4 py-4 rounded-2xl items-center hover:bg-white/5 transition-all cursor-default border border-transparent hover:border-white/10 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                        <UserCircleIcon className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-sm font-semibold tracking-tight">
                        {bet.player}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 opacity-60 grayscale group-hover:grayscale-0 transition-all">
                        {
                          ROOM_ICON_MAP[
                            bet.game.toLowerCase().includes("dice")
                              ? "dice"
                              : bet.game.toLowerCase().includes("coin")
                                ? "coin-toss"
                                : bet.game.toLowerCase().includes("keno")
                                  ? "keno"
                                  : "roulette"
                          ]
                        }
                      </div>
                      <div className="text-sm font-bold text-white/80">{bet.game}</div>
                    </div>
                    <div className="text-right">
                      {bet.w ? (
                        <span className="inline-block px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 font-mono font-bold text-sm border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                          +{bet.amt}
                        </span>
                      ) : (
                        <span className="text-white/40 font-mono font-bold text-sm bg-white/5 px-3 py-1.5 rounded-lg">
                          {bet.amt ?? (bet as any).settlement}
                        </span>
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
                href="/ops"
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
    </div>
  );
}
