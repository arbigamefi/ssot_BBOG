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
  AuditTabs,
  AuditTableHeader,
  AuditTableRow,
  AuditTableCell,
  type BetStatus,
  type DataTableColumn,
} from "@ssot/ui";
import Link from "next/link";
import type { BetRow as IndexedBetRow } from "@ssot/ssot/indexer";

import { PageTransition } from "../../components/PageTransition";
import { useBets } from "../../features/bets/useBets";
import { useIndexer } from "../../features/ops/useIndexer";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { formatUnits } from "../../features/betting/model/units";

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

  const assetDecimalsByAddress = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of release?.assets ?? []) {
      map.set(asset.address.toLowerCase(), asset.decimals);
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
      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">My Tickets</h1>
            <p className="text-white/50 text-lg">Your complete wagering history across all ArbiGameFi smart contracts.</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-[#0a0a0a] border border-white/5 rounded-xl">
             {STATUS_TABS.map((tab) => (
               <button 
                 key={tab.key}
                 onClick={() => setStatusFilter(tab.key as StatusFilter)}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === tab.key ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
               >
                 {tab.label}
               </button>
             ))}
          </div>
        </div>

        {/* Global Audit View using standard component */}
        <AuditTabs activeColorClass="border-blue-400 text-blue-400">
           <AuditTableHeader>
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Date / Block</div>
                  <div>Game / Result Hash</div>
                  <div>Wager</div>
                  <div>Payout</div>
                  <div>Status</div>
                  <div className="text-right">Action</div>
              </div>
           </AuditTableHeader>

           {isLoading ? (
             <div className="py-20 text-center text-white/30">Loading tickets...</div>
           ) : filteredBets.length === 0 ? (
             <div className="py-20 text-center text-white/30">No tickets found for the current selection.</div>
           ) : (
             filteredBets.map((row) => {
               const gameLabel = row.gameId ? gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId) : "—";
               const assetSymbol = row.asset ? assetLabelByAddress.get(row.asset.toLowerCase()) ?? shortHex(row.asset) : "—";
               const status = mapBetState(row.state);
               
               const decimals = row.asset ? assetDecimalsByAddress.get(row.asset.toLowerCase()) ?? 18 : 18;
               const payoutBigInt = (row as any).payout ? BigInt((row as any).payout) : null;
               
               return (
                 <Link key={row.betId} href={`/bets/${row.betId}`}>
                    <AuditTableRow className="cursor-pointer group">
                      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                        <AuditTableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-white">{formatRelativeTime(row.updatedAt)}</span>
                            <span className="text-[10px] font-mono text-white/30 hidden sm:block">ID: {row.betId}</span>
                          </div>
                        </AuditTableCell>
                        <AuditTableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-white font-bold">{gameLabel}</span>
                            <span className="text-[10px] font-mono text-white/40">{shortHex(row.lastTxHash)}</span>
                          </div>
                        </AuditTableCell>
                        <AuditTableCell>
                           <span className="font-mono text-sm text-white/70">
                             {(row as any).stake ? formatUnits(BigInt((row as any).stake), decimals) : '0.00'} {assetSymbol}
                           </span>
                        </AuditTableCell>
                        <AuditTableCell>
                           <span className={`font-mono text-sm ${status === 'won' ? 'text-green-400 font-bold' : 'text-white/40'}`}>
                             {payoutBigInt != null ? `${formatUnits(payoutBigInt, decimals)} ${assetSymbol}` : '--'}
                           </span>
                        </AuditTableCell>
                        <AuditTableCell>
                           <span className={`py-1 px-2 border font-bold text-[10px] uppercase rounded-md shrink-0 ${
                             status === 'won' ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                             status === 'lost' ? 'border-white/10 bg-white/5 text-white/40' :
                             'border-blue-500/20 bg-blue-500/10 text-blue-400 animate-pulse'
                           }`}>
                              {row.state}
                           </span>
                        </AuditTableCell>
                        <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/30 group-hover:text-white">
                           View Receipt →
                        </AuditTableCell>
                      </div>
                    </AuditTableRow>
                 </Link>
               );
             })
           )}
        </AuditTabs>

      </main>
    </PageTransition>
  );
}
