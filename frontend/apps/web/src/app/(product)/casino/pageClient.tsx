"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@ssot/ui";
import {
  MagnifyingGlassIcon,
  PlayCircleIcon,
  SparklesIcon,
  TrophyIcon
} from "@heroicons/react/24/outline";

import { ProductStateCard } from "../../../components/ProductStateCard";
import { getDefaultCasinoPoolAssetContext } from "../../../features/assets/pool-asset";
import { getCatalogRooms } from "../../../features/casino/catalog";
import { CasinoGameMark } from "../../../features/casino/CasinoMiniIcons";
import { useCasinoStats } from "../../../features/casino/useCasinoStats";
import { formatTokenAmount } from "../../../features/marketing/format";
import { useRelease } from "../../../ssot/release/ReleaseProvider";

const ROOM_COPY_KEYS: Record<
  string,
  {
    titleKey: string;
    promiseKey: string;
    badgeKey: string;
    tagKey: string;
  }
> = {
  dice: {
    titleKey: "casino.directory.rooms.dice.title",
    promiseKey: "casino.directory.rooms.dice.promise",
    badgeKey: "casino.directory.rooms.dice.badge",
    tagKey: "casino.directory.tags.binary"
  },
  roulette: {
    titleKey: "casino.directory.rooms.roulette.title",
    promiseKey: "casino.directory.rooms.roulette.promise",
    badgeKey: "casino.directory.rooms.roulette.badge",
    tagKey: "casino.directory.tags.table"
  },
  "coin-toss": {
    titleKey: "casino.directory.rooms.coinToss.title",
    promiseKey: "casino.directory.rooms.coinToss.promise",
    badgeKey: "casino.directory.rooms.coinToss.badge",
    tagKey: "casino.directory.tags.binary"
  },
  keno: {
    titleKey: "casino.directory.rooms.keno.title",
    promiseKey: "casino.directory.rooms.keno.promise",
    badgeKey: "casino.directory.rooms.keno.badge",
    tagKey: "casino.directory.tags.lottery"
  },
  plinko: {
    titleKey: "casino.directory.rooms.plinko.title",
    promiseKey: "casino.directory.rooms.plinko.promise",
    badgeKey: "casino.directory.rooms.plinko.badge",
    tagKey: "casino.directory.tags.arcade"
  },
  slots: {
    titleKey: "casino.directory.rooms.slots.title",
    promiseKey: "casino.directory.rooms.slots.promise",
    badgeKey: "casino.directory.rooms.slots.badge",
    tagKey: "casino.directory.tags.arcade"
  },
  baccarat: {
    titleKey: "casino.directory.rooms.baccarat.title",
    promiseKey: "casino.directory.rooms.baccarat.promise",
    badgeKey: "casino.directory.rooms.baccarat.badge",
    tagKey: "casino.directory.tags.table"
  },
  "sic-bo": {
    titleKey: "casino.directory.rooms.sicBo.title",
    promiseKey: "casino.directory.rooms.sicBo.promise",
    badgeKey: "casino.directory.rooms.sicBo.badge",
    tagKey: "casino.directory.tags.dice"
  }
};

