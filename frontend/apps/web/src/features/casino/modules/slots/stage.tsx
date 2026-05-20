import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { SLOT_SYMBOLS, SlotSymbolArt } from "./slot-symbol";
import { SlotReel, type SlotReelMode } from "./slot-reel";

/**
 * SlotsStage — a slot-machine cabinet, not a dashboard card.
 *
 * Stage realism: the three reels are recessed into a cabinet body with a
 * marquee, an inset reel deck, a brand payline across the centre, edge
 * vignettes that clip the symbols, and a glass sheen.
 *
 * Animation realism: each reel is a framer-motion symbol strip that scrolls
 * continuously and spring-decelerates onto the payline (see SlotReel). The
 * staggered stop timing (reel 1 → 2 → 3) and the VRF reveal state machine are
 * preserved from the previous implementation so the round timing is unchanged.
 */

export function SlotsStage({
  isPending,
  isRevealing,
  showResult,
  symbols,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  symbols: readonly number[];
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const symbolsKey = symbols.join(",");
  const reels = React.useMemo(() => [symbols[0], symbols[1], symbols[2]], [symbolsKey]);
  const hasFinalSymbols = reels.every((symbol) => typeof symbol === "number");
  const [stoppedReels, setStoppedReels] = React.useState(() =>
    showResult && hasFinalSymbols ? 3 : 0
  );
  const allStopped = hasFinalSymbols && (stoppedReels >= 3 || (showResult && !isRevealing));
  const symbolResult = reels
    .filter((symbol): symbol is number => typeof symbol === "number")
    .map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`))
    .join(" / ");
  const isWin = allStopped && hasFinalSymbols && reels[0] === reels[1] && reels[1] === reels[2];

  // VRF reveal state machine — unchanged: staggered reel stop + completion.
  React.useEffect(() => {
    if (!isRevealing || !hasFinalSymbols) {
      setStoppedReels(showResult && hasFinalSymbols ? 3 : 0);
      return;
    }

    setStoppedReels(0);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timeouts.push(window.setTimeout(callback, delay));
    };

    if (prefersReducedMotion) {
      setStoppedReels(3);
      schedule(() => onRevealComplete?.(), 180);
      return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
    }

    schedule(() => setStoppedReels(1), 900);
    schedule(() => setStoppedReels(2), 1_500);
    schedule(() => setStoppedReels(3), 2_100);
    schedule(() => onRevealComplete?.(), 2_380);

    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [
    hasFinalSymbols,
    isRevealing,
    onRevealComplete,
    prefersReducedMotion,
    showResult,
    symbolsKey
  ]);

  const reelMode = (index: number): SlotReelMode => {
    if (showResult && !isRevealing && hasFinalSymbols) return "stopped";
    if (isRevealing && hasFinalSymbols) return stoppedReels > index ? "stopped" : "spinning";
    if (isPending) return "spinning";
    return "idle";
  };

  const symbolLabel = React.useCallback(
    (symbol: number) => t(`casino.room.selection.slots.symbols.${symbol}`),
    [t]
  );

  const statusText = isPending
    ? t("casino.room.stage.slots.spinning")
    : isRevealing
      ? t("casino.room.stage.slots.spinning")
      : allStopped
        ? t("casino.room.stage.slots.result", { symbols: symbolResult })
        : t("casino.room.stage.slots.ready");

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 overflow-hidden px-6 py-10">
      {/* ---- Cabinet ---- */}
      <div className="relative w-full max-w-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/50 blur-2xl"
        />

        <div className="relative rounded-2xl border border-border-strong bg-surface-1 p-3 shadow-e3">
          {/* Marquee */}
          <div className="mb-3 flex items-center justify-center rounded-lg border border-border-soft bg-gradient-to-b from-surface-2 to-surface-1 py-2 shadow-inner-e1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-fg-muted">
              {t("casino.room.stage.slots.classic")}
            </span>
          </div>

          {/* Reel deck — recessed */}
          <div className="relative overflow-hidden rounded-xl border border-border-strong bg-surface-0 p-2.5 shadow-inner-e1">
            <div className="grid grid-cols-3 gap-2.5">
              {reels.map((symbol, index) => (
                <SlotReel
                  key={index}
                  mode={reelMode(index)}
                  resultSymbol={typeof symbol === "number" ? symbol : 0}
                  symbolLabel={symbolLabel}
                  reduced={prefersReducedMotion}
                  spinDurationMs={360 + index * 60}
                />
              ))}
            </div>

            {/* Edge vignettes — clip the symbols like a real reel window */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-surface-0 via-surface-0/70 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface-0 via-surface-0/70 to-transparent"
            />
            {/* Glass sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-fg/10 via-transparent to-transparent"
            />

            {/* Payline */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1/2 z-20 -translate-y-1/2"
              animate={isWin && !prefersReducedMotion ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
              transition={isWin ? { duration: 0.7, repeat: 2 } : { duration: 0.2 }}
              style={{ height: 2 }}
            >
              <div
                className={cn(
                  "h-full w-full rounded-full",
                  isWin ? "bg-accent shadow-glow" : "bg-brand/70"
                )}
              />
              <span
                className={cn(
                  "absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45",
                  isWin ? "bg-accent" : "bg-brand/70"
                )}
              />
              <span
                className={cn(
                  "absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45",
                  isWin ? "bg-accent" : "bg-brand/70"
                )}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ---- Paytable strip ---- */}
      <div className="grid w-full max-w-xl grid-cols-8 gap-1.5">
        {SLOT_SYMBOLS.map((symbol, index) => (
          <div
            key={symbol.id}
            className={cn(
              "flex flex-col items-center rounded-md border bg-surface-1 px-1 py-1.5 transition-colors",
              allStopped && symbols.includes(index)
                ? "border-brand/45 bg-brand-soft"
                : "border-border"
            )}
          >
            <SlotSymbolArt value={index} size="xs" label={symbolLabel(index)} />
          </div>
        ))}
      </div>

      {/* ---- Status readout ---- */}
      <div
        className={cn(
          "rounded-lg border bg-surface-1 px-5 py-2.5 text-center shadow-e1",
          isWin ? "border-accent/45" : "border-border"
        )}
        aria-live="polite"
      >
        <p
          className={cn(
            "font-mono text-xs font-semibold uppercase tracking-[0.18em]",
            isWin ? "text-accent" : "text-fg-subtle"
          )}
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
