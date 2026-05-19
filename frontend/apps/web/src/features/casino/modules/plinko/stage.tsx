import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PLINKO_FACTOR_TABLE, type PlinkoRisk } from "../../room/params";

const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"] as const;
const PLINKO_ROWS = 8;

function stepDuration(step: number) {
  return Math.round(480 - (Math.min(step, PLINKO_ROWS) / PLINKO_ROWS) * 260);
}

function formatFactor(factorBps: number) {
  return `${(factorBps / 10_000).toFixed(factorBps >= 100_000 ? 1 : 2)}x`;
}

function clampBucket(bucket: number | undefined) {
  if (bucket == null || !Number.isFinite(bucket)) return 4;
  return Math.max(0, Math.min(PLINKO_ROWS, Math.floor(bucket)));
}

function makeSeededRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function deriveZigzagDecisions(targetBucket: number, randomHash?: string | null) {
  const decisions: Array<-1 | 1> = [
    ...Array.from({ length: PLINKO_ROWS - targetBucket }, () => -1 as const),
    ...Array.from({ length: targetBucket }, () => 1 as const)
  ];
  const rng = makeSeededRng(randomHash ?? `plinko-${targetBucket}`);
  for (let i = decisions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = decisions[i] ?? -1;
    const swap = decisions[j] ?? -1;
    decisions[i] = swap;
    decisions[j] = current;
  }
  return decisions;
}

function buildPath(targetBucket: number, randomHash?: string | null) {
  const decisions = deriveZigzagDecisions(targetBucket, randomHash);
  const points = [{ x: 50, y: 5 }];
  let offset = 0;

  decisions.forEach((dir, index) => {
    offset += dir;
    points.push({
      x: 50 + offset * 4.7,
      y: 14 + (index + 1) * 7.4
    });
  });

  return points;
}

function getPegPoint(row: number, index: number) {
  return {
    x: 50 + (index - row / 2) * 8.2,
    y: 20 + row * 7.4
  };
}

