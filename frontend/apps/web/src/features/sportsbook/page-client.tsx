"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DomainSportsMarket } from "@ssot/ssot";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

import { EmptyMarketsState } from "./EmptyMarketsState";
import { EventBoard, type EventBoardEntry, type EventBoardFilter } from "./EventBoard";
import { MarketStateBadge } from "./MarketStateBadge";
import {
  bucketMarket,
  describeMarketWallClock,
  marketShortTag,
  type SportsMarketBucket
} from "./player-format";
import type { SportsbookProviderOdds } from "./provider-odds";
import { useSportsbookProviderOdds } from "./use-provider-odds";

const PUBLIC_LIST_LIMIT = 24;

function buildRecentMarketIds(nextMarketId: bigint, limit: number) {
  if (nextMarketId <= 1n || limit <= 0) return [] as bigint[];
  const ids: bigint[] = [];
  let current = nextMarketId - 1n;
  while (current >= 1n && ids.length < limit) {
    ids.push(current);
    current -= 1n;
  }
  return ids;
}

interface EventBoardData {
  entries: EventBoardEntry[];
  source: "live" | "empty" | "preview";
}

function useSportsbookBoard(enabled: boolean): {
  data: EventBoardData | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const releaseDigest = release?.releaseDigest;

  const nextMarketIdQuery = useQuery({
    queryKey: ["sportsbook", "player", "next-market-id", releaseDigest ?? "none"],
    enabled: Boolean(enabled && release && sdk && ready),
    staleTime: 15_000,
    queryFn: async () => {
      if (!sdk) return undefined;
      return await sdk.sportsHub.getNextMarketId();
    }
  });

  const marketsQuery = useQuery({
    queryKey: [
      "sportsbook",
      "player",
      "markets",
      releaseDigest ?? "none",
      nextMarketIdQuery.data?.toString() ?? "none"
    ],
    enabled: Boolean(
      enabled && release && sdk && ready && nextMarketIdQuery.data && nextMarketIdQuery.data > 1n
    ),
    staleTime: 15_000,
    queryFn: async () => {
      if (!sdk || !nextMarketIdQuery.data) return [] as DomainSportsMarket[];
      const marketIds = buildRecentMarketIds(nextMarketIdQuery.data, PUBLIC_LIST_LIMIT);
      const markets = await Promise.all(
        marketIds.map(async (marketId) => {
          try {
            return await sdk.sportsHub.getMarket(marketId);
          } catch {
            return undefined;
          }
        })
      );
      return markets.filter((m): m is DomainSportsMarket => Boolean(m));
    }
  });

  const isLoading = nextMarketIdQuery.isLoading || marketsQuery.isLoading;
  const error = nextMarketIdQuery.error ?? marketsQuery.error;

  const data = React.useMemo<EventBoardData | undefined>(() => {
    if (!enabled) return { entries: [], source: "preview" };
    if (!marketsQuery.data) return undefined;
    if (marketsQuery.data.length === 0) return { entries: [], source: "empty" };
    return {
      entries: marketsQuery.data.map((market) => ({
        market,
        href: `/sportsbook/${market.marketId.toString()}`
      })),
      source: "live"
    };
  }, [enabled, marketsQuery.data]);

  return { data, isLoading, error };
}

/**
 * Stitch provider odds into the board entries when the indexer has hydrated
 * the matching marketId. Provider odds are fetched per-market by the existing
 * `useSportsbookProviderOdds` hook; we hydrate all rows once the page mounts
 * so the directory itself can render `Home / Draw / Away` prices.
 */
function useStitchProviderOdds(entries: readonly EventBoardEntry[]): EventBoardEntry[] {
  // Note: in this MVP each market has a single provider snapshot fetched
  // through the public odds-snapshot API. The hook below is the existing
  // per-market provider hook, called for the first ~6 entries (visible above
  // the fold) to avoid N requests on initial paint. Below-the-fold rows show
  // outcome count + state without prices, which is acceptable for the
  // directory view; the detail page will fetch full odds on click.
  const oddsBySlot = useSportsbookProviderOddsSlots(entries.slice(0, 6));

  return React.useMemo(
    () =>
      entries.map((entry, index) => {
        if (index >= oddsBySlot.length) return entry;
        const stitched = oddsBySlot[index];
        if (!stitched) return entry;
        return { ...entry, odds: stitched };
      }),
    [entries, oddsBySlot]
  );
}

