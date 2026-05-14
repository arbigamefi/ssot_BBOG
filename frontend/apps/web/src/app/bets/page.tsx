"use client";

import * as React from "react";
import type { BetRow as IndexedBetRow } from "@ssot/ssot/indexer";
import { cn, GlassModal, CopyButton, Button, toast, TxStatusChip } from "@ssot/ui";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet } from "@ssot/ssot";
import type { HubEventRow } from "@ssot/ssot/indexer";

import { PageTransition } from "../../components/PageTransition";
import { useBets } from "../../features/bets/useBets";
import { formatUnits } from "../../features/betting/model/units";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../ssot/runtime";
import { useSSOTSDK } from "../../ssot/sdk";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";

type StatusFilter = "all" | "open" | "won" | "lost";

const STATUS_TABS = [
  { key: "open", label: "Open Tickets" },
  { key: "won", label: "Settled (Win)" },
  { key: "lost", label: "Settled (Loss)" },
  { key: "all", label: "All Ledger" }
] as const;

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** Map raw BetRow.state string to a UI status group.
 *  The critical fix: "finalized" bets are won/lost determined by comparing
 *  payout vs stake (payout > stake = won), NOT by state string content.
 */
function mapBetState(state?: string, payout?: bigint, stake?: bigint) {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  // "finalized" or "settled" states — use payout comparison for W/L
  if (
    normalized.includes("final") ||
    normalized.includes("settled") ||
    normalized.includes("resolved")
  ) {
    if (payout !== undefined && stake !== undefined) {
      return payout > stake ? "won" : "lost";
    }
    // Fallback when no payout data: show as settled (neutral)
    return "settled";
  }
  if (normalized.includes("won") || normalized.includes("win")) return "won";
  if (normalized.includes("lost") || normalized.includes("lose")) return "lost";
  if (normalized.includes("placed")) return "placed";
  if (normalized.includes("refund")) return "refunded";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("random")) return "pending_vrf"; // randomReady
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

