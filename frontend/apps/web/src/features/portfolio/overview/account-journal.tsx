import * as React from "react";
import { TxStatusChip } from "@ssot/ui";

import { mapJournalStatus, shortHex } from "./format";
import type { AccountJournalRow } from "./types";

export function AccountJournal({
  rows,
  explorerBaseUrl
}: {
  rows: readonly AccountJournalRow[];
  explorerBaseUrl?: string;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">Journal</div>
        <h2 className="mt-2 text-2xl font-black text-fg">Transaction journal</h2>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-[1fr_96px] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>Action</div>
          <div className="text-right">Status</div>
        </div>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_96px] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
            >
              <div>
                <div className="font-bold text-fg">{row.action.replace(/_/g, " ")}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-fg-muted">
                  <span>{new Date(row.createdAt).toLocaleTimeString()}</span>
                  {row.txHash ? (
                    explorerBaseUrl ? (
                      <a
                        href={`${explorerBaseUrl}/tx/${row.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:text-brand-hover"
                      >
                        {shortHex(row.txHash)}
                      </a>
                    ) : (
                      <span>{shortHex(row.txHash)}</span>
                    )
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <TxStatusChip status={mapJournalStatus(row.status)} />
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">
            No account transactions in this browser session.
          </div>
        )}
      </div>
    </section>
  );
}