function useSportsbookProviderOddsSlots(
  entries: readonly EventBoardEntry[]
): Array<SportsbookProviderOdds | undefined> {
  // Hooks must run in a stable count. We pre-allocate 6 slots so the order of
  // hook calls never changes between renders. Slots beyond the entries length
  // pass enabled=false to suppress the network request.
  const slots = Array.from(
    { length: 6 },
    (_, idx) => entries[idx]?.market.marketId as bigint | undefined
  );
  const r0 = useSportsbookProviderOdds({ marketId: slots[0], enabled: slots[0] !== undefined });
  const r1 = useSportsbookProviderOdds({ marketId: slots[1], enabled: slots[1] !== undefined });
  const r2 = useSportsbookProviderOdds({ marketId: slots[2], enabled: slots[2] !== undefined });
  const r3 = useSportsbookProviderOdds({ marketId: slots[3], enabled: slots[3] !== undefined });
  const r4 = useSportsbookProviderOdds({ marketId: slots[4], enabled: slots[4] !== undefined });
  const r5 = useSportsbookProviderOdds({ marketId: slots[5], enabled: slots[5] !== undefined });
  return [
    r0.data ?? undefined,
    r1.data ?? undefined,
    r2.data ?? undefined,
    r3.data ?? undefined,
    r4.data ?? undefined,
    r5.data ?? undefined
  ];
}

