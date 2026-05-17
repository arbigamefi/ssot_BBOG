import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainError } from "@ssot/ssot";
import { ErrorCallout, TxStepper, TxStatusChip, type TxStepItem, type TxStatus } from "@ssot/ui";

import { serializeErrorDetails, shortHex } from "./format";

export function EarnActionTrace({
  title,
  status,
  steps,
  hasActivity,
  error,
  txHash,
  blockNumber,
  explorerBaseUrl,
  onReset
}: {
  title: string;
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  explorerBaseUrl?: string;
  onReset: () => void;
}) {
  const t = useTranslations();

  if (!hasActivity && !error) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-2 p-4 text-center font-mono text-xs text-fg-subtle">
        {t("earn.trace.waiting")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <ErrorCallout
          title={t("earn.trace.error")}
          message={error.message}
          details={serializeErrorDetails(error)}
        />
      ) : null}
      <TxStepper
        title={title}
        subtitle={t("earn.trace.subtitle")}
        steps={[...steps]}
        footer={
          <div className="space-y-2 text-xs text-fg-muted">
            <div className="flex items-center justify-between">
              <span>{t("earn.trace.status")}</span>
              <TxStatusChip status={status} />
            </div>
            {txHash ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono">{shortHex(txHash)}</span>
                {explorerBaseUrl ? (
                  <a
                    href={`${explorerBaseUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand hover:text-brand-hover"
                  >
                    {t("earn.trace.viewExplorer")}
                  </a>
                ) : null}
              </div>
            ) : null}
            {blockNumber ? <div>{t("earn.trace.block", { blockNumber })}</div> : null}
            <button
              type="button"
              onClick={onReset}
              className="font-bold text-fg-muted hover:text-fg"
            >
              {t("earn.trace.reset")}
            </button>
          </div>
        }
      />
    </div>
  );
}
