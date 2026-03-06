"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Button,
  CopyButton,
  type DataTableColumn,
  type BetStatus,
} from "@ssot/ui";
import type { BetRow as IndexedBetRow } from "@ssot/ssot/indexer";

import { PageTransition } from "../../components/PageTransition";
import { useBets } from "../../features/bets/useBets";
import { useIndexer } from "../../features/ops/useIndexer";

function shortHex(s?: string) {
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const s = state.toLowerCase();
  if (s.includes("won") || s.includes("win")) return "won";
  if (s.includes("lost") || s.includes("lose")) return "lost";
  if (s.includes("settled") || s.includes("resolved")) return "settled";
  if (s.includes("placed")) return "placed";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("fail")) return "failed";
  return "pending";
}

export default function BetsPage() {
  const router = useRouter();
  const { data: bets = [], isLoading } = useBets(500);
  const { indexerStatus, syncNow } = useIndexer();

  const columns: DataTableColumn<IndexedBetRow>[] = React.useMemo(
    () => [
      {
        key: "betId",
        header: "Bet ID",
        render: (row) => <span className="font-mono text-white font-medium">{row.betId}</span>,
        cellClassName: "w-20",
      },
      {
        key: "state",
        header: "Status",
        render: (row) => <StatusBadge status={mapBetState(row.state)} label={row.state} />,
      },
      {
        key: "event",
        header: "Event",
        render: (row) => <span className="text-slate-300">{row.lastEventName || "—"}</span>,
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
        key: "asset",
        header: "Asset",
        render: (row) => (
          <span className="inline-flex items-center gap-1 font-mono text-slate-400">
            {shortHex(row.asset)}
          </span>
        ),
      },
      {
        key: "block",
        header: "Block",
        render: (row) => <span className="font-mono text-slate-500">{row.updatedBlock}</span>,
      },
      {
        key: "tx",
        header: "Tx",
        render: (row) => (
          <span className="inline-flex items-center gap-1 font-mono text-slate-500">
            {shortHex(row.lastTxHash)}
            {row.lastTxHash && <CopyButton value={row.lastTxHash} label="Copy tx hash" />}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <PageTransition pageKey="bets">
      <PageHeader
        title="My Bets"
        description={`${bets.length} bets indexed · Last synced block: ${indexerStatus?.lastSyncedBlock ?? "—"}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => void syncNow()} className="border-slate-700 text-slate-300 hover:text-white">
            Sync Now
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={bets}
        loading={isLoading}
        emptyMessage="No bets indexed yet. Connect your wallet and place your first bet!"
        rowKey={(row) => row.id ?? row.betId}
        onRowClick={(row) => router.push(`/bets/${row.betId}`)}
      />
    </PageTransition>
  );
}
