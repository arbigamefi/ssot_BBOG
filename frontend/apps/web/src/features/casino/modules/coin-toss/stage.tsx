import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";
import { useTranslations } from "next-intl";

import type { CoinSide } from "../../room/params";

export function CoinTossStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  coinSide,
  onSideChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
  onSideChange: (side: CoinSide) => void;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const reduced = useReducedMotion() ?? false;
  const spinning = isPending || Boolean(isRevealing);
  const selectedSideLabel =
    coinSide === "HEADS"
      ? t("casino.room.selection.coin.heads")
      : t("casino.room.selection.coin.tails");

  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 1_250);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden px-5 py-8">
      <div className="relative z-20 grid w-full max-w-5xl grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)]">
        <CoinChoiceButton
          side="HEADS"
          label={t("casino.room.selection.coin.heads")}
          active={coinSide === "HEADS"}
          disabled={spinning || showResult}
          icon={<SparklesIcon className="h-8 w-8" />}
          onClick={() => onSideChange("HEADS")}
        />

        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-2 border-brand/35 bg-surface-1 shadow-e2 sm:hidden">
          <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border border-brand/25 bg-brand-soft text-fg">
            {coinSide === "HEADS" ? (
              <SparklesIcon className="h-12 w-12" />
            ) : (
              <ShieldCheckIcon className="h-12 w-12" />
            )}
            <span className="mt-2 text-lg font-semibold uppercase tracking-[0.18em]">
              {selectedSideLabel}
            </span>
          </div>
        </div>

        <div
          className="relative mx-auto hidden h-52 w-52 sm:block md:h-64 md:w-64"
          style={{ perspective: "1200px" }}
        >
          {/* Felt toss pad — the surface the coin is tossed over and lands on */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 bottom-[-46px] h-[72px] w-[122%] -translate-x-1/2"
          >
            <div className="absolute inset-0 rounded-[50%] border-[3px] border-border-strong bg-surface-1 shadow-e3" />
            <div className="absolute inset-[5px] rounded-[50%] bg-[radial-gradient(ellipse_at_50%_24%,hsl(var(--surface-2)),hsl(var(--surface-0)))] shadow-inner-e1" />
            <div className="absolute inset-[5px] rounded-[50%] bg-[linear-gradient(160deg,hsl(var(--fg)/0.12),transparent_46%)]" />
          </div>

          {/* Landing shadow on the felt */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 bottom-2 h-4 w-3/5 rounded-[50%] bg-black/55 blur-xl"
            initial={false}
            animate={{
              x: "-50%",
              scale: spinning ? 0.7 : 1,
              opacity: spinning ? 0.45 : 0.8
            }}
            transition={{ duration: 0.5 }}
          />

          <CoinDisc
            spinning={spinning}
            isRevealing={Boolean(isRevealing)}
            showResult={showResult}
            resultNum={resultNum}
            coinSide={coinSide}
            reduced={reduced}
            headsLabel={t("casino.room.selection.coin.heads")}
            tailsLabel={t("casino.room.selection.coin.tails")}
          />
        </div>

        <CoinChoiceButton
          side="TAILS"
          label={t("casino.room.selection.coin.tails")}
          active={coinSide === "TAILS"}
          disabled={spinning || showResult}
          icon={<ShieldCheckIcon className="h-8 w-8" />}
          onClick={() => onSideChange("TAILS")}
        />
      </div>

      {!spinning && !showResult && (
        <div className="relative z-20 mt-8 flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in duration-500">
          <span className="mb-4 text-[10px] uppercase tracking-[0.4em] text-fg-subtle">
            {t("casino.room.stage.coin.awaitingSelection")}
          </span>
          <div className="flex w-72 items-center justify-center gap-4 rounded-xl border border-border bg-surface-1/85 px-8 py-4 shadow-e2 backdrop-blur-xl">
            <div
              className={cn(
                "h-3 w-3 rounded-full animate-pulse",
                coinSide === "HEADS" ? "bg-brand" : "bg-accent"
              )}
            />
            <span className="font-mono text-xl font-semibold uppercase tracking-widest text-fg">
              {t("casino.room.stage.coin.selected", { side: selectedSideLabel })}
            </span>
          </div>
        </div>
      )}

      {spinning && (
        <div className="relative z-20 mt-8 flex flex-col items-center animate-pulse">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-fg">
            {t("casino.room.stage.coin.waitingVrf")}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * CoinDisc — a real tossed coin.
 *
 * The coin flips end-over-end on the X axis with a vertical toss arc, rather
 * than spinning flat. Rotation is driven through a motion value so each phase
 * continues forward from the last: idle settle → continuous toss while VRF is
 * pending → a final arc that lands on the result face. `prefers-reduced-motion`
 * snaps to the correct face.
 */
function CoinDisc({
  spinning,
  isRevealing,
  showResult,
  resultNum,
  coinSide,
  reduced,
  headsLabel,
  tailsLabel
}: {
  spinning: boolean;
  isRevealing: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
  reduced: boolean;
  headsLabel: string;
  tailsLabel: string;
}) {
  const restRotateX = coinSide === "TAILS" ? 180 : 0;
  const resultRotateX = resultNum === 1 ? 0 : 180;
  const rotateX = useMotionValue(restRotateX);
  const liftY = useMotionValue(0);

  const phase = isRevealing ? "reveal" : spinning ? "pending" : showResult ? "resolved" : "idle";

  React.useEffect(() => {
    const forward = (target: number) => {
      const current = rotateX.get();
      return current + ((((target - current) % 360) + 360) % 360);
    };

    if (reduced) {
      rotateX.set(phase === "reveal" || phase === "resolved" ? resultRotateX : restRotateX);
      liftY.set(0);
      return;
    }

    const running: Array<{ stop: () => void }> = [];

    if (phase === "pending") {
      running.push(
        animate(rotateX, rotateX.get() + 100_000, { duration: 100_000 / 760, ease: "linear" }),
        animate(liftY, [0, -24, 0], { duration: 0.62, ease: "easeInOut", repeat: Infinity })
      );
    } else if (phase === "reveal" && resultNum != null) {
      running.push(
        animate(rotateX, rotateX.get() + 1_080 + forward(resultRotateX), {
          duration: 1.05,
          ease: [0.16, 0.84, 0.3, 1]
        }),
        animate(liftY, [0, -82, 12, 0], {
          duration: 1.1,
          times: [0, 0.42, 0.85, 1],
          ease: "easeInOut"
        })
      );
    } else {
      const target = phase === "resolved" && resultNum != null ? resultRotateX : restRotateX;
      running.push(
        animate(rotateX, forward(target), { type: "spring", stiffness: 90, damping: 15 }),
        animate(liftY, 0, { duration: 0.4, ease: "easeOut" })
      );
    }

    return () => running.forEach((controls) => controls.stop());
  }, [phase, reduced, resultNum, restRotateX, resultRotateX, rotateX, liftY]);

  return (
    <motion.div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d", rotateX, rotateZ: -6, y: liftY }}
      aria-label={`Coin ${spinning ? "tossing" : coinSide}`}
    >
      {/* Coin edge — stacked rings give the disc real thickness */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border-[6px]"
          style={{
            transform: `translateZ(${15 - i}px)`,
            borderColor: i % 2 === 0 ? "hsl(var(--brand) / 0.4)" : "hsl(var(--accent) / 0.3)",
            filter: "brightness(0.78)"
          }}
        />
      ))}

      {/* Heads face */}
      <div
        className="[backface-visibility:hidden] absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-brand/35 bg-brand/20 shadow-e3"
        style={{ transform: "translateZ(16px)" }}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-brand/25 bg-surface-1">
          <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
          <SparklesIcon className="h-24 w-24 p-4 text-fg" />
          <span className="mt-[-10px] text-3xl font-semibold tracking-[0.2em] text-fg">
            {headsLabel}
          </span>
        </div>
      </div>

      {/* Tails face */}
      <div
        className="[backface-visibility:hidden] absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-accent/35 bg-accent/20 shadow-e3"
        style={{ transform: "rotateX(180deg) translateZ(16px)" }}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-accent/25 bg-surface-1">
          <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
          <ShieldCheckIcon className="h-24 w-24 p-4 text-fg" />
          <span className="mt-[-10px] text-3xl font-semibold tracking-[0.2em] text-fg">
            {tailsLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function CoinChoiceButton({
  side,
  label,
  active,
  disabled,
  icon,
  onClick
}: {
  side: CoinSide;
  label: string;
  active: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group flex min-h-40 flex-col justify-between rounded-xl border p-5 text-left transition-colors md:min-h-56",
        active
          ? "border-brand bg-brand-soft text-fg shadow-e2"
          : "border-border bg-surface-1/90 text-fg-muted hover:border-brand/45 hover:bg-surface-2 hover:text-fg",
        disabled ? "cursor-default opacity-70" : ""
      )}
    >
      <span className="flex items-center justify-between">
        <span className="rounded-lg border border-border bg-surface-0 p-3 text-brand">{icon}</span>
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-fg-subtle">
          {side}
        </span>
      </span>
      <span className="mt-8 text-3xl font-semibold uppercase tracking-[0.12em] md:text-4xl">
        {label}
      </span>
    </button>
  );
}
