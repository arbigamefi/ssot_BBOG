import * as React from "react";

import { formatAllowance, formatAmount } from "./format";
import type { AccountAssetRow } from "./types";

export function AccountPositionsPanel({
  rows,
  loading
}: {
  rows: readonly AccountAssetRow[];
  loading: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">Ledger</div>
        <h2 className="mt-2 text-2xl font-black text-fg">Asset positions</h2>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>Asset</div>
          <div>Wallet</div>
          <div>Bank position</div>
          <div>Allowance</div>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">Loading balances.</div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
            >
              <div>
                <div className="font-mono font-black text-fg">{row.symbol}</div>
                <div className="mt-1 font-mono text-xs text-fg-subtle">{row.asset}</div>
              </div>
              <div className="font-mono text-fg-muted">
                {formatAmount(row.walletBalance, row.decimals)}
              </div>
              <div>
                <div className="font-mono font-bold text-fg">
                  {formatAmount(row.assetsEquivalent, row.decimals)}
                </div>
                <div className="mt-1 font-mono text-xs text-fg-subtle">
                  {formatAmount(row.shares, row.decimals)} shares
                </div>
              </div>
              <div
                className={
                  row.allowance === 0n
                    ? "font-mono font-bold text-danger"
                    : "font-mono font-bold text-success"
                }
              >
                {formatAllowance(row.allowance, row.decimals)}
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm text-fg-muted">
            Connect a wallet to inspect account state.
          </div>
        )}
      </div>
    </section>
  );
}