export function SportsbookPageClient() {
  const t = useTranslations();
  const locale = useLocale();
  const { release, sportsbook, readOnly, readOnlyReason } = useRelease();
  const enabled = sportsbook.enabled && sportsbook.hasSportsRelease;
  const [activeFilter, setActiveFilter] = React.useState<EventBoardFilter>("all");

  const { data: board, isLoading, error } = useSportsbookBoard(enabled);
  const stitched = useStitchProviderOdds(board?.entries ?? []);
  const filteredEntryCount = React.useMemo(
    () => countFilterEntries(stitched, activeFilter, locale),
    [stitched, activeFilter, locale]
  );

  if (!release) {
    return (
      <PageTransition pageKey="sportsbook">
        <div className="mx-auto max-w-3xl py-16">
          <EmptyMarketsState
            variant="preview"
            reason={readOnlyReason ?? t("sportsbook.player.empty.preview.description")}
          />
        </div>
      </PageTransition>
    );
  }

  const sportsHubMissing = !sportsbook.hasSportsRelease;
  const ticketsDisabled = !sportsbook.enabled;

  return (
    <PageTransition pageKey="sportsbook">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 py-10 md:py-12">
        <SportsbookHeader
          ticketsDisabled={ticketsDisabled}
          sportsHubMissing={sportsHubMissing}
          readOnly={readOnly}
          readOnlyReason={readOnlyReason}
        />

        {!enabled ? (
          <EmptyMarketsState
            variant="preview"
            reason={
              sportsbook.disabledReason ??
              (readOnly ? readOnlyReason : t("sportsbook.player.empty.preview.description"))
            }
          />
        ) : null}

        {enabled ? (
          <div className="flex flex-col gap-6">
            {isLoading ? <BoardSkeleton /> : null}
            {!isLoading && error ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm leading-6 text-danger">
                {t("sportsbook.player.error.title")}
              </div>
            ) : null}
            {!isLoading && !error && board?.source === "empty" ? (
              <EmptyMarketsState variant="quiet" />
            ) : null}
            {!isLoading && !error && board?.source === "live" ? (
              <>
                <SportsbookLobbyPanel entries={stitched} locale={locale} />
                <section className="flex flex-col gap-3">
                  <header className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                        {t("sportsbook.player.lobby.boardTitle")}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-fg-muted">
                        {t("sportsbook.player.lobby.boardDescription")}
                      </p>
                    </div>
                  </header>
                  <MarketFilterTabs
                    activeFilter={activeFilter}
                    entries={stitched}
                    locale={locale}
                    onChange={setActiveFilter}
                  />
                  <EventBoard
                    filter={activeFilter}
                    entries={stitched}
                    locale={locale}
                    showPast={activeFilter === "past" || shouldShowPastBoard(stitched)}
                  />
                  {filteredEntryCount === 0 ? (
                    <FilteredMarketsEmpty activeFilter={activeFilter} />
                  ) : null}
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
}

const MARKET_FILTERS: EventBoardFilter[] = ["all", "live", "today", "upcoming", "past"];

function MarketFilterTabs({
  activeFilter,
  entries,
  locale,
  onChange
}: {
  activeFilter: EventBoardFilter;
  entries: readonly EventBoardEntry[];
  locale: string;
  onChange: (filter: EventBoardFilter) => void;
}) {
  const t = useTranslations("sportsbook.player.lobby.filters");
  const now = React.useMemo(() => Date.now(), [entries]);
  const counts = React.useMemo(() => countBuckets(entries, now, locale), [entries, now, locale]);
  const activeCount = counts.live + counts.today + counts.upcoming;
  const allCount = activeCount + counts.past;
  const countFor = (filter: EventBoardFilter) => (filter === "all" ? allCount : counts[filter]);

  return (
    <div
      className="sticky top-20 z-20 flex gap-2 overflow-x-auto rounded-lg border border-border bg-surface-1/95 p-1 backdrop-blur"
      role="tablist"
      aria-label={t("ariaLabel")}
    >
      {MARKET_FILTERS.map((filter) => {
        const selected = filter === activeFilter;
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
              selected
                ? "bg-brand text-fg-inverse"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <span>{t(filter)}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                selected ? "bg-fg-inverse/15" : "bg-surface-3 text-fg-subtle"
              }`}
            >
              {countFor(filter)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilteredMarketsEmpty({ activeFilter }: { activeFilter: EventBoardFilter }) {
  const t = useTranslations("sportsbook.player.lobby.filters");
  return (
    <p className="rounded-lg border border-border bg-surface-1 px-4 py-5 text-sm leading-6 text-fg-muted">
      {t(`empty.${activeFilter}`)}
    </p>
  );
}

function SportsbookLobbyPanel({
  entries,
  locale
}: {
  entries: readonly EventBoardEntry[];
  locale: string;
}) {
  const t = useTranslations("sportsbook.player.lobby");
  const now = React.useMemo(() => Date.now(), [entries]);
  const featured = React.useMemo(() => selectFeaturedEntry(entries, now), [entries, now]);
  const counts = React.useMemo(() => countBuckets(entries, now, locale), [entries, now, locale]);

  if (!featured) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <FeaturedMarketCard entry={featured} locale={locale} />
      <aside className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
          {t("snapshotEyebrow")}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-fg">{t("snapshotTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{t("snapshotDescription")}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <SnapshotCell label={t("live")} value={counts.live.toString()} />
          <SnapshotCell label={t("today")} value={counts.today.toString()} />
          <SnapshotCell label={t("upcoming")} value={counts.upcoming.toString()} />
          <SnapshotCell label={t("settled")} value={counts.past.toString()} />
        </dl>
      </aside>
    </section>
  );
}

function FeaturedMarketCard({ entry, locale }: { entry: EventBoardEntry; locale: string }) {
  const t = useTranslations("sportsbook.player.lobby");
  const now = Date.now();
  const clock = describeMarketWallClock(entry.market, now, locale);
  const bucket = bucketMarket(clock, now);
  const canPlaceTicket = entry.market.state === "open" && bucket !== "past";
  const title = entry.odds
    ? t("eventTitle", { away: entry.odds.event.awayTeam, home: entry.odds.event.homeTeam })
    : t("fallbackTitle", { tag: marketShortTag(entry.market.marketKey) });
  const sortedOutcomes = React.useMemo(() => sortProviderOutcomes(entry.odds), [entry.odds]);

  return (
    <article className="rounded-lg border border-brand/25 bg-surface-1 p-4 shadow-e2 md:p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        <span className="text-brand">{t("featuredEyebrow")}</span>
        <span aria-hidden>·</span>
        <MarketStateBadge state={entry.market.state} clock={clock} size="small" />
        <span aria-hidden>·</span>
        <span>{clock.label}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t("kickoff", { time: clock.absolute })}</p>
        </div>
        <Link
          href={entry.href}
          className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-fg-inverse transition-colors hover:bg-brand-hover"
        >
          {canPlaceTicket ? t("openMarket") : t("viewMarket")}
        </Link>
      </div>

      {sortedOutcomes.length > 0 ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {sortedOutcomes.map((outcome) => (
            <Link
              key={outcome.outcomeId}
              href={`${entry.href}?outcome=${outcome.outcomeId}`}
              className="rounded-md border border-border bg-surface-2 px-3 py-3 transition-colors hover:border-brand/50 hover:bg-surface-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                {t(`side.${outcome.side}`)}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-fg">
                  {outcome.name}
                </span>
                <span className="font-mono text-base tabular-nums text-fg">
                  {outcome.decimalPrice}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-border-soft bg-surface-2/60 px-3 py-3 text-sm text-fg-muted">
          {t("oddsPending", { count: entry.market.outcomeCount })}
        </p>
      )}
    </article>
  );
}

function SnapshotCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-2/60 px-3 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function selectFeaturedEntry(entries: readonly EventBoardEntry[], now: number) {
  const active = entries.filter(
    (entry) => bucketMarket(describeMarketWallClock(entry.market, now), now) !== "past"
  );
  const open = active.find((entry) => entry.market.state === "open");
  return open ?? active[0] ?? entries[0];
}

function shouldShowPastBoard(entries: readonly EventBoardEntry[]) {
  const now = Date.now();
  return !entries.some(
    (entry) => bucketMarket(describeMarketWallClock(entry.market, now), now) !== "past"
  );
}

function countBuckets(
  entries: readonly EventBoardEntry[],
  now: number,
  locale: string
): Record<SportsMarketBucket, number> {
  return entries.reduce<Record<SportsMarketBucket, number>>(
    (acc, entry) => {
      const bucket = bucketMarket(describeMarketWallClock(entry.market, now, locale), now);
      acc[bucket] += 1;
      return acc;
    },
    { live: 0, today: 0, upcoming: 0, past: 0 }
  );
}

function countFilterEntries(
  entries: readonly EventBoardEntry[],
  filter: EventBoardFilter,
  locale: string
) {
  const now = Date.now();
  const buckets = countBuckets(entries, now, locale);
  if (filter === "all") {
    const active = buckets.live + buckets.today + buckets.upcoming;
    return active > 0 ? active : buckets.past;
  }
  return buckets[filter];
}

function sortProviderOutcomes(odds: SportsbookProviderOdds | undefined) {
  const order = { home: 0, draw: 1, away: 2 };
  return [...(odds?.outcomes ?? [])].sort((a, b) => order[a.side] - order[b.side]);
}

function SportsbookHeader({
  ticketsDisabled,
  sportsHubMissing,
  readOnly,
  readOnlyReason
}: {
  ticketsDisabled: boolean;
  sportsHubMissing: boolean;
  readOnly?: boolean;
  readOnlyReason?: string;
}) {
  const t = useTranslations("sportsbook.player.header");

  let statusLabel = t("status.ready");
  let statusTone = "bg-success-soft text-success ring-success/30";
  if (sportsHubMissing) {
    statusLabel = t("status.notInRelease");
    statusTone = "bg-warn-soft text-warn ring-warn/30";
  } else if (ticketsDisabled) {
    statusLabel = t("status.previewOnly");
    statusTone = "bg-warn-soft text-warn ring-warn/30";
  } else if (readOnly) {
    statusLabel = t("status.readOnly");
    statusTone = "bg-warn-soft text-warn ring-warn/30";
  }

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <div
          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ring-inset ${statusTone}`}
        >
          {statusLabel}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-fg-muted">
          {ticketsDisabled ? t("descriptionPreview") : t("description")}
        </p>
        {readOnly && readOnlyReason ? (
          <p className="mt-2 max-w-xl text-xs leading-5 text-fg-subtle">{readOnlyReason}</p>
        ) : null}
      </div>
    </header>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="grid animate-pulse gap-4 rounded-lg border border-border bg-surface-1 p-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-center md:p-5"
          aria-hidden
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-5 w-16 rounded-full bg-surface-3" />
              <span className="h-3 w-20 rounded bg-surface-2" />
              <span className="ml-auto h-3 w-12 rounded bg-surface-2" />
            </div>
            <div className="mt-4 h-5 w-3/4 rounded bg-surface-3" />
            <div className="mt-2 h-3 w-44 rounded bg-surface-2" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="h-12 rounded-md bg-surface-2" />
            <span className="h-12 rounded-md bg-surface-2" />
            <span className="h-12 rounded-md bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
