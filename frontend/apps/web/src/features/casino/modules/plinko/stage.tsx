import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PLINKO_FACTOR_TABLE, type PlinkoRisk } from "../../room/params";

const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"] as const;
const PLINKO_ROWS = 8;
const PLINKO_STEP_MS = 380;

function formatFactor(factorBps: number) {
  return `${(factorBps / 10_000).toFixed(factorBps >= 100_000 ? 1 : 2)}x`;
}

function clampBucket(bucket: number | undefined) {
  if (bucket == null || !Number.isFinite(bucket)) return 4;
  return Math.max(0, Math.min(PLINKO_ROWS, Math.floor(bucket)));
}

function getPathPoint(step: number, bucket: number) {
  if (step <= 0) return { x: 50, y: 3 };
  const row = Math.min(step, PLINKO_ROWS);
  const position = Math.round((bucket * row) / PLINKO_ROWS);
  return {
    x: 50 + (position - row / 2) * 8,
    y: 10 + row * 9.8
  };
}

function getPegPoint(row: number, index: number) {
  return {
    x: 50 + (index - row / 2) * 8,
    y: 14 + row * 9.8
  };
}

export function PlinkoStage({
  isPending,
  isRevealing = false,
  showResult,
  risk,
  buckets,
  onRiskChange
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  risk: PlinkoRisk;
  buckets: readonly number[];
  onRiskChange: (risk: PlinkoRisk) => void;
}) {
  const t = useTranslations();
  const lastBucket = buckets.at(-1);
  const factors = PLINKO_FACTOR_TABLE[risk];
  const targetBucket = clampBucket(lastBucket);
  const [revealStep, setRevealStep] = React.useState(0);
  const activePoint = getPathPoint(
    isRevealing ? revealStep : showResult && lastBucket != null ? PLINKO_ROWS : 0,
    targetBucket
  );

  React.useEffect(() => {
    if (!isRevealing || lastBucket == null) {
      setRevealStep(showResult && lastBucket != null ? PLINKO_ROWS : 0);
      return;
    }

    setRevealStep(0);
    const interval = window.setInterval(() => {
      setRevealStep((current) => {
        if (current >= PLINKO_ROWS) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, PLINKO_STEP_MS);

    return () => window.clearInterval(interval);
  }, [isRevealing, lastBucket, showResult]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-5 pb-6 pt-8 md:pt-10">
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-5">
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
                  disabled={isPending || isRevealing || showResult}
                  onClick={() => onRiskChange(item)}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "bg-brand text-fg-inverse shadow-e1"
                      : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
                    isPending || isRevealing || showResult ? "cursor-default opacity-70" : ""
                  )}
                >
                  {t(`casino.room.selection.plinko.${item}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full max-w-3xl rounded-xl border border-border bg-surface-1/70 px-4 pb-5 pt-8 shadow-e2">
          <div
            className="relative h-[20rem] overflow-hidden rounded-lg border border-border-soft bg-surface-0/80 shadow-inner-e1"
            aria-label={t("casino.room.stage.plinko.board")}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.08),transparent_62%)]" />

            {Array.from({ length: PLINKO_ROWS }).map((_, row) =>
              Array.from({ length: row + 1 }).map((__, index) => {
                const point = getPegPoint(row, index);
                const activePeg = isRevealing && revealStep === row + 1;
                return (
                  <span
                    key={`${row}-${index}`}
                    className={cn(
                      "absolute h-2.5 w-2.5 rounded-full border border-brand/30 bg-fg/80 shadow-e1 transition-[transform,background-color,border-color]",
                      activePeg && "scale-125 border-accent bg-accent"
                    )}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: "translate(-50%, -50%)"
                    }}
                  />
                );
              })
            )}

            <div
              className={cn(
                "absolute z-20 flex h-12 w-12 items-center justify-center rounded-full border font-mono text-sm font-semibold shadow-e2 transition-[left,top,transform,background-color,border-color] duration-[360ms] ease-out",
                isPending
                  ? "animate-bounce border-brand/40 bg-brand-soft text-fg"
                  : isRevealing
                    ? "border-brand bg-brand text-fg-inverse"
                    : showResult
                      ? "border-accent bg-accent text-fg-inverse"
                      : "border-brand/40 bg-brand-soft text-fg"
              )}
              style={{
                left: `${activePoint.x}%`,
                top: `${activePoint.y}%`,
                transform: "translate(-50%, -50%)"
              }}
            >
              {lastBucket == null ? "P" : lastBucket}
            </div>

            <div className="absolute inset-x-4 bottom-4 grid grid-cols-9 gap-2">
              {factors.map((factor, bucket) => {
                const active = (showResult || isRevealing) && lastBucket === bucket;
                return (
                  <div
                    key={bucket}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-md border bg-surface-1 px-1 py-2 text-center shadow-inner-e1 transition-[border-color,background-color,color,transform]",
                      active
                        ? "scale-[1.03] border-accent bg-accent-soft text-accent shadow-e2"
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
          </div>
          <div className="mt-3 h-1 rounded-full bg-surface-0" aria-hidden>
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-[360ms]"
              style={{
                width: `${
                  isRevealing
                    ? Math.min(100, (revealStep / PLINKO_ROWS) * 100)
                    : showResult && lastBucket != null
                      ? 100
                      : 0
                }%`
              }}
            />
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {isRevealing
            ? t("casino.room.stage.plinko.revealing")
            : showResult
              ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
              : t("casino.room.stage.plinko.dropZone")}
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.plinko.waitingVrf")
              : isRevealing
                ? t("casino.room.stage.plinko.revealing")
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
