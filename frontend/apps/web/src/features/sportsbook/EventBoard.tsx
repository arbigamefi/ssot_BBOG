import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainSportsMarket } from "@ssot/ssot";

import { EventCard } from "./EventCard";
import { bucketMarket, describeMarketWallClock, type SportsMarketBucket } from "./player-format";
import type { SportsbookProviderOdds } from "./provider-odds";

export interface EventBoardEntry {
  market: DomainSportsMarket;
  odds?: SportsbookProviderOdds;
  href: string;
}

export type EventBoardFilter = "all" | SportsMarketBucket;

interface SortedBuckets {
  live: EventBoardEntry[];
  today: EventBoardEntry[];
  upcoming: EventBoardEntry[];
  past: EventBoardEntry[];
}

const ORDER: Array<keyof SortedBuckets> = ["live", "today", "upcoming", "past"];

function partition(
  entries: readonly EventBoardEntry[],
  now: number,
  locale: string
): SortedBuckets {
  const buckets: SortedBuckets = { live: [], today: [], upcoming: [], past: [] };
  for (const entry of entries) {
    const clock = describeMarketWallClock(entry.market, now, locale);
    const bucket: SportsMarketBucket = bucketMarket(clock, now);
    buckets[bucket].push(entry);
  }
  buckets.live.sort((a, b) => {
    const ar = describeMarketWallClock(a.market, now).msRemaining ?? 0;
    const br = describeMarketWallClock(b.market, now).msRemaining ?? 0;
    return ar - br;
  });
  buckets.today.sort((a, b) => Number(a.market.startsAt) - Number(b.market.startsAt));
  buckets.upcoming.sort((a, b) => Number(a.market.startsAt) - Number(b.market.startsAt));
  buckets.past.sort((a, b) => Number(b.market.startsAt) - Number(a.market.startsAt));
  return buckets;
}

/**
 * EventBoard — the body of the public sportsbook page. Groups events into the
 * four wall-clock buckets that the player thinks in: live now, today,
 * upcoming, past. Empty buckets are hidden; the section header counts each
 * bucket so the player can scan availability at a glance.
 */
export function EventBoard({
  entries,
  filter = "all",
  locale,
  showPast = false
}: {
  entries: readonly EventBoardEntry[];
  filter?: EventBoardFilter;
  locale: string;
  showPast?: boolean;
}) {
  const t = useTranslations("sportsbook.player.board");
  const now = React.useMemo(() => Date.now(), []);
  const buckets = React.useMemo(() => partition(entries, now, locale), [entries, now, locale]);

  return (
    <div className="flex flex-col gap-8">
      {ORDER.map((bucket) => {
        if (filter !== "all" && filter !== bucket) return null;
        if (bucket === "past" && filter !== "past" && !showPast) return null;
        const rows = buckets[bucket];
        if (rows.length === 0) return null;
        return (
          <section key={bucket} className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                {t(`bucket.${bucket}`)}
              </h2>
              <span className="font-mono text-xs tabular-nums text-fg-subtle">
                {t("count", { count: rows.length })}
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {rows.map((entry) => (
                <EventCard
                  key={entry.market.marketId.toString()}
                  market={entry.market}
                  odds={entry.odds}
                  href={entry.href}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
