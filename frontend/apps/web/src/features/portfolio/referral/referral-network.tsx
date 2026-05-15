import * as React from "react";

const NODES = [
  {
    label: "Player",
    value: "Invited wallet",
    detail: "Arrives through the encoded invite URL."
  },
  {
    label: "Affiliate",
    value: "Bound address",
    detail: "One-way upstream registry state."
  },
  {
    label: "Settlement",
    value: "Protocol rules",
    detail: "Rewards resolve through the deployed release."
  }
];

export function ReferralNetwork({
  hasBoundReferrer,
  loading
}: {
  hasBoundReferrer: boolean;
  loading: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="flex items-center justify-between gap-4 border-b border-border p-5">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">Model</div>
          <h2 className="mt-2 text-2xl font-black text-fg">Referral settlement model</h2>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-xs text-fg-muted">
          {loading ? "Loading" : hasBoundReferrer ? "Bound" : "Open"}
        </span>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3">
        {NODES.map((node, index) => (
          <div
            key={node.label}
            className="relative rounded-md border border-border bg-surface-0 p-5"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-sm font-black text-brand">
              {index + 1}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
              {node.label}
            </div>
            <div className="mt-2 font-mono text-lg font-black text-fg">{node.value}</div>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{node.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-4 text-sm leading-6 text-fg-muted">
        Referral data that is not exposed by the current on-chain reader stays explicit as pending
        indexation. The UI does not fabricate downstream volume, invite counts, or rebate totals.
      </div>
    </section>
  );
}
