import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { PLINKO_FACTOR_TABLE, type PlinkoRisk } from "../../room/params";
import { PlinkoBall, type PlinkoBallMode } from "./plinko-ball";

/**
 * PlinkoStage — a fixed-size plinko cabinet.
 *
 * The board play field is a fixed-size fixture: pegs, ball and buckets are all
 * placed in one shared coordinate system (percent of that fixed field), so the
 * ball always tracks the peg lanes and lands dead-centre in a bucket — at every
 * window size. The ball's horizontal step is exactly half the peg spacing, so
 * it zig-zags between pegs the way a real plinko ball does.
 */

const PLINKO_RISKS: readonly PlinkoRisk[] = ["low", "medium", "high"] as const;
const PLINKO_ROWS = 8;

// Shared coordinate system — percent of the fixed play field.
// 8 decision rows → 9 multiplier buckets (binomial Plinko-8).
const COL = 10; // horizontal step between adjacent peg columns
const ROW = 8; // vertical step between peg rows
const PEG_TOP = 13; // y of the row-0 peg
const DROP_Y = 4; // y where the ball is released
const BALL_REST_Y = 80; // y where the ball settles — resting ON TOP of the tile
const BUCKET_Y = 88; // y of the multiplier-tile centres (kept clear of the ball)

function stepDuration(step: number) {
  return Math.round(480 - (Math.min(step, PLINKO_ROWS) / PLINKO_ROWS) * 260);
}

function formatFactor(factorBps: number) {
  const multiplier = factorBps / 10_000;
  if (multiplier === 0) return "0x";
  return `${multiplier.toFixed(1)}x`;
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

/** Peg centre, in percent of the play field. */
function pegPoint(row: number, index: number) {
  return { x: 50 + (index - row / 2) * COL, y: PEG_TOP + row * ROW };
}

/** Bucket centre x, in percent of the play field. */
function bucketX(bucket: number) {
  return 50 + (bucket - 4) * COL;
}

/** Multiplier-tile tone, graded by payout — hot at the edges, cool in the middle. */
function bucketTone(factorBps: number, active: boolean) {
  if (active) return "border-accent bg-accent-soft text-accent shadow-e2";
  const multiplier = factorBps / 10_000;
  if (multiplier >= 5) return "border-accent/45 bg-accent-soft/55 text-accent";
  if (multiplier > 1) return "border-brand/40 bg-brand-soft text-brand";
  return "border-border bg-surface-1 text-fg-muted";
}

/**
 * Ball path. Each row the ball steps COL/2 — exactly half the peg spacing — so
 * it stays on a peg column at every row and lands centred in its bucket.
 */
function buildPath(targetBucket: number, randomHash?: string | null) {
  const decisions = deriveZigzagDecisions(targetBucket, randomHash);
  const points = [{ x: 50, y: DROP_Y }];
  let offset = 0;

  decisions.forEach((dir, index) => {
    offset += dir;
    points.push({
      x: 50 + offset * (COL / 2),
      y: index < PLINKO_ROWS - 1 ? PEG_TOP + (index + 1) * ROW : BALL_REST_Y
    });
  });

  return points;
}

/**
 * Accumulated ball rotation up to `step`, signed by horizontal travel, so the
 * ball reads as rolling off each peg rather than sliding.
 */
function pathRotation(path: Array<{ x: number; y: number }>, step: number) {
  let rotation = 0;
  for (let i = 1; i <= Math.min(step, path.length - 1); i += 1) {
    const prev = path[i - 1];
    const curr = path[i];
    if (!prev || !curr) continue;
    rotation += (curr.x >= prev.x ? 1 : -1) * 150;
  }
  return rotation;
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
    path[0] ?? { x: 50, y: DROP_Y };
  const ballMode: PlinkoBallMode = isRevealing
    ? "dropping"
    : landed
      ? "landed"
      : isPending
        ? "pending"
        : "idle";
  const controlsLocked = isPending || isRevealing || showResult;

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
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden p-4">
      <div className="relative rounded-2xl border border-border-strong bg-surface-1 p-2.5 shadow-e3">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-5 left-1/2 h-9 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/50 blur-2xl"
        />

        {/* ---- Risk selector ---- */}
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-0 px-3 py-2 shadow-inner-e1">
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
                  disabled={controlsLocked}
                  onClick={() => onRiskChange(item)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "bg-brand text-fg-inverse shadow-e1"
                      : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
                    controlsLocked ? "cursor-default opacity-70" : ""
                  )}
                >
                  {t(`casino.room.selection.plinko.${item}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Fixed-size play field — one coordinate system for pegs/ball/buckets ---- */}
        <div
          aria-label={t("casino.room.stage.plinko.board")}
          className="relative h-[490px] w-[480px] max-w-full overflow-hidden rounded-xl border border-border-strong bg-surface-0 shadow-inner-e1"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.1),transparent_56%)]" />

          {/* drop chute */}
          <div className="absolute left-1/2 top-0 z-10 flex h-6 w-14 -translate-x-1/2 items-end justify-center rounded-b-md border-x border-b border-border-soft bg-surface-1 shadow-inner-e1">
            <span className="mb-1 h-1 w-7 rounded-full bg-fg/40" />
          </div>

          {/* pegs */}
          {Array.from({ length: PLINKO_ROWS }).map((_, row) =>
            Array.from({ length: row + 1 }).map((__, index) => {
              const point = pegPoint(row, index);
              const activePeg = isRevealing && revealStep === row;
              return (
                <span
                  key={`${row}-${index}`}
                  className={cn(
                    "absolute h-3 w-3 rounded-full border border-brand/30 bg-fg/80 shadow-e1 transition-[transform,background-color,border-color]",
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

          <PlinkoBall
            mode={ballMode}
            point={activePoint}
            rotation={pathRotation(path, isRevealing ? revealStep : landed ? PLINKO_ROWS : 0)}
            durationMs={isRevealing ? stepDuration(revealStep) : 360}
            label={landed ? (lastBucket ?? "") : ""}
          />

          {/* multiplier tray */}
          <div
            aria-hidden
            className="absolute inset-x-2 bottom-2 top-[80%] rounded-lg border border-border-soft bg-surface-1/60 shadow-inner-e1"
          />
          {factors.map((factor, bucket) => {
            const active = landed && lastBucket === bucket;
            return (
              <div
                key={bucket}
                className={cn(
                  "absolute flex items-center justify-center overflow-hidden rounded-md border shadow-e1 transition-[border-color,background-color,color,transform]",
                  bucketTone(factor, active),
                  active && "animate-[plinko-bucket-land_360ms_ease-out]"
                )}
                style={{
                  left: `${bucketX(bucket)}%`,
                  top: `${BUCKET_Y}%`,
                  width: `${COL * 0.96}%`,
                  height: "8%",
                  transform: "translate(-50%, -50%)"
                }}
              >
                <span className="font-mono text-[11px] font-semibold tabular-nums sm:text-xs">
                  {formatFactor(factor)}
                </span>
              </div>
            );
          })}

          {/* status line */}
          <div className="absolute inset-x-3 top-2 z-10 flex items-center justify-between gap-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              {isPending
                ? t("casino.room.stage.plinko.waitingVrf")
                : isRevealing
                  ? t("casino.room.stage.plinko.revealing")
                  : showResult
                    ? t("casino.room.stage.plinko.slot", { slot: lastBucket ?? "—" })
                    : t("casino.room.stage.plinko.dropZone")}
            </p>
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
    </div>
  );
}
