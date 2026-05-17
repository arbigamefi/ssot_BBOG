"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { BetRow } from "@ssot/ssot/indexer";

import { PageTransition } from "../../../../components/PageTransition";
import { ActivityFilterTabs } from "../../../../features/portfolio/activity/activity-filter-tabs";
import { ActivityHero } from "../../../../features/portfolio/activity/activity-hero";
import { ActivityLedger } from "../../../../features/portfolio/activity/activity-ledger";
import {
  formatOutcome,
  formatRelativeTime,
  getBigIntField,
  isLossStatus,
  isOpenStatus,
  mapBetState,
  shortHex
} from "../../../../features/portfolio/activity/format";
import type {
  BetMetric,
  BetStatusFilter,
  EnrichedBetRow
} from "../../../../features/portfolio/activity/types";
import { usePlayerBets } from "../../../../features/betting/usePlayerBets";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";

export function PortfolioActivityPageClient() {
  const t = useTranslations();
  const { release } = useRelease();
  const { sdk } = useSSOTSDK();
  const {
    data: bets = [],
    isLoading,
    localRows,
    serverRows
  } = usePlayerBets({ limit: 500, player: sdk?.account });
  const [statusFilter, setStatusFilter] = React.useState<BetStatusFilter>("all");

  const gameLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of release?.gamesMeta ?? []) {
      map.set(game.gameId.toLowerCase(), game.label);
    }
    return map;
  }, [release?.gamesMeta]);

  const assetMaps = React.useMemo(() => {
    const symbols = new Map<string, string>();
    const decimals = new Map<string, number>();
    for (const asset of release?.assets ?? []) {
      symbols.set(asset.address.toLowerCase(), asset.symbol);
      decimals.set(asset.address.toLowerCase(), asset.decimals);
    }
    return { symbols, decimals };
  }, [release?.assets]);

  const enrichedBets = React.useMemo(
    () =>
      bets.map((row) =>
        enrichBetRow({
          row,
          gameLabelById,
          assetSymbols: assetMaps.symbols,
          assetDecimals: assetMaps.decimals,
          labels: {
            pending: t("portfolio.activity.common.pending"),
            unknownGame: t("portfolio.activity.common.unknownGame"),
            asset: t("portfolio.activity.common.asset"),
            justNow: t("portfolio.activity.time.justNow"),
            minutesAgo: (minutes) => t("portfolio.activity.time.minutesAgo", { minutes }),
            hoursAgo: (hours) => t("portfolio.activity.time.hoursAgo", { hours }),
            daysAgo: (days) => t("portfolio.activity.time.daysAgo", { days })
          }
        })
      ),
    [assetMaps.decimals, assetMaps.symbols, bets, gameLabelById, t]
  );

  const filteredBets = React.useMemo(() => {
    return enrichedBets.filter((item) => {
      if (statusFilter === "open") return isOpenStatus(item.status);
      if (statusFilter === "won") return item.status === "won";
      if (statusFilter === "lost") return isLossStatus(item.status);
      return true;
    });
  }, [enrichedBets, statusFilter]);

  const metrics = React.useMemo<BetMetric[]>(() => {
    const open = enrichedBets.filter((item) => isOpenStatus(item.status)).length;
    const won = enrichedBets.filter((item) => item.status === "won").length;
    const closed = enrichedBets.filter((item) => isLossStatus(item.status)).length;
    return [
      {
        label: t("portfolio.activity.metrics.indexed.label"),
        value: enrichedBets.length.toLocaleString("en-US"),
        detail: sdk?.account
          ? t("portfolio.activity.metrics.indexed.connected", {
              serverRows: serverRows.length,
              localRows: localRows.length
            })
          : t("portfolio.activity.metrics.indexed.disconnected")
      },
      {
        label: t("portfolio.activity.metrics.open.label"),
        value: open.toLocaleString("en-US"),
        detail: t("portfolio.activity.metrics.open.detail")
      },
      {
        label: t("portfolio.activity.metrics.settled.label"),
        value: (won + closed).toLocaleString("en-US"),
        detail: t("portfolio.activity.metrics.settled.detail")
      }
    ];
  }, [enrichedBets, localRows.length, sdk?.account, serverRows.length, t]);

  return (
    <PageTransition pageKey="portfolio-activity">
      <div className="space-y-8">
        <ActivityHero metrics={metrics} />
        <ActivityFilterTabs active={statusFilter} onChange={setStatusFilter} />
        <ActivityLedger rows={filteredBets} loading={isLoading} />
      </div>
    </PageTransition>
  );
}

function enrichBetRow({
  row,
  gameLabelById,
  assetSymbols,
  assetDecimals,
  labels
}: {
  row: BetRow;
  gameLabelById: ReadonlyMap<string, string>;
  assetSymbols: ReadonlyMap<string, string>;
  assetDecimals: ReadonlyMap<string, number>;
  labels: {
    pending: string;
    unknownGame: string;
    asset: string;
    justNow: string;
    minutesAgo: (minutes: number) => string;
    hoursAgo: (hours: number) => string;
    daysAgo: (days: number) => string;
  };
}): EnrichedBetRow {
  const stake = getBigIntField(row, "stake") ?? 0n;
  const payout = getBigIntField(row, "payout");
  const status = mapBetState(row.state, payout, stake);
  const gameLabel = row.gameId
    ? (gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId, labels.pending))
    : labels.unknownGame;
  const assetSymbol = row.asset
    ? (assetSymbols.get(row.asset.toLowerCase()) ?? shortHex(row.asset, labels.pending))
    : labels.asset;
  const decimals = row.asset ? (assetDecimals.get(row.asset.toLowerCase()) ?? 18) : 18;

  return {
    row,
    status,
    gameLabel,
    assetSymbol,
    decimals,
    stake,
    payout,
    outcomeLabel: formatOutcome({
      status,
      stake,
      payout,
      decimals,
      symbol: assetSymbol,
      pendingLabel: labels.pending
    }),
    relativeTime: formatRelativeTime(row.updatedAt, labels)
  };
}