const FILTERS = [
  { key: "all", labelKey: "casino.directory.filters.all" },
  { key: "table", labelKey: "casino.directory.filters.table" },
  { key: "dice", labelKey: "casino.directory.filters.dice" },
  { key: "binary", labelKey: "casino.directory.filters.binary" },
  { key: "lottery", labelKey: "casino.directory.filters.lottery" },
  { key: "arcade", labelKey: "casino.directory.filters.arcade" }
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matchesFilter(slug: string, filter: FilterKey) {
  switch (filter) {
    case "table":
      return slug === "roulette" || slug === "baccarat";
    case "dice":
      return slug === "dice" || slug === "sic-bo";
    case "binary":
      return slug === "coin-toss";
    case "lottery":
      return slug === "keno";
    case "arcade":
      return slug === "plinko" || slug === "slots";
    default:
      return true;
  }
}

function shortAddress(value?: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function GamesListClient() {
  const t = useTranslations();
  const locale = useLocale();
  const { release, readOnlyReason } = useRelease();
  const casinoPoolAsset = React.useMemo(
    () => (release ? getDefaultCasinoPoolAssetContext(release) : null),
    [release]
  );
  const casinoAsset = casinoPoolAsset?.asset;
  const { data: casinoStats } = useCasinoStats({ asset: casinoAsset?.address });
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  if (!release) {
    return (
      <ProductStateCard
        title={t("nav.games")}
        description={readOnlyReason ?? t("casino.directory.empty.noRelease")}
      />
    );
  }

  const rooms = getCatalogRooms(
    release.gamesMeta as Array<{ slug: string; label: string }> | undefined
  );

  if (!rooms.length) {
    return (
      <ProductStateCard title={t("nav.games")} description={t("casino.directory.empty.noGames")} />
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = rooms.filter((room) => {
    const copyKeys = ROOM_COPY_KEYS[room.slug];
    const title = copyKeys ? t(copyKeys.titleKey) : room.label;
    const promise = copyKeys ? t(copyKeys.promiseKey) : room.summary;
    const matchesQuery =
      !normalizedQuery ||
      room.label.toLowerCase().includes(normalizedQuery) ||
      room.summary.toLowerCase().includes(normalizedQuery) ||
      title.toLowerCase().includes(normalizedQuery) ||
      promise.toLowerCase().includes(normalizedQuery);
    return matchesQuery && matchesFilter(room.slug, filter);
  });

  const canonicalOrder = [
    "dice",
    "plinko",
    "slots",
    "baccarat",
    "sic-bo",
    "roulette",
    "coin-toss",
    "keno"
  ];
  const roomsToRender = filteredRooms.slice().sort((a, b) => {
    const idxA = canonicalOrder.indexOf(a.slug);
    const idxB = canonicalOrder.indexOf(b.slug);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.label.localeCompare(b.label);
  });
  const bankAddress = casinoPoolAsset?.bank;
  const assetSymbol = casinoAsset?.symbol ?? "—";

  // Real betting analytics from the durable bet index. When the Postgres
  // source is unavailable (e.g. dev without DB) we show "—" rather than a
  // misleading zero.
  const statsAvailable = casinoStats?.source === "postgres";
  const statsDecimals = casinoStats?.asset.decimals ?? casinoAsset?.decimals ?? 6;
  const statsSymbol = casinoStats?.asset.symbol ?? assetSymbol;
  const volumeLabel =
    statsAvailable && casinoStats
      ? formatTokenAmount(BigInt(casinoStats.stats.turnover), statsDecimals, statsSymbol, locale)
      : "—";
  const betCountLabel =
    statsAvailable && casinoStats ? casinoStats.stats.betCount.toLocaleString(locale) : "—";
  const playersLabel =
    statsAvailable && casinoStats ? casinoStats.stats.uniquePlayers.toLocaleString(locale) : "—";
  const hasCasinoActivity =
    statsAvailable &&
    Boolean(casinoStats) &&
    (casinoStats.stats.betCount > 0 ||
      casinoStats.stats.uniquePlayers > 0 ||
      BigInt(casinoStats.stats.turnover) > 0n);
  const shouldShowStats = hasCasinoActivity;

  return (
    <div className="relative overflow-hidden pb-16 text-fg selection:bg-brand/20">
      {/* Atmosphere — matches the rebuilt game consoles: a top-down surface
          lift and a soft brand bloom instead of the old noise texture. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[44rem]"
        style={{
          background: "radial-gradient(120% 70% at 50% -6%, hsl(var(--surface-2)), transparent 72%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-6 h-[440px] w-[820px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.12), transparent 68%)" }}
      />

      <section className="relative border-b border-border-soft py-6 md:py-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand">
              <SparklesIcon className="h-4 w-4" />
              {t("casino.directory.hero.eyebrow")}
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-fg md:text-5xl">
              {t("casino.directory.hero.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted md:text-lg md:leading-8">
              {t("casino.directory.hero.description")}
            </p>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full items-center gap-1 overflow-x-auto md:w-auto">
            {FILTERS.map((item) => {
              const isActive = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "relative shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors md:px-5 md:py-2.5 md:text-sm",
                    isActive
                      ? "bg-brand-soft text-brand ring-1 ring-inset ring-brand/30"
                      : "text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("casino.directory.search.placeholder")}
              aria-label={t("casino.directory.search.aria")}
              className="relative z-0 w-full rounded-full border border-border bg-surface-1 py-2.5 pl-12 pr-4 text-sm text-fg shadow-inner-e1 transition-colors placeholder:text-fg-subtle hover:border-brand/30 focus:border-brand focus:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
          </div>
        </div>
      </section>

      <section className="relative py-5 md:py-8">
        {roomsToRender.length === 0 ? (
          <div className="rounded-xl border border-border-soft bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] p-8 text-center shadow-e2">
            <p className="text-lg font-semibold text-fg">{t("casino.directory.empty.noResults")}</p>
            <p className="mt-2 text-sm text-fg-muted">
              {t("casino.directory.empty.noResultsDetail", { query: query.trim() })}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-5 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
            >
              {t("casino.directory.empty.clearSearch")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {roomsToRender.map((room) => {
              const copyKeys = ROOM_COPY_KEYS[room.slug];
              const copy = copyKeys
                ? {
                    title: t(copyKeys.titleKey),
                    promise: t(copyKeys.promiseKey),
                    badge: t(copyKeys.badgeKey),
                    tag: t(copyKeys.tagKey)
                  }
                : {
                    title: room.label,
                    promise: room.summary,
                    badge: room.badge,
                    tag: t("casino.directory.tags.module")
                  };

              return (
                <Link
                  key={room.slug}
                  href={room.href}
                  data-testid="room-entry-card"
                  data-slug={room.slug}
                  className="group relative flex min-h-[18rem] flex-col overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] shadow-e2 transition-colors duration-200 hover:border-brand/40 hover:bg-surface-2 md:min-h-[20rem]"
                >
                  {/* top edge sheen */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
                    }}
                  />

                  <div className="absolute left-3 top-3 z-20 rounded-full border border-border-soft bg-surface-0/80 px-2.5 py-1 backdrop-blur md:left-4 md:top-4 md:px-3 md:py-1.5">
                    <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {t("casino.directory.card.releaseAnchored")}
                    </span>
                  </div>

                  <div className="absolute right-3 top-3 z-20 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase text-brand backdrop-blur md:right-4 md:top-4 md:px-3">
                    {copy.badge}
                  </div>

                  <div className="relative z-10 mt-7 flex min-h-[11rem] flex-1 items-center justify-center p-4 md:min-h-[12rem] md:p-5">
                    {/* Shared game mark system: the lobby should feel like the
                        same product as the individual room stages. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 transition-opacity duration-200 group-hover:opacity-80"
                      style={{
                        background:
                          "radial-gradient(circle, hsl(var(--brand) / 0.1), transparent 70%)"
                      }}
                    />
                    <div className="relative">
                      <CasinoGameMark slug={room.slug} className="h-28 w-28 md:h-36 md:w-36" />
                    </div>
                  </div>

                  <div className="relative z-20 border-t border-border-soft bg-surface-2/85 p-4 backdrop-blur md:p-5">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">
                      {copy.tag}
                    </div>
                    <h3 className="text-xl font-bold text-fg md:text-2xl">{copy.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                      {copy.promise}
                    </p>

                    <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border-soft bg-surface-2 py-3 text-sm font-bold text-fg-muted transition-colors group-hover:border-brand/40 group-hover:bg-brand-soft group-hover:text-brand md:mt-6 md:py-4">
                      {t("casino.directory.card.playNow")}{" "}
                      <PlayCircleIcon className="h-5 w-5 shrink-0" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {shouldShowStats ? (
          <dl className="mt-6 grid gap-2 border-y border-border-soft py-4 text-sm md:grid-cols-3">
            <div className="flex items-center justify-between gap-3 md:block">
              <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t("casino.directory.stats.volume")}
              </dt>
              <dd className="truncate font-mono font-semibold text-fg md:mt-2" title={volumeLabel}>
                {volumeLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 md:block">
              <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand">
                <TrophyIcon className="h-3.5 w-3.5" />
                {t("casino.directory.stats.bets")}
              </dt>
              <dd className="font-mono font-semibold text-fg md:mt-2">{betCountLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 md:block">
              <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {t("casino.directory.stats.players")}
              </dt>
              <dd className="font-mono font-semibold text-fg md:mt-2">{playersLabel}</dd>
            </div>
          </dl>
        ) : null}

        <aside className="mt-10 overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] p-1 shadow-e3">
          <div className="relative overflow-hidden rounded-lg border border-border-soft bg-surface-2 px-6 py-8 md:px-8 md:py-10">
            <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand">
                  <TrophyIcon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-fg md:text-3xl">
                    {t("casino.directory.reserve.title")}
                  </h3>
                  <p className="mt-2 font-mono text-sm font-medium uppercase tracking-widest text-fg-subtle">
                    {t("casino.directory.reserve.subtitle", { bank: shortAddress(bankAddress) })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <div className="font-mono text-3xl font-semibold tracking-tight text-fg md:text-4xl">
                  {assetSymbol}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    {t("casino.directory.reserve.status")}
                  </span>
                </div>
                <Link
                  href="/earn"
                  className="mt-4 rounded-md border border-border bg-surface-1 px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
                >
                  {t("casino.directory.reserve.cta")}
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