export function PlinkoStage({
  isPending,
  isRevealing = false,
  showResult,
  risk,
  buckets,
  onRiskChange,
  randomHash,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  risk: PlinkoRisk;
  buckets: readonly number[];
  onRiskChange: (risk: PlinkoRisk) => void;
  randomHash?: string | null;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const lastBucket = buckets.at(-1);
  const factors = PLINKO_FACTOR_TABLE[risk];
  const targetBucket = clampBucket(lastBucket);
  const [revealStep, setRevealStep] = React.useState(0);
  const path = React.useMemo(() => buildPath(targetBucket, randomHash), [targetBucket, randomHash]);
  const landed = !isRevealing && (showResult || revealStep >= PLINKO_ROWS) && lastBucket != null;
  const activePoint = path[
    Math.min(isRevealing ? revealStep : landed ? PLINKO_ROWS : 0, PLINKO_ROWS)
  ] ??
    path[0] ?? { x: 50, y: 5 };

  React.useEffect(() => {
    if (!isRevealing || lastBucket == null) {
      setRevealStep(showResult && lastBucket != null ? PLINKO_ROWS : 0);
      return;
    }

    let cancelled = false;
    const timeouts: number[] = [];
    let step = 0;
    setRevealStep(0);
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(callback, delay);
      timeouts.push(timeout);
      return timeout;
    };

    if (prefersReducedMotion) {
      setRevealStep(PLINKO_ROWS);
      schedule(() => {
        if (!cancelled) onRevealComplete?.();
      }, 200);
      return () => {
        cancelled = true;
        timeouts.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    const tick = () => {
      if (cancelled || step >= PLINKO_ROWS) return;
      step += 1;
      setRevealStep(step);
      if (step < PLINKO_ROWS) {
        schedule(tick, stepDuration(step));
      } else {
        schedule(() => {
          if (!cancelled) onRevealComplete?.();
        }, 280);
      }
    };

    schedule(tick, stepDuration(0));

    return () => {
      cancelled = true;
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [isRevealing, lastBucket, onRevealComplete, prefersReducedMotion, showResult]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div
        className="relative h-full max-h-[42rem] min-h-[25rem] w-full max-w-4xl rounded-xl border border-border bg-surface-1/70 p-3 shadow-e2"
        aria-label={t("casino.room.stage.plinko.board")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.08),transparent_58%)]" />

        <div className="relative z-30 flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-0/85 p-2 shadow-inner-e1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.selection.plinko.riskProfile")}
            </p>
            <p className="truncate font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg">
              {t("casino.room.stage.plinko.risk", {
                risk: t(`casino.room.selection.plinko.${risk}`)
              })}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-border bg-surface-1 p-1">
            {PLINKO_RISKS.map((item) => {
              const active = item === risk;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={isPending || isRevealing || showResult}
                  onClick={() => onRiskChange(item)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
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

        <div className="relative z-10 mt-3 h-[calc(100%-4.25rem)] min-h-[20rem] overflow-hidden rounded-lg border border-border-soft bg-surface-0/80 shadow-inner-e1">
          <div className="absolute left-1/2 top-0 z-10 flex h-6 w-14 -translate-x-1/2 items-end justify-center rounded-b-md border-x border-b border-border-soft bg-surface-1 shadow-inner-e1">
            <span className="mb-1 h-1 w-7 rounded-full bg-fg/40" />
          </div>

          {Array.from({ length: PLINKO_ROWS }).map((_, row) =>
            Array.from({ length: row + 1 }).map((__, index) => {
              const point = getPegPoint(row, index);
              const activePeg = isRevealing && revealStep === row + 1;
              return (
                <span
                  key={`${row}-${index}`}
                  className={cn(
                    "absolute h-2.5 w-2.5 rounded-full border border-brand/30 bg-fg/80 shadow-e1 transition-[transform,background-color,border-color]",
                    activePeg && "animate-[plinko-peg-bonk_240ms_ease-out] border-accent bg-accent"
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
            className="absolute z-10 h-2 w-9 rounded-full bg-fg/25 blur-sm transition-[left,top,opacity] ease-in"
            aria-hidden
            style={{
              left: `${activePoint.x}%`,
              opacity: isRevealing || landed ? 0.2 + (revealStep / PLINKO_ROWS) * 0.35 : 0.16,
              top: `${Math.min(activePoint.y + 4, 88)}%`,
              transform: "translate(-50%, -50%)",
              transitionDuration: `${isRevealing ? stepDuration(revealStep) : 360}ms`
            }}
          />

          <div
            className={cn(
              "absolute z-20 flex h-12 w-12 items-center justify-center rounded-full border font-mono text-sm font-semibold shadow-e2 transition-[left,top,transform,background-color,border-color] ease-in",
              isPending
                ? "animate-bounce border-brand/40 bg-brand-soft text-fg"
                : isRevealing
                  ? "border-brand bg-brand text-fg-inverse"
                  : landed
                    ? "animate-[plinko-land_360ms_ease-out] border-accent bg-accent text-fg-inverse"
                    : "border-brand/40 bg-brand-soft text-fg"
            )}
            style={{
              left: `${activePoint.x}%`,
              top: `${activePoint.y}%`,
              transform: "translate(-50%, -50%)",
              transitionDuration: `${isRevealing ? stepDuration(revealStep) : 360}ms`
            }}
          >
            {landed ? lastBucket : isRevealing ? "" : "P"}
          </div>

          <div className="absolute inset-x-3 bottom-4 grid grid-cols-9 gap-1.5 sm:gap-2">
            {factors.map((factor, bucket) => {
              const active = landed && lastBucket === bucket;
              return (
                <div
                  key={bucket}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center rounded-md border bg-surface-1 px-1 py-1.5 text-center shadow-inner-e1 transition-[border-color,background-color,color,transform]",
                    active
                      ? "animate-[plinko-bucket-land_360ms_ease-out] border-accent bg-accent-soft text-accent shadow-e2"
                      : "border-border text-fg-muted"
                  )}
                >
                  <span className="font-mono text-xs font-semibold">{bucket}</span>
                  <span className="mt-0.5 font-mono text-[9px] font-semibold sm:text-[10px]">
                    {formatFactor(factor)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-3 bottom-1.5 h-1 rounded-full bg-surface-1" aria-hidden>
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

          <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              {isPending
                ? t("casino.room.stage.plinko.waitingVrf")
                : isRevealing
                  ? t("casino.room.stage.plinko.revealing")
                  : showResult
                    ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
                    : t("casino.room.stage.plinko.dropZone")}
            </p>
            <p className="shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg">
              {t("casino.room.stage.plinko.risk", {
                risk: t(`casino.room.selection.plinko.${risk}`)
              })}
            </p>
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {isRevealing
            ? t("casino.room.stage.plinko.revealing")
            : showResult
              ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
              : t("casino.room.stage.plinko.dropZone")}
        </div>
      </div>
    </div>
  );
}
