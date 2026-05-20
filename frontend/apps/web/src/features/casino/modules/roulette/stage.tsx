import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "../../room/model";
import { RouletteWheel, type RouletteWheelMode } from "./roulette-wheel";

export function RouletteStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  spots,
  onChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  spots: readonly string[];
  onChange: (spots: string[]) => void;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const reduced = useReducedMotion() ?? false;
  const spinning = isPending || Boolean(isRevealing);
  const wheelMode: RouletteWheelMode = isRevealing
    ? "settling"
    : isPending
      ? "spinning"
      : showResult
        ? "settled"
        : "idle";
  const selectedCountLabel =
    spots.length === 0 ? t("casino.room.selection.roulette.empty") : spots.join(" / ");

  const toggleSpot = React.useCallback(
    (spot: string) => {
      onChange(spots.includes(spot) ? spots.filter((s) => s !== spot) : [...spots, spot]);
    },
    [onChange, spots]
  );

  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 2_400);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pb-6 z-10 overflow-hidden">
      <div className="pointer-events-auto relative z-30 flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-border bg-surface-1/90 p-3 shadow-e2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-2xl font-semibold text-fg">
            {spots.length}{" "}
            <span className="text-sm uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.selection.roulette.bets")}
            </span>
          </div>
          <p className="mt-1 max-w-2xl truncate text-sm text-fg-muted">{selectedCountLabel}</p>
        </div>
        <button
          type="button"
          disabled={spinning || showResult || spots.length === 0}
          onClick={() => onChange([])}
          className="rounded-lg border border-border bg-surface-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50"
        >
          {t("casino.room.selection.roulette.clearAll")}
        </button>
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center min-h-[260px]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{
            background: "radial-gradient(ellipse at top, hsl(var(--brand) / 0.06), transparent 70%)"
          }}
        />
        <RouletteWheel mode={wheelMode} resultNum={resultNum} reduced={reduced} />
      </div>

      <div className="relative z-20 w-fit max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar pointer-events-auto transform-gpu origin-bottom scale-[0.85] sm:scale-95 xl:scale-100 pb-2 px-1">
        <div className="relative flex min-w-[500px] flex-col gap-1.5 overflow-hidden rounded-lg border-[4px] border-border bg-surface-1 p-2 shadow-e3 sm:p-4 md:min-w-fit md:p-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
            style={{ backgroundImage: "url('/textures/noise.svg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none" />

          <div className="flex">
            <button
              disabled={spinning || showResult}
              onClick={() => toggleSpot("0")}
              className={cn(
                "group relative flex w-10 items-center justify-center overflow-hidden rounded-l-lg border font-mono text-lg font-semibold transition-[border-color,background-color,color] sm:w-12 md:w-14 md:text-xl",
                spots.includes("0")
                  ? "z-10 border-success bg-success text-fg-inverse shadow-e2"
                  : "border-success/25 bg-success-soft text-success hover:bg-success/20"
              )}
            >
              <div className="relative z-10">0</div>
              {spots.includes("0") && (
                <div className="absolute inset-0 bg-gradient-to-tr from-fg/30 to-transparent animate-pulse" />
              )}
            </button>

            <div className="flex flex-col gap-1.5 ml-1.5">
              {[3, 2, 1].map((rN) => (
                <div key={rN} className="flex gap-1.5">
                  {Array.from({ length: 12 }).map((_, cI) => {
                    const num = cI * 3 + rN;
                    const isSelected = spots.includes(num.toString());
                    return (
                      <button
                        key={num}
                        disabled={spinning || showResult}
                        onClick={() => toggleSpot(num.toString())}
                        className={cn(
                          "group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-sm border font-mono text-xs font-semibold shadow-e1 transition-[border-color,background-color,color] sm:h-10 sm:w-10 md:h-11 md:w-11 md:text-sm",
                          isSelected
                            ? "z-10 border-fg bg-fg text-fg-inverse shadow-e2"
                            : RED_NUMBER_SET.has(num)
                              ? "border-danger/35 bg-danger-soft text-danger hover:bg-danger/20"
                              : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                        )}
                      >
                        <span className="relative z-10">{num}</span>
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-surface-0/5 to-transparent shadow-inner" />
                        )}
                      </button>
                    );
                  })}
                  <button className="w-10 rounded-r-md border border-border bg-surface-2 text-[9px] font-semibold uppercase tracking-tighter text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg sm:w-12 md:w-14 md:text-[10px]">
                    2:1
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px] mt-1">
            {["1st 12", "2nd 12", "3rd 12"].map((dozen) => (
              <button
                key={dozen}
                disabled={spinning || showResult}
                onClick={() => toggleSpot(dozen)}
                className={cn(
                  "relative flex-1 overflow-hidden rounded-md border py-1.5 text-[9px] font-semibold uppercase transition-[border-color,background-color,color] md:py-2 md:text-[11px]",
                  spots.includes(dozen)
                    ? "z-10 border-brand bg-brand text-fg-inverse shadow-e2"
                    : "border-border bg-surface-2 text-fg-subtle hover:bg-surface-3 hover:text-fg"
                )}
              >
                {getRouletteBetLabel(t, dozen)}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px]">
            {["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].map((outsideBet) => (
              <button
                key={outsideBet}
                disabled={spinning || showResult}
                onClick={() => toggleSpot(outsideBet)}
                aria-label={getRouletteBetLabel(t, outsideBet)}
                className={cn(
                  "relative flex flex-1 items-center justify-center overflow-hidden rounded-md border py-1.5 text-[8px] font-semibold uppercase shadow-inner transition-[border-color,background-color,color] md:py-2 md:text-[10px]",
                  spots.includes(outsideBet)
                    ? "z-10 border-brand bg-brand text-fg-inverse shadow-e2"
                    : "border-border bg-surface-2 text-fg-subtle hover:bg-surface-3 hover:text-fg"
                )}
              >
                {outsideBet === "RED" ? (
                  <div className="h-3 w-3 rounded-sm bg-danger md:h-4 md:w-4" />
                ) : outsideBet === "BLACK" ? (
                  <div className="h-3 w-3 rounded-sm bg-surface-0 md:h-4 md:w-4" />
                ) : (
                  getRouletteBetLabel(t, outsideBet)
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getRouletteBetLabel(t: (key: string) => string, bet: string) {
  switch (bet) {
    case "1st 12":
      return t("casino.room.selection.roulette.labels.firstDozen");
    case "2nd 12":
      return t("casino.room.selection.roulette.labels.secondDozen");
    case "3rd 12":
      return t("casino.room.selection.roulette.labels.thirdDozen");
    case "EVEN":
      return t("casino.room.selection.roulette.labels.even");
    case "RED":
      return t("casino.room.selection.roulette.labels.red");
    case "BLACK":
      return t("casino.room.selection.roulette.labels.black");
    case "ODD":
      return t("casino.room.selection.roulette.labels.odd");
    default:
      return bet;
  }
}
