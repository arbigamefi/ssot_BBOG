import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PLINKO_FACTOR_TABLE, type PlinkoRisk } from "../../room/params";

const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"] as const;

function formatFactor(factorBps: number) {
  return `${(factorBps / 10_000).toFixed(factorBps >= 100_000 ? 1 : 2)}x`;
}

export function PlinkoStage({
  isPending,
  showResult,
  risk,
  buckets,
  onRiskChange
}: {
  isPending: boolean;
  showResult: boolean;
  risk: PlinkoRisk;
  buckets: readonly number[];
  onRiskChange: (risk: PlinkoRisk) => void;
}) {
  const t = useTranslations();
  const lastBucket = buckets.at(-1);
  const factors = PLINKO_FACTOR_TABLE[risk];

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-5 pb-6 pt-8 md:pt-10">
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-5">
        <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-surface-1/90 p-3 shadow-e2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg-subtle">
              {t("casino.room.selection.plinko.riskProfile")}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-fg">
              {t("casino.room.stage.plinko.risk", {
                risk: t(`casino.room.selection.plinko.${risk}`)
              })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface-0 p-1">
            {PLINKO_RISKS.map((item) => {
              const active = item === risk;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={isPending || showResult}
                  onClick={() => onRiskChange(item)}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "bg-brand text-fg-inverse shadow-e1"
                      : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
                    isPending || showResult ? "cursor-default opacity-70" : ""
                  )}
                >
                  {t(`casino.room.selection.plinko.${item}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex h-16 w-16 items-center justify-center">
          <div
            className={cn(
              "absolute h-14 w-14 rounded-full border border-brand/40 bg-brand-soft shadow-e2 transition-transform",
              isPending && "animate-bounce",
              showResult && "scale-110 border-accent/50 bg-accent-soft"
            )}
          />
          <span className="relative font-mono text-xl font-semibold text-fg">
            {lastBucket == null ? "P" : lastBucket}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          {Array.from({ length: 8 }).map((_, row) => (
            <div
              key={row}
              className="flex justify-center gap-4"
              style={{ width: `${(row + 2) * 2}rem` }}
            >
              {Array.from({ length: row + 1 }).map((__, index) => (
                <span
                  key={index}
                  className="h-2 w-2 rounded-full border border-brand/30 bg-fg/80 shadow-e1"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="grid w-full grid-cols-9 gap-1.5">
          {factors.map((factor, bucket) => {
            const active = showResult && lastBucket === bucket;
            return (
              <div
                key={bucket}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-md border bg-surface-1 px-1 py-1.5 text-center shadow-inner-e1",
                  active
                    ? "border-accent bg-accent-soft text-accent shadow-e2"
                    : "border-border text-fg-muted"
                )}
              >
                <span className="font-mono text-xs font-semibold">{bucket}</span>
                <span className="mt-0.5 font-mono text-[10px] font-semibold">
                  {formatFactor(factor)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.plinko.waitingVrf")
              : showResult
                ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
                : t("casino.room.stage.plinko.dropZone")}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold uppercase tracking-widest text-fg">
            {t("casino.room.stage.plinko.risk", {
              risk: t(`casino.room.selection.plinko.${risk}`)
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
