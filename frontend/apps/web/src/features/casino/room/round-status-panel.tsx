import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@ssot/ui";

import { formatNativeFee, type CasinoRoundPhase } from "./casino-round";

type Translate = ReturnType<typeof useTranslations>;

/**
 * The four player-visible stages of a round. Internal phases collapse onto
 * these so the player sees a stable "where am I" tracker instead of a
 * shifting status string.
 */
const STEP_KEYS = ["place", "random", "settle", "result"] as const;
type StepKey = (typeof STEP_KEYS)[number];

/** Phase → active step index (0-3). null = round not in flight yet. */
function phaseToStepIndex(phase: CasinoRoundPhase): number | null {
  switch (phase) {
    case "placing":
      return 0;
    case "waiting_vrf":
    case "timeout_soft":
      return 1;
    case "settling":
    case "manual_settle_offered":
      return 2;
    case "settled":
    case "refundable":
      return 3;
    case "failed":
      return -1; // error — handled separately
    default:
      return null; // idle / loading_quote / ready → no tracker
  }
}

function RoundProgressStepper({ phase, t }: { phase: CasinoRoundPhase; t: Translate }) {
  const activeIndex = phaseToStepIndex(phase);
  if (activeIndex === null) return null;
  const failed = phase === "failed";
  const complete = phase === "settled" || phase === "refundable";

  return (
    <ol className="mb-2 flex items-center gap-1" aria-label={t("casino.room.roundStatus.title")}>
      {STEP_KEYS.map((key: StepKey, index) => {
        const done = !failed && (complete ? true : index < activeIndex);
        const active = !failed && !complete && index === activeIndex;
        const errored = failed && index === Math.max(0, lastReachedStep(phase));
        return (
          <li key={key} className="flex flex-1 items-center gap-1">
            <div className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                  errored
                    ? "border-danger bg-danger-soft text-danger"
                    : done
                      ? "border-success bg-success-soft text-success"
                      : active
                        ? "border-brand bg-brand-soft text-brand motion-safe:animate-pulse"
                        : "border-border bg-surface-2 text-fg-subtle"
                )}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.08em]",
                  active ? "text-brand" : done ? "text-success" : "text-fg-subtle"
                )}
              >
                {t(`casino.room.roundStatus.steps.${key}`)}
              </span>
            </div>
            {index < STEP_KEYS.length - 1 && (
              <span
                aria-hidden
                className={cn("mb-4 h-0.5 w-3 rounded-full", done ? "bg-success" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Best-effort "where did it fail" for the error highlight. */
function lastReachedStep(phase: CasinoRoundPhase): number {
  // We don't carry the pre-failure phase, so default to the place step.
  return phase === "failed" ? 0 : 0;
}

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

      <RoundProgressStepper phase={phase} t={t} />

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
