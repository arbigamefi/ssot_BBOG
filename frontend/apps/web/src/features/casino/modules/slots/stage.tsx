import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

const SLOT_SYMBOLS = [
  { mark: "CH" },
  { mark: "LE" },
  { mark: "BE" },
  { mark: "DI" },
  { mark: "CR" },
  { mark: "ST" },
  { mark: "BA" },
  { mark: "7" }
] as const;

function symbolFor(value: number | undefined) {
  return SLOT_SYMBOLS[value ?? -1] ?? { mark: "—" };
}

function positiveMod(value: number, mod: number) {
  return ((value % mod) + mod) % mod;
}

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
  const prefersReducedMotion = useReducedMotion();
  const symbolsKey = symbols.join(",");
  const reels = React.useMemo(() => [symbols[0], symbols[1], symbols[2]], [symbolsKey]);
  const hasFinalSymbols = reels.every((symbol) => typeof symbol === "number");
  const [spinFrame, setSpinFrame] = React.useState(0);
  const [stoppedReels, setStoppedReels] = React.useState(() =>
    showResult && hasFinalSymbols ? 3 : 0
  );
  const allStopped = hasFinalSymbols && (stoppedReels >= 3 || (showResult && !isRevealing));
  const symbolResult = reels
    .filter((symbol): symbol is number => typeof symbol === "number")
    .map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`))
    .join(" / ");

  React.useEffect(() => {
    if (!isRevealing || !hasFinalSymbols) {
      setStoppedReels(showResult && hasFinalSymbols ? 3 : 0);
      return;
    }

    setStoppedReels(0);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(callback, delay);
      timeouts.push(timeout);
    };

    if (prefersReducedMotion) {
      setStoppedReels(3);
      schedule(() => onRevealComplete?.(), 180);
      return () => {
        timeouts.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    const interval = window.setInterval(() => {
      setSpinFrame((frame) => frame + 1);
    }, 90);
    schedule(() => setStoppedReels(1), 900);
    schedule(() => setStoppedReels(2), 1_500);
    schedule(() => setStoppedReels(3), 2_100);
    schedule(() => {
      onRevealComplete?.();
    }, 2_380);

    return () => {
      window.clearInterval(interval);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [
    hasFinalSymbols,
    isRevealing,
    onRevealComplete,
    prefersReducedMotion,
    showResult,
    symbolsKey
  ]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-14">
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-7">
        <div className="grid w-full max-w-2xl grid-cols-3 gap-4 rounded-xl border border-border bg-surface-1 p-5 shadow-e2">
          {reels.map((symbol, index) => {
            const stopped =
              hasFinalSymbols && (stoppedReels > index || (showResult && !isRevealing));
            const centerSymbol = stopped
              ? (symbol ?? 0)
              : positiveMod(spinFrame + index * 3, SLOT_SYMBOLS.length);
            return (
              <div
                key={index}
                className={cn(
                  "relative flex h-36 flex-col items-center justify-center overflow-hidden rounded-lg border bg-surface-2 shadow-inner-e1 md:h-40",
                  (isPending || (isRevealing && !stopped)) && "border-brand/40",
                  stopped && "border-accent/50 bg-accent-soft"
                )}
              >
                <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-border-soft" />
                <div
                  className={cn(
                    "flex flex-col items-center gap-2 transition-transform duration-200",
                    isRevealing && !stopped && "animate-[slots-reel-spin_360ms_linear_infinite]",
                    stopped && "animate-[slots-reel-stop_300ms_ease-out]"
                  )}
                >
                  {[-1, 0, 1].map((offset) => {
                    const value = stopped
                      ? positiveMod((centerSymbol ?? 0) + offset, SLOT_SYMBOLS.length)
                      : positiveMod(centerSymbol + offset, SLOT_SYMBOLS.length);
                    const meta = symbolFor(value);
                    const isCenter = offset === 0;
                    return (
                      <div
                        key={offset}
                        className={cn(
                          "flex min-h-9 flex-col items-center justify-center rounded-md px-4 transition-opacity",
                          isCenter ? "opacity-100" : "opacity-35"
                        )}
                      >
                        <span
                          className={cn(
                            "font-mono font-semibold text-fg",
                            isCenter ? "text-5xl" : "text-2xl"
                          )}
                        >
                          {meta.mark}
                        </span>
                        {isCenter && (
                          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
                            {t(`casino.room.selection.slots.symbols.${value}`)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid w-full max-w-2xl grid-cols-4 gap-2">
          {SLOT_SYMBOLS.map((symbol, index) => (
            <div
              key={symbol.mark}
              className={cn(
                "rounded-md border border-border bg-surface-1 px-2 py-2 text-center shadow-inner-e1",
                allStopped && symbols.includes(index) && "border-brand/40 bg-brand-soft"
              )}
            >
              <div className="font-mono text-sm font-semibold text-fg">{symbol.mark}</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-fg-subtle">
                {t(`casino.room.selection.slots.symbols.${index}`)}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.slots.spinning")
              : isRevealing
                ? t("casino.room.stage.slots.spinning")
                : allStopped
                  ? t("casino.room.stage.slots.result", { symbols: symbolResult })
                  : t("casino.room.stage.slots.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold uppercase tracking-widest text-fg">
            {t("casino.room.stage.slots.classic")}
          </p>
        </div>
      </div>
    </div>
  );
}
