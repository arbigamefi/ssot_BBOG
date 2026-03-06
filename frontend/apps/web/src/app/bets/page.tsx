"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CopyButton,
  DataTable,
  Input,
  PageHeader,
  StatusBadge,
  TabBar,
  type BetStatus,
  type DataTableColumn,
} from "@ssot/ui";
import type { BetRow as IndexedBetRow } from "@ssot/ssot/indexer";

import { PageTransition } from "../../components/PageTransition";
import { useBets } from "../../features/bets/useBets";
import { useIndexer } from "../../features/ops/useIndexer";
import { useRelease } from "../../ssot/release/ReleaseProvider";

type StatusFilter = "all" | "placed" | "randomReady" | "finalized" | "refunded";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "randomReady", label: "Random Ready" },
  { key: "finalized", label: "Finalized" },
  { key: "refunded", label: "Refunded" },
] as const;

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

function getExplorerBaseUrl(chainId: number) {
  switch (chainId) {
    case 84532:
      return "https://sepolia.basescan.org";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return undefined;
  }
}

export default function BetsPage() {
  const router = useRouter();
  const { release, chainId } = useRelease();
  const { data: bets = [], isLoading } = useBets(500);
  const { indexerStatus, syncNow } = useIndexer();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [gameFilter, setGameFilter] = React.useState<string>("all");
  const deferredQuery = React.useDeferredValue(searchQuery);

  const gameMeta = React.useMemo(
    () => release?.gamesMeta?.map((game) => ({ key: game.slug, label: game.label })) ?? [],
    [release?.gamesMeta]
  );

  const gameTabs = React.useMemo(
    () => [{ key: "all", label: "All Games" }, ...gameMeta],
    [gameMeta]
  );

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.label);
    }
    return map;
  }, [release?.gamesMeta]);

  const gameSlugById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.slug);
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

  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const filteredBets = React.useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    return bets.filter((row) => {
      if (statusFilter !== "all" && row.state !== statusFilter) return false;
      if (gameFilter !== "all") {
        const slug = row.gameId ? gameSlugById.get(row.gameId.toLowerCase()) : undefined;
        if (slug !== gameFilter) return false;
      }
      if (!query) return true;

      const haystack = [
        row.betId,
        row.state,
        row.player,
        row.asset,
        row.lastTxHash,
        row.lastEventName,
        row.gameId ? gameLabelById.get(row.gameId.toLowerCase()) : "",
        row.asset ? assetLabelByAddress.get(row.asset.toLowerCase()) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [assetLabelByAddress, bets, deferredQuery, gameFilter, gameLabelById, gameSlugById, statusFilter]);

  const columns: DataTableColumn<IndexedBetRow>[] = React.useMemo(
    () => [
      {
        key: "betId",
        header: "Bet ID",
        render: (row) => <span className="font-mono text-white font-medium">{row.betId}</span>,
        cellClassName: "w-20",
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
        key: "state",
        header: "Status",
        render: (row) => <StatusBadge status={mapBetState(row.state)} label={row.state} />,
      },
      {
        key: "asset",
        header: "Asset",
        render: (row) => (
          <span className="text-slate-300">
            {row.asset ? assetLabelByAddress.get(row.asset.toLowerCase()) ?? shortHex(row.asset) : "—"}
          </span>
        ),
      },
      {
        key: "player",
        header: "Player",
        render: (row) => (
          <span className="inline-flex items-center gap-1 font-mono text-slate-400">
            {shortHex(row.player)}
            {row.player && <CopyButton value={row.player} label="Copy player address" />}
          </span>
        ),
      },
      {
        key: "event",
        header: "Last Event",
        render: (row) => <span className="text-slate-300">{row.lastEventName || "—"}</span>,
      },
      {
        key: "updated",
        header: "Updated",
        render: (row) => <span className="text-slate-400">{formatRelativeTime(row.updatedAt)}</span>,
      },
      {
        key: "tx",
        header: "Tx",
        render: (row) => {
          if (!row.lastTxHash) return <span className="text-slate-500">—</span>;
          return (
            <span className="inline-flex items-center gap-2 font-mono text-slate-400">
              <span>{shortHex(row.lastTxHash)}</span>
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}/tx/${row.lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 transition-colors hover:text-emerald-200"
                  onClick={(event) => event.stopPropagation()}
                >
                  View
                </a>
              ) : null}
            </span>
          );
        },
      },
    ],
    [assetLabelByAddress, explorerBaseUrl, gameLabelById]
  );

  return (
    <PageTransition pageKey="bets">
      <div className="space-y-8">
        <PageHeader
          title="My Bets"
          description={`${filteredBets.length} of ${bets.length} indexed bets · Last synced block: ${indexerStatus?.lastSyncedBlock ?? "—"}`}
          actions={
            <Button variant="outline" size="sm" onClick={() => void syncNow()} className="border-slate-700 text-slate-300 hover:text-white">
              Sync Now
            </Button>
          }
        />

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-2">
              <label htmlFor="bets-search" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Search
              </label>
              <Input
                id="bets-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="betId, player, tx hash, asset, or game"
                className="border-slate-700 bg-slate-950/60 text-white"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</div>
              <div className="overflow-x-auto">
                <TabBar tabs={STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label }))} activeKey={statusFilter} onTabChange={(key) => setStatusFilter(key as StatusFilter)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Game</div>
            <div className="overflow-x-auto">
              <TabBar tabs={gameTabs} activeKey={gameFilter} onTabChange={setGameFilter} />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredBets}
          loading={isLoading}
          emptyMessage="No bets match the current filters. Try widening the search or place a new bet from Games."
          rowKey={(row) => row.id ?? row.betId}
          onRowClick={(row) => router.push(`/bets/${row.betId}`)}
        />
      </div>
    </PageTransition>
  );
}
