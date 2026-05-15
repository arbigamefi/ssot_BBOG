import * as React from "react";
import Link from "next/link";

import { formatTokenAmount } from "./format";
import type { EnrichedBetRow } from "./types";

export function BetsLedger({
  rows,
  loading
}: {
  rows: readonly EnrichedBetRow[];
  loading: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">Tickets</div>
        <h2 className="mt-2 text-2xl font-black text-fg">Casino ledger</h2>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[120px_1.4fr_1fr_1fr_120px_120px] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
            <div>Ticket</div>
            <div>Module</div>
            <div>Stake</div>
            <div>Settlement</div>
            <div>Status</div>
            <div className="text-right">Action</div>
          </div>
          <Rows rows={rows} loading={loading} />
        </div>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {loading ? (
          <div className="rounded-md border border-dashed border-border bg-surface-0 p-5 text-center text-sm text-fg-muted">
            Synchronizing ledger.
          </div>
        ) : rows.length > 0 ? (
          rows.map((item) => <MobileRow key={item.row.id} item={item} />)
        ) : (
          <div className="rounded-md border border-dashed border-border bg-surface-0 p-5 text-center text-sm text-fg-muted">
            No tickets align with the current filter.
          </div>
        )}
      </div>
    </section>
  );
}

function Rows({ rows, loading }: { rows: readonly EnrichedBetRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="px-5 py-12 text-center text-sm text-fg-muted">Synchronizing ledger.</div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-fg-muted">
        No tickets align with the current filter.
      </div>
    );
  }
  return (
    <div>
      {rows.map((item) => (
        <Link
          key={item.row.id}
          href={`/portfolio/activity/${item.row.betId}`}
          className="grid grid-cols-[120px_1.4fr_1fr_1fr_120px_120px] items-center border-b border-border-soft px-5 py-4 text-sm transition last:border-b-0 hover:bg-surface-2"
        >
          <div className="font-mono font-black text-fg">#{item.row.betId}</div>
          <div>
            <div className="font-bold text-fg">{item.gameLabel}</div>
            <div className="mt-1 font-mono text-xs text-fg-subtle">{item.relativeTime}</div>
          </div>
          <div className="font-mono text-fg-muted">
            {formatTokenAmount(item.stake, item.decimals, item.assetSymbol)}
          </div>
          <div className={getOutcomeClass(item.status)}>{item.outcomeLabel}</div>
          <div>
            <StatusBadge status={item.status} />
          </div>
          <div className="text-right text-xs font-black uppercase tracking-[0.12em] text-brand">
            View
          </div>
        </Link>
      ))}
    </div>
  );
}

function MobileRow({ item }: { item: EnrichedBetRow }) {
  return (
    <Link
      href={`/portfolio/activity/${item.row.betId}`}
      className="rounded-md border border-border bg-surface-0 p-4 transition hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-black text-fg">#{item.row.betId}</div>
          <div className="mt-1 text-sm font-bold text-fg-muted">{item.gameLabel}</div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-subtle">Stake</span>
          <span className="font-mono text-fg-muted">
            {formatTokenAmount(item.stake, item.decimals, item.assetSymbol)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-subtle">Settlement</span>
          <span className={getOutcomeClass(item.status)}>{item.outcomeLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-subtle">Updated</span>
          <span className="font-mono text-fg-muted">{item.relativeTime}</span>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: EnrichedBetRow["status"] }) {
  const label =
    status === "won"
      ? "Won"
      : status === "lost" || status === "refunded" || status === "failed"
        ? "Closed"
        : status === "settled"
          ? "Settled"
          : "Open";
  const className =
    status === "won"
      ? "border-success/30 bg-success-soft text-success"
      : status === "lost" || status === "refunded" || status === "failed"
        ? "border-danger/30 bg-danger-soft text-danger"
        : "border-brand/30 bg-brand-soft text-brand";
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

function getOutcomeClass(status: EnrichedBetRow["status"]) {
  if (status === "won") return "font-mono font-bold text-success";
  if (status === "lost" || status === "refunded" || status === "failed") {
    return "font-mono font-bold text-danger";
  }
  return "font-mono font-bold text-brand";
}
