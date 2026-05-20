import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainSportsMarket, DomainSportsResult } from "@ssot/ssot";

import { OutcomeButton } from "./OutcomeButton";
import { providerOutcomeById, type SportsbookProviderOdds } from "./provider-odds";

interface DescribedOutcome {
  outcomeId: number;
  label: string;
  sublabel?: string;
  price?: string;
}

function describe(
  market: DomainSportsMarket,
  odds: SportsbookProviderOdds | undefined,
  t: ReturnType<typeof useTranslations>
): DescribedOutcome[] {
  const count = market.outcomeCount;
  return Array.from({ length: count }, (_, outcomeId) => {
    const provider = providerOutcomeById(odds, outcomeId);
    if (provider) {
      return {
        outcomeId,
        label: provider.name,
        sublabel:
          provider.side === "home"
            ? t("outcomeSide.home")
            : provider.side === "draw"
              ? t("outcomeSide.draw")
              : provider.side === "away"
                ? t("outcomeSide.away")
                : undefined,
        price: provider.decimalPrice
      };
    }
    // Fallback labels when the provider snapshot is missing.
    if (count === 2) {
      return {
        outcomeId,
        label: outcomeId === 0 ? t("fallback.binaryYes") : t("fallback.binaryNo")
      };
    }
    if (count === 3) {
      return {
        outcomeId,
        label:
          outcomeId === 0
            ? t("fallback.threeWayHome")
            : outcomeId === 1
              ? t("fallback.threeWayDraw")
              : t("fallback.threeWayAway")
      };
    }
    return { outcomeId, label: t("fallback.generic", { outcomeId: outcomeId + 1 }) };
  });
}

/**
 * OutcomesBoard — the main odds canvas on the market detail page.
 *
 * Visual contract: one prominent outcome button per outcome, laid out in a
 * dense grid that adapts to outcome count (2 columns for binary, 3 columns
 * for moneyline, auto for higher arity). The board is the primary affordance
 * for "pick a side"; the BetSlip is the affordance for "confirm and place".
 *
 * When the market has a published result the winning outcome is highlighted
 * in success tone and locked from re-selection.
 */
export function OutcomesBoard({
  market,
  odds,
  result,
  selectedOutcomeId,
  onSelect,
  disabled
}: {
  market: DomainSportsMarket;
  odds?: SportsbookProviderOdds;
  result?: DomainSportsResult;
  selectedOutcomeId?: number;
  onSelect: (outcomeId: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("sportsbook.player.detail.board");
  const outcomes = React.useMemo(() => describe(market, odds, t), [market, odds, t]);
  const resultReady = Boolean(result && result.proposedAt > 0);
  const winningOutcomeId = resultReady ? Number(result?.winningOutcomeId ?? -1) : undefined;

  const cols =
    market.outcomeCount === 2
      ? "grid-cols-2"
      : market.outcomeCount === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fg-subtle">
          {resultReady ? t("titleResolved") : t("title")}
        </h2>
        {odds?.provider.marketLastUpdate ? (
          <span className="text-xs text-fg-subtle">
            {t("snapshotTime", { time: formatTime(odds.provider.marketLastUpdate) })}
          </span>
        ) : null}
      </header>

      <div className={`grid gap-2 ${cols}`}>
        {outcomes.map((outcome) => {
          const isWinner = winningOutcomeId === outcome.outcomeId;
          const isSelected = selectedOutcomeId === outcome.outcomeId;
          return (
            <OutcomeButton
              key={outcome.outcomeId}
              label={outcome.label}
              sublabel={
                isWinner
                  ? t("winner")
                  : (outcome.sublabel ?? t("outcomeShort", { outcomeId: outcome.outcomeId + 1 }))
              }
              price={outcome.price}
              selected={isSelected || isWinner}
              disabled={disabled || resultReady}
              onClick={resultReady ? undefined : () => onSelect(outcome.outcomeId)}
              className={isWinner ? "border-success bg-success-soft text-fg" : undefined}
            />
          );
        })}
      </div>

      {!odds && !resultReady ? (
        <p className="mt-3 text-xs text-fg-muted">{t("oddsPending")}</p>
      ) : null}
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en", { timeStyle: "short", hour12: false }).format(d);
  } catch {
    return iso;
  }
}
