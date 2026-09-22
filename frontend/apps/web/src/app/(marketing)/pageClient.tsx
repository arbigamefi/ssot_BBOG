"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { BetRow } from "@ssot/ssot/indexer";
import { useLocale, useTranslations } from "next-intl";

import { useRecentBets } from "../../features/betting/useRecentBets";
import { getCatalogRooms } from "../../features/casino/catalog";
import { getExplorerBaseUrl } from "../../features/earn/format";
import { formatTokenAmount, shortAddress, timeAgo } from "../../features/marketing/format";
import { HomeActivity } from "../../features/marketing/home-activity";
import { HomeFooterCta } from "../../features/marketing/home-footer-cta";
import { HomeHero } from "../../features/marketing/home-hero";
import { HomeRoomDirectory } from "../../features/marketing/home-room-directory";
import { HomeStatsStrip } from "../../features/marketing/home-stats-strip";
import { HomeVerify } from "../../features/marketing/home-verify";
import { HomeHowItWorks } from "../../features/marketing/home-how-it-works";
import type {
  AssetOverview,
  LandingActivity,
  LandingAssetTab,
  LandingRoom,
  LandingStat
} from "../../features/marketing/home-types";
import { useRelease } from "../../ssot/release/ReleaseProvider";

import { fetchLandingOverview } from "../../features/marketing/landing-overview";

function toBigOrNull(value?: string | bigint | number): bigint | null {
  if (value == null || value === "") return null;
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    return null;
  }
}

