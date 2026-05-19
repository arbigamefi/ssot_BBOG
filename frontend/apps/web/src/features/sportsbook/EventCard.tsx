import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DomainSportsMarket } from "@ssot/ssot";

import { MarketStateBadge } from "./MarketStateBadge";
import { OutcomeButton } from "./OutcomeButton";
import { describeMarketWallClock, marketShortTag } from "./player-format";
import type { SportsbookProviderOdds } from "./provider-odds";

/**
 * EventCard — single-event row used by the public sportsbook directory.
 *
 * Visual contract: at narrow widths each card stacks (title → odds);
 * at >= md widths the card becomes a single line — title block on the left,
 * three odds buttons on the right. Hover lifts subtly and the entire card is
 * clickable into the market detail.
 *
 * No "marketId" copy in the user-facing surface. Player sees a short tag and
 * either a team line (if provider odds are bound) or a fallback identity.
 */
export function EventCard({
  market,
  odds,
  href,
  onOutcomeClick,
  selectedOutcomeId
}: {
  market: DomainSportsMarket;
  odds?: SportsbookProviderOdds;
  href: string;
  onOutcomeClick?: (outcomeId: number) => void;
  selectedOutcomeId?: number;
}) {
  const t = useTranslations("sportsbook.player");
  const locale = useLocale();
  const clock = describeMarketWallClock(market, Date.now(), locale);
  const tag = marketShortTag(market.marketKey);

  const home = odds?.event.homeTeam;
  const away = odds?.event.awayTeam;
  const hasTeams = Boolean(home && away);

  const homeOutcome = odds?.outcomes.find((o) => o.side === "home");
  const drawOutcome = odds?.outcomes.find((o) => o.side === "draw");
  const awayOutcome = odds?.outcomes.find((o) => o.side === "away");

  return (
    <article className="group relative rounded-lg border border-border bg-surface-1 transition-colors hover:border-brand/30">
      <Link
        href={href}
        aria-label={hasTeams ? `${away} vs ${home}` : t("event.fallbackTitle", { tag })}
        className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
      />
      <div className="relative z-10 grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 md:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            <MarketStateBadge state={market.state} clock={clock} size="small" />
            <span aria-hidden>·</span>
            <span>{clock.label}</span>
            {odds?.provider.sportKey ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{odds.provider.sportKey}</span>
              </>
            ) : null}
            <span aria-hidden className="ml-auto">
              <span className="font-mono text-[11px] text-fg-subtle">#{tag}</span>
            </span>
          </div>
          <div className="mt-3">
            {hasTeams ? (
              <h3 className="truncate text-lg font-semibold leading-7 text-fg">
                <span>{away}</span>
                <span className="mx-2 text-fg-subtle">@</span>
                <span>{home}</span>
              </h3>
            ) : (
              <h3 className="truncate text-lg font-semibold leading-7 text-fg">
                {t("event.fallbackTitle", { tag })}
              </h3>
            )}
            <div className="mt-1 text-xs text-fg-muted">
              {t("event.kickoffAt", { time: clock.absolute })}
            </div>
          </div>
        </div>

        {odds ? (
          <div className="relative z-10 grid w-full grid-cols-3 gap-2 md:w-[360px]">
            <OutcomeButton
              size="small"
              label={t("event.outcomeShort.home")}
              sublabel={home ?? undefined}
              price={homeOutcome?.decimalPrice}
              selected={selectedOutcomeId === homeOutcome?.outcomeId}
              onClick={
                homeOutcome && onOutcomeClick
                  ? () => onOutcomeClick(homeOutcome.outcomeId)
                  : undefined
              }
            />
            <OutcomeButton
              size="small"
              label={t("event.outcomeShort.draw")}
              price={drawOutcome?.decimalPrice}
              selected={selectedOutcomeId === drawOutcome?.outcomeId}
              onClick={
                drawOutcome && onOutcomeClick
                  ? () => onOutcomeClick(drawOutcome.outcomeId)
                  : undefined
              }
              disabled={!drawOutcome}
            />
            <OutcomeButton
              size="small"
              label={t("event.outcomeShort.away")}
              sublabel={away ?? undefined}
              price={awayOutcome?.decimalPrice}
              selected={selectedOutcomeId === awayOutcome?.outcomeId}
              onClick={
                awayOutcome && onOutcomeClick
                  ? () => onOutcomeClick(awayOutcome.outcomeId)
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="text-xs text-fg-muted md:text-right">
            {t("event.outcomesPending", { count: market.outcomeCount })}
          </div>
        )}
      </div>
    </article>
  );
}
