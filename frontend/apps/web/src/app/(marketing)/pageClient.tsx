"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { BetRow } from "@ssot/ssot/indexer";
import type { Address } from "@ssot/ssot/sdk";
import { useLocale, useTranslations } from "next-intl";

import { useRecentBets } from "../../features/betting/useRecentBets";
import { getCatalogRooms } from "../../features/casino/catalog";
import {
  formatTokenAmount,
  shortAddress,
  shortDigest,
  timeAgo
} from "../../features/marketing/format";
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
import { useSSOTSDK } from "../../ssot/sdk";

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
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { data: latestBets = [] } = useRecentBets({
    errorMessage: t("errors.recentBetsFailed"),
    limit: 5
  });

  const { data: assetOverviews = [] } = useQuery({
    queryKey: ["ssot", "landing", "asset-overview", release?.releaseDigest],
    enabled: Boolean(release && sdk && ready),
    queryFn: async (): Promise<AssetOverview[]> => {
      if (!release || !sdk) return [];
      return await Promise.all(
        release.pools.map(async (pool) => {
          const assetMeta = release.assets.find(
            (asset) => asset.address.toLowerCase() === pool.asset.toLowerCase()
          );
          const snapshot = await sdk.bank.getSnapshot(pool.poolId);
          return {
            address: pool.asset as Address,
            symbol: pool.symbol || assetMeta?.symbol || t("format.assetFallback"),
            decimals: pool.decimals ?? assetMeta?.decimals ?? 18,
            totalAssets: snapshot.totalAssets,
            totalReserved: snapshot.totalReserved
          };
        })
      );
    }
  });

  const rooms = React.useMemo(
    () => getCatalogRooms(release?.gamesMeta as Array<{ slug: string; label: string }> | undefined),
    [release?.gamesMeta]
  );

  const primaryAsset = assetOverviews[0];
  const totalAssets = assetOverviews.reduce((sum, asset) => sum + asset.totalAssets, 0n);
  const totalReserved = assetOverviews.reduce((sum, asset) => sum + asset.totalReserved, 0n);
  const freeReserve = totalAssets > totalReserved ? totalAssets - totalReserved : 0n;
  const reserveFloor = primaryAsset
    ? formatTokenAmount(
        freeReserve,
        primaryAsset.decimals,
        primaryAsset.symbol,
        locale,
        t("format.syncing")
      )
    : t("format.awaitingReserveSync");
  const totalAssetsLabel = primaryAsset
    ? formatTokenAmount(
        totalAssets,
        primaryAsset.decimals,
        primaryAsset.symbol,
        locale,
        t("format.syncing")
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

  const activityDecimals = primaryAsset?.decimals ?? 6;
  const activitySymbol = primaryAsset?.symbol ?? "USDC";
  const activity = latestBets.slice(0, 5).map<LandingActivity>((bet: BetRow, index: number) => {
    const stake = toBigOrNull(bet.stake);
    const payout = toBigOrNull(bet.payout);
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

  const stats: LandingStat[] = [
    {
      label: t("stats.freeReserve.label"),
      value: reserveFloor,
      detail: t("stats.freeReserve.detail")
    },
    {
      label: t("stats.bankAssets.label"),
      value: totalAssetsLabel,
      detail: t("stats.bankAssets.detail")
    },
    {
      label: t("stats.release.label"),
      value: shortDigest(release?.releaseDigest, t("format.pending")),
      detail: t("stats.release.detail")
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
          viewBank: t("hero.viewBank")
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
          empty: t("activity.empty")
        }}
      />

      <HomeStatsStrip stats={stats} />

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
