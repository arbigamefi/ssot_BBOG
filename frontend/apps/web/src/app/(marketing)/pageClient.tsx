"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { BetRow } from "@ssot/ssot/indexer";
import type { Address } from "@ssot/ssot/sdk";
import { useLocale, useTranslations } from "next-intl";

import { useRecentBets } from "../../features/betting/useRecentBets";
import { getCatalogRooms } from "../../features/casino/catalog";
import { formatTokenAmount, shortAddress, timeAgo } from "../../features/marketing/format";
import { HomeActivity } from "../../features/marketing/home-activity";
import { HomeFeatured } from "../../features/marketing/home-featured";
import { HomeFooterCta } from "../../features/marketing/home-footer-cta";
import { HomeHero } from "../../features/marketing/home-hero";
import { HomeReserveBar } from "../../features/marketing/home-reserve-bar";
import { HomeRoomDirectory } from "../../features/marketing/home-room-directory";
import { HomeStatsStrip } from "../../features/marketing/home-stats-strip";
import { HomeWhyUs } from "../../features/marketing/home-why-us";
import type {
  AssetOverview,
  LandingActivity,
  LandingRoom,
  LandingStat
} from "../../features/marketing/home-types";
import { useRelease } from "../../ssot/release/ReleaseProvider";

type LandingAssetOverviewResponse = {
  totalBets?: string;
  rows: Array<{
    address: string;
    symbol: string;
    decimals: number;
    totalAssets: string;
    totalReserved: string;
    protocolFee: string;
  }>;
};

