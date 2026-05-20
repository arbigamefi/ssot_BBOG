import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

const SLOT_SYMBOLS = [
  { id: "cherry", tone: "text-danger" },
  { id: "lemon", tone: "text-accent" },
  { id: "bell", tone: "text-brand" },
  { id: "diamond", tone: "text-success" },
  { id: "crown", tone: "text-warn" },
  { id: "star", tone: "text-fg" },
  { id: "bar", tone: "text-fg-muted" },
  { id: "seven", tone: "text-brand" }
] as const;

function symbolFor(value: number | undefined) {
  return SLOT_SYMBOLS[value ?? -1] ?? null;
}

function positiveMod(value: number, mod: number) {
  return ((value % mod) + mod) % mod;
}

function SlotSymbolArt({
  value,
  size = "lg",
  label
}: {
  value: number | undefined;
  size?: "xs" | "sm" | "lg";
  label: string;
}) {
  const meta = symbolFor(value);
  const sizeClass =
    size === "xs" ? "h-7 w-7" : size === "sm" ? "h-10 w-10" : "h-20 w-20 md:h-24 md:w-24";

  if (!meta) {
    return (
      <span
        className={cn("font-mono font-semibold text-fg", size === "lg" ? "text-5xl" : "text-2xl")}
      >
        —
      </span>
    );
  }

  const iconClass = cn(sizeClass, meta.tone, "drop-shadow-[0_12px_24px_hsl(var(--brand)/0.24)]");

  return (
    <span className="relative inline-flex items-center justify-center" aria-label={label}>
      <span className="sr-only">{label}</span>
      {meta.id === "cherry" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M50 35c5-14 13-24 27-27"
            fill="none"
            stroke="hsl(var(--success))"
            strokeLinecap="round"
            strokeWidth="7"
          />
          <path
            d="M39 41c1-14 7-25 21-33"
            fill="none"
            stroke="hsl(var(--success))"
            strokeLinecap="round"
            strokeWidth="7"
          />
          <circle cx="34" cy="62" r="20" fill="currentColor" />
          <circle cx="63" cy="58" r="18" fill="currentColor" opacity="0.82" />
          <circle cx="26" cy="54" r="5" fill="hsl(var(--fg) / 0.72)" />
        </svg>
      )}
      {meta.id === "lemon" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M18 50c10-26 36-38 62-32 8 24-4 51-32 62-19-4-30-14-30-30Z"
            fill="currentColor"
          />
          <path
            d="M28 48c9-14 22-22 41-23"
            fill="none"
            stroke="hsl(var(--surface-0) / 0.55)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M50 80c-14-7-23-17-32-30"
            fill="none"
            stroke="hsl(var(--surface-0) / 0.32)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "bell" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M25 70h46c-7-8-8-16-8-30 0-13-7-22-15-22s-15 9-15 22c0 14-1 22-8 30Z"
            fill="currentColor"
          />
          <path d="M38 72c2 8 6 12 10 12s8-4 10-12H38Z" fill="currentColor" opacity="0.7" />
          <path d="M42 15h12l-3 9h-6l-3-9Z" fill="currentColor" opacity="0.75" />
          <path
            d="M36 40c0-8 4-14 11-17"
            fill="none"
            stroke="hsl(var(--fg) / 0.7)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "diamond" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path d="M48 8 82 48 48 88 14 48 48 8Z" fill="currentColor" />
          <path d="M48 8 60 48 48 88 36 48 48 8Z" fill="hsl(var(--surface-0) / 0.24)" />
          <path d="M14 48h68" stroke="hsl(var(--fg) / 0.52)" strokeWidth="4" />
          <path
            d="M28 31h40"
            stroke="hsl(var(--fg) / 0.42)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "crown" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path d="M16 73h64l6-44-22 18L48 20 32 47 10 29l6 44Z" fill="currentColor" />
          <path d="M20 80h56" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
          <circle cx="48" cy="20" r="6" fill="currentColor" />
          <path
            d="M28 62h40"
            stroke="hsl(var(--surface-0) / 0.45)"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      )}
      {meta.id === "star" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="m48 8 11 26 28 2-21 18 7 27-25-15-25 15 7-27L9 36l28-2L48 8Z"
            fill="currentColor"
          />
          <path
            d="M48 25 54 40l16 2"
            fill="none"
            stroke="hsl(var(--brand) / 0.68)"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      )}
      {meta.id === "bar" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          {[23, 42, 61].map((y) => (
            <rect key={y} x="15" y={y} width="66" height="13" rx="4" fill="currentColor" />
          ))}
          <path
            d="M24 29h48M24 48h48M24 67h48"
            stroke="hsl(var(--surface-0) / 0.52)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
      )}
      {meta.id === "seven" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M22 18h52L44 82H25l25-49H22V18Z"
            fill="currentColor"
            stroke="hsl(var(--fg) / 0.55)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path d="M36 47h24" stroke="hsl(var(--fg) / 0.7)" strokeLinecap="round" strokeWidth="5" />
        </svg>
      )}
    </span>
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
                        <SlotSymbolArt
                          value={meta ? value : undefined}
                          size={isCenter ? "lg" : "sm"}
                          label={t(`casino.room.selection.slots.symbols.${value}`)}
                        />
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
              key={symbol.id}
              className={cn(
                "flex flex-col items-center rounded-md border border-border bg-surface-1 px-2 py-2 text-center shadow-inner-e1",
                allStopped && symbols.includes(index) && "border-brand/40 bg-brand-soft"
              )}
            >
              <SlotSymbolArt
                value={index}
                size="xs"
                label={t(`casino.room.selection.slots.symbols.${index}`)}
              />
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
