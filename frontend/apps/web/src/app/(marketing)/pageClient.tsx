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
import { HomeBankAndActivity } from "../../features/marketing/home-bank-activity";
import { HomeHero } from "../../features/marketing/home-hero";
import { HomeProofSection } from "../../features/marketing/home-proof-section";
import { HomeRoomDirectory } from "../../features/marketing/home-room-directory";
import { HomeStatsStrip } from "../../features/marketing/home-stats-strip";
import type {
  AssetOverview,
  LandingActivity,
  LandingRoom,
  LandingStat
} from "../../features/marketing/home-types";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

export function HomePageClient() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const { release } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { data: latestBets = [] } = useRecentBets({ limit: 5 });

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

  const activity = latestBets.slice(0, 5).map<LandingActivity>((bet: BetRow, index: number) => ({
    id: String(bet.id ?? bet.betId ?? index),
    player: shortAddress(bet.player, t("format.walletPending")),
    game: bet.gameId
      ? (gameLabelById.get(String(bet.gameId).toLowerCase()) ?? t("format.roomFallback"))
      : t("format.roomFallback"),
    state: String(bet.state ?? t("format.placedFallback")),
    time: timeAgo(typeof bet.updatedAt === "number" ? bet.updatedAt : undefined, {
      now: t("timeAgo.now"),
      seconds: (count) => t("timeAgo.seconds", { count }),
      minutes: (count) => t("timeAgo.minutes", { count }),
      hours: (count) => t("timeAgo.hours", { count }),
      days: (count) => t("timeAgo.days", { count })
    })
  }));

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

  return (
    <main className="min-h-screen bg-surface-0 text-fg">
      <HomeHero
        reserveFloor={reserveFloor}
        totalAssets={totalAssetsLabel}
        releaseDigest={release?.releaseDigest}
        roomCount={rooms.length}
        copy={{
          channel: t("hero.channel"),
          title: t("hero.title"),
          description: t("hero.description"),
          enterCasino: t("hero.enterCasino"),
          viewBank: t("hero.viewBank"),
          consoleLabel: t("hero.consoleLabel"),
          live: t("hero.live"),
          metrics: {
            freeReserve: t("hero.metrics.freeReserve"),
            bankAssets: t("hero.metrics.bankAssets"),
            rooms: t("hero.metrics.rooms")
          },
          proofRows: [
            {
              title: t("hero.proofRows.vrf.title"),
              detail: t("hero.proofRows.vrf.detail")
            },
            {
              title: t("hero.proofRows.bytecode.title"),
              detail: t("hero.proofRows.bytecode.detail")
            }
          ],
          pendingDigest: t("format.pending")
        }}
      />
      <HomeStatsStrip stats={stats} />
      <HomeRoomDirectory
        rooms={localizedRooms}
        copy={{
          eyebrow: t("rooms.eyebrow"),
          title: t("rooms.title"),
          detail: t("rooms.detail"),
          actionLabel: t("rooms.actionLabel")
        }}
      />
      <HomeBankAndActivity
        reserveFloor={reserveFloor}
        totalAssets={totalAssetsLabel}
        releaseDigest={release?.releaseDigest}
        activity={activity}
        copy={{
          bank: {
            eyebrow: t("bank.eyebrow"),
            title: t("bank.title"),
            description: t("bank.description"),
            freeReserve: t("bank.freeReserve"),
            totalBankAssets: t("bank.totalBankAssets"),
            releaseDigest: t("bank.releaseDigest"),
            pending: t("format.pending"),
            inspectBank: t("bank.inspectBank")
          },
          activity: {
            eyebrow: t("activity.eyebrow"),
            title: t("activity.title"),
            viewAll: t("activity.viewAll"),
            headers: {
              player: t("activity.headers.player"),
              room: t("activity.headers.room"),
              state: t("activity.headers.state"),
              age: t("activity.headers.age")
            },
            empty: t("activity.empty")
          }
        }}
      />
      <HomeProofSection
        copy={{
          traceLabel: t("proof.traceLabel"),
          proofSurface: t("proof.proofSurface"),
          eyebrow: t("proof.eyebrow"),
          title: t("proof.title"),
          description: t("proof.description"),
          actionLabel: t("proof.actionLabel")
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
    badge: t(`roomCards.${key}.badge`),
    summary: t(`roomCards.${key}.summary`),
    facts: [0, 1, 2].map((index) => t(`roomCards.${key}.facts.${index}`))
  };
}
