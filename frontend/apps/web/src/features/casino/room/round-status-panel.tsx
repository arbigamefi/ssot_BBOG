import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { formatNativeFee, type CasinoRoundPhase } from "./casino-round";

type Translate = ReturnType<typeof useTranslations>;

function getPhaseCopy(phase: CasinoRoundPhase, t: Translate) {
  switch (phase) {
    case "loading_quote":
      return {
        status: t("casino.room.roundStatus.phases.loadingQuote.status")
      };
    case "waiting_vrf":
      return {
        status: t("casino.room.roundStatus.phases.waitingVrf.status")
      };
    case "timeout_soft":
      return {
        status: t("casino.room.roundStatus.phases.timeoutSoft.status")
      };
    case "placing":
      return {
        status: t("casino.room.roundStatus.phases.placing.status")
      };
    case "settling":
      return {
        status: t("casino.room.roundStatus.phases.settling.status")
      };
    case "manual_settle_offered":
      return {
        status: t("casino.room.roundStatus.phases.manualSettleOffered.status")
      };
    case "settled":
      return {
        status: t("casino.room.roundStatus.phases.settled.status")
      };
    case "refundable":
      return {
        status: t("casino.room.roundStatus.phases.refundable.status")
      };
    case "failed":
      return {
        status: t("casino.room.roundStatus.phases.failed.status")
      };
    default:
      return {
        status: t("casino.room.roundStatus.phases.ready.status")
      };
  }
}

function RoundProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 py-1.5 text-xs">
      <span className="whitespace-nowrap text-fg-subtle">{label}</span>
      <span
        className="block min-w-0 truncate text-right font-mono font-semibold text-fg"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export function CasinoRoundStatusPanel({
  phase,
  quote,
  betId,
  requestId,
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
        "mb-2 rounded-lg border bg-surface-1 px-3 py-2 text-sm shadow-inner-e1",
        active ? "border-brand/30" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3 pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
          {t("casino.room.roundStatus.title")}
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
            active
              ? "border-brand/30 bg-brand-soft text-brand"
              : "border-border bg-surface-2 text-fg-subtle"
          )}
        >
          {copy.status}
        </span>
      </div>

      <div className="divide-y divide-border-soft">
        <RoundProofRow
          label={t("casino.room.roundStatus.metrics.vrfEstimate")}
          value={formatNativeFee(quote)}
        />
        <RoundProofRow
          label={t("casino.room.roundStatus.metrics.betId")}
          value={betId == null ? "—" : betId.toString()}
        />
        <RoundProofRow
          label={t("casino.room.roundStatus.metrics.vrfRequest")}
          value={requestId == null || requestId === 0n ? "—" : requestId.toString()}
        />
      </div>

      {manualSettleAvailable && (
        <button
          type="button"
          onClick={onManualSettle}
          className="mt-2 w-full rounded-lg border border-warn/40 bg-warn-soft px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-warn transition-colors hover:bg-warn/15"
        >
          {t("casino.room.roundStatus.actions.settleResult")}
        </button>
      )}

      {manualRefundAvailable && (
        <button
          type="button"
          onClick={onManualRefund}
          className="mt-2 w-full rounded-lg border border-danger/35 bg-danger-soft px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-danger transition-colors hover:bg-danger/15"
        >
          {t("casino.room.roundStatus.actions.refundStake")}
        </button>
      )}
    </div>
  );
}
