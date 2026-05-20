import * as React from "react";
import { useTranslations } from "next-intl";
import { ErrorCallout, TxStepper, TxStatusChip } from "@ssot/ui";

import { shortHex } from "./format";
import type { PortfolioFlowState } from "./types";

export function PortfolioActionTrace({
  flow,
  explorerBaseUrl
}: {
  flow: PortfolioFlowState;
  explorerBaseUrl?: string;
}) {
  const t = useTranslations();

  if (!flow.hasActivity && !flow.error) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-0 p-4 text-center font-mono text-xs text-fg-subtle">
        {t("portfolio.overview.trace.waiting")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flow.error ? (
        <ErrorCallout title={t("portfolio.overview.trace.error")} message={flow.error.message} />
      ) : null}
      <TxStepper
        title={t("portfolio.overview.trace.title")}
        subtitle={t("portfolio.overview.trace.subtitle")}
        steps={[...flow.steps]}
        footer={
          <div className="space-y-2 text-xs text-fg-muted">
            <div className="flex items-center justify-between">
              <span>{t("portfolio.overview.trace.status")}</span>
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
                    {t("portfolio.overview.trace.viewExplorer")}
                  </a>
                ) : null}
              </div>
            ) : null}
            {flow.blockNumber ? (
              <div>{t("portfolio.overview.trace.block", { blockNumber: flow.blockNumber })}</div>
            ) : null}
            <button type="button" onClick={flow.reset} className="font-bold hover:text-fg">
              {t("portfolio.overview.trace.reset")}
            </button>
          </div>
        }
      />
    </div>
  );
}
