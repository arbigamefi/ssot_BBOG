import * as React from "react";
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
  const spinning = isPending || Boolean(isRevealing);
  const resultVisible = showResult && !isRevealing;
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
          className="mx-auto hidden h-52 w-52 sm:block md:h-64 md:w-64"
          style={{ perspective: "1200px" }}
        >
          <div
            className={cn(
              "relative h-full w-full transition-[transform] ease-out",
              spinning ? "animate-[spin-coin-fast_0.5s_linear_infinite]" : "duration-700"
            )}
            style={{
              transformStyle: "preserve-3d",
              transform:
                !spinning && resultVisible
                  ? `rotateX(15deg) rotateY(${resultNum === 1 ? 0 : 180}deg)`
                  : spinning
                    ? "none"
                    : `rotateX(15deg) rotateY(${coinSide === "TAILS" ? 180 : 0}deg)`
            }}
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border-[6px]"
                style={{
                  transform: `translateZ(-${i}px)`,
                  borderColor:
                    i % 2 === 0 ? "hsl(var(--brand) / 0.35)" : "hsl(var(--accent) / 0.28)",
                  filter: "brightness(0.8)"
                }}
              />
            ))}

            <div
              className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-brand/35 bg-brand/20 shadow-e3 backface-hidden"
              style={{ transform: "translateZ(1px)" }}
            >
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-brand/25 bg-surface-1">
                <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
                <SparklesIcon className="h-24 w-24 p-4 text-fg" />
                <span className="mt-[-10px] text-3xl font-semibold tracking-[0.2em] text-fg">
                  {t("casino.room.selection.coin.heads")}
                </span>
              </div>
            </div>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-accent/35 bg-accent/20 shadow-e3 backface-hidden"
              style={{ transform: "rotateY(180deg) translateZ(30px)" }}
            >
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border border-accent/25 bg-surface-1">
                <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
                <ShieldCheckIcon className="h-24 w-24 p-4 text-fg" />
                <span className="mt-[-10px] text-3xl font-semibold tracking-[0.2em] text-fg">
                  {t("casino.room.selection.coin.tails")}
                </span>
              </div>
            </div>
          </div>
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