export function HomePageClient() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const { chainId, release } = useRelease();
  const { data: latestBets = [] } = useRecentBets({
    errorMessage: t("errors.recentBetsFailed"),
    limit: 5
  });

  const {
    data: landingOverview,
    isPending,
    error: overviewError,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ["ssot", "landing", "asset-overview", chainId, release?.releaseDigest],
    enabled: Boolean(release),
    queryFn: () => fetchLandingOverview(chainId, release!.releaseDigest),
    retry: 1
  });
  const assetOverviews = landingOverview?.assets ?? [];

  const rooms = React.useMemo(
    () => getCatalogRooms(release?.gamesMeta as Array<{ slug: string; label: string }> | undefined),
    [release?.gamesMeta]
  );

  // Keep each asset separate, including a successfully read zero balance.
  const aggregatedAssets = aggregateAssetOverviews(assetOverviews);
  const hasBankRows = aggregatedAssets.length > 0;
  const [selectedAssetAddress, setSelectedAssetAddress] = React.useState<string | null>(null);
  const selectedAsset =
    aggregatedAssets.find((asset) => asset.address.toLowerCase() === selectedAssetAddress) ??
    aggregatedAssets[0];
  const reserveFloor = hasBankRows
    ? formatAssetOverviewValue(selectedAsset, locale, t("format.awaitingReserveSync"), (asset) =>
        asset.totalAssets > asset.totalReserved ? asset.totalAssets - asset.totalReserved : 0n
      )
    : t("format.awaitingReserveSync");
  const totalAssetsLabel = hasBankRows
    ? formatAssetOverviewValue(
        selectedAsset,
        locale,
        t("format.awaitingReserveSync"),
        (asset) => asset.totalAssets
      )
    : t("format.awaitingReserveSync");

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const gameMeta of release?.gamesMeta ?? []) {
      if (!gameMeta?.gameId || !gameMeta?.label) continue;
      map.set(String(gameMeta.gameId).toLowerCase(), String(gameMeta.label));
    }
    return map;
  }, [release?.gamesMeta]);

  const activityAssetFallback = assetOverviews[0];
  const activityAssetByAddress = React.useMemo(() => {
    const map = new Map<string, { decimals: number; symbol: string }>();
    for (const asset of release?.assets ?? []) {
      if (!asset?.address) continue;
      map.set(String(asset.address).toLowerCase(), {
        decimals: asset.decimals,
        symbol: asset.symbol || t("format.assetFallback")
      });
    }
    for (const asset of assetOverviews) {
      map.set(String(asset.address).toLowerCase(), {
        decimals: asset.decimals,
        symbol: asset.symbol || t("format.assetFallback")
      });
    }
    return map;
  }, [assetOverviews, release?.assets, t]);
  const activity = latestBets.slice(0, 5).map<LandingActivity>((bet: BetRow, index: number) => {
    const stake = toBigOrNull(bet.stake);
    const payout = toBigOrNull(bet.payout);
    const betAsset = bet.asset
      ? activityAssetByAddress.get(String(bet.asset).toLowerCase())
      : undefined;
    const activityDecimals = betAsset?.decimals ?? activityAssetFallback?.decimals ?? 6;
    const activitySymbol =
      betAsset?.symbol ?? activityAssetFallback?.symbol ?? t("format.assetFallback");
    const settled = bet.state === "finalized";
    const isWin = settled && stake != null && payout != null && payout > stake;
    const multiplier =
      isWin && stake && payout
        ? `${(Number((payout * 1_000_000n) / stake) / 1_000_000).toFixed(2)}×`
        : undefined;
    return {
      id: String(bet.id ?? bet.betId ?? index),
      player: shortAddress(bet.player, t("format.walletPending")),
      game: bet.gameId
        ? (gameLabelById.get(String(bet.gameId).toLowerCase()) ?? t("format.roomFallback"))
        : t("format.roomFallback"),
      state: String(bet.state ?? t("format.placedFallback")),
      payout:
        settled && payout != null
          ? formatTokenAmount(payout, activityDecimals, activitySymbol, locale, "")
          : undefined,
      multiplier,
      isWin,
      time: timeAgo(typeof bet.updatedAt === "number" ? bet.updatedAt : undefined, {
        now: t("timeAgo.now"),
        seconds: (count) => t("timeAgo.seconds", { count }),
        minutes: (count) => t("timeAgo.minutes", { count }),
        hours: (count) => t("timeAgo.hours", { count }),
        days: (count) => t("timeAgo.days", { count })
      })
    };
  });

  // Lifetime turnover — verifiable per Bank and shown per asset. Do not sum
  // USDC and WETH into a fake single number.
  const totalTurnoverLabel = hasBankRows
    ? formatAssetOverviewValue(
        selectedAsset,
        locale,
        t("format.awaitingReserveSync"),
        (asset) => asset.turnover
      )
    : t("format.awaitingReserveSync");
  const stats: LandingStat[] = [
    {
      label: t("stats.vault.label"),
      value: totalAssetsLabel,
      detail: t("stats.vault.detail"),
      integrity: "verifiable"
    },
    {
      label: t("stats.turnover.label"),
      value: totalTurnoverLabel,
      detail: t("stats.turnover.detail"),
      integrity: "verifiable"
    },
    {
      label: t("landing.bank.freeLabel"),
      value: reserveFloor,
      detail: t("landing.bank.freeDetail"),
      integrity: "verifiable"
    }
  ];

  // Mechanism descriptions are not live chain measurements.
  const mechanismStats: LandingStat[] = (["rules", "randomness", "receipts"] as const).map(
    (key) => ({
      label: t(`landing.mechanisms.${key}.label`),
      value: t(`landing.mechanisms.${key}.value`),
      detail: t(`landing.mechanisms.${key}.detail`)
    })
  );
  const assetTabs: LandingAssetTab[] = aggregatedAssets.map((asset) => ({
    label: asset.symbol,
    selected: selectedAsset?.address.toLowerCase() === asset.address.toLowerCase(),
    onSelect: () => setSelectedAssetAddress(asset.address.toLowerCase())
  }));

  const localizedRooms = React.useMemo(
    () => rooms.map((room) => localizeLandingRoom(room, t)),
    [rooms, t]
  );

  // Verify-the-bytecode proof links to the actual deployed dice module so the
  // displayed source excerpt is never treated as the source of truth.
  const explorerBaseUrl = getExplorerBaseUrl(chainId);
  const verifyContractAddress =
    release?.gamesMeta?.find((meta) => meta.slug === "dice")?.module ?? release?.contracts.gameHub;
  const verifyHref =
    explorerBaseUrl && verifyContractAddress
      ? `${explorerBaseUrl}/address/${verifyContractAddress}`
      : undefined;

  return (
    <div className="min-h-screen bg-surface-0 text-fg">
      <HomeHero
        copy={{
          channel: t("hero.channel"),
          title: t("hero.title"),
          description: t("hero.description"),
          enterCasino: t("hero.enterCasino"),
          viewBank: t("hero.viewBank"),
          scrollHint: t("landing.scrollHint"),
          visual: {
            status: t("landing.visual.status"),
            wallet: t("landing.visual.wallet"),
            receipt: t("landing.visual.receipt"),
            proof: t("landing.visual.proof"),
            title: t("landing.visual.title"),
            request: t("landing.visual.request"),
            transaction: t("landing.visual.transaction")
          },
          proofRows: {
            vrf: {
              title: t("hero.proofRows.vrf.title"),
              detail: t("hero.proofRows.vrf.detail")
            },
            bytecode: {
              title: t("hero.proofRows.bytecode.title"),
              detail: t("landing.bankHint")
            }
          }
        }}
      />
      <div id="home-after-hero" className="scroll-mt-24" />

      <HomeStatsStrip
        stats={mechanismStats}
        copy={{
          verifiable: t("stats.verifiable"),
          indexed: t("stats.indexed"),
          assetContext: t("stats.assetContext")
        }}
      />

      <HomeRoomDirectory
        rooms={localizedRooms}
        copy={{
          eyebrow: t("rooms.eyebrow"),
          title: t("rooms.title"),
          detail: t("rooms.detail"),
          actionLabel: t("rooms.actionLabel")
        }}
      />

      <HomeHowItWorks
        copy={{
          eyebrow: t("landing.steps.eyebrow"),
          title: t("landing.steps.title"),
          items: [0, 1, 2].map((index) => ({
            title: t(`landing.steps.items.${index}.title`),
            detail: t(`landing.steps.items.${index}.detail`)
          }))
        }}
      />

      <HomeVerify
        verifyHref={verifyHref}
        copy={{
          eyebrow: t("verify.eyebrow"),
          title: t("verify.title"),
          description: t("landing.verifyDescription"),
          sourceNote: t("verify.sourceNote"),
          verifyCta: t("verify.verifyCta"),
          cta: t("hero.enterCasino")
        }}
      />

      {activity.length > 0 ? (
        <HomeActivity
          activity={activity}
          copy={{
            eyebrow: t("landing.activityEyebrow"),
            title: t("activity.title"),
            viewAll: t("activity.viewAll"),
            live: t("stats.indexed"),
            headers: {
              player: t("activity.headers.player"),
              room: t("activity.headers.room"),
              payout: t("activity.headers.payout"),
              age: t("activity.headers.age")
            },
            empty: t("activity.empty"),
            emptyCta: t("hero.enterCasino")
          }}
        />
      ) : null}

      <section
        aria-labelledby="home-bank-title"
        className="border-b border-border-soft bg-surface-1 py-16"
      >
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <p className="text-sm font-semibold text-brand">
            {t("bank.eyebrow")} · {release?.name ?? String(chainId)}
          </p>
          <h2 id="home-bank-title" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            {t("landing.bank.title")}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-fg-muted">
            {t("landing.bank.description")}
          </p>
          <Link
            href="/earn"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4"
          >
            {t("bank.inspectBank")}
          </Link>
          {!release || isPending || overviewError || !hasBankRows ? (
            <div
              role="status"
              className="mt-6 rounded-xl border border-border-soft bg-surface-2 p-6 text-fg-muted"
            >
              {!release
                ? t("landing.bank.unavailable")
                : isPending
                  ? t("landing.bank.loading")
                  : overviewError
                    ? t("landing.bank.error")
                    : t("landing.bank.empty")}
              {release && overviewError ? (
                <button
                  type="button"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                  className="mt-4 flex min-h-11 items-center rounded-md border border-border-soft px-5 font-semibold text-fg disabled:opacity-50"
                >
                  {isFetching ? t("landing.bank.loading") : t("landing.bank.retry")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {release && !isPending && !overviewError && hasBankRows ? (
          <HomeStatsStrip
            stats={stats}
            assetTabs={assetTabs}
            copy={{
              verifiable: t("stats.verifiable"),
              indexed: t("stats.indexed"),
              assetContext: t("stats.assetContext")
            }}
          />
        ) : null}
      </section>

      <HomeFooterCta
        copy={{
          eyebrow: t("footerCta.eyebrow"),
          title: t("footerCta.title"),
          description: t("footerCta.description"),
          primary: t("footerCta.primary"),
          secondary: t("landing.receiptCta")
        }}
      />
    </div>
  );
}

/** Sum reserve banks that hold the same asset without inventing a fiat total. */
function aggregateAssetOverviews(rows: readonly AssetOverview[]): AssetOverview[] {
  const byAsset = new Map<string, AssetOverview>();
  for (const row of rows) {
    const key = String(row.address).toLowerCase();
    const existing = byAsset.get(key);
    if (existing) {
      existing.totalAssets += row.totalAssets;
      existing.totalReserved += row.totalReserved;
      existing.turnover += row.turnover;
      existing.protocolFee += row.protocolFee;
    } else {
      byAsset.set(key, { ...row });
    }
  }
  return Array.from(byAsset.values());
}

function formatAssetOverviewValue(
  asset: AssetOverview | undefined,
  locale: string,
  emptyLabel: string,
  selectValue: (asset: AssetOverview) => bigint
) {
  if (!asset) return emptyLabel;
  return formatTokenAmount(selectValue(asset), asset.decimals, asset.symbol, locale, emptyLabel);
}

function localizeLandingRoom(
  room: LandingRoom,
  t: ReturnType<typeof useTranslations<"marketing">>
): LandingRoom {
  const key = room.slug === "coin-toss" ? "coinToss" : room.slug;
  return {
    ...room,
    label: t(`roomCards.${key}.title`),
    badge: t(`roomCards.${key}.badge`),
    summary: t(`roomCards.${key}.summary`),
    facts: [0, 1, 2].map((index) => t(`roomCards.${key}.facts.${index}`))
  };
}
