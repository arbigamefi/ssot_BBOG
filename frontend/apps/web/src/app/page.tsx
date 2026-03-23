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
  dice: <DiceMiniIcon />,
  roulette: <RouletteMiniIcon />,
  "coin-toss": <CoinTossMiniIcon />,
  keno: <KenoMiniIcon />
};

const ROOM_GLOW_MAP: Record<string, string> = {
  dice: "hover:border-purple-500/70 hover:shadow-[0_0_50px_rgba(168,85,247,0.22)]",
  roulette: "hover:border-emerald-500/70 hover:shadow-[0_0_50px_rgba(16,185,129,0.22)]",
  "coin-toss": "hover:border-amber-500/70 hover:shadow-[0_0_50px_rgba(245,158,11,0.22)]",
  keno: "hover:border-fuchsia-500/70 hover:shadow-[0_0_50px_rgba(217,70,239,0.22)]"
};

const ROOM_GALLERY_COPY_MAP: Record<
  string,
  {
    title: string;
    promise: string;
  }
> = {
  dice: { title: "Precision Dice", promise: "1-99 sizing in seconds." },
  roulette: { title: "European Roulette", promise: "Classic 37-slot physical mechanics." },
  "coin-toss": { title: "Coin Toss", promise: "High-speed 50/50 resolution." },
  keno: { title: "Keno Draft", promise: "Pick multi-spots for massive multipliers." }
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

function GalleryRoomCard({
  title,
  href,
  promise,
  glow,
  icon
}: {
  title: string;
  href: string;
  promise: string;
  glow: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-testid="room-entry-card"
      className={[
        "group relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050505] transition-all",
        glow
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10 flex flex-1 items-center justify-center p-6">{icon}</div>
      <div className="relative z-10 border-t border-white/5 bg-white/[0.02] p-6 backdrop-blur-md">
        <div className="mb-1 text-xl font-bold text-white">{title}</div>
        <p className="text-sm text-white/40">{promise}</p>
      </div>
    </Link>
  );
}

function PillarCard({
  accentClassName,
  icon,
  title,
  points
}: {
  accentClassName: string;
  icon: React.ReactNode;
  title: string;
  points: Array<{ strong: string; body: string }>;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] p-10 shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] transition-all">
      <div
        className={[
          "absolute top-0 right-0 h-32 w-32 rounded-full blur-[50px] transition-colors pointer-events-none",
          accentClassName
        ].join(" ")}
      />
      <div className="relative z-10 mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-white">
        {icon}
      </div>
      <h3 className="relative z-10 mb-4 text-2xl font-bold text-white">{title}</h3>
      <ul className="relative z-10 space-y-4 text-white/60">
        {points.map((point) => (
          <li key={point.strong} className="flex items-start gap-3">
            <span className="mt-1 text-white">✓</span>
            <span>
              <strong className="text-white">{point.strong}</strong> {point.body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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

  const liveFeed = latestBets.slice(0, 5).map((bet) => ({
    id: bet.id,
    player: bet.player ? `${bet.player.slice(0, 6)}…${bet.player.slice(-4)}` : "Wallet pending",
    game: bet.gameId ? (gameLabelById.get(String(bet.gameId).toLowerCase()) ?? "Room") : "Room",
    settlement: bet.state ?? "Placed",
    time: timeAgo(typeof bet.updatedAt === "number" ? bet.updatedAt : undefined)
  }));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-blue-500/30">
      <section className="relative flex flex-col items-center justify-center px-6 pb-20 pt-40 text-center md:pb-32 md:pt-52">
        <div className="pointer-events-none absolute top-0 left-1/2 h-[700px] w-full max-w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-600/10 via-emerald-600/5 to-transparent blur-[120px]" />

        <div className="absolute top-32 left-[5%] hidden h-40 w-72 -rotate-6 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#050505]/90 opacity-90 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_2px_0_0_#10b981,0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-3xl xl:block">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <div className="relative z-10 flex flex-col gap-3 p-5">
            <div className="mb-2 flex items-center gap-2">
              <CircleStackIcon className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                Isolated Bank
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded border border-emerald-500/30 bg-emerald-500/20">
              <div className="h-full w-[82%] bg-emerald-500/50" />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-white/40">
              <span>Free: {reserveFloor}</span>
              <span>R: {totalAssetsLabel}</span>
            </div>
          </div>
        </div>

        <div className="absolute top-48 right-[5%] hidden h-32 w-72 rotate-6 overflow-hidden rounded-2xl border border-blue-500/20 bg-[#050505]/90 opacity-90 shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),inset_-2px_0_0_#3b82f6,0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-3xl xl:block">
          <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/10 to-transparent" />
          <div className="relative z-10 flex flex-col gap-2 p-5">
            <div className="mb-2 flex items-center gap-2">
              <ShareIcon className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">
                Zero-Recon Referral
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/20 text-[10px] text-blue-300">
                P1
              </div>
              <ArrowRightIcon className="h-3 w-3 text-white/30" />
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-purple-500/50 bg-purple-500/20 text-[10px] text-purple-300">
                C1
              </div>
              <ArrowRightIcon className="h-3 w-3 text-white/30" />
              <div className="flex-1 border-b border-dashed border-white/20" />
              <span className="font-mono text-xs text-white/60">Bound on settle</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-8 inline-flex cursor-default items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-md transition-colors hover:bg-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            SSOT Architecture v1.0
          </div>

          <h1 className="mb-8 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl lg:text-[5.5rem]">
            <span className="text-white">The Settlement Engine</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              for On-Chain Games.
            </span>
          </h1>

          <p className="mb-12 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
            Not just a casino. ArbiGameFi is an infrastructure-grade non-custodial gaming protocol
            featuring isolated liquidity banks, readable settlement, and zero-reconciliation
            referral budgets.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/games">
              <button className="flex items-center gap-2 rounded-full border border-blue-400/50 bg-blue-500 px-8 py-4 text-lg font-extrabold text-black shadow-[0_0_40px_rgba(59,130,246,0.3),inset_0_2px_4px_rgba(255,255,255,0.5)] transition-all active:scale-95 hover:bg-blue-400">
                Enter Rooms <ArrowRightIcon className="h-5 w-5" strokeWidth={3} />
              </button>
            </Link>
            <Link href="/invest">
              <button className="rounded-full border border-emerald-500/30 bg-[#0a0a0a] px-8 py-4 text-lg font-bold text-emerald-400 transition-all active:scale-95 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                Audit Protocol
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-white/5 bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-12 px-6 py-8 md:gap-24">
          {[
            {
              label: "Bankroll reserves (R)",
              value: totalAssetsLabel,
              labelClassName: "text-emerald-400/70",
              hoverClassName: "group-hover:text-emerald-400"
            },
            {
              label: "Settlement Volume",
              value: "—",
              labelClassName: "text-blue-400/70",
              hoverClassName: "group-hover:text-blue-400"
            },
            {
              label: "Active Partners",
              value: "—",
              labelClassName: "text-purple-400/70",
              hoverClassName: "group-hover:text-purple-400"
            }
          ].map((metric, index) => (
            <React.Fragment key={metric.label}>
              <div className="group flex cursor-default flex-col items-center md:items-start">
                <span
                  className={`mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] ${metric.labelClassName}`}
                >
                  {index === 0 ? (
                    <CircleStackIcon className="h-3 w-3" />
                  ) : index === 1 ? (
                    <BoltIcon className="h-3 w-3" />
                  ) : (
                    <ShareIcon className="h-3 w-3" />
                  )}
                  {metric.label}
                </span>
                <span
                  className={`text-3xl font-mono font-bold text-white transition-colors ${metric.hoverClassName}`}
                >
                  {metric.value}
                </span>
              </div>
              {index < 2 ? <div className="hidden h-12 w-px bg-white/10 md:block" /> : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="relative py-24 md:py-32">
        <div className="mx-auto max-w-[1440px] px-6">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">
              A Platform for the Entire Ecosystem
            </h2>
            <p className="text-lg text-white/50">
              Whether you&apos;re playing, providing liquidity, or referring traffic, the SSOT
              architecture enforces your rights on-chain. No platform privilege.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <PillarCard
              accentClassName="bg-blue-500/5 group-hover:bg-blue-500/10"
              icon={<WalletIcon className="h-8 w-8 text-blue-400" />}
              title="For Players"
              points={[
                {
                  strong: "Wallet Native:",
                  body: "No deposits. Retain full custody of your funds until the ticket is placed."
                },
                {
                  strong: "Verifiable Rules:",
                  body: "Every game logic is a pure function. You can run the exact bytecode yourself."
                },
                {
                  strong: "Refund Paths:",
                  body: "If the oracle fails, the timeout refund path remains explicit."
                }
              ]}
            />
            <PillarCard
              accentClassName="bg-emerald-500/5 group-hover:bg-emerald-500/10"
              icon={<CircleStackIcon className="h-8 w-8 text-emerald-400" />}
              title="For Liquidity Providers"
              points={[
                {
                  strong: "Isolated Banks:",
                  body: "USDC is never pooled with other assets. Total risk isolation."
                },
                {
                  strong: "Explicit Reserves:",
                  body: "Pending liabilities vs free bankroll remain readable."
                },
                {
                  strong: "Real Yield:",
                  body: "Earn strict mathematical edge, not inflationary emissions."
                }
              ]}
            />
            <PillarCard
              accentClassName="bg-purple-500/5 group-hover:bg-purple-500/10"
              icon={<ShareIcon className="h-8 w-8 text-purple-400" />}
              title="For Partners & Channels"
              points={[
                {
                  strong: "Zero Reconciliation:",
                  body: "Budgets split during settlement without manual reconciliation."
                },
                {
                  strong: "Skyline Pricing:",
                  body: "Dynamic partner pricing stays explicit in protocol state."
                },
                {
                  strong: "First-Touch Binding:",
                  body: "Referral attribution remains bound in contract state."
                }
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-[1440px] px-6">
          <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
                <CubeTransparentIcon className="h-4 w-4" /> The Execution Layer
              </div>
              <h2 className="text-4xl font-bold tracking-tight">Pure functional rooms.</h2>
            </div>
            <Link
              href="/games"
              className="flex items-center gap-2 text-sm font-bold text-white/40 transition-colors hover:text-white"
            >
              View Directory <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {rooms.slice(0, 4).map((room) => {
              const copy = ROOM_GALLERY_COPY_MAP[room.slug] ?? {
                title: room.label,
                promise: room.summary
              };
              return (
                <GalleryRoomCard
                  key={room.slug}
                  title={copy.title}
                  href={room.href}
                  promise={copy.promise}
                  glow={ROOM_GLOW_MAP[room.slug] ?? ""}
                  icon={ROOM_ICON_MAP[room.slug] ?? <div className="text-5xl">{room.icon}</div>}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-black/50 py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)]" />

        <div className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-6 xl:grid-cols-2 xl:gap-24">
          <div className="flex flex-col justify-center">
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
              Real Yield.
              <br />
              Mathematical Edge.
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/50">
              ArbiGameFi is powered by isolated banks. There are no black box pools. Reserve floor,
              liabilities, and settlement paths stay visible while liquidity providers capture
              protocol edge in the primary bankroll asset.
            </p>

            <div className="group relative overflow-hidden rounded-[2rem] border-2 border-emerald-500/30 bg-[#050505] p-8 shadow-[0_0_50px_rgba(16,185,129,0.15),inset_0_2px_20px_rgba(16,185,129,0.05)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_42%)]" />
              <div className="relative z-10 mt-8 mb-8 bg-gradient-to-b from-white via-emerald-200 to-emerald-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-7xl">
                {reserveFloor}
              </div>
              <div className="mb-6 inline-flex w-fit flex-col gap-1 rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-3 text-xs font-bold uppercase tracking-widest text-emerald-400/80">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                  Isolated {primaryAsset?.symbol ?? "Primary"} Bank
                </span>
                <span className="font-mono text-[10px] font-normal text-emerald-300/80">
                  {shortDigest(release?.releaseDigest)}
                </span>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-4">
                <Link href="/invest">
                  <button className="rounded-xl bg-emerald-500 px-8 py-4 text-lg font-extrabold text-black shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] transition-all active:scale-95 hover:bg-emerald-400">
                    Deposit to Bank
                  </button>
                </Link>
                <div className="flex flex-col gap-1 py-2 text-sm font-bold text-white/50 md:border-l md:border-emerald-500/30 md:pl-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                    Status
                  </span>
                  <div className="text-white">Visible reserve context</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-2xl font-bold">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]" />
                Live Settlement Feed
              </h3>
              <Link
                href="/bets"
                className="text-sm font-bold text-white/40 transition-colors hover:text-white"
              >
                View Ledger →
              </Link>
            </div>

            <div className="flex h-[400px] flex-col gap-1 overflow-hidden rounded-3xl border border-white/10 bg-[#050505] p-2">
              <div className="grid grid-cols-[1fr_1.5fr_1fr_80px] border-b border-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                <div>Player</div>
                <div>Module</div>
                <div className="text-right">Settlement</div>
                <div className="text-right">Block</div>
              </div>

              <div className="relative flex h-full flex-col gap-1 overflow-hidden">
                <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-24 bg-gradient-to-t from-[#050505] to-transparent" />
                {(liveFeed.length
                  ? liveFeed
                  : [
                      {
                        id: "placeholder-1",
                        player: "0x7F...4a21",
                        game: "Precision Dice",
                        settlement: "Placed",
                        time: "just now"
                      },
                      {
                        id: "placeholder-2",
                        player: "0x22...9b0c",
                        game: "European Roulette",
                        settlement: "Settled",
                        time: "12s ago"
                      }
                    ]
                ).map((bet) => (
                  <div
                    key={bet.id}
                    className="grid cursor-default grid-cols-[1fr_1.5fr_1fr_80px] items-center rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-white/5 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <UserCircleIcon className="h-5 w-5 text-white/20" />
                      <span className="font-mono text-sm tracking-tight">{bet.player}</span>
                    </div>
                    <div className="text-sm font-bold text-white/80">{bet.game}</div>
                    <div className="text-right">
                      <span className="inline-block rounded border border-white/10 px-2 py-1 text-xs font-mono font-bold text-white/50">
                        {bet.settlement}
                      </span>
                    </div>
                    <div className="text-right font-mono text-xs tracking-tighter text-white/30">
                      {bet.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-[#050505] py-24 md:py-32">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-16 px-6 lg:grid-cols-[1fr_1fr] lg:gap-24">
          <div className="order-2 overflow-hidden rounded-2xl border border-blue-500/30 bg-[#020202] shadow-[0_0_50px_rgba(59,130,246,0.1),inset_0_2px_20px_rgba(255,255,255,0.02)] lg:order-1">
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-[#050505] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(234,179,8,0.8)]" />
                <div className="h-3 w-3 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
              </div>
              <span className="font-mono text-xs text-blue-400">vrf_fulfillment.sol</span>
            </div>
            <div className="relative overflow-x-auto bg-[#020202] p-6 text-[13px] font-mono leading-relaxed">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] opacity-20" />
              <div className="relative z-10 text-white/80">
                <span className="font-bold text-blue-400">function</span>{" "}
                <span className="text-yellow-300">fulfillRandomWords</span>(
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256</span> requestId,
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256[]</span>{" "}
                <span className="text-blue-400">memory</span> randomWords
                <br />) <span className="font-bold text-blue-400">internal override</span> {"{"}
                <br />
                &nbsp;&nbsp;Ticket <span className="text-blue-400">memory</span> t = globalHub.
                <span className="text-cyan-300">getTicket</span>(requestId);
                <br />
                &nbsp;&nbsp;
                <span className="italic text-white/30">// Pure deterministic execution</span>
                <br />
                &nbsp;&nbsp;<span className="text-emerald-400">uint256</span> payout = gameModule.
                <span className="text-cyan-300">resolve</span>(t, randomWords[0]);
                <br />
                &nbsp;&nbsp;<span className="font-bold text-fuchsia-400">if</span> (payout {">"} 0){" "}
                {"{"}
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;isolatedBank.<span className="text-cyan-300">payout</span>
                (t.player, payout);
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="font-bold text-blue-400">emit</span>{" "}
                <span className="text-emerald-300">TicketSettled</span>(t.player, payout);
                <br />
                &nbsp;&nbsp;{"}"}
                <br />
                {"}"}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-300">
              <CodeBracketSquareIcon className="h-4 w-4" /> Open Source Verification
            </div>
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
              Don&apos;t trust us.
              <br />
              Trust the bytecode.
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/50">
              ArbiGameFi explicitly separates custody, game logic, and randomness into audited
              components. Every ticket routes through the hub and resolves against verifiable
              randomness with a readable fallback path.
            </p>
            <div className="flex flex-col gap-4">
              <Link
                href="/ops"
                className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                    <ShieldCheckIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="mb-1 text-lg font-bold">SSOT Ops & Audits</div>
                    <div className="text-sm text-white/40">Trace exact release bytecode.</div>
                  </div>
                </div>
                <ArrowRightIcon className="h-5 w-5 text-white/30 transition-colors group-hover:text-white" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
