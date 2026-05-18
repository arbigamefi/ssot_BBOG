import * as React from "react";
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

export function SlotsStage({
  isPending,
  showResult,
  symbols
}: {
  isPending: boolean;
  showResult: boolean;
  symbols: readonly number[];
}) {
  const t = useTranslations();
  const reels = [symbols[0], symbols[1], symbols[2]];
  const hasResult = showResult && symbols.length === 3;
  const symbolResult = symbols
    .map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`))
    .join(" / ");

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.07)_0%,transparent_62%)]" />
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="grid w-full max-w-xl grid-cols-3 gap-4 rounded-xl border border-border bg-surface-1 p-5 shadow-e2">
          {reels.map((symbol, index) => {
            const meta = symbolFor(symbol);
            return (
              <div
                key={index}
                className={cn(
                  "flex h-36 flex-col items-center justify-center rounded-lg border bg-surface-2 shadow-inner-e1",
                  isPending && "animate-pulse border-brand/40",
                  hasResult && "border-accent/50 bg-accent-soft"
                )}
              >
                <span className="font-mono text-4xl font-black text-fg">{meta.mark}</span>
                <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
                  {symbol == null ? "—" : t(`casino.room.selection.slots.symbols.${symbol}`)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid w-full max-w-xl grid-cols-4 gap-2">
          {SLOT_SYMBOLS.map((symbol, index) => (
            <div
              key={symbol.mark}
              className={cn(
                "rounded-md border border-border bg-surface-1 px-2 py-2 text-center shadow-inner-e1",
                hasResult && symbols.includes(index) && "border-brand/40 bg-brand-soft"
              )}
            >
              <div className="font-mono text-sm font-black text-fg">{symbol.mark}</div>
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
              : hasResult
                ? t("casino.room.stage.slots.result", { symbols: symbolResult })
                : t("casino.room.stage.slots.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-black uppercase tracking-widest text-fg">
            {t("casino.room.stage.slots.classic")}
          </p>
        </div>
      </div>
    </div>
  );
}
