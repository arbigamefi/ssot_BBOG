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

function ProofItem({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function LiveBetRow({ bet, label }: { bet: BetRow; label: string }) {
  return (
    <Link
      href={`/bets/${bet.betId}`}
      className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/14"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{label}</span>
          <StatusBadge status={mapBetState(bet.state)} label={bet.state} />
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500">betId {bet.betId}</div>
      </div>
      <div className="text-right text-sm text-slate-400">
        <div>{formatRelativeTime(bet.updatedAt)}</div>
        <div className="mt-1 text-xs text-slate-500">block {bet.updatedBlock}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { db } = useSSOTRuntime();
  const { indexerStatus } = useIndexer();
  const { data: latestBets = [] } = useBets(5);

  const { data: indexedBetCount = 0 } = useQuery({
    queryKey: ["ssot", "home", "bet-count", release?.chainId],
    enabled: Boolean(db && release),
    queryFn: async () => {
      if (!db || !release) return 0;
      return await db.bets.where("chainId").equals(release.chainId).count();
    },
    refetchInterval: 5_000,
  });

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

  const featuredGames = React.useMemo(() => (release?.gamesMeta ?? []).slice(0, 4), [release?.gamesMeta]);
  const heroGame = featuredGames[0];
  const heroPresentation = heroGame ? getGamePresentation(heroGame.slug, heroGame.label) : null;
  const primaryAsset = assetOverviews[0];
  const lagBlocks = indexerStatus?.lagBlocks;
  const syncLabel = typeof lagBlocks === "number" ? `${lagBlocks} blocks behind` : "Waiting for sync";

  return (
    <PageTransition pageKey="home">
      <div className="space-y-10 py-6">
        <section className="ag-marketing-panel relative overflow-hidden rounded-[2.2rem] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Wallet-native casino
              </div>

              <div className="space-y-4">
                <ArbiGameFiLockup className="hidden h-12 w-auto lg:block" />
                <h1 className="max-w-4xl text-5xl font-black tracking-[-0.05em] text-white md:text-7xl">
                  Play premium rooms. Settle every ticket on-chain.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  ArbiGameFi is rebuilding the casino front-end around real room flow: cleaner tables,
                  faster ticket entry, and readable settlement from wallet to outcome.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/games">Open Rooms</Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link href="/bets">See Live Bets</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <HeroMetric
                  label="Live rooms"
                  value={String(release?.gamesMeta?.length ?? 0)}
                  detail="Top-of-page room selector"
                />
                <HeroMetric
                  label="Indexed bets"
                  value={String(indexedBetCount)}
                  detail="Live proof, not dashboard clutter"
                />
                <HeroMetric
                  label="Primary asset"
                  value={primaryAsset?.symbol ?? "—"}
                  detail={primaryAsset ? formatTokenAmount(primaryAsset.totalAssets, primaryAsset.decimals, primaryAsset.symbol) : "Waiting for asset snapshot"}
                />
              </div>
            </div>

            <div className="ag-room-panel relative overflow-hidden rounded-[2rem] p-4 sm:p-5">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {(release?.gamesMeta ?? []).slice(0, 6).map((game, index) => (
                  <Link
                    key={game.slug}
                    href={`/games/${game.slug}`}
                    data-active={index === 0}
                    className="ag-pill-tab min-w-max px-4 py-2 text-sm"
                  >
                    {game.label}
                  </Link>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className={`relative overflow-hidden rounded-[1.6rem] border border-white/8 p-5 ${heroPresentation?.theme.stageClassName ?? "bg-slate-900"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Featured room
                      </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-white">
                    {heroGame?.label ?? "Room preview"}
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    {heroPresentation?.roomSummary ?? "Open the room, build the ticket, then inspect settlement below the fold."}
                  </p>
                </div>
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/10 bg-[#050714]/35 text-4xl">
                      {heroPresentation?.icon ?? "🎮"}
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    {(heroPresentation?.previewSteps ?? [
                      { title: "Pick the room", body: "Choose the table before you worry about anything else." },
                      { title: "Build the ticket", body: "Set the amount and rounds in one clear slip." },
                      { title: "Track the outcome", body: "Follow the live table after submission." },
                    ]).slice(0, 3).map((step, index) => (
                      <div key={step.title} className="flex items-start gap-4 rounded-[1.2rem] border border-white/8 bg-[#050714]/32 px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{step.title}</div>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <ArbiGameFiMark accent="cyan" className="h-12 w-12 rounded-[1rem]" />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Live proof
                      </div>
                      <div className="text-sm font-semibold text-white">What players see right now</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {latestBets.slice(0, 3).map((bet) => (
                      <LiveBetRow
                        key={bet.id}
                        bet={bet}
                        label={gameLabelById.get((bet.gameId ?? "").toLowerCase()) ?? "Live room"}
                      />
                    ))}
                    {latestBets.length === 0 ? (
                      <div className="rounded-[1.2rem] border border-white/8 bg-[#050714]/45 px-4 py-4 text-sm text-slate-400">
                        Waiting for live activity. The room layer is ready; the next indexed tickets will appear here.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[1.2rem] border border-white/8 bg-[#050714]/45 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Release state
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {release?.name ?? "Unknown network"} • digest {shortHex(release?.releaseDigest)} • {syncLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Featured rooms</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Choose a room and get straight to the table.</h2>
            </div>
            <Link href="/games" className="text-sm font-semibold text-cyan-100">
              Browse all rooms
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featuredGames.map((game) => {
              const presentation = getGamePresentation(game.slug, game.label);
              return (
                <Link key={game.slug} href={`/games/${game.slug}`} className="block">
                  <GameCard
                    slug={game.slug}
                    label={game.label}
                    icon={presentation.icon}
                    badge={presentation.roomLabel}
                    description={presentation.listDescription}
                    summary={presentation.roomSummary}
                    facts={presentation.cardFacts}
                  />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div className="rounded-[1.9rem] border border-white/8 bg-white/[0.04] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">How it works</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">See what is happening without dropping into operator mode.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <ProofItem
                title="Pick the room"
                body="The directory is meant to feel like a casino lobby. Enter the room first, audit later."
              />
              <ProofItem
                title="Build the ticket"
                body="Top selector, dominant play surface, and one readable bet slip instead of stacked protocol cards."
              />
              <ProofItem
                title="Follow settlement"
                body="The ledger still stays reachable, but the primary experience remains a room, not a debug console."
              />
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/8 bg-white/[0.04] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Why trust it</div>
            <div className="mt-4 space-y-4">
              <ProofItem
                title="Wallet-native flow"
                body="Funds stay in the wallet until the player signs. The front-end only helps compose the interaction."
              />
              <ProofItem
                title="Visible room facts"
                body="Release digest, assets, and recent indexed bets are still visible, but they no longer dominate the first fold."
              />
              <ProofItem
                title="Readable liquidity context"
                body={
                  primaryAsset
                    ? `${primaryAsset.symbol} free liquidity ${formatTokenAmount(primaryAsset.freeLiquidity, primaryAsset.decimals, primaryAsset.symbol)}`
                    : "Liquidity context appears as soon as the bank snapshot is available."
                }
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/8 bg-[linear-gradient(135deg,rgba(10,16,36,0.95),rgba(36,14,59,0.88))] px-6 py-8 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Final CTA</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Open a room and see the new shell where it matters.</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                The old protocol-dashboard language is being replaced route by route. Start with the rooms that benefit most from a clean game-first surface.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild size="lg">
                <Link href="/games">Open Rooms</Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link href="/liquidity">Check liquidity</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
