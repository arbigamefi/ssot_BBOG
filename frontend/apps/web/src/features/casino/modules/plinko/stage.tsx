import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PLINKO_FACTOR_TABLE, type PlinkoRisk } from "../../room/params";

function formatFactor(factorBps: number) {
  return `${(factorBps / 10_000).toFixed(factorBps >= 100_000 ? 1 : 2)}x`;
}

export function PlinkoStage({
  isPending,
  showResult,
  risk,
  buckets
}: {
  isPending: boolean;
  showResult: boolean;
  risk: PlinkoRisk;
  buckets: readonly number[];
}) {
  const t = useTranslations();
  const lastBucket = buckets.at(-1);
  const factors = PLINKO_FACTOR_TABLE[risk];

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.06)_0%,transparent_62%)]" />
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div
            className={cn(
              "absolute h-16 w-16 rounded-full border border-brand/40 bg-brand-soft shadow-glow transition-transform",
              isPending && "animate-bounce",
              showResult && "scale-110 border-accent/50 bg-accent-soft"
            )}
          />
          <span className="relative font-mono text-xl font-black text-fg">
            {lastBucket == null ? "P" : lastBucket}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          {Array.from({ length: 8 }).map((_, row) => (
            <div
              key={row}
              className="flex justify-center gap-5"
              style={{ width: `${(row + 2) * 2.25}rem` }}
            >
              {Array.from({ length: row + 1 }).map((__, index) => (
                <span
                  key={index}
                  className="h-2.5 w-2.5 rounded-full border border-brand/30 bg-fg/80 shadow-glow"
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
                  "flex min-h-16 flex-col items-center justify-center rounded-md border bg-surface-1 px-1 py-2 text-center shadow-inner-e1",
                  active
                    ? "border-accent bg-accent-soft text-accent shadow-glow"
                    : "border-border text-fg-muted"
                )}
              >
                <span className="font-mono text-xs font-black">{bucket}</span>
                <span className="mt-1 font-mono text-[10px] font-bold">{formatFactor(factor)}</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.plinko.waitingVrf")
              : showResult
                ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
                : t("casino.room.stage.plinko.dropZone")}
          </p>
          <p className="mt-1 font-mono text-sm font-black uppercase tracking-widest text-fg">
            {t("casino.room.stage.plinko.risk", {
              risk: t(`casino.room.selection.plinko.${risk}`)
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
