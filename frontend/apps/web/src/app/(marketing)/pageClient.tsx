"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../app-shell/casino-access";
import { getAppChain, getExplorerAddressUrl } from "../../app-shell/chain-registry";
import { useRecentBets } from "../../features/betting/useRecentBets";
import { getCatalogRooms } from "../../features/casino/catalog";
import { isCasinoModuleSlug } from "../../features/casino/modules";
import { useDisabledGameIds, withoutDisabledRooms } from "../../features/casino/useDisabledGames";
import { ticketMultiplier } from "../../features/home/game-multipliers";
import {
  BetSteps,
  GameStubs,
  HomeHero,
  LiquiditySection,
  TelegramDock,
  VerifyLedger,
  type PoolFigures,
  type TicketStub
} from "../../features/home/home-sections";
import { ReceiptPrinter, type PrintableReceipt } from "../../features/home/receipt-printer";
import { receiptFromRow, splitAmount } from "../../features/receipt/receipt";
import {
  fetchLandingOverview,
  type AssetOverview
} from "../../features/marketing/landing-overview";
import { useRelease } from "../../ssot/release/ReleaseProvider";

/** How many settled bets the printer rotates through. */
const RECEIPT_COUNT = 5;

/** i18n key of a game, from its module slug. */
function gameKey(slug: string) {
  return slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function HomePageClient() {
  const t = useTranslations("home");
  const locale = useLocale();
  const { chainId, release } = useRelease();
  const access = getCasinoAccess(chainId);
  const chain = getAppChain(chainId);
  const chainName = chain?.name ?? String(chainId);
  const houseEdgeBps = release?.defaultHouseEdgeBps ?? 0;
  const houseEdgeRate = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2
  }).format(houseEdgeBps / 10_000);

  // Unsettled bets are skipped, so read more rows than the printer shows.
  const recentBets = useRecentBets({ errorMessage: t("receipt.error"), limit: 20 });
  const receipts = React.useMemo<PrintableReceipt[]>(() => {
    if (!release) return [];
    const slugById = new Map(release.gamesMeta.map((game) => [game.gameId, game.slug]));
    const assetByAddress = new Map(release.assets.map((asset) => [asset.address, asset]));
    const fallbackAsset = release.assets[0];
    const printable: PrintableReceipt[] = [];
    for (const row of recentBets.data ?? []) {
      const asset = (row.asset && assetByAddress.get(row.asset.toLowerCase())) || fallbackAsset;
      const slug = row.gameId ? slugById.get(row.gameId.toLowerCase()) : undefined;
      // The printer shows settled bets; refunds and voids have their own receipts.
      if (row.state !== "finalized" || !asset || !slug || !isCasinoModuleSlug(slug)) continue;
      const receipt = receiptFromRow(row, { chainId, decimals: asset.decimals });
      if (!receipt) continue;
      printable.push({
        ...receipt,
        game: t(`games.items.${gameKey(slug)}.name`),
        symbol: asset.symbol
      });
      if (printable.length === RECEIPT_COUNT) break;
    }
    return printable;
  }, [chainId, recentBets.data, release, t]);

  const disabledGameIds = useDisabledGameIds();
  const stubs = React.useMemo<TicketStub[]>(
    () =>
      withoutDisabledRooms(getCatalogRooms(release?.gamesMeta), release?.gamesMeta, disabledGameIds)
        .filter((room) => isCasinoModuleSlug(room.slug))
        .map((room) => {
          const { value, fixed } = ticketMultiplier(
            room.slug as Parameters<typeof ticketMultiplier>[0],
            houseEdgeBps
          );
          return { key: gameKey(room.slug), href: room.href, multiplier: value, fixed };
        }),
    [disabledGameIds, houseEdgeBps, release?.gamesMeta]
  );
  const maxRounds = release?.gamesMeta.reduce((max, game) => Math.max(max, game.maxBetCount), 0);

  const overview = useQuery({
    queryKey: ["ssot", "landing", "asset-overview", chainId, release?.releaseDigest],
    enabled: Boolean(release),
    queryFn: () => fetchLandingOverview(chainId, release!.releaseDigest),
    retry: 1
  });
  const poolFigures = React.useMemo<PoolFigures[]>(() => {
    // After a failed refresh the cached balances are no longer current, so they are not shown.
    const read = overview.data && !overview.isError ? sumByAsset(overview.data.assets) : undefined;
    // A figure that cannot be read shows a dash; the assets still come from the release.
    return (read ?? release?.assets ?? []).map((asset) => {
      const figures = "lpCapital" in asset ? asset : undefined;
      // Balances carry no sign; only a net result does.
      const cut = (value: bigint) => ({
        ...splitAmount(value, asset.decimals, Math.min(2, asset.decimals)),
        sign: "" as const
      });
      return {
        symbol: asset.symbol,
        pool: figures ? cut(figures.lpCapital) : undefined,
        free: figures
          ? cut(
              figures.lpCapital > figures.lockedCapital
                ? figures.lpCapital - figures.lockedCapital
                : 0n
            )
          : undefined,
        turnover: figures ? cut(figures.turnover) : undefined
      };
    });
  }, [overview.data, overview.isError, release?.assets]);

  const refundWait = release?.refundTimeoutSeconds
    ? release.refundTimeoutSeconds % 3600 === 0
      ? t("steps.hours", { count: release.refundTimeoutSeconds / 3600 })
      : t("steps.minutes", { count: Math.ceil(release.refundTimeoutSeconds / 60) })
    : undefined;
  const diceModule = release?.gamesMeta.find((game) => game.slug === "dice")?.module;

  return (
    <div className="bg-paper font-text text-body text-carbon">
      <HomeHero
        access={access}
        chainName={chainName}
        printer={
          <ReceiptPrinter
            receipts={receipts}
            status={recentBets.isPending ? "loading" : recentBets.isError ? "error" : "ready"}
            chainName={chainName}
            houseEdgeRate={houseEdgeRate}
            caption={
              chain?.environment === "testnet" ? t("receipt.captionTestnet") : t("receipt.caption")
            }
          />
        }
      />
      <VerifyLedger
        houseEdgeRate={houseEdgeRate}
        links={{
          results: getExplorerAddressUrl(chainId, release?.contracts.vrfHub),
          rules: getExplorerAddressUrl(chainId, diceModule),
          houseEdge: getExplorerAddressUrl(chainId, release?.contracts.gameHub),
          changes: getExplorerAddressUrl(chainId, release?.contracts.governanceTimelock)
        }}
      />
      <GameStubs stubs={stubs} houseEdgeRate={houseEdgeRate} maxRounds={maxRounds || undefined} />
      <BetSteps refundWait={refundWait} />
      <LiquiditySection figures={poolFigures} />
      {access === "preview" ? <TelegramDock /> : null}
    </div>
  );
}

/** Banks that hold the same asset add up; different assets never do. */
function sumByAsset(rows: readonly AssetOverview[]): AssetOverview[] {
  const byAsset = new Map<string, AssetOverview>();
  for (const row of rows) {
    const key = row.address.toLowerCase();
    const existing = byAsset.get(key);
    byAsset.set(
      key,
      existing
        ? {
            ...existing,
            lpCapital: existing.lpCapital + row.lpCapital,
            lockedCapital: existing.lockedCapital + row.lockedCapital,
            turnover: existing.turnover + row.turnover,
            protocolFee: existing.protocolFee + row.protocolFee
          }
        : row
    );
  }
  return [...byAsset.values()];
}
