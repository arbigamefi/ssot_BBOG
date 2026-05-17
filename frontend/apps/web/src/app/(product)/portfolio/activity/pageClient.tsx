"use client";

import * as React from "react";
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
import { useBets } from "../../../../features/betting/useBets";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";

export function PortfolioActivityPageClient() {
  const { release } = useRelease();
  const { data: bets = [], isLoading } = useBets(500);
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
          assetDecimals: assetMaps.decimals
        })
      ),
    [assetMaps.decimals, assetMaps.symbols, bets, gameLabelById]
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
        label: "Indexed tickets",
        value: enrichedBets.length.toLocaleString("en-US"),
        detail: "Rows loaded from the local replayable index."
      },
      {
        label: "Open tickets",
        value: open.toLocaleString("en-US"),
        detail: "Placed or VRF-ready tickets that still need closure."
      },
      {
        label: "Settled outcomes",
        value: (won + closed).toLocaleString("en-US"),
        detail: "Tickets with final win, loss, refund, or failure state."
      }
    ];
  }, [enrichedBets]);

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
  assetDecimals
}: {
  row: BetRow;
  gameLabelById: ReadonlyMap<string, string>;
  assetSymbols: ReadonlyMap<string, string>;
  assetDecimals: ReadonlyMap<string, number>;
}): EnrichedBetRow {
  const stake = getBigIntField(row, "stake") ?? 0n;
  const payout = getBigIntField(row, "payout");
  const status = mapBetState(row.state, payout, stake);
  const gameLabel = row.gameId
    ? (gameLabelById.get(row.gameId.toLowerCase()) ?? shortHex(row.gameId))
    : "Unknown game";
  const assetSymbol = row.asset
    ? (assetSymbols.get(row.asset.toLowerCase()) ?? shortHex(row.asset))
    : "Asset";
  const decimals = row.asset ? (assetDecimals.get(row.asset.toLowerCase()) ?? 18) : 18;

  return {
    row,
    status,
    gameLabel,
    assetSymbol,
    decimals,
    stake,
    payout,
    outcomeLabel: formatOutcome({ status, stake, payout, decimals, symbol: assetSymbol }),
    relativeTime: formatRelativeTime(row.updatedAt)
  };
}
