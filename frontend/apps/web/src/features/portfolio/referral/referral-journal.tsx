import * as React from "react";
import { TxStatusChip, type TxStatus } from "@ssot/ui";

import { shortHex } from "./format";

export type ReferralJournalRow = {
  key: string;
  action: string;
  value: string;
  status: TxStatus;
  txHash: string;
};

export function ReferralJournal({
  rows,
  explorerBaseUrl
}: {
  rows: readonly ReferralJournalRow[];
  explorerBaseUrl?: string;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">Journal</div>
        <h2 className="mt-2 text-2xl font-black text-fg">Session referral activity</h2>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_96px] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>Hash</div>
          <div>Action</div>
          <div>Value</div>
          <div className="text-right">Status</div>
        </div>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1.2fr_1fr_1fr_96px] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
            >
              <div className="font-mono text-fg-muted">
                {explorerBaseUrl ? (
                  <a
                    href={`${explorerBaseUrl}/tx/${row.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand"
                  >
                    {shortHex(row.txHash)}
                  </a>
                ) : (
                  shortHex(row.txHash)
                )}
              </div>
              <div className="font-bold text-fg">{row.action}</div>
              <div className="font-mono text-fg-muted">{row.value}</div>
              <div className="text-right">
                <TxStatusChip status={row.status} />
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">
            No referral transactions in this browser session.
          </div>
        )}
      </div>
    </section>
  );
}
