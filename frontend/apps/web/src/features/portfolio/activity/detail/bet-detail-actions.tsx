import * as React from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
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

  const activeTitle =
    activeFlow === refundFlow
      ? t("portfolio.activity.detail.actions.refundTrace")
      : t("portfolio.activity.detail.actions.finalizeTrace");
  const busy = finalizeFlow.busy || refundFlow.busy;

  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        {t("portfolio.activity.detail.actions.eyebrow")}
      </div>
      <h2 className="mt-2 text-2xl font-black text-fg">
        {canRefund
          ? t("portfolio.activity.detail.actions.refundSurface")
          : t("portfolio.activity.detail.actions.finalizeSurface")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        {t("portfolio.activity.detail.actions.description")}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {canFinalize ? (
          <button
            type="button"
            onClick={onFinalize}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-3 text-sm font-black text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finalizeFlow.busy
              ? t("portfolio.activity.detail.actions.finalizing")
              : t("portfolio.activity.detail.actions.finalizeTicket")}
          </button>
        ) : null}
        {canRefund ? (
          <button
            type="button"
            onClick={onRefund}
            disabled={busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-3 text-sm font-black text-fg transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refundFlow.busy
              ? t("portfolio.activity.detail.actions.refunding")
              : t("portfolio.activity.detail.actions.refundStake")}
          </button>
        ) : null}
      </div>

      {activeFlow?.hasActivity ? (
        <div className="mt-5 space-y-3">
          {activeFlow.error ? (
            <ErrorCallout
              title={t("portfolio.activity.detail.actions.transactionError")}
              message={activeFlow.error.message}
            />
          ) : null}
          <TxStepper
            title={activeTitle}
            subtitle={t("portfolio.activity.detail.actions.traceSubtitle")}
            steps={[...activeFlow.steps]}
            footer={
              <div className="space-y-2 text-xs text-fg-muted">
                <div className="flex items-center justify-between">
                  <span>{t("portfolio.activity.detail.actions.status")}</span>
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
                        {t("portfolio.activity.detail.actions.viewExplorer")}
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {activeFlow.journalEntry?.blockNumber ? (
                  <div>
                    {t("portfolio.activity.detail.actions.block", {
                      blockNumber: activeFlow.journalEntry.blockNumber
                    })}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={activeFlow.reset}
                  className="font-bold hover:text-fg"
                >
                  {t("portfolio.activity.detail.actions.resetTrace")}
                </button>
              </div>
            }
          />
        </div>
      ) : null}
    </section>
  );
}