// ----------------------------------------------------------------------------
// Detailed Glass Modal Content
// ----------------------------------------------------------------------------
function BetDetailModalContent({ row, onClose }: { row: IndexedBetRow; onClose: () => void }) {
  const betId = String(row.betId);
  const { db } = useSSOTRuntime();
  const { sdk } = useSSOTSDK();
  const { chainId, readOnly, release } = useRelease();
  const explorerBaseUrl = getExplorerBaseUrl(chainId);

  // 1. Fetch live chain status if possible
  const { data: onChainBet, refetch: refetchOnChain } = useQuery({
    queryKey: ["ssot", "getBet", chainId, betId],
    enabled: Boolean(sdk && betId),
    queryFn: async (): Promise<DomainBet | null> => {
      if (!sdk || !betId) return null;
      try {
        return await sdk.hub.getBet(BigInt(betId));
      } catch {
        return null;
      }
    },
    refetchInterval: 3_000
  });

  const state = onChainBet?.state ?? row.state;
  const stake = BigInt((row as any).stake ?? "0");
  const payout =
    onChainBet?.payout != null ? onChainBet.payout : BigInt((row as any).payout ?? "0");
  const statusGroup = mapBetState(state, payout, stake);
  const isPending =
    statusGroup === "placed" ||
    statusGroup === "pending" ||
    statusGroup === "pending_vrf" ||
    state === "randomReady";

  const assetMeta = release?.assets?.find(
    (a) => a.address.toLowerCase() === (row.asset ?? "").toLowerCase()
  );
  const symbol = assetMeta?.symbol ?? "???";
  const decimals = assetMeta?.decimals ?? 18;

  const canRefund = state === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = state === "randomReady" && !readOnly && Boolean(sdk?.account);

  const finalizeFlow = useDirectTxAction({
    action: "FINALIZE",
    labels: { preflight: "...", submit: "...", confirm: "..." },
    descriptions: { preflight: "", submit: "", confirm: "" }
  });
  const refundFlow = useDirectTxAction({
    action: "REFUND",
    labels: { preflight: "...", submit: "...", confirm: "..." },
    descriptions: { preflight: "", submit: "", confirm: "" }
  });

  const handleFinalize = async () => {
    if (!sdk) return;
    try {
      const res = await finalizeFlow.execute(() => sdk.hub.finalize(BigInt(betId)));
      if (res.ok) {
        toast.success("Ticket finalized.");
        refetchOnChain();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRefund = async () => {
    if (!sdk) return;
    try {
      const res = await refundFlow.execute(() => sdk.hub.refund(BigInt(betId)));
      if (res.ok) {
        toast.success("Stake refunded.");
        refetchOnChain();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-sm">
      {/* Header Splash */}
      <div
        className={cn(
          "rounded-2xl p-6 relative overflow-hidden flex flex-col items-center text-center",
          statusGroup === "won"
            ? "bg-green-500/10 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]"
            : statusGroup === "lost"
              ? "bg-rose-500/10 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]"
              : isPending
                ? "bg-blue-500/10 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]"
                : "bg-white/5 border border-white/10"
        )}
      >
        <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full border",
            statusGroup === "won"
              ? "text-green-400 border-green-400/30"
              : statusGroup === "lost"
                ? "text-rose-400 border-rose-400/30"
                : isPending
                  ? "text-blue-400 border-blue-400/30 animate-pulse"
                  : "text-white/40 border-white/20"
          )}
        >
          {isPending ? "In Progress" : statusGroup === "won" ? "Net Positive" : "House Won"}
        </span>
        <div
          className={cn(
            "text-4xl font-black tracking-tighter drop-shadow-lg",
            statusGroup === "won"
              ? "text-green-500"
              : statusGroup === "lost"
                ? "text-rose-500"
                : "text-blue-400"
          )}
        >
          {statusGroup === "won"
            ? `+${formatUnits(payout, decimals)} ${symbol}`
            : statusGroup === "lost"
              ? `-${formatUnits(stake, decimals)} ${symbol}`
              : "Pending Settlement"}
        </div>
      </div>

      {/* Facts Matrix */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col gap-1 shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            Ticket ID
          </span>
          <span className="font-mono text-white/90 flex items-center justify-between gap-2">
            #{betId} <CopyButton value={betId} label="" />
          </span>
        </div>
        <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col gap-1 shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            Capital at Risk
          </span>
          <span className="font-mono text-white/90">
            {formatUnits(stake, decimals)} {symbol}
          </span>
        </div>
        <div className="col-span-2 bg-[#050505] border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            Cryptographic Signature
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-blue-400/80 text-[11px] truncate max-w-[150px]">
              {row.lastTxHash}
            </span>
            {explorerBaseUrl && (
              <a
                href={`${explorerBaseUrl}/tx/${row.lastTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-blue-300 text-xs underline underline-offset-2"
              >
                Verify
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Manual Intv Actions */}
      {(canFinalize || canRefund) && (
        <div className="flex gap-3 pt-4 border-t border-white/10">
          {canFinalize && (
            <button
              onClick={handleFinalize}
              disabled={finalizeFlow.busy}
              className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              {finalizeFlow.busy ? "Executing..." : "Force Finalize"}
            </button>
          )}
          {canRefund && (
            <button
              onClick={handleRefund}
              disabled={refundFlow.busy}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              {refundFlow.busy ? "Executing..." : "Force Refund"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Ledger Page
// ----------------------------------------------------------------------------
export default function BetsPage() {
  const { release } = useRelease();
  const { data: bets = [], isLoading } = useBets(500);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedBetRow, setSelectedBetRow] = React.useState<IndexedBetRow | null>(null);

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.label);
    }
    return map;
  }, [release?.gamesMeta]);

  const assetMaps = React.useMemo(() => {
    const symbols = new Map<string, string>();
    const decims = new Map<string, number>();
    for (const a of release?.assets ?? []) {
      symbols.set(a.address.toLowerCase(), a.symbol);
      decims.set(a.address.toLowerCase(), a.decimals);
    }
    return { symbols, decims };
  }, [release?.assets]);

  const filteredBets = React.useMemo(() => {
    return bets.filter((row) => {
      const stake = BigInt((row as any).stake ?? "0");
      const payout = (row as any).payout ? BigInt((row as any).payout) : undefined;
      const status = mapBetState(row.state, payout, stake);
      if (statusFilter === "open")
        return status === "pending" || status === "placed" || status === "pending_vrf";
      if (statusFilter === "won") return status === "won";
      if (statusFilter === "lost")
        return status === "lost" || status === "refunded" || status === "failed";
      return true;
    });
  }, [bets, statusFilter]);

  return (
    <PageTransition pageKey="bets">
      <div className="fixed inset-0 bg-[#050505] z-0 pointer-events-none" />
      <div className="fixed top-[10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/10 blur-[150px] pointer-events-none rounded-full z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-6 pt-6 pb-2 h-[calc(100vh-88px)] flex flex-col">
        {/* LEDGER HEADER */}
        <header className="shrink-0 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Decentralized
              Execution
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Casino Ledger
            </h1>
          </div>

          <div className="flex gap-1 bg-[#020202] rounded-xl p-1 border border-white/10 shadow-inner overflow-x-auto hide-scrollbar w-full md:w-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as StatusFilter)}
                className={cn(
                  "px-4 md:px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                  statusFilter === tab.key
                    ? "text-blue-400 bg-blue-500/10 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    : "text-white/30 hover:text-white/70 hover:bg-white/5 border border-transparent"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* COMPACT LEDGER TABLE */}
        <div className="flex-1 bg-[#020202] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-[inset_0_2px_20px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_1fr] md:grid-cols-[1fr_1.5fr_1.5fr_1.5fr_1fr_100px] border-b border-white/10 bg-[#050505] p-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 sticky top-0 z-10">
            <div className="px-2">Ticket ID</div>
            <div className="px-2">Module / Date</div>
            <div className="px-2">Capital at Risk</div>
            <div className="px-2">Settlement</div>
            <div className="px-2">Status</div>
            <div className="px-2 text-right hidden md:block">Action</div>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar custom-scrollbar p-2 space-y-1">
            {isLoading ? (
              <div className="h-40 flex items-center justify-center text-[10px] uppercase font-bold text-white/20 tracking-widest">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-3" />{" "}
                Synchronizing Ledger...
              </div>
            ) : filteredBets.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-[10px] uppercase font-bold text-white/20 tracking-widest">
                No tickets align with current filter
              </div>
            ) : (
              filteredBets.map((row) => {
                const gameLabel = row.gameId
                  ? (gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId))
                  : "—";
                const assetSymbol = row.asset
                  ? (assetMaps.symbols.get(row.asset.toLowerCase()) ?? shortHex(row.asset))
                  : "—";
                const decimals = row.asset
                  ? (assetMaps.decims.get(row.asset.toLowerCase()) ?? 18)
                  : 18;

                const stake = BigInt((row as any).stake ?? "0");
                const payout = (row as any).payout ? BigInt((row as any).payout) : null;
                const status = mapBetState(row.state, payout ?? undefined, stake);
                const isOpen =
                  status === "placed" || status === "pending" || status === "pending_vrf";
                const isWin = status === "won";
                const isLoss = status === "lost" || status === "refunded" || status === "failed";

                return (
                  <button
                    key={row.betId}
                    onClick={() => setSelectedBetRow(row)}
                    className={cn(
                      "w-full text-left grid grid-cols-[1fr_2fr_1.5fr_1.5fr_1fr] md:grid-cols-[1fr_1.5fr_1.5fr_1.5fr_1fr_100px] items-center p-3 rounded-xl border border-transparent transition-all group",
                      isWin
                        ? "bg-green-500/[0.02] hover:bg-green-500/10 hover:border-green-500/30"
                        : isLoss
                          ? "bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/10 opacity-70 hover:opacity-100"
                          : "bg-blue-500/[0.02] hover:bg-blue-500/10 hover:border-blue-500/30"
                    )}
                  >
                    {/* Ticket ID */}
                    <div className="px-2 font-mono text-xs text-white/60 group-hover:text-white transition-colors">
                      #{row.betId}
                    </div>

                    {/* Module / Date */}
                    <div className="px-2 flex flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-xs font-bold tracking-tight",
                          isWin ? "text-green-50" : isOpen ? "text-blue-100" : "text-white/70"
                        )}
                      >
                        {gameLabel}
                      </span>
                      <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                        {formatRelativeTime(row.updatedAt)}
                      </span>
                    </div>

                    {/* Capital at Risk */}
                    <div className="px-2 font-mono text-xs text-white/60">
                      {formatUnits(stake, decimals)} {assetSymbol}
                    </div>

                    {/* Settlement */}
                    <div
                      className={cn(
                        "px-2 font-mono text-xs font-bold",
                        isWin
                          ? "text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                          : isLoss
                            ? "text-rose-500/80"
                            : "text-blue-400/80"
                      )}
                    >
                      {isWin && payout
                        ? `+${formatUnits(payout, decimals)} ${assetSymbol}`
                        : isLoss
                          ? `-${formatUnits(stake, decimals)} ${assetSymbol}`
                          : "PENDING"}
                    </div>

                    {/* Status Badge */}
                    <div className="px-2">
                      <span
                        className={cn(
                          "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border",
                          isWin
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : isLoss
                              ? "bg-white/5 text-white/40 border-white/10"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}
                      >
                        {isWin ? "Won" : isLoss ? "Lost" : "Active"}
                      </span>
                    </div>

                    {/* Action (Desktop Only) */}
                    <div className="px-2 text-right hidden md:block text-[10px] font-bold uppercase tracking-widest text-white/20 group-hover:text-white/70 transition-colors">
                      View Dossier ↗
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <GlassModal
          isOpen={!!selectedBetRow}
          onClose={() => setSelectedBetRow(null)}
          title="Protocol Receipt Dossier"
          maxWidth="md"
        >
          {selectedBetRow && (
            <BetDetailModalContent row={selectedBetRow} onClose={() => setSelectedBetRow(null)} />
          )}
        </GlassModal>
      </main>
    </PageTransition>
  );
}
