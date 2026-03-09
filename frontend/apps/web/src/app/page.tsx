"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import type { BetRow } from "@ssot/ssot/indexer";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GameCard,
  Skeleton,
  StatusBadge,
  type BetStatus
} from "@ssot/ui";

import { PageTransition } from "../components/PageTransition";
import { HomeHeroVisual } from "../components/home/HomeHeroVisual";
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

const ROOM_COPY: Record<string, { description: string; facts: string[] }> = {
  dice: {
    description: "Call the cap and size the ticket in seconds.",
    facts: ["Precision room", "Fast ticket sizing"]
  },
  "coin-toss": {
    description: "Fast two-sided action with a clean slip flow.",
    facts: ["Binary room", "Quick entry"]
  },
  roulette: {
    description: "Standard European table layout with clear ticket review.",
    facts: ["European table", "Structured bets"]
  },
  keno: {
    description: "Pick the board, then let the room handle the rest.",
    facts: ["Matrix room", "Board-first play"]
  }
};

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

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
  if (!timestamp) return "—";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (normalized.includes("won") || normalized.includes("win")) return "won";
  if (normalized.includes("lost") || normalized.includes("lose")) return "lost";
  if (
    normalized.includes("final") ||
    normalized.includes("settled") ||
    normalized.includes("resolved")
  ) {
    return "settled";
  }
  if (normalized.includes("placed")) return "placed";
  if (normalized.includes("refund")) return "cancelled";
  if (normalized.includes("fail")) return "failed";
  return "pending";
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{children}</div>
  );
}

function HeroBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100">
      {children}
    </div>
  );
}

function ProofRibbonItem({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  );
}

