"use client";

import * as React from "react";
import Link from "next/link";
import type { BetRow as IndexedBetRow } from "@ssot/ssot/indexer";
import { AuditTabs, AuditTableCell, AuditTableHeader, cn } from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { useBets } from "../../features/bets/useBets";
import { formatUnits } from "../../features/betting/model/units";
import { useRelease } from "../../ssot/release/ReleaseProvider";

type StatusFilter = "all" | "open" | "won" | "lost";

const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All Tickets" }
] as const;

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function mapBetState(state?: string) {
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

export default function BetsPage() {
  const { release } = useRelease();
  const { data: bets = [], isLoading } = useBets(500);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

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

  const assetDecimalsByAddress = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of release?.assets ?? []) {
      map.set(asset.address.toLowerCase(), asset.decimals);
    }
    return map;
  }, [release?.assets]);

  const filteredBets = React.useMemo(() => {
    return bets.filter((row) => {
      const status = mapBetState(row.state);
      if (statusFilter === "open") return status === "pending" || status === "placed";
      if (statusFilter === "won") return status === "won" || status === "settled";
      if (statusFilter === "lost")
        return status === "lost" || status === "cancelled" || status === "failed";
      return true;
    });
  }, [bets, statusFilter]);

  return (
    <PageTransition pageKey="bets">
      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        <div className="relative z-10 mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] md:text-5xl">
              My Tickets
            </h1>
            <p className="text-sm font-mono uppercase tracking-widest text-white/40">
              Decentralized Wagering Ledger
            </p>
          </div>

          <div className="flex gap-2 rounded-[1.25rem] border border-white/10 bg-[#050505] p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as StatusFilter)}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
                  statusFilter === tab.key
                    ? "border border-white/20 bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    : tab.key === "won"
                      ? "text-green-500/40 hover:bg-green-500/10 hover:text-green-400"
                      : "text-white/30 hover:bg-white/5 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-b from-[#0a0a0a] to-[#020202] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <AuditTabs activeColorClass="border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/10">
            <AuditTableHeader>
              <div className="mb-4 grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] border-b border-white/5 pb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                <div>Timestamp / Block</div>
                <div>Protocol / Target</div>
                <div>Capital At Risk</div>
                <div>Settlement</div>
                <div>Status</div>
                <div className="text-right">Action</div>
              </div>
            </AuditTableHeader>

            <div className="flex min-h-[360px] flex-col gap-3">
              {isLoading ? (
                <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-8 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  Synchronizing indexed ticket stream
                </div>
              ) : filteredBets.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-8 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  No tickets found in this slice
                </div>
              ) : (
                filteredBets.map((row: IndexedBetRow) => {
                  const gameLabel = row.gameId
                    ? (gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId))
                    : "—";
                  const assetSymbol = row.asset
                    ? (assetLabelByAddress.get(row.asset.toLowerCase()) ?? shortHex(row.asset))
                    : "—";
                  const status = mapBetState(row.state);
                  const decimals = row.asset
                    ? (assetDecimalsByAddress.get(row.asset.toLowerCase()) ?? 18)
                    : 18;
                  const payoutBigInt = (row as { payout?: string }).payout
                    ? BigInt((row as { payout?: string }).payout ?? "0")
                    : null;
                  const stakeBigInt = (row as { stake?: string }).stake
                    ? BigInt((row as { stake?: string }).stake ?? "0")
                    : 0n;
                  const isOpen = row.state === "placed" || row.state === "randomReady";
                  const statusLabel =
                    status === "won"
                      ? "Confirmed"
                      : isOpen
                        ? "In Progress"
                        : status === "cancelled"
                          ? "Refunded"
                          : "Burned";
                  const statusClass =
                    status === "won"
                      ? "border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                      : isOpen
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                        : "border-white/10 bg-white/5 text-white/40";
                  const rowTone =
                    status === "won"
                      ? "hover:border-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.1)]"
                      : isOpen
                        ? "hover:border-blue-500/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]"
                        : "hover:border-white/20 hover:shadow-[0_0_25px_rgba(255,255,255,0.05)]";
                  const actionLabel =
                    status === "won" ? "Receipt ↗" : isOpen ? "Decrypt ↗" : "Archive ↗";

                  return (
                    <Link
                      key={row.betId}
                      href={`/bets/${row.betId}`}
                      className={cn(
                        "group cursor-pointer rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all",
                        rowTone,
                        status !== "won" && !isOpen ? "opacity-70 hover:opacity-100" : ""
                      )}
                    >
                      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_100px] items-center">
                        <AuditTableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-mono text-white/80 transition-colors group-hover:text-white">
                              {new Date(row.updatedAt).toLocaleDateString()} ·{" "}
                              {formatRelativeTime(row.updatedAt)}
                            </span>
                            <span className="hidden text-[10px] font-mono uppercase tracking-widest text-white/20 sm:block">
                              BLK: {(row as { blockNumber?: number }).blockNumber ?? "—"}
                            </span>
                          </div>
                        </AuditTableCell>
                        <AuditTableCell>
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                "font-bold tracking-tight",
                                status === "won"
                                  ? "text-green-50"
                                  : isOpen
                                    ? "text-blue-100"
                                    : "text-white/70"
                              )}
                            >
                              {gameLabel}
                            </span>
                            <span
                              className={cn(
                                "max-w-[140px] truncate text-[10px] font-mono uppercase tracking-widest",
                                status === "won"
                                  ? "text-white/30"
                                  : isOpen
                                    ? "text-blue-400/50"
                                    : "text-white/30"
                              )}
                            >
                              {shortHex(row.lastTxHash)}
                            </span>
                          </div>
                        </AuditTableCell>
                        <AuditTableCell>
                          <span
                            className={cn(
                              "font-mono text-sm font-bold",
                              status === "won" ? "text-white/80" : "text-white/50"
                            )}
                          >
                            {`${formatUnits(stakeBigInt, decimals)} ${assetSymbol}`}
                          </span>
                        </AuditTableCell>
                        <AuditTableCell>
                          <span
                            className={cn(
                              "font-mono text-sm",
                              payoutBigInt != null && payoutBigInt > 0n
                                ? "text-lg font-bold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                                : isOpen
                                  ? "text-white/20"
                                  : "text-white/50"
                            )}
                          >
                            {payoutBigInt != null && payoutBigInt > 0n
                              ? `+${formatUnits(payoutBigInt, decimals)} ${assetSymbol}`
                              : isOpen
                                ? "PENDING"
                                : status === "cancelled"
                                  ? "REFUNDED"
                                  : `-${formatUnits(stakeBigInt, decimals)} ${assetSymbol}`}
                          </span>
                        </AuditTableCell>
                        <AuditTableCell>
                          <span
                            className={cn(
                              "shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest",
                              statusClass
                            )}
                          >
                            {statusLabel}
                          </span>
                        </AuditTableCell>
                        <AuditTableCell
                          className={cn(
                            "justify-end text-[10px] font-bold uppercase tracking-widest transition-transform group-hover:translate-x-1",
                            status === "won"
                              ? "text-white/20 group-hover:text-green-400"
                              : isOpen
                                ? "text-white/20 group-hover:text-blue-400"
                                : "text-white/20 group-hover:text-white/50"
                          )}
                        >
                          {actionLabel}
                        </AuditTableCell>
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
