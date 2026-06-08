import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { SLOT_SYMBOLS, SlotSymbolArt } from "./slot-symbol";
import { SlotReel, type SlotReelMode } from "./slot-reel";

/**
 * SlotsStage — a slot machine inside the shared game console.
 *
 * The three reels stay a recessed deck with a marquee, a brand payline, edge
 * vignettes and a glass sheen. Each reel is a framer-motion symbol strip that
 * scrolls and spring-decelerates onto the payline (see SlotReel). The staggered
 * stop timing and the VRF reveal state machine are unchanged — only the cabinet
 * chrome was rebuilt into the shared console language.
 */

/** Hairline section divider that fades out at both ends. */
function Divider() {
  return (
    <div
      aria-hidden
      className="mx-5 h-px"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)" }}
    />
  );
}

export function SlotsStage({
  isPending,
  isRevealing,
  showResult,
  symbols,
  onRevealComplete
}: {
  isPending: boolean;
  controlsLocked?: boolean;
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
    <div className="relative z-10 w-full min-w-0 overflow-visible lg:absolute lg:inset-0 lg:overflow-y-auto lg:custom-scrollbar">
      {/* Stage atmosphere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 80% at 50% -8%, hsl(var(--surface-2)), hsl(var(--surface-0)) 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[620px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.13), transparent 68%)" }}
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-4">
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />

          {/* Marquee. */}
          <div className="px-5 pb-3 pt-4">
            <div
              className="flex items-center justify-center rounded-lg border border-border-soft py-2 shadow-inner-e1"
              style={{
                background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
              }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-fg-muted">
                {t("casino.room.stage.slots.classic")}
              </span>
            </div>
          </div>

          {/* Reel deck — recessed. */}
          <div className="px-5 pb-4">
            <div
              className="relative overflow-hidden rounded-xl border border-border-soft bg-surface-0 p-2.5"
              style={{ boxShadow: "inset 0 2px 14px hsl(var(--surface-0) / 0.6)" }}
            >
              <div className="grid grid-cols-3 gap-2.5">
                {reels.map((symbol, index) => (
                  <SlotReel
                    key={index}
                    mode={reelMode(index)}
                    resultSymbol={typeof symbol === "number" ? symbol : 0}
                    symbolLabel={symbolLabel}
                    spinningLabel={t("casino.room.stage.slots.spinning")}
                    reduced={prefersReducedMotion}
                    spinDurationMs={360 + index * 60}
                  />
                ))}
              </div>

              {/* Edge vignettes — clip the symbols like a real reel window. */}
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

          <Divider />

          {/* Paytable + status. */}
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="grid grid-cols-8 gap-1.5">
              {SLOT_SYMBOLS.map((symbol, index) => {
                const lit = allStopped && symbols.includes(index);
                return (
                  <div
                    key={symbol.id}
                    className={cn(
                      "flex flex-col items-center rounded-md px-1 py-1.5 transition-[background-color,box-shadow]",
                      lit
                        ? "bg-brand-soft ring-1 ring-inset ring-brand/40"
                        : "bg-surface-2 ring-1 ring-inset ring-border-soft"
                    )}
                  >
                    <SlotSymbolArt value={index} size="xs" label={symbolLabel(index)} />
                  </div>
                );
              })}
            </div>

            <p
              aria-live="polite"
              className={cn(
                "text-center font-mono text-xs font-semibold uppercase tracking-[0.18em]",
                isWin ? "text-accent" : "text-fg-subtle"
              )}
            >
              {statusText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
