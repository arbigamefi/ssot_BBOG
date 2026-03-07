"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DataTable,
  ErrorCallout,
  GameCard,
  PageHeader,
  ReleaseBadge,
  Skeleton,
  StatCard,
  StatusBadge,
  type BetStatus,
  type DataTableColumn,
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

function formatTokenAmount(value: bigint | undefined, decimals: number, symbol?: string, maxFractionDigits = 2) {
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

function formatBps(value?: number) {
  if (value == null) return "—";
  return `${value.toLocaleString("en-US")} bps`;
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
  if (normalized.includes("final") || normalized.includes("settled") || normalized.includes("resolved")) {
    return "settled";
  }
  if (normalized.includes("placed")) return "placed";
  if (normalized.includes("refund")) return "cancelled";
  if (normalized.includes("fail")) return "failed";
  return "pending";
}

function AssetOverviewCard({ item }: { item: AssetOverview }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
      <CardHeader className="border-b border-slate-800/70 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black tracking-tight text-white">{item.symbol}</CardTitle>
            <CardDescription className="mt-1 text-slate-400">
              Asset {shortHex(item.address)} · Bank {shortHex(item.bank)}
            </CardDescription>
          </div>
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Live
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">NAV</div>
          <div className="text-lg font-bold text-white tabular-nums">
            {formatTokenAmount(item.totalAssets, item.decimals, item.symbol)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reserved</div>
          <div className="text-lg font-bold text-white tabular-nums">
            {formatTokenAmount(item.totalReserved, item.decimals, item.symbol)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Free Liquidity</div>
          <div className="text-lg font-bold text-emerald-300 tabular-nums">
            {formatTokenAmount(item.freeLiquidity, item.decimals, item.symbol)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Protocol Fees</div>
          <div className="text-sm font-semibold text-slate-200 tabular-nums">
            {formatTokenAmount(item.protocolFeesPayable, item.decimals, item.symbol)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">External Payables</div>
          <div className="text-sm font-semibold text-slate-200 tabular-nums">
            {formatTokenAmount(item.externalPayablesTotal, item.decimals, item.symbol)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Min Liquidity</div>
          <div className="text-sm font-semibold text-slate-200">
            {formatBps(item.minLiquidityBps)}
          </div>
          <div className="text-xs text-slate-500">
            Updated block {item.updatedAtBlock?.toString() ?? "—"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetOverviewSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
      <CardHeader className="border-b border-slate-800/70 pb-4">
        <Skeleton className="h-7 w-28 bg-slate-800" />
        <Skeleton className="mt-2 h-4 w-56 bg-slate-800" />
      </CardHeader>
      <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24 bg-slate-800" />
            <Skeleton className="h-6 w-36 bg-slate-800" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { db } = useSSOTRuntime();
  const { indexerStatus, syncNow } = useIndexer();
  const { data: latestBets = [], isLoading: betsLoading } = useBets(6);

  const { data: indexedBetCount = 0 } = useQuery({
    queryKey: ["ssot", "home", "bet-count", release?.chainId],
    enabled: Boolean(db && release),
    queryFn: async () => {
      if (!db || !release) return 0;
      return await db.bets.where("chainId").equals(release.chainId).count();
    },
    refetchInterval: 5_000,
  });

  const {
    data: assetOverviews = [],
    isLoading: overviewLoading,
    error: overviewError,
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

  const assetLabelByAddress = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of release?.assets ?? []) {
      map.set(asset.address.toLowerCase(), asset.symbol);
    }
    return map;
  }, [release?.assets]);

  const featuredGames = React.useMemo(() => (release?.gamesMeta ?? []).slice(0, 4), [release?.gamesMeta]);

  const latestBetColumns = React.useMemo<DataTableColumn<BetRow>[]>(
    () => [
      {
        key: "betId",
        header: "Bet ID",
        render: (row) => <span className="font-mono text-white">{row.betId}</span>,
      },
      {
        key: "game",
        header: "Game",
        render: (row) => (
          <span className="text-slate-200">
            {row.gameId ? gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId) : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={mapBetState(row.state)} label={row.state} />,
      },
      {
        key: "asset",
        header: "Asset",
        render: (row) => <span className="text-slate-300">{row.asset ? assetLabelByAddress.get(row.asset.toLowerCase()) ?? shortHex(row.asset) : "—"}</span>,
      },
      {
        key: "player",
        header: "Player",
        render: (row) => <span className="font-mono text-slate-400">{shortHex(row.player)}</span>,
      },
      {
        key: "updated",
        header: "Updated",
        render: (row) => <span className="text-slate-400">{formatRelativeTime(row.updatedAt)}</span>,
      },
      {
        key: "block",
        header: "Block",
        render: (row) => <span className="font-mono text-slate-500">{row.updatedBlock}</span>,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
    ],
    [assetLabelByAddress, gameLabelById]
  );

  if (!release) {
    return (
      <PageTransition pageKey="home-empty">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-white">Protocol Overview</CardTitle>
            <CardDescription className="text-slate-400">
              {readOnlyReason ?? "No embedded release is available for this chain."}
            </CardDescription>
          </CardHeader>
        </Card>
      </PageTransition>
    );
  }

  const lagBlocks = indexerStatus?.lagBlocks;
  const confirmations = indexerStatus?.config?.confirmations;
  const lagTrend =
    typeof lagBlocks !== "number" || typeof confirmations !== "number"
      ? "neutral"
      : lagBlocks <= confirmations
        ? "up"
        : lagBlocks <= confirmations * 3
          ? "neutral"
          : "down";

  return (
    <PageTransition pageKey="home-overview">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/60 px-6 py-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_32%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <ReleaseBadge
                networkName={release.name}
                hubShort={shortHex(release.contracts.hub)}
                digestShort={release.releaseDigest.slice(0, 8)}
              />

              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Protocol Overview
                </div>
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  Live protocol state, not marketing placeholders.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  This dashboard is driven by the embedded release, live Bank snapshots, and event-derived facts from the local indexer.
                  It is the fastest path to verify which games, assets, and bets are actually available on the connected network.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/games">Play Games</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/liquidity">Review Liquidity</Link>
                </Button>
                <Button asChild variant="glass" size="lg">
                  <Link href="/bets">Inspect Bets</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release Digest</div>
                  <div className="mt-2 break-all font-mono text-sm text-slate-200">{release.releaseDigest}</div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Runtime Mode</div>
                  <div className="mt-2 text-sm font-medium text-slate-200">
                    {readOnly ? `Read-only${readOnlyReason ? ` · ${readOnlyReason}` : ""}` : "Read / write enabled"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <StatCard
                label="Live Games"
                value={formatCount(release.gamesMeta?.length ?? Object.keys(release.games).length)}
                subValue="release-driven"
              />
              <StatCard
                label="Supported Assets"
                value={formatCount(release.assets.length)}
                subValue="bank-backed"
              />
              <StatCard
                label="Indexed Bets"
                value={formatCount(indexedBetCount)}
                subValue={betsLoading ? "syncing" : "event-derived"}
              />
              <StatCard
                label="Indexer Lag"
                value={typeof lagBlocks === "number" ? `${lagBlocks}` : "—"}
                subValue={
                  indexerStatus?.lastSyncedBlock != null
                    ? `synced ${indexerStatus.lastSyncedBlock}`
                    : "waiting for sync"
                }
                trend={lagTrend}
              />
            </div>
          </div>
        </section>

        {featuredGames.length > 0 ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-6">
              <PageHeader
                title="Featured Rooms"
                description="Jump straight into the live rooms exposed by the active release. These entries mirror the room-first detail pages without inventing protocol facts."
                actions={
                  <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                    <Link href="/games">Open Room Directory</Link>
                  </Button>
                }
              />

              <div className="grid gap-6 sm:grid-cols-2">
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
                        facts={[game.paramsEncoding ?? "release-defined", `${release.assets.length} assets`]}
                        ctaLabel="Enter Room"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader>
                <CardTitle className="text-white">Why Room-First</CardTitle>
                <CardDescription className="text-slate-400">
                  Discovery should feel productized without turning governed presentation into fake protocol guarantees.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-slate-300">
                <p>Each featured room inherits its tone, copy, and gradients from governed frontend metadata keyed by slug.</p>
                <p>Route validity, supported assets, module routing, and params encoding still come only from the embedded release bundle.</p>
                <p>Once you enter a room, the live table and protocol truth panels take over so the path from discovery to action stays auditable.</p>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-slate-400">
                  If a room drops out of this section, the release no longer exposes it. No legacy aliases are used to keep dead rooms alive.
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="space-y-6">
          <PageHeader
            title="Asset Snapshots"
            description="Per-asset Bank state from live SDK reads. Values are never aggregated across assets, so multi-asset semantics remain intact."
            actions={
              <Button variant="outline" size="sm" onClick={() => void syncNow()} className="border-slate-700 text-slate-300 hover:text-white">
                Sync Facts
              </Button>
            }
          />

          {overviewError ? (
            <ErrorCallout
              title="Snapshot load failed"
              message={(overviewError as Error).message}
              details="The Home overview could not read Bank snapshots for the active release."
            />
          ) : null}

          <div className="grid gap-6">
            {overviewLoading
              ? release.assets.map((asset) => <AssetOverviewSkeleton key={asset.address} />)
              : assetOverviews.map((item) => <AssetOverviewCard key={item.address} item={item} />)}
          </div>
        </section>

        <section className="space-y-6">
          <PageHeader
            title="Latest Bets"
            description="Recent event-derived bets from the local facts store. This table mirrors indexed chain activity and links straight into bet detail."
            actions={
              <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                <Link href="/bets">Open Full Ledger</Link>
              </Button>
            }
          />

          <DataTable
            columns={latestBetColumns}
            data={latestBets}
            loading={betsLoading}
            emptyMessage="No indexed bets yet. Sync the indexer or place a bet to start the local audit trail."
            rowKey={(row) => row.id}
            onRowClick={(row) => router.push(`/bets/${row.betId}`)}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader>
              <CardTitle className="text-white">Operational Signals</CardTitle>
              <CardDescription className="text-slate-400">
                Home only surfaces minimal signals. The full diagnostics view remains on the Ops route.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Safe Head</div>
                <div className="mt-2 font-mono text-lg text-slate-200">{indexerStatus?.safeHeadBlock ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confirmations</div>
                <div className="mt-2 font-mono text-lg text-slate-200">{indexerStatus?.config?.confirmations ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Polling</div>
                <div className="mt-2 font-mono text-lg text-slate-200">
                  {typeof indexerStatus?.config?.pollIntervalMs === "number"
                    ? `${Math.round(indexerStatus.config.pollIntervalMs / 1000)}s`
                    : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last Run</div>
                <div className="mt-2 text-lg text-slate-200">
                  {formatRelativeTime(indexerStatus?.lastRunAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader>
              <CardTitle className="text-white">Resources</CardTitle>
              <CardDescription className="text-slate-400">
                Repo-native references for release identity, protocol documentation, and operator visibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm text-slate-300">
                <Link href="/games" className="rounded-xl border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Explore live games
                </Link>
                <Link href="/liquidity" className="rounded-xl border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Review Bank liquidity
                </Link>
                <Link href="/ops" className="rounded-xl border border-slate-800 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/40">
                  Open Ops diagnostics
                </Link>
              </div>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-400">
                Protocol interactions are release-bound and event-auditable. If displayed values drift from chain truth, the issue belongs in the release, SDK, or indexer layer and should be investigated there rather than patched in-page.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
