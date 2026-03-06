"use client";

import * as React from "react";
import { PageHeader, DataTable, type DataTableColumn } from "@ssot/ui";
import { PageTransition } from "../../components/PageTransition";
import { useTxJournal } from "../../features/account/useTxJournal";

function shortHex(s?: string) {
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

type TxRow = {
  id: string;
  createdAt: number;
  action: string;
  status: string;
  txHash?: string;
  blockNumber?: string;
  errorCode?: string;
};

const STATUS_COLORS: Record<string, string> = {
  mined: "text-emerald-400",
  submitted: "text-blue-400",
  failed: "text-rose-400",
  pending: "text-amber-400",
};

export default function AccountPage() {
  const { data: rows = [], isLoading } = useTxJournal(100);

  const columns: DataTableColumn<TxRow>[] = React.useMemo(
    () => [
      {
        key: "time",
        header: "Time",
        render: (row) => (
          <span className="font-mono text-slate-400">{new Date(row.createdAt).toLocaleTimeString()}</span>
        ),
      },
      {
        key: "action",
        header: "Action",
        render: (row) => <span className="text-white font-medium">{row.action}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <span className={`font-medium ${STATUS_COLORS[row.status] ?? "text-slate-400"}`}>
            {row.status}
          </span>
        ),
      },
      {
        key: "tx",
        header: "Tx Hash",
        render: (row) => <span className="font-mono text-slate-500">{shortHex(row.txHash)}</span>,
      },
      {
        key: "block",
        header: "Block",
        render: (row) => <span className="font-mono text-slate-500">{row.blockNumber ?? "—"}</span>,
      },
      {
        key: "error",
        header: "Error",
        render: (row) => (
          <span className="font-mono text-xs text-rose-400/70">{row.errorCode ?? ""}</span>
        ),
      },
    ],
    []
  );

  return (
    <PageTransition pageKey="account">
      <PageHeader
        title="Account"
        description="Your local transaction journal — an audit trail of every on-chain action."
      />

      <DataTable
        columns={columns}
        data={rows as TxRow[]}
        loading={isLoading}
        emptyMessage="No transactions yet. Place a bet or provide liquidity to get started."
        rowKey={(row) => row.id}
      />
    </PageTransition>
  );
}
