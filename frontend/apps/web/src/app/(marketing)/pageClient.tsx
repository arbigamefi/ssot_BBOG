"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { BetRow } from "@ssot/ssot/indexer";
import type { Address } from "@ssot/ssot/sdk";

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
  LandingStat
} from "../../features/marketing/home-types";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

export function HomePageClient() {
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
            symbol: pool.symbol || assetMeta?.symbol || "Asset",
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
    ? formatTokenAmount(freeReserve, primaryAsset.decimals, primaryAsset.symbol)
    : "Awaiting reserve sync";
  const totalAssetsLabel = primaryAsset
    ? formatTokenAmount(totalAssets, primaryAsset.decimals, primaryAsset.symbol)
    : "Awaiting reserve sync";

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
    player: shortAddress(bet.player),
    game: bet.gameId ? (gameLabelById.get(String(bet.gameId).toLowerCase()) ?? "Room") : "Room",
    state: String(bet.state ?? "Placed"),
    time: timeAgo(typeof bet.updatedAt === "number" ? bet.updatedAt : undefined)
  }));

  const stats: LandingStat[] = [
    {
      label: "Free reserve",
      value: reserveFloor,
      detail: "Readable bank capacity after reserved liabilities."
    },
    {
      label: "Bank assets",
      value: totalAssetsLabel,
      detail: "Aggregated from release-linked bank snapshots."
    },
    {
      label: "Release",
      value: shortDigest(release?.releaseDigest),
      detail: "Frontend state is anchored to a release manifest."
    }
  ];

  return (
    <main className="min-h-screen bg-surface-0 text-fg">
      <HomeHero
        reserveFloor={reserveFloor}
        totalAssets={totalAssetsLabel}
        releaseDigest={release?.releaseDigest}
        roomCount={rooms.length}
      />
      <HomeStatsStrip stats={stats} />
      <HomeRoomDirectory rooms={rooms} />
      <HomeBankAndActivity
        reserveFloor={reserveFloor}
        totalAssets={totalAssetsLabel}
        releaseDigest={release?.releaseDigest}
        activity={activity}
      />
      <HomeProofSection />
    </main>
  );
}
