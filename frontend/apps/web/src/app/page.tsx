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
  ReleaseBadge,
  Skeleton,
  StatusBadge,
  type BetStatus
} from "@ssot/ui";

import { PageTransition } from "../components/PageTransition";
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

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function TrustPill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
      {label}
    </div>
  );
}

function NarrativeStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-[1.75rem] border border-slate-800/70 bg-slate-950/50 p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-sm font-black text-cyan-100">
        {index}
      </div>
      <div className="space-y-1.5">
        <div className="text-base font-semibold text-white">{title}</div>
        <p className="text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </div>
  );
}

function RoomRailItem({
  href,
  icon,
  label,
  badge,
  active = false
}: {
  href: string;
  icon: string;
  label: string;
  badge: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        active
          ? "border-cyan-400/30 bg-cyan-400/10"
          : "border-slate-800/70 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-2xl">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-slate-500">{badge}</div>
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Open</div>
    </Link>
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

function AssetPulseCard({ item }: { item: AssetOverview }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-800/70 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-white">{item.symbol}</div>
        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          Bank backed
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Free Liquidity
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatTokenAmount(item.freeLiquidity, item.decimals, item.symbol)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Updated
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Block {item.updatedAtBlock?.toString() ?? "—"}
          </div>
        </div>
      </div>
    </div>
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
  const primaryRoomHref = featuredGames[0] ? `/games/${featuredGames[0].slug}` : "/games";
  const heroGame = featuredGames[0];
  const heroPresentation = heroGame
    ? getGamePresentation(heroGame.slug, heroGame.label)
    : getGamePresentation("dice", "Dice");
  const heroSecondaryGames = featuredGames.slice(1, 4);
  const liveBetFeed = latestBets.slice(0, 4);
  const latestHeroBet = liveBetFeed[0];
  const assetPulse = assetOverviews.slice(0, 3);

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
      <div className="space-y-12">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 px-6 py-8 shadow-2xl shadow-slate-950/40 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.24),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.03fr)_minmax(420px,0.97fr)]">
            <div className="space-y-6 lg:space-y-7">
              <div className="flex flex-wrap items-center gap-2">
                <TrustPill label="Wallet-native" />
                <TrustPill label="Provably fair" />
                <TrustPill label="On-chain settlement" />
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  Live casino rooms
                </div>
                <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] text-white md:text-7xl">
                  Live rooms that feel fast before they settle on-chain.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 md:text-lg">
                  Start from a room, not a spreadsheet. Pick the outcome, size the stake, and let
                  the release route the round while the ledger stays visible.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={primaryRoomHref}>Play Now</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/games">Browse Rooms</Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link href="/bets">See Live Bets</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SignalPill label="Live rooms" value={formatCount(roomCount)} />
                <SignalPill label="Event-ledger bets" value={formatCount(indexedBetCount)} />
                <SignalPill label="Settlement pulse" value={syncLabel} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SignalPill label="Network" value={release?.name ?? "Waiting for release"} />
                <SignalPill label="Assets" value={`${formatCount(assetCount)} supported`} />
                <SignalPill
                  label="Mode"
                  value={
                    readOnly
                      ? `Read-only${readOnlyReason ? ` · ${readOnlyReason}` : ""}`
                      : "Ready to play"
                  }
                />
                <SignalPill
                  label="Last sync"
                  value={formatRelativeTime(indexerStatus?.lastRunAt)}
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div
                className={`relative overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-xl shadow-slate-950/40 ${heroPresentation.theme.stageClassName}`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-white/10 bg-slate-950/45 text-4xl shadow-lg shadow-black/30">
                      {heroPresentation.icon}
                    </div>
                    <div>
                      <div
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${heroPresentation.theme.badgeClassName}`}
                      >
                        {heroPresentation.roomLabel}
                      </div>
                      <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
                        {heroGame?.label ?? "Featured room"}
                      </h2>
                    </div>
                  </div>
                  {release ? (
                    <ReleaseBadge
                      networkName={release.name}
                      hubShort={shortHex(release.contracts.hub)}
                      digestShort={release.releaseDigest.slice(0, 8)}
                    />
                  ) : null}
                </div>

                <div className="relative mt-6 max-w-md space-y-4">
                  <p className="text-sm leading-6 text-slate-200">
                    {heroGame
                      ? heroPresentation.roomSummary
                      : "Enter a room, pick the line, and let settlement happen on the active release."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SignalPill label="Shape" value={heroPresentation.helpLabel} />
                    <SignalPill
                      label="Encoding"
                      value={heroGame?.paramsEncoding ?? "release-defined"}
                    />
                    <SignalPill label="Assets" value={`${assetCount}`} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="lg">
                      <Link href={primaryRoomHref}>Open {heroGame?.label ?? "Room"}</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="/games">All Rooms</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Card className="border-white/10 bg-slate-950/55 shadow-xl shadow-slate-950/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white">Tonight&apos;s rooms</CardTitle>
                    <CardDescription className="text-slate-400">
                      The first click should always be a game choice.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {featuredGames.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                        Waiting for the active release to expose rooms.
                      </div>
                    ) : (
                      <>
                        <RoomRailItem
                          href={primaryRoomHref}
                          icon={heroPresentation.icon}
                          label={heroGame?.label ?? "Featured room"}
                          badge={heroPresentation.roomLabel}
                          active
                        />
                        {heroSecondaryGames.map((game) => {
                          const presentation = getGamePresentation(game.slug, game.label);
                          return (
                            <RoomRailItem
                              key={game.slug}
                              href={`/games/${game.slug}`}
                              icon={presentation.icon}
                              label={game.label}
                              badge={presentation.roomLabel}
                            />
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-slate-950/55 shadow-xl shadow-slate-950/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white">Latest round</CardTitle>
                    <CardDescription className="text-slate-400">
                      Proof stays visible, but it supports the play decision instead of taking over
                      the page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {latestHeroBet ? (
                      <LiveBetItem
                        bet={latestHeroBet}
                        gameLabel={
                          latestHeroBet.gameId
                            ? (gameLabelById.get(latestHeroBet.gameId.toLowerCase()) ??
                              shortHex(latestHeroBet.gameId))
                            : "Unknown room"
                        }
                      />
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400">
                        No recent rounds yet. The first settled bet will appear here.
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SignalPill label="Hub" value={shortHex(release?.contracts.hub)} />
                      <SignalPill
                        label="Bank proof"
                        value={
                          overviewError
                            ? "Temporarily unavailable"
                            : `${assetPulse.length || assetCount} live`
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="border-slate-800 bg-slate-900/55 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Three moves
              </div>
              <CardTitle className="text-white">
                From wallet to settlement, without losing the plot.
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <NarrativeStep
                index="01"
                title="Open a room that matches the risk shape"
                body="Dice, coin toss, roulette, and keno should feel distinct before the player reads a single line of protocol copy."
              />
              <NarrativeStep
                index="02"
                title="Set the outcome and the amount in one flow"
                body="The room should hold choice and stake together so betting feels like one decision instead of three separate forms."
              />
              <NarrativeStep
                index="03"
                title="Confirm once, then watch the result land"
                body="Settlement proof and live ledger stay visible after the fact, not as clutter in front of the first click."
              />
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/55 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Why trust this
              </div>
              <CardTitle className="text-white">
                Simple trust story, not a wall of diagnostics.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/45 p-5">
                <div className="text-sm font-semibold text-white">
                  Your wallet stays the point of control
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Players sign from the wallet instead of moving into a house account and hoping to
                  withdraw later.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/45 p-5">
                <div className="text-sm font-semibold text-white">
                  The release decides what is actually live
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Supported rooms, assets, modules, and encodings come from the active release, not
                  from home-page fiction.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/45 p-5">
                <div className="text-sm font-semibold text-white">Recent play stays auditable</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Indexer facts keep recent rounds visible so users can verify what just happened
                  instead of trusting copy.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-slate-800 bg-slate-900/55 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Live proof
                  </div>
                  <CardTitle className="text-white">Recent activity</CardTitle>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/bets">Full Ledger</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveBetFeed.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                    No indexed bets yet. Recent activity appears here as soon as the first round
                    lands.
                  </div>
                ) : (
                  liveBetFeed.map((bet) => (
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

            <Card className="border-slate-800 bg-slate-900/55 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Bank proof
                  </div>
                  <CardTitle className="text-white">Asset pulse</CardTitle>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/liquidity">Liquidity View</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {overviewLoading ? (
                  <>
                    <Skeleton className="h-24 rounded-[1.5rem] bg-slate-800" />
                    <Skeleton className="h-24 rounded-[1.5rem] bg-slate-800" />
                  </>
                ) : overviewError ? (
                  <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    Asset snapshots are temporarily unavailable.
                  </div>
                ) : assetPulse.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                    No asset pulse available yet for the active release.
                  </div>
                ) : (
                  assetPulse.map((item) => <AssetPulseCard key={item.address} item={item} />)
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-slate-900/60 px-6 py-8 shadow-xl shadow-slate-950/30 backdrop-blur-xl sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_32%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Final CTA
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                Start from the room. Audit the rest when you need it.
              </h2>
              <p className="text-sm leading-6 text-slate-400">
                Home should create intent and send users into play. The audit routes still exist,
                but they do not need to own the first screen.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={primaryRoomHref}>Play Now</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/games">Browse Rooms</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
