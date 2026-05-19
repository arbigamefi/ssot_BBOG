import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DomainSportsMarket } from "@ssot/ssot";

import { MarketStateBadge } from "./MarketStateBadge";
import { describeMarketWallClock, marketShortTag } from "./player-format";
import type { SportsbookProviderOdds } from "./provider-odds";

/**
 * MarketDetailHeader — the visual frame at the top of `/sportsbook/[marketId]`.
 *
 * Replaces the previous SportsHub address + "Market detail" pill ribbon with
 * a player-grade event header:
 *   - back link to /sportsbook (keyboard reachable, not just a decoration)
 *   - team line (or short market tag fallback when provider odds are absent)
 *   - state pill that doubles as urgency cue
 *   - kickoff + lock time presented as the player would parse them
 *
 * No inspector chrome here; the previous "release digest" detail moves into
 * the verification drawer or /ops/sportsbook.
 */
export function MarketDetailHeader({
  market,
  odds
}: {
  market: DomainSportsMarket;
  odds?: SportsbookProviderOdds;
}) {
  const t = useTranslations("sportsbook.player.detail.header");
  const locale = useLocale();
  const clock = describeMarketWallClock(market, Date.now(), locale);
  const tag = marketShortTag(market.marketKey);
  const home = odds?.event.homeTeam;
  const away = odds?.event.awayTeam;
  const hasTeams = Boolean(home && away);

  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/sportsbook"
        className="inline-flex h-7 items-center gap-1.5 self-start text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="h-3.5 w-3.5"
        >
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <MarketStateBadge state={market.state} clock={clock} size="small" />
        <span aria-hidden>·</span>
        <span>{clock.label}</span>
        {odds?.provider.sportKey ? (
          <>
            <span aria-hidden>·</span>
            <span>{odds.provider.sportKey}</span>
          </>
        ) : null}
        {(odds?.provider.bookmakerTitle ?? odds?.provider.bookmakerKey) ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {t("bookmaker", {
                name: odds.provider.bookmakerTitle ?? odds.provider.bookmakerKey ?? ""
              })}
            </span>
          </>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-fg-subtle">#{tag}</span>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
        {hasTeams ? (
          <>
            <span>{away}</span>
            <span className="mx-3 text-fg-subtle">@</span>
            <span>{home}</span>
          </>
        ) : (
          t("fallback", { tag })
        )}
      </h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-fg-muted">
        <span>{t("kickoff", { time: clock.absolute })}</span>
        <span>{t("locks", { time: formatLocks(market.lockTime, locale) })}</span>
      </div>
    </header>
  );
}

function formatLocks(lockTime: number | bigint, locale: string): string {
  const ms = (typeof lockTime === "bigint" ? Number(lockTime) : lockTime) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}
