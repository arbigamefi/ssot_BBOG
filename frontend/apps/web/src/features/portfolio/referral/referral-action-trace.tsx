import * as React from "react";
import { ErrorCallout, TxStepper, TxStatusChip } from "@ssot/ui";

import { serializeErrorDetails, shortHex } from "./format";
import type { ReferralFlowState } from "./types";

export function ReferralActionTrace({
  flow,
  explorerBaseUrl
}: {
  flow: ReferralFlowState;
  explorerBaseUrl?: string;
}) {
  if (!flow.hasActivity && !flow.error) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-0 p-4 text-center font-mono text-xs text-fg-subtle">
        Waiting for referral intent.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flow.error ? (
        <ErrorCallout
          title="Transaction error"
          message={flow.error.message}
          details={serializeErrorDetails(flow.error)}
        />
      ) : null}
      <TxStepper
        title="Referral bind trace"
        subtitle="Wallet signature, broadcast, and receipt state."
        steps={[...flow.steps]}
        footer={
          <div className="space-y-2 text-xs text-fg-muted">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <TxStatusChip status={flow.status} />
            </div>
            {flow.txHash ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono">{shortHex(flow.txHash)}</span>
                {explorerBaseUrl ? (
                  <a
                    href={`${explorerBaseUrl}/tx/${flow.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand hover:text-brand-hover"
                  >
                    View explorer
                  </a>
                ) : null}
              </div>
            ) : null}
            {flow.blockNumber ? <div>Block {flow.blockNumber}</div> : null}
            <button type="button" onClick={flow.reset} className="font-bold hover:text-fg">
              Reset trace
            </button>
          </div>
        }
      />
    </div>
  );
}
