import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "../../room/model";
import { RouletteWheel, type RouletteWheelMode } from "./roulette-wheel";

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
    case "col1":
      return t("casino.room.selection.roulette.labels.firstColumn");
    case "col2":
      return t("casino.room.selection.roulette.labels.secondColumn");
    case "col3":
      return t("casino.room.selection.roulette.labels.thirdColumn");
    default:
      return bet;
  }
}

type BetTone = "red" | "black" | "zero" | "neutral";
// `covered` is the soft indicator a number/column cell gets when it's caught
// by some outside-bet selection (RED/BLACK, dozens, columns…) but the user
// hasn't directly clicked it. Direct selection still wins visually.
type BetStatus = "idle" | "covered" | "selected" | "won" | "result" | "lost";

function numberTone(num: number): BetTone {
  if (num === 0) return "zero";
  return RED_NUMBER_SET.has(num) ? "red" : "black";
}

/** Whether the settled wheel number `n` satisfies bet `spot`. */
function betResultHit(spot: string, n: number): boolean {
  if (/^\d+$/.test(spot)) return Number(spot) === n;
  switch (spot) {
    case "RED":
      return RED_NUMBER_SET.has(n);
    case "BLACK":
      return n !== 0 && !RED_NUMBER_SET.has(n);
    case "EVEN":
      return n !== 0 && n % 2 === 0;
    case "ODD":
      return n % 2 === 1;
    case "1-18":
      return n >= 1 && n <= 18;
    case "19-36":
      return n >= 19 && n <= 36;
    case "1st 12":
      return n >= 1 && n <= 12;
    case "2nd 12":
      return n >= 13 && n <= 24;
    case "3rd 12":
      return n >= 25 && n <= 36;
    case "col1":
      return n >= 1 && n % 3 === 1;
    case "col2":
      return n >= 2 && n % 3 === 2;
    case "col3":
      return n >= 3 && n % 3 === 0;
    default:
      return false;
  }
}

const TONE_BG: Record<BetTone, string> = {
  red: "bg-[linear-gradient(180deg,hsl(var(--danger)),hsl(var(--danger)/0.78))] text-fg",
  black: "bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-0)))] text-fg",
  zero: "bg-[linear-gradient(180deg,hsl(var(--success)),hsl(var(--success)/0.78))] text-fg-inverse",
  neutral: "bg-surface-2 text-fg-muted"
};

const STATUS_RING: Record<BetStatus, string> = {
  idle: "ring-1 ring-inset ring-border-soft",
  // Covered cells get a soft accent ring — visible but not as loud as a
  // direct selection. No lift, no glow.
  covered: "ring-2 ring-inset ring-accent/55",
  selected: "-translate-y-0.5 ring-2 ring-inset ring-brand shadow-glow",
  won: "-translate-y-0.5 ring-2 ring-inset ring-success",
  result: "ring-2 ring-inset ring-accent",
  lost: "opacity-40 ring-1 ring-inset ring-border-soft"
};

const STATUS_GLOW: Partial<Record<BetStatus, string>> = {
  won: "0 0 0 1px hsl(var(--success) / 0.6), 0 10px 24px -6px hsl(var(--success) / 0.5)",
  result: "0 0 0 1px hsl(var(--accent) / 0.55), 0 10px 24px -6px hsl(var(--accent) / 0.45)"
};

function BetCell({
  tone,
  status,
  disabled,
  onClick,
  ariaLabel,
  className,
  children
}: {
  tone: BetTone;
  status: BetStatus;
  disabled: boolean;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const glow = STATUS_GLOW[status];
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      style={glow ? { boxShadow: glow } : undefined}
      className={cn(
        "relative flex items-center justify-center rounded-md font-mono font-bold shadow-e1 transition-[transform,box-shadow,background-color,opacity,color]",
        TONE_BG[tone],
        STATUS_RING[status],
        status === "idle" &&
          !disabled &&
          "hover:-translate-y-0.5 hover:shadow-e2 hover:ring-brand/45",
        disabled && "cursor-default",
        className
      )}
    >
      {children}
    </button>
  );
}

