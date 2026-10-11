import * as React from "react";
import Link from "next/link";
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
    case "result_unbooked":
      return {
        status: t("casino.room.roundStatus.phases.resultUnbooked.status")
      };
    case "voided":
      return {
        status: t("casino.room.roundStatus.phases.voided.status")
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
  requestId
}: {
  phase: CasinoRoundPhase;
  quote?: bigint;
  betId?: bigint;
  requestId?: bigint;
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
  // The result arrived but settlement lags: the bet's page holds the void once it is eligible.
  const settlementPending =
    betId != null && (phase === "result_unbooked" || phase === "manual_settle_offered");

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
          role="status"
          aria-live="polite"
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
      {settlementPending ? (
        <div
          className="mt-2 border-t border-border-soft pt-2"
          data-testid="round-settlement-pending"
        >
          <p className="text-xs leading-5 text-fg-muted">
            {t("casino.room.roundStatus.pendingSettlement.body")}
          </p>
          <Link
            href={`/portfolio/activity/${betId.toString()}`}
            className="mt-1 inline-flex min-h-11 items-center text-xs font-bold text-brand hover:text-brand-hover"
          >
            {t("casino.room.roundStatus.pendingSettlement.link")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
