import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { formatNativeFee, type CasinoRoundPhase } from "./casino-round";

type Translate = ReturnType<typeof useTranslations>;

function getPhaseCopy(phase: CasinoRoundPhase, t: Translate) {
  switch (phase) {
    case "loading_quote":
      return {
        label: t("casino.room.roundStatus.phases.loadingQuote.label"),
        detail: t("casino.room.roundStatus.phases.loadingQuote.detail"),
        status: t("casino.room.roundStatus.phases.loadingQuote.status")
      };
    case "waiting_vrf":
      return {
        label: t("casino.room.roundStatus.phases.waitingVrf.label"),
        detail: t("casino.room.roundStatus.phases.waitingVrf.detail"),
        status: t("casino.room.roundStatus.phases.waitingVrf.status")
      };
    case "timeout_soft":
      return {
        label: t("casino.room.roundStatus.phases.timeoutSoft.label"),
        detail: t("casino.room.roundStatus.phases.timeoutSoft.detail"),
        status: t("casino.room.roundStatus.phases.timeoutSoft.status")
      };
    case "placing":
      return {
        label: t("casino.room.roundStatus.phases.placing.label"),
        detail: t("casino.room.roundStatus.phases.placing.detail"),
        status: t("casino.room.roundStatus.phases.placing.status")
      };
    case "settling":
      return {
        label: t("casino.room.roundStatus.phases.settling.label"),
        detail: t("casino.room.roundStatus.phases.settling.detail"),
        status: t("casino.room.roundStatus.phases.settling.status")
      };
    case "manual_settle_offered":
      return {
        label: t("casino.room.roundStatus.phases.manualSettleOffered.label"),
        detail: t("casino.room.roundStatus.phases.manualSettleOffered.detail"),
        status: t("casino.room.roundStatus.phases.manualSettleOffered.status")
      };
    case "settled":
      return {
        label: t("casino.room.roundStatus.phases.settled.label"),
        detail: t("casino.room.roundStatus.phases.settled.detail"),
        status: t("casino.room.roundStatus.phases.settled.status")
      };
    case "refundable":
      return {
        label: t("casino.room.roundStatus.phases.refundable.label"),
        detail: t("casino.room.roundStatus.phases.refundable.detail"),
        status: t("casino.room.roundStatus.phases.refundable.status")
      };
    case "failed":
      return {
        label: t("casino.room.roundStatus.phases.failed.label"),
        detail: t("casino.room.roundStatus.phases.failed.detail"),
        status: t("casino.room.roundStatus.phases.failed.status")
      };
    default:
      return {
        label: t("casino.room.roundStatus.phases.ready.label"),
        detail: t("casino.room.roundStatus.phases.ready.detail"),
        status: t("casino.room.roundStatus.phases.ready.status")
      };
  }
}

export function CasinoRoundStatusPanel({
  phase,
  quote,
  quoteError,
  betId,
  requestId,
  error,
  manualSettleAvailable,
  onManualSettle,
  manualRefundAvailable,
  onManualRefund
}: {
  phase: CasinoRoundPhase;
  quote?: bigint;
  quoteError?: string;
  betId?: bigint;
  requestId?: bigint;
  error?: string;
  manualSettleAvailable?: boolean;
  onManualSettle?: () => void;
  manualRefundAvailable?: boolean;
  onManualRefund?: () => void;
}) {
  const t = useTranslations();
  const copy = getPhaseCopy(phase, t);
  const active =
    phase === "waiting_vrf" ||
    phase === "timeout_soft" ||
    phase === "placing" ||
    phase === "settling" ||
    phase === "manual_settle_offered" ||
    phase === "loading_quote";

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border bg-surface-1 p-3 text-sm shadow-inner-e1",
        active ? "border-brand/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fg-subtle">
            {t("casino.room.roundStatus.title")}
          </p>
          <p className="mt-1 font-bold text-fg">{copy.label}</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            {error ?? quoteError ?? copy.detail}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
            active
              ? "border-brand/30 bg-brand-soft text-brand"
              : "border-border bg-surface-2 text-fg-subtle"
          )}
        >
          {copy.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">{t("casino.room.roundStatus.metrics.vrfEstimate")}</p>
          <p className="mt-1 font-mono font-bold text-fg">{formatNativeFee(quote)}</p>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">{t("casino.room.roundStatus.metrics.betId")}</p>
          <p className="mt-1 truncate font-mono font-bold text-fg">
            {betId == null ? "—" : betId.toString()}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">{t("casino.room.roundStatus.metrics.vrfRequest")}</p>
          <p className="mt-1 truncate font-mono font-bold text-fg">
            {requestId == null || requestId === 0n ? "—" : requestId.toString()}
          </p>
        </div>
      </div>

      {manualSettleAvailable && (
        <button
          type="button"
          onClick={onManualSettle}
          className="mt-4 w-full rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-warn transition-colors hover:bg-warn/15"
        >
          {t("casino.room.roundStatus.actions.settleResult")}
        </button>
      )}

      {manualRefundAvailable && (
        <button
          type="button"
          onClick={onManualRefund}
          className="mt-4 w-full rounded-lg border border-danger/35 bg-danger-soft px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-danger transition-colors hover:bg-danger/15"
        >
          {t("casino.room.roundStatus.actions.refundStake")}
        </button>
      )}
    </div>
  );
}
