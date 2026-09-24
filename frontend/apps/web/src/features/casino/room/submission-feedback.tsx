import * as React from "react";
import { useTranslations } from "next-intl";
import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import { getBetErrorKind, getStepperErrorMessage, type StepperDisplayError } from "./feedback";
import type { PoolAvailability } from "./hooks";

export function PoolStatusNotice({
  status,
  symbol,
  onRefresh
}: {
  status: PoolAvailability;
  symbol: string;
  onRefresh?: () => void;
}) {
  const t = useTranslations("casino.room.poolStatus");
  if (status === "ready") return null;
  return (
    <div
      className="rounded-lg border border-warning/30 bg-surface-1 p-3 text-sm text-fg"
      role="status"
    >
      <p>{t(status, { symbol })}</p>
      {status !== "loading" && onRefresh ? (
        <button
          type="button"
          className="mt-1 min-h-11 font-semibold text-brand"
          onClick={onRefresh}
        >
          {t("refresh")}
        </button>
      ) : null}
    </div>
  );
}

export function BetSubmissionFeedback({
  error,
  onCheckTransaction,
  checking = false
}: {
  error?: StepperDisplayError;
  onCheckTransaction?: () => void;
  checking?: boolean;
}) {
  const t = useTranslations();
  if (!error) return null;
  const hash = error.details?.txHash;
  const chainId = error.details?.chainId;
  const href =
    typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash) && typeof chainId === "number"
      ? getExplorerTxUrl(chainId, hash)
      : undefined;
  return (
    <div
      className="rounded-lg border border-warning/30 bg-surface-1 p-3 text-sm text-fg"
      role="alert"
    >
      <p>{getStepperErrorMessage(error, undefined, t)}</p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        {onCheckTransaction ? (
          <button
            type="button"
            disabled={checking}
            className="min-h-11 font-semibold text-brand disabled:opacity-50"
            onClick={onCheckTransaction}
          >
            {t(
              checking ? "casino.room.feedback.checking" : "casino.room.feedback.checkTransaction"
            )}
          </button>
        ) : null}
        {href ? (
          <a
            className="inline-flex min-h-11 items-center font-semibold text-brand"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("casino.room.feedback.viewTransaction")}
          </a>
        ) : ["unconfirmed", "unknown", "connection", "reverted"].includes(
            getBetErrorKind(error)
          ) ? (
          <a
            className="inline-flex min-h-11 items-center font-semibold text-brand"
            href="/portfolio/activity"
          >
            {t("casino.room.feedback.viewActivity")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