function HowItWorksStep({
  index,
  title,
  body
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/45 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-sm font-black text-cyan-100">
          {index}
        </div>
        <div className="text-base font-semibold text-white">{title}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function TrustCard({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/45 p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function LiveBetItem({ bet, gameLabel }: { bet: BetRow; gameLabel: string }) {
  return (
    <Link
      href={`/bets/${bet.betId}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/45 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-900/80"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold text-white">{gameLabel}</div>
          <StatusBadge status={mapBetState(bet.state)} label={bet.state} />
        </div>
        <div className="truncate font-mono text-xs text-slate-500">betId {bet.betId}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-slate-200">
          {formatRelativeTime(bet.updatedAt)}
        </div>
        <div className="text-xs text-slate-500">block {bet.updatedBlock}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { db } = useSSOTRuntime();
  const { indexerStatus } = useIndexer();
  const { data: latestBets = [] } = useBets(4);

  const { data: indexedBetCount = 0 } = useQuery({
    queryKey: ["ssot", "home", "bet-count", release?.chainId],
    enabled: Boolean(db && release),
    queryFn: async () => {
      if (!db || !release) return 0;
      return await db.bets.where("chainId").equals(release.chainId).count();
    },
    refetchInterval: 5_000
  });

  const {
    data: assetOverviews = [],
    isLoading: overviewLoading,
    error: overviewError
  } = useQuery({
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
            updatedAtBlock: snapshot.updatedAtBlock
          };
        })
      );
    },
    refetchInterval: 15_000
  });

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.label);
    }
    return map;
  }, [release?.gamesMeta]);

  const featuredGames = React.useMemo(
    () => (release?.gamesMeta ?? []).slice(0, 4),
    [release?.gamesMeta]
  );

  const roomCount = release?.gamesMeta?.length ?? Object.keys(release?.games ?? {}).length;
  const assetCount = release?.assets.length ?? 0;
  const roomsHref = "/games";
  const heroGame = featuredGames[0];
  const heroPresentation = heroGame
    ? getGamePresentation(heroGame.slug, heroGame.label)
    : getGamePresentation("dice", "Dice");
  const latestHeroBet = latestBets[0];
  const primaryAsset = assetOverviews[0];

  const lagBlocks = indexerStatus?.lagBlocks;
  const confirmations = indexerStatus?.config?.confirmations;
  const syncLabel =
    typeof lagBlocks !== "number"
      ? "Waiting for sync"
      : typeof confirmations === "number" && lagBlocks <= confirmations
        ? "In sync"
        : `${lagBlocks} blocks behind`;

  return (
    <PageTransition pageKey="home-landing">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2.75rem] border border-slate-800 bg-slate-950 px-6 py-8 shadow-2xl shadow-slate-950/40 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,59,99,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(75,45,143,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(82,212,166,0.12),transparent_28%),linear-gradient(160deg,rgba(9,11,20,0.98),rgba(15,23,42,0.94))]" />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.02fr)_minmax(440px,0.98fr)]">
            <div className="space-y-6 lg:space-y-7">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Wallet-native game rooms
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] text-white md:text-7xl">
                  Play on-chain without losing the room feel.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  ArbiGameFi brings premium game-room flow and readable settlement into the same
                  product surface. Choose a room, place a ticket, and follow the outcome without
                  guessing what happened in between.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={roomsHref}>Open Rooms</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="#how-it-works">How It Works</Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <HeroBullet>Wallet-native actions</HeroBullet>
                <HeroBullet>Readable settlement path</HeroBullet>
                <HeroBullet>Auditable room activity</HeroBullet>
              </div>
            </div>

            <HomeHeroVisual
              icon={heroPresentation.icon}
              featuredLabel={heroGame?.label ?? "Featured room"}
              featuredDescriptor={
                heroGame
                  ? ROOM_COPY[heroGame.slug]?.description ?? heroPresentation.roomLabel
                  : "Choose a room, build the ticket, and let the active release settle it."
              }
              roomSummary={heroPresentation.roomSummary}
              syncLabel={syncLabel}
              roomCount={roomCount}
              indexedBetCount={indexedBetCount}
              stageClassName={heroPresentation.theme.stageClassName}
              rooms={(release?.gamesMeta ?? []).slice(0, 4).map((game) => ({
                label: game.label,
                active: game.slug === heroGame?.slug
              }))}
            />
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-4">
          <ProofRibbonItem
            label="Live rooms"
            value={formatCount(roomCount)}
            detail="Room-first entry across the active release."
          />
          <ProofRibbonItem
            label="Wallet-first tickets"
            value={readOnly ? "Explore only" : "Signature-based"}
            detail={readOnly ? readOnlyReason ?? "Writes are disabled." : "Tickets start from the wallet, not a house balance."}
          />
          <ProofRibbonItem
            label="Transparent settlement"
            value={syncLabel}
            detail="Keep the trust layer close without turning home into ops."
          />
          <ProofRibbonItem
            label="Liquidity with visible reserves"
            value={
              primaryAsset
                ? formatTokenAmount(primaryAsset.freeLiquidity, primaryAsset.decimals, primaryAsset.symbol)
                : `${formatCount(assetCount)} supported assets`
            }
            detail={
              primaryAsset
                ? `${primaryAsset.symbol} free liquidity from the active release snapshot.`
                : "Capital surfaces stay readable when you step into Liquidity."
            }
          />
        </section>

        <section className="space-y-5">
          <div className="space-y-3">
            <SectionEyebrow>Featured Rooms</SectionEyebrow>
            <div className="max-w-3xl space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-white">
                Choose a room and get straight to the table.
              </h2>
              <p className="text-sm leading-6 text-slate-400 md:text-base">
                Each room is designed to make the game legible first, while keeping the trust layer
                close when you need it.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {featuredGames.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400 lg:col-span-2">
                Waiting for the active release to expose rooms.
              </div>
            ) : (
              featuredGames.map((game, index) => {
                const presentation = getGamePresentation(game.slug, game.label);
                const copy = ROOM_COPY[game.slug] ?? {
                  description: presentation.listDescription,
                  facts: [presentation.roomLabel, "Release-routed"]
                };

                return (
                  <Link
                    key={game.slug}
                    href={`/games/${game.slug}`}
                    className={index === 0 ? "lg:col-span-2" : ""}
                  >
                    <GameCard
                      slug={game.slug}
                      label={game.label}
                      icon={presentation.icon}
                      badge={index === 0 ? "Featured" : presentation.roomLabel}
                      description={copy.description}
                      summary={index === 0 ? presentation.roomSummary : undefined}
                      facts={copy.facts}
                      ctaLabel="Enter Room"
                      className={index === 0 ? "min-h-[22rem]" : "min-h-[18rem]"}
                    />
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section id="how-it-works" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="border-slate-800 bg-slate-900/55 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
            <CardHeader>
              <SectionEyebrow>How it works</SectionEyebrow>
              <CardTitle className="text-white">Three moves from room entry to settlement.</CardTitle>
              <CardDescription className="text-slate-400">
                Home should route intent. The deeper trust surfaces stay available when the player
                wants the full record.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <HowItWorksStep
                index="01"
                title="Pick a room"
                body="Start with the room that matches the pace and risk surface you want."
              />
              <HowItWorksStep
                index="02"
                title="Build the ticket"
                body="Choose the outcome, set the stake, and review the live ticket before signing."
              />
              <HowItWorksStep
                index="03"
                title="Follow settlement"
                body="Track status, result, and follow-up actions through visible product surfaces instead of hidden back-office logic."
              />
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/55 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
            <CardHeader>
              <SectionEyebrow>Why trust it</SectionEyebrow>
              <CardTitle className="text-white">
                The trust layer stays close, not in your way.
              </CardTitle>
              <CardDescription className="text-slate-400">
                Keep the first screen playable while making the deeper financial and settlement
                surfaces available when they matter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrustCard
                title="Wallet-native flow"
                body="Tickets start from your wallet and stay explicit through the signing path."
              />
              <TrustCard
                title="Readable settlement"
                body="Outcomes, balances, and claims can be followed through dedicated product routes built for clarity."
              />
              <TrustCard
                title="Visible liquidity context"
                body="Capital surfaces are explained in product language instead of buried in raw protocol jargon."
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <Card className="border-slate-800 bg-slate-900/55 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <SectionEyebrow>Live proof</SectionEyebrow>
                <CardTitle className="text-white">
                  See what is happening without dropping into operator mode.
                </CardTitle>
                <CardDescription className="max-w-2xl text-slate-400">
                  Use a light proof layer on the landing page, then move into Bets, Liquidity, or
                  Account when you want the full record.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/bets">Open Ledger</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestBets.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                  No indexed bets yet. Recent room activity appears here once the first ticket lands.
                </div>
              ) : (
                latestBets.map((bet) => (
                  <LiveBetItem
                    key={bet.id}
                    bet={bet}
                    gameLabel={
                      bet.gameId
                        ? (gameLabelById.get(bet.gameId.toLowerCase()) ?? shortHex(bet.gameId))
                        : "Unknown room"
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-slate-800 bg-slate-900/55 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Live liquidity context</CardTitle>
                <CardDescription className="text-slate-400">
                  Capital surfaces stay readable when you need more than the room UI.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {overviewLoading ? (
                  <Skeleton className="h-24 rounded-[1.5rem] bg-slate-800" />
                ) : overviewError ? (
                  <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    Asset snapshots are temporarily unavailable.
                  </div>
                ) : primaryAsset ? (
                  <div className="rounded-[1.5rem] border border-slate-800/70 bg-slate-950/45 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{primaryAsset.symbol}</div>
                      <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        Reserve visible
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Free liquidity</span>
                        <span className="font-semibold text-white">
                          {formatTokenAmount(primaryAsset.freeLiquidity, primaryAsset.decimals, primaryAsset.symbol)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Reserve snapshot</span>
                        <span>{formatTokenAmount(primaryAsset.totalReserved, primaryAsset.decimals, primaryAsset.symbol)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Updated</span>
                        <span>Block {primaryAsset.updatedAtBlock?.toString() ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                    No asset pulse available yet for the active release.
                  </div>
                )}

                <Button asChild variant="outline" size="sm">
                  <Link href="/liquidity">View Liquidity</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/55 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Current product pulse</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Network
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {release?.name ?? "Waiting for release"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Assets
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatCount(assetCount)} supported
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Activity
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatCount(indexedBetCount)} indexed tickets
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Last sync
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatRelativeTime(indexerStatus?.lastRunAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-slate-900/60 px-6 py-8 shadow-xl shadow-slate-950/30 backdrop-blur-xl sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,59,99,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(82,212,166,0.14),transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <SectionEyebrow>Final CTA</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-tight text-white">
                Ready to step into a room?
              </h2>
              <p className="text-sm leading-6 text-slate-400">
                Start with the directory, choose the room that fits your style, and keep the trust
                layer available when you need it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={roomsHref}>Open Rooms</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/liquidity">View Liquidity</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
