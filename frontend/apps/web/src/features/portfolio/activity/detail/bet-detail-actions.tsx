import * as React from "react";
import { ErrorCallout, TxStatusChip, TxStepper } from "@ssot/ui";

import { shortHex } from "./format";
import type { useDirectTxAction } from "../../../tx/useDirectTxAction";

type ActionFlow = ReturnType<typeof useDirectTxAction>;

export function BetDetailActions({
  canFinalize,
  canRefund,
  finalizeFlow,
  refundFlow,
  onFinalize,
  onRefund,
  explorerBaseUrl
}: {
  canFinalize: boolean;
  canRefund: boolean;
  finalizeFlow: ActionFlow;
  refundFlow: ActionFlow;
  onFinalize: () => void;
  onRefund: () => void;
  explorerBaseUrl?: string;
}) {
  const activeFlow = finalizeFlow.hasActivity
    ? finalizeFlow
    : refundFlow.hasActivity
      ? refundFlow
      : canFinalize
        ? finalizeFlow
        : canRefund
          ? refundFlow
          : null;

  if (!canFinalize && !canRefund && !activeFlow?.hasActivity) return null;

  const activeTitle = activeFlow === refundFlow ? "Refund trace" : "Finalize trace";
  const busy = finalizeFlow.busy || refundFlow.busy;

  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        Protocol action
      </div>
      <h2 className="mt-2 text-2xl font-black text-fg">
        {canRefund ? "Refund surface" : "Finalize surface"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Actions only appear when GameHub state allows them. The execution trace remains attached to
        this receipt.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {canFinalize ? (
          <button
            type="button"
            onClick={onFinalize}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-3 text-sm font-black text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finalizeFlow.busy ? "Finalizing..." : "Finalize ticket"}
          </button>
        ) : null}
        {canRefund ? (
          <button
            type="button"
            onClick={onRefund}
            disabled={busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-3 text-sm font-black text-fg transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refundFlow.busy ? "Refunding..." : "Refund stake"}
          </button>
        ) : null}
      </div>

      {activeFlow?.hasActivity ? (
        <div className="mt-5 space-y-3">
          {activeFlow.error ? (
            <ErrorCallout title="Transaction error" message={activeFlow.error.message} />
          ) : null}
          <TxStepper
            title={activeTitle}
            subtitle="Wallet signature, broadcast, and receipt state."
            steps={[...activeFlow.steps]}
            footer={
              <div className="space-y-2 text-xs text-fg-muted">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <TxStatusChip status={activeFlow.status} />
                </div>
                {activeFlow.txHash ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono">{shortHex(activeFlow.txHash)}</span>
                    {explorerBaseUrl ? (
                      <a
                        href={`${explorerBaseUrl}/tx/${activeFlow.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-brand hover:text-brand-hover"
                      >
                        View explorer
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {activeFlow.journalEntry?.blockNumber ? (
                  <div>Block {activeFlow.journalEntry.blockNumber}</div>
                ) : null}
                <button
                  type="button"
                  onClick={activeFlow.reset}
                  className="font-bold hover:text-fg"
                >
                  Reset trace
                </button>
              </div>
            }
          />
        </div>
      ) : null}
    </section>
  );
}
