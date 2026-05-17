import * as React from "react";
import { useTranslations } from "next-intl";
import { ErrorCallout, TxStepper, TxStatusChip } from "@ssot/ui";

import { serializeErrorDetails, shortHex } from "./format";
import type { ClaimsFlowState } from "./types";

export function ClaimsActionTrace({
  title,
  flow,
  explorerBaseUrl
}: {
  title: string;
  flow: ClaimsFlowState;
  explorerBaseUrl?: string;
}) {
  const t = useTranslations();

  if (!flow.hasActivity && !flow.error) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-0 p-4 text-center font-mono text-xs text-fg-subtle">
        {t("portfolio.claims.trace.waiting")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flow.error ? (
        <ErrorCallout
          title={t("portfolio.claims.trace.error")}
          message={flow.error.message}
          details={serializeErrorDetails(flow.error)}
        />
      ) : null}
      <TxStepper
        title={title}
        subtitle={t("portfolio.claims.trace.subtitle")}
        steps={[...flow.steps]}
        footer={
          <div className="space-y-2 text-xs text-fg-muted">
            <div className="flex items-center justify-between">
              <span>{t("portfolio.claims.trace.status")}</span>
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
                    {t("portfolio.claims.trace.viewExplorer")}
                  </a>
                ) : null}
              </div>
            ) : null}
            {flow.blockNumber ? (
              <div>{t("portfolio.claims.trace.block", { blockNumber: flow.blockNumber })}</div>
            ) : null}
            <button type="button" onClick={flow.reset} className="font-bold hover:text-fg">
              {t("portfolio.claims.trace.reset")}
            </button>
          </div>
        }
      />
    </div>
  );
}