type LandingOverview = { assets: AssetOverview[]; totalBets?: string };

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

  const { data: landingOverview } = useQuery({
    queryKey: ["ssot", "landing", "asset-overview", chainId, release?.releaseDigest],
    enabled: Boolean(release),
    queryFn: async (): Promise<LandingOverview> => {
      const params = new URLSearchParams({ chainId: String(chainId) });
      const response = await fetch(`/api/landing/asset-overview?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) return { assets: [] };
      const body = (await response.json()) as LandingAssetOverviewResponse;
      return {
        totalBets: body.totalBets,
        assets: body.rows.map((row) => ({
          address: row.address as Address,
          symbol: row.symbol || t("format.assetFallback"),
          decimals: row.decimals,
          totalAssets: BigInt(row.totalAssets),
          totalReserved: BigInt(row.totalReserved),
          protocolFee: BigInt(row.protocolFee)
        }))
      };
    }
  });
  const assetOverviews = landingOverview?.assets ?? [];
  const totalBetsRaw = landingOverview?.totalBets;

  const rooms = React.useMemo(
    () => getCatalogRooms(release?.gamesMeta as Array<{ slug: string; label: string }> | undefined),
    [release?.gamesMeta]
  );

  // Reserve banks can hold the same asset across multiple pools, so the raw
  // rows look like "188 USDC / 24 USDC / 0 WETH". Aggregate by asset for one
  // clean figure per token and drop zero-balance tokens. An empty result means
  // the bank is unfunded (pre-launch) — show the sync state, never "0 USDC".
  const aggregatedAssets = aggregateAssetOverviews(assetOverviews);
  const bankFunded = aggregatedAssets.length > 0;
  const reserveFloor = bankFunded
    ? formatAssetOverviewList(aggregatedAssets, locale, t("format.awaitingReserveSync"), (asset) =>
        asset.totalAssets > asset.totalReserved ? asset.totalAssets - asset.totalReserved : 0n
      )
    : t("format.awaitingReserveSync");
  const totalAssetsLabel = bankFunded
    ? formatAssetOverviewList(
        aggregatedAssets,
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

  // Total bets ever — verifiable on-chain counter (SettlementRouter.nextPositionId).
  const totalBetsLabel =
    bankFunded && totalBetsRaw != null ? BigInt(totalBetsRaw).toLocaleString(locale) : "—";
  // Protocol fee is read straight off the Bank (protocolFeesPayable) — chain-read,
  // verifiable, no index dependency.
  const protocolFeeLabel = bankFunded
    ? formatAssetOverviewList(
        aggregatedAssets,
        locale,
        t("format.awaitingReserveSync"),
        (asset) => asset.protocolFee
      )
    : t("format.awaitingReserveSync");

  // Three cards = the three flywheel sides, all read straight from the chain:
  // vault (NAV), total bets (position counter), protocol fee. All verifiable —
  // the integrity marker still labels them so the data-honesty posture is explicit.
  const stats: LandingStat[] = [
    {
      label: t("stats.vault.label"),
      value: totalAssetsLabel,
      detail: t("stats.vault.detail"),
      integrity: "verifiable"
    },
    {
      label: t("stats.totalBets.label"),
      value: totalBetsLabel,
      detail: t("stats.totalBets.detail"),
      integrity: "verifiable"
    },
    {
      label: t("stats.protocolFee.label"),
      value: protocolFeeLabel,
      detail: t("stats.protocolFee.detail"),
      integrity: "verifiable"
    }
  ];

  const localizedRooms = React.useMemo(
    () => rooms.map((room) => localizeLandingRoom(room, t)),
    [rooms, t]
  );

  const featuredRoom = rooms.find((room) => room.slug === "keno");

  return (
    <main className="min-h-screen bg-surface-0 text-fg">
      <HomeHero
        copy={{
          channel: t("hero.channel"),
          title: t("hero.title"),
          description: t("hero.description"),
          enterCasino: t("hero.enterCasino"),
          viewBank: t("hero.viewBank"),
          proofRows: {
            vrf: {
              title: t("hero.proofRows.vrf.title"),
              detail: t("hero.proofRows.vrf.detail")
            },
            bytecode: {
              title: t("hero.proofRows.bytecode.title"),
              detail: t("hero.proofRows.bytecode.detail")
            }
          }
        }}
      />

      {/* Activity is the strongest social-proof signal a casino landing page
          has — surface it right under the hero so visitors see live play
          before they see trust copy. */}
      <HomeActivity
        activity={activity}
        copy={{
          eyebrow: t("activity.eyebrow"),
          title: t("activity.title"),
          viewAll: t("activity.viewAll"),
          live: t("activity.live"),
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

      {bankFunded ? (
        <HomeStatsStrip
          stats={stats}
          copy={{ verifiable: t("stats.verifiable"), indexed: t("stats.indexed") }}
        />
      ) : null}

      {featuredRoom ? (
        <HomeFeatured
          slug={featuredRoom.slug}
          href={featuredRoom.href}
          copy={{
            eyebrow: t("featured.eyebrow"),
            title: t("featured.title"),
            detail: t("featured.detail"),
            cta: t("featured.cta")
          }}
        />
      ) : null}

      <HomeRoomDirectory
        rooms={localizedRooms}
        copy={{
          eyebrow: t("rooms.eyebrow"),
          title: t("rooms.title"),
          detail: t("rooms.detail"),
          actionLabel: t("rooms.actionLabel")
        }}
      />

      <HomeWhyUs
        copy={{
          eyebrow: t("whyUs.eyebrow"),
          title: t("whyUs.title"),
          items: [0, 1, 2, 3].map((index) => ({
            title: t(`whyUs.items.${index}.title`),
            detail: t(`whyUs.items.${index}.detail`)
          }))
        }}
      />

      <HomeReserveBar
        freeReserve={reserveFloor}
        totalAssets={totalAssetsLabel}
        copy={{
          eyebrow: t("reserveBar.eyebrow"),
          free: t("reserveBar.free"),
          total: t("reserveBar.total"),
          verify: t("reserveBar.verify")
        }}
      />

      <HomeFooterCta
        copy={{
          eyebrow: t("footerCta.eyebrow"),
          title: t("footerCta.title"),
          description: t("footerCta.description"),
          primary: t("footerCta.primary"),
          secondary: t("footerCta.secondary")
        }}
      />
    </main>
  );
}

/** Sum reserve banks that hold the same asset, and drop zero-balance tokens. */
function aggregateAssetOverviews(rows: readonly AssetOverview[]): AssetOverview[] {
  const byAsset = new Map<string, AssetOverview>();
  for (const row of rows) {
    const key = String(row.address).toLowerCase();
    const existing = byAsset.get(key);
    if (existing) {
      existing.totalAssets += row.totalAssets;
      existing.totalReserved += row.totalReserved;
      existing.protocolFee += row.protocolFee;
    } else {
      byAsset.set(key, { ...row });
    }
  }
  return Array.from(byAsset.values()).filter((asset) => asset.totalAssets > 0n);
}

function formatAssetOverviewList(
  rows: readonly AssetOverview[],
  locale: string,
  emptyLabel: string,
  selectValue: (asset: AssetOverview) => bigint
) {
  if (rows.length === 0) return emptyLabel;
  return rows
    .map((asset) =>
      formatTokenAmount(selectValue(asset), asset.decimals, asset.symbol, locale, emptyLabel)
    )
    .join(" / ");
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