export function RouletteStage({
  isPending,
  controlsLocked = false,
  isRevealing,
  showResult,
  resultNum,
  spots,
  onChange,
  onRevealComplete
}: {
  isPending: boolean;
  controlsLocked?: boolean;
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
  const locked = controlsLocked || spinning;
  const wheelMode: RouletteWheelMode = isRevealing
    ? "settling"
    : isPending
      ? "spinning"
      : showResult
        ? "settled"
        : "idle";
  const settled = showResult && !isRevealing && resultNum != null;

  const toggleSpot = React.useCallback(
    (spot: string) => {
      onChange(spots.includes(spot) ? spots.filter((s) => s !== spot) : [...spots, spot]);
    },
    [onChange, spots]
  );

  // Set of numbers (0-36) that are caught by any non-straight bet currently
  // in `spots`. Used to paint a soft "covered" indicator on number cells the
  // user hasn't directly clicked. Direct selections still take priority.
  const coveredNumbers = React.useMemo(() => {
    const set = new Set<number>();
    for (const s of spots) {
      if (/^\d+$/.test(s)) continue;
      for (let n = 0; n <= 36; n += 1) {
        if (betResultHit(s, n)) set.add(n);
      }
    }
    return set;
  }, [spots]);

  const spotStatus = React.useCallback(
    (spot: string): BetStatus => {
      const selected = spots.includes(spot);
      if (!settled || resultNum == null) {
        if (selected) return "selected";
        // Only apply the `covered` indicator to straight-number cells —
        // outside-bet buttons stay `idle` until clicked.
        if (/^\d+$/.test(spot) && coveredNumbers.has(Number(spot))) return "covered";
        return "idle";
      }
      const hit = betResultHit(spot, resultNum);
      if (hit && selected) return "won";
      if (hit) return "result";
      if (selected) return "lost";
      return "idle";
    },
    [coveredNumbers, resultNum, settled, spots]
  );

  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 2_400);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

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
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[640px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.12), transparent 68%)" }}
      />

      <div className="relative flex min-h-full items-start justify-center px-4 py-2 sm:items-center sm:py-3">
        <div
          data-roulette-stage-card
          className="relative w-full max-w-[680px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
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

          {/* Header — bet count caption and clear action. */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5 sm:py-2.5">
            <p className="truncate text-xs text-fg-muted">
              {spots.length === 0
                ? t("casino.room.selection.roulette.empty")
                : `${spots.length} ${t("casino.room.selection.roulette.bets")}`}
            </p>
            <button
              type="button"
              disabled={locked || spots.length === 0}
              onClick={() => onChange([])}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted ring-1 ring-inset ring-border transition-colors hover:text-fg disabled:opacity-40"
            >
              {t("casino.room.selection.roulette.clearAll")}
            </button>
          </div>

          <Divider />

          {/* Wheel — lights up while spinning. */}
          <div className="relative flex justify-center px-4 py-2 sm:px-5 sm:py-3">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500 sm:h-[300px] sm:w-[340px]"
              style={{
                opacity: spinning ? 1 : 0,
                background: "radial-gradient(circle, hsl(var(--brand) / 0.28), transparent 68%)"
              }}
            />
            {/* The 320px wheel is uniformly scaled to fit — smaller on phones,
                full on >=sm. Its coordinate system and ball physics are
                untouched (scale is a uniform transform). */}
            <div className="relative h-[184px] w-[184px] sm:h-[272px] sm:w-[272px]">
              <div className="absolute left-0 top-0 origin-top-left scale-[0.575] sm:scale-[0.85]">
                <RouletteWheel mode={wheelMode} resultNum={resultNum} reduced={reduced} />
              </div>
            </div>
          </div>

          <Divider />

          {/* Betting table — recessed felt, fully responsive (no scale hack). */}
          <div className="px-3 py-2.5 sm:px-5 sm:py-3">
            <div
              data-roulette-table
              className="overflow-x-auto rounded-lg p-2 [scrollbar-width:none] sm:p-3 [&::-webkit-scrollbar]:hidden"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--success) / 0.05), transparent 60%), hsl(var(--surface-0))",
                boxShadow: "inset 0 2px 12px hsl(var(--surface-0) / 0.55)"
              }}
            >
              <div className="mx-auto flex w-max flex-col gap-1 sm:gap-1.5">
                {/* Zero + number grid — the zero spans exactly the three rows. */}
                <div className="flex gap-1 sm:gap-1.5">
                  <BetCell
                    tone="zero"
                    status={spotStatus("0")}
                    disabled={locked}
                    onClick={() => toggleSpot("0")}
                    className="w-9 shrink-0 self-stretch text-base sm:w-10"
                  >
                    0
                  </BetCell>

                  <div className="flex flex-1 flex-col gap-1 sm:gap-1.5">
                    {[3, 2, 1].map((rN) => {
                      // Each row sits next to its column bet (rN=3 → col3,
                      // rN=2 → col2, rN=1 → col1). The column chip pays 2:1
                      // and covers the 12 numbers in that row.
                      const columnSpot = `col${rN}` as "col1" | "col2" | "col3";
                      return (
                        <div key={rN} className="flex gap-1 sm:gap-1.5">
                          {Array.from({ length: 12 }).map((_, cI) => {
                            const num = cI * 3 + rN;
                            return (
                              <BetCell
                                key={num}
                                tone={numberTone(num)}
                                status={spotStatus(String(num))}
                                disabled={locked}
                                onClick={() => toggleSpot(String(num))}
                                className="aspect-square w-8 shrink-0 text-xs sm:w-9"
                              >
                                {num}
                              </BetCell>
                            );
                          })}
                          <BetCell
                            tone="neutral"
                            status={spotStatus(columnSpot)}
                            disabled={locked}
                            onClick={() => toggleSpot(columnSpot)}
                            ariaLabel={getRouletteBetLabel(t, columnSpot)}
                            className="w-9 shrink-0 self-stretch text-[10px] font-semibold tracking-tight sm:w-10"
                          >
                            2:1
                          </BetCell>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dozens — aligned under the twelve number columns. */}
                <div className="flex gap-1 pl-[40px] pr-[40px] sm:gap-1.5 sm:pl-[46px] sm:pr-[46px]">
                  {["1st 12", "2nd 12", "3rd 12"].map((dozen) => (
                    <BetCell
                      key={dozen}
                      tone="neutral"
                      status={spotStatus(dozen)}
                      disabled={locked}
                      onClick={() => toggleSpot(dozen)}
                      className="h-6 flex-1 text-[9px] uppercase tracking-wide sm:h-7 sm:text-[10px]"
                    >
                      {getRouletteBetLabel(t, dozen)}
                    </BetCell>
                  ))}
                </div>

                {/* Outside bets. Right-side column 2:1 chips line up with
                    the column buttons, so we pad to the same total width
                    (40 + 6 = 46px gap each side). */}
                <div className="flex gap-1 pl-[40px] pr-[40px] sm:gap-1.5 sm:pl-[46px] sm:pr-[46px]">
                  {["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].map((bet) => (
                    <BetCell
                      key={bet}
                      tone="neutral"
                      status={spotStatus(bet)}
                      disabled={locked}
                      onClick={() => toggleSpot(bet)}
                      ariaLabel={getRouletteBetLabel(t, bet)}
                      className="h-6 flex-1 text-[8px] uppercase tracking-wide sm:h-7 sm:text-[10px]"
                    >
                      {bet === "RED" ? (
                        // Swatch + label for clarity — aria-label still wins
                        // for screen readers.
                        <span className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-sm bg-danger" />
                          <span>{getRouletteBetLabel(t, bet)}</span>
                        </span>
                      ) : bet === "BLACK" ? (
                        <span className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-sm bg-surface-0 ring-1 ring-inset ring-border" />
                          <span>{getRouletteBetLabel(t, bet)}</span>
                        </span>
                      ) : (
                        getRouletteBetLabel(t, bet)
                      )}
                    </BetCell>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
