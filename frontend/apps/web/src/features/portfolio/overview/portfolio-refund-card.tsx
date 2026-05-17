import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

import { PortfolioActionTrace } from "./portfolio-action-trace";
import type { PortfolioFlowState } from "./types";

export function PortfolioRefundCard({
  amount,
  connected,
  readOnly,
  disabled,
  flow,
  explorerBaseUrl,
  onClaim
}: {
  amount: string;
  connected: boolean;
  readOnly: boolean;
  disabled: boolean;
  flow: PortfolioFlowState;
  explorerBaseUrl?: string;
  onClaim: () => void;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            VRF refund credit
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-fg">{amount}</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3 text-accent">
          <ArrowPathIcon className="h-6 w-6" />
        </div>
      </div>

      {!connected ? (
        <div className="mt-4 rounded-md border border-dashed border-border bg-surface-0 p-4 text-sm text-fg-muted">
          Connect a wallet to inspect and claim recoverable VRF credit.
        </div>
      ) : null}

      {readOnly ? (
        <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
          Writes are disabled for this release.
        </div>
      ) : null}

      <button
        type="button"
        onClick={onClaim}
        disabled={disabled}
        className="mt-4 w-full rounded-md bg-brand px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {flow.busy ? "Claiming" : "Claim credit"}
      </button>

      <div className="mt-4">
        <PortfolioActionTrace flow={flow} explorerBaseUrl={explorerBaseUrl} />
      </div>
    </section>
  );
}
