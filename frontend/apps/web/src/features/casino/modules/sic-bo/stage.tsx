import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import type { SicBoKind } from "../../room/params";

type SicBoRoll = Extract<CasinoOutcome, { kind: "sic-bo" }>["rolls"][number];

function formatSicBoBet(kind: SicBoKind, value: number, t: ReturnType<typeof useTranslations>) {
  const label = t(`casino.room.selection.sicBo.kinds.${kind}`);
  if (kind === "total") return `${label} ${value}`;
  if (kind === "specificTriple" || kind === "specificDouble" || kind === "singleFace") {
    return `${label} ${value}`;
  }
  return label;
}

function DieFace({ value, active }: { value: number | undefined; active: boolean }) {
  return (
    <div
      className={cn(
        "flex h-28 w-28 items-center justify-center rounded-lg border bg-surface-2 shadow-inner-e1",
        active ? "border-accent/60 bg-accent-soft" : "border-border"
      )}
    >
      <span className={cn("font-mono text-5xl font-black", active ? "text-accent" : "text-fg")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function SicBoStage({
  isPending,
  showResult,
  betKind,
  betValue,
  outcome
}: {
  isPending: boolean;
  showResult: boolean;
  betKind: SicBoKind;
  betValue: number;
  outcome?: Extract<CasinoOutcome, { kind: "sic-bo" }> | null;
}) {
  const t = useTranslations();
  const roll: SicBoRoll | undefined = outcome?.rolls.at(-1);
  const hasResult = Boolean(showResult && roll);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.07)_0%,transparent_62%)]" />
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface-1 p-5 shadow-e2">
          {[0, 1, 2].map((index) => (
            <DieFace
              key={index}
              value={roll?.dice[index]}
              active={Boolean(hasResult && roll?.won)}
            />
          ))}
        </div>

        <div className="grid w-full max-w-xl grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.total")}
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-fg">{roll?.total ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.triple")}
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-fg">
              {roll == null
                ? "—"
                : roll.triple
                  ? t("casino.room.selection.slots.yes")
                  : t("casino.room.selection.slots.no")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.result")}
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-2xl font-black",
                roll?.won ? "text-success" : hasResult ? "text-danger" : "text-fg"
              )}
            >
              {roll == null
                ? "—"
                : roll.won
                  ? t("casino.room.result.outcomes.win.label")
                  : t("casino.room.result.outcomes.loss.label")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.sicBo.rolling")
              : hasResult
                ? t("casino.room.stage.sicBo.opened", { dice: roll?.dice.join(" / ") ?? "—" })
                : t("casino.room.stage.sicBo.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-black uppercase tracking-widest text-fg">
            {formatSicBoBet(betKind, betValue, t)}
          </p>
        </div>
      </div>
    </div>
  );
}
