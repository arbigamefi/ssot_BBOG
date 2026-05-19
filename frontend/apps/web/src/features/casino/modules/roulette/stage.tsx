import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { EUROPEAN_WHEEL_ORDER, RED_NUMBER_SET } from "../../room/model";

export function RouletteStage({
  isPending,
  showResult,
  resultNum,
  spots,
  onChange
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  spots: readonly string[];
  onChange: (spots: string[]) => void;
}) {
  const t = useTranslations();
  const selectedCountLabel =
    spots.length === 0 ? t("casino.room.selection.roulette.empty") : spots.join(" / ");

  const toggleSpot = React.useCallback(
    (spot: string) => {
      onChange(spots.includes(spot) ? spots.filter((s) => s !== spot) : [...spots, spot]);
    },
    [onChange, spots]
  );

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
          disabled={isPending || showResult || spots.length === 0}
          onClick={() => onChange([])}
          className="rounded-lg border border-border bg-surface-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:opacity-50"
        >
          {t("casino.room.selection.roulette.clearAll")}
        </button>
      </div>

      <div className="relative z-10 flex-1 w-full flex items-center justify-center min-h-[220px]">
        <div className="absolute top-0 inset-x-0 h-32 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand)/0.06),transparent_70%)] pointer-events-none" />

        <div className="relative flex h-[280px] w-[280px] transform-gpu items-center justify-center rounded-full border-[10px] border-surface-3 bg-surface-1 p-1 shadow-e3 ring-2 ring-brand/40 md:h-[340px] md:w-[340px] md:border-[16px] md:p-2 lg:h-[380px] lg:w-[380px]">
          <div
            className={cn(
              "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-brand/25 transition-[transform,filter] duration-[3000ms]",
              isPending
                ? "animate-[spin_4s_cubic-bezier(0.1,0.7,0.1,1)_forwards] blur-[0.5px]"
                : "rotate-0"
            )}
            style={{
              background: `conic-gradient(from -4.86deg, ${EUROPEAN_WHEEL_ORDER.map((num, i) => {
                const color =
                  num === 0
                    ? "hsl(var(--success))"
                    : RED_NUMBER_SET.has(num)
                      ? "hsl(var(--danger))"
                      : "hsl(var(--surface-2))";
                const deg = 360 / 37;
                return `${color} ${i * deg}deg ${(i + 1) * deg}deg`;
              }).join(", ")})`
            }}
          >
            <div className="absolute inset-0 rounded-full flex items-center justify-center">
              {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                <div
                  key={num}
                  className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                  style={{ transform: `rotate(${i * (360 / 37)}deg)` }}
                >
                  <div className="mt-0.5 flex h-[40px] w-[20px] items-center justify-center font-mono text-[10px] font-semibold text-fg md:mt-2 md:h-[50px] md:text-[14px] lg:h-[55px] lg:text-[16px]">
                    {num}
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
              {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                <div
                  key={`fret-${num}`}
                  className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                  style={{ transform: `rotate(${i * (360 / 37) + 360 / 37 / 2}deg)` }}
                >
                  <div className="h-[60px] w-[2px] bg-gradient-to-b from-accent via-brand to-transparent md:h-[80px]" />
                </div>
              ))}
            </div>

            <div className="absolute left-1/2 top-1/2 z-10 flex h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-surface-3 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--accent)),hsl(var(--brand))_70%,hsl(var(--surface-2)))] shadow-e3 md:h-[240px] md:w-[240px]">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-0 shadow-e1 md:h-28 md:w-28">
                <div className="h-10 w-10 rounded-full border border-border bg-gradient-to-br from-fg-muted via-fg to-fg-subtle shadow-e2" />
              </div>
              {[0, 45, 90, 135].map((deg) => (
                <div
                  key={deg}
                  className="absolute h-[12px] w-full bg-accent/20 mix-blend-overlay blur-[0.5px]"
                  style={{ transform: `rotate(${deg}deg)` }}
                />
              ))}
            </div>

            <div className="absolute left-1/2 top-1/2 z-0 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/20 bg-surface-0/60 shadow-inner md:h-[260px] md:w-[260px] lg:h-[290px] lg:w-[290px]" />
          </div>

          <div
            className={cn(
              "absolute inset-0 rounded-full z-20 pointer-events-none transition-transform",
              isPending ? "animate-[spin_2s_linear_infinite_reverse]" : "duration-1000 ease-out"
            )}
            style={
              !isPending && showResult && resultNum !== null
                ? {
                    transform: `rotate(${EUROPEAN_WHEEL_ORDER.indexOf(resultNum) * (360 / 37)}deg)`
                  }
                : {}
            }
          >
            <div
              className={cn(
                "absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-fg transition-[top,transform,filter] md:h-5 md:w-5",
                isPending
                  ? "top-[12px] scale-125 blur-[1.5px] duration-[2000ms] md:top-[16px]"
                  : "top-[40px] scale-100 duration-1000 md:top-[50px] lg:top-[55px]"
              )}
            />
          </div>
        </div>
      </div>

      <div className="relative z-20 w-fit max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar pointer-events-auto transform-gpu origin-bottom scale-[0.85] sm:scale-95 xl:scale-100 pb-2 px-1">
        <div className="relative flex min-w-[500px] flex-col gap-1.5 overflow-hidden rounded-lg border-[4px] border-border bg-surface-1 p-2 shadow-e3 sm:p-4 md:min-w-fit md:p-3">
          <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-25 pointer-events-none mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none" />

          <div className="flex">
            <button
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
