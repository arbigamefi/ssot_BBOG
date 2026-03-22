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
  cn,
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
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 relative z-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] text-white">My Tickets</h1>
            <p className="text-white/40 text-[10px] font-mono tracking-[0.3em] uppercase">Decentralized Wagering Ledger</p>
          </div>
          
          <div className="flex gap-2 p-1.5 bg-[#050505] border border-white/10 rounded-[1.25rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
             {STATUS_TABS.map((tab) => (
                <button 
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as StatusFilter)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-widest",
                    statusFilter === tab.key 
                      ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20" 
                      : "text-white/30 hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab.label}
                </button>
             ))}
          </div>
        </div>

        {/* Global Audit View using standard component */}
        <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-b from-[#0a0a0a] to-[#020202] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
          
          <AuditTabs activeColorClass="border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/10">
             <AuditTableHeader>
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] text-white/30 font-bold uppercase tracking-[0.2em] text-[10px] pb-4 border-b border-white/5 mb-4">
                    <div>Timestamp / Block</div>
                    <div>Protocol / Target</div>
                    <div>Capital At Risk</div>
                    <div>Settlement</div>
                    <div>Status</div>
                    <div className="text-right">Action</div>
                </div>
             </AuditTableHeader>

             <div className="flex flex-col gap-3 min-h-[400px]">
               {isLoading ? (
                 <div className="py-20 text-center flex flex-col items-center gap-4">
                    <span className="text-blue-400/50 animate-pulse text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing Ledger...</span>
                 </div>
               ) : filteredBets.length === 0 ? (
                 <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                    <span className="text-white/20 text-xs font-mono uppercase tracking-[0.2em]">No tickets found in this sector</span>
                 </div>
               ) : (
                 filteredBets.map((row) => {
                    const gameLabel = row.gameId ? gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId) : "—";
                    const assetSymbol = row.asset ? assetLabelByAddress.get(row.asset.toLowerCase()) ?? shortHex(row.asset) : "—";
                    const status = mapBetState(row.state);
                    const decimals = row.asset ? assetDecimalsByAddress.get(row.asset.toLowerCase()) ?? 18 : 18;
                    const payoutBigInt = (row as any).payout ? BigInt((row as any).payout) : null;
                    const isWinning = status === 'won';
                    const isPending = status === 'pending' || status === 'placed';

                    return (
                      <Link key={row.betId} href={`/bets/${row.betId}`}>
                        <div className={cn(
                          "rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all cursor-pointer group",
                          isWinning ? "hover:border-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.1)]" : "hover:border-blue-500/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]",
                          "hover:bg-[#0a0a0a]"
                        )}>
                           <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                             <AuditTableCell>
                               <div className="flex flex-col gap-1">
                                 <span className="text-white/80 font-mono text-sm group-hover:text-white transition-colors">
                                   {new Date(row.updatedAt).toLocaleDateString()} {new Date(row.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                                 <span className="text-[10px] font-mono text-white/20 hidden sm:block uppercase tracking-widest">ID: {row.betId}</span>
                               </div>
                             </AuditTableCell>
                             <AuditTableCell>
                               <div className="flex flex-col gap-1">
                                 <span className={cn("font-bold tracking-tight transition-colors", isWinning ? "text-green-50 group-hover:text-green-300" : "text-blue-100 group-hover:text-blue-300")}>
                                   {gameLabel}
                                 </span>
                                 <span className="text-[10px] font-mono text-white/30 truncate max-w-[120px]">{shortHex(row.lastTxHash)}</span>
                               </div>
                             </AuditTableCell>
                             <AuditTableCell>
                                <span className="font-mono text-sm font-bold text-white/80">
                                  {(row as any).stake ? formatUnits(BigInt((row as any).stake), decimals) : '0.00'} {assetSymbol}
                                </span>
                             </AuditTableCell>
                             <AuditTableCell>
                                <span className={cn(
                                  "font-mono font-bold transition-all",
                                  isWinning ? "text-lg text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "text-sm text-white/20"
                                )}>
                                  {payoutBigInt != null && payoutBigInt > 0n 
                                    ? `+${formatUnits(payoutBigInt, decimals)} ${assetSymbol}` 
                                    : isPending ? "PENDING" : "SETTLED"}
                                </span>
                             </AuditTableCell>
                             <AuditTableCell>
                                <span className={cn(
                                  "py-1.5 px-3 border font-bold text-[10px] uppercase tracking-widest rounded-lg shrink-0 shadow-sm",
                                  isWinning ? "border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]" :
                                  status === 'lost' ? "border-white/10 bg-white/5 text-white/40" :
                                  "border-blue-500/30 bg-blue-500/10 text-blue-400 animate-[pulse_2s_infinite] shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                )}>
                                   {row.state}
                                </span>
                             </AuditTableCell>
                             <AuditTableCell className="justify-end transition-transform group-hover:translate-x-1 text-white/20 group-hover:text-blue-400 font-bold uppercase text-[10px] tracking-widest">
                                {isWinning ? "Receipt ↗" : "Decrypt ↗"}
                             </AuditTableCell>
                           </div>
                        </div>
                      </Link>
                    );
                 })
               )}
             </div>
          </AuditTabs>
        </div>

      </main>
    </PageTransition>
  );
}
