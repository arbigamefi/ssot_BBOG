import { getCasinoCashReturned } from "@ssot/bet-index/financials";
import * as React from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { mapBetState, shortHex, type GameMeta } from "./model";
import {
  applyHouseEdgeToMultiplier,
  baccaratMultiplier,
  kenoMaxMultiplier,
  plinkoMaxMultiplier,
  rouletteReserveMultiplier,
  sicBoMultiplier,
  slotsMaxMultiplier
} from "./params";
import {
  formatHouseEdge,
  resolveHouseEdgeBps,
  type ReleaseGamePresentationMeta,
  type ReleasePresentationMeta
} from "./presentation";
import { usePlayerBets } from "../../betting/usePlayerBets";
import { useCasinoLeaderboard, useCasinoStats, useCasinoTimeseries } from "../useCasinoStats";
import { formatTokenAmount } from "../../marketing/format";
import { TrendChart, formatDayLabel, type TrendChartPoint } from "../../charts/TrendChart";
import {
  getAppChain,
  getExplorerAddressUrl,
  getExplorerTxUrl
} from "../../../app-shell/chain-registry";
import type { PoolAssetContext } from "../../assets/pool-asset";

/** Loose row shape that covers both the indexer `BetRow` and any test stub. */
export type GameAuditBet = {
  id?: string;
  betId: string | number | bigint;
  player?: string;
  state?: string;
  stake?: string | bigint | number;
  payout?: string | bigint | number;
  refundAmount?: string | bigint | number;
  updatedAt?: number;
  gameId?: string;
  /** Per-row pool/asset metadata from durable index rows. Needed for mixed-asset rooms. */
  poolId?: string | number;
  asset?: string;
  /** Indexer-supplied tx hashes — used for explorer links. */
  finalizedTxHash?: string;
  terminalTxHash?: string;
  lastTxHash?: string;
};

type AuditTab = "live" | "mine" | "leaderboard" | "analytics" | "info";
const AUDIT_TABS: readonly AuditTab[] = ["live", "mine", "leaderboard", "analytics", "info"];
type StateFilter = "all" | "pending" | "won" | "lost" | "refunded";

type GameInfoBet = {
  key: string;
  label: string;
  coverage: string;
  multiplier: string;
};

type Translate = ReturnType<typeof useTranslations>;

/**
 * Track which bet IDs the user has already seen, per tab.
 * When new finalized+win rows appear in a tab that isn't active, we surface
 * an unread badge until the user clicks that tab.
 */
type UnreadTab = "live" | "mine";

function emptyUnread(): Record<AuditTab, number> {
  return { live: 0, mine: 0, leaderboard: 0, analytics: 0, info: 0 };
}

function useUnreadBadge(
  liveRows: readonly GameAuditBet[],
  myRows: readonly GameAuditBet[],
  activeTab: AuditTab
) {
  // Only the row-feed tabs (live / mine) carry an unread concept. Leaderboard
  // and analytics are aggregate views with no per-row "new" signal.
  const seenRef = React.useRef<Record<UnreadTab, Set<string>>>({
    live: new Set(),
    mine: new Set()
  });
  const [unread, setUnread] = React.useState<Record<AuditTab, number>>(emptyUnread);

  // On first render, mark everything currently visible as seen — we don't
  // want stale rows to count as "new" the moment the user lands on the page.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    for (const row of liveRows) seenRef.current.live.add(String(row.betId));
    for (const row of myRows) seenRef.current.mine.add(String(row.betId));
  }, [liveRows, myRows]);

  const bump = React.useCallback(
    (tab: UnreadTab, rows: readonly GameAuditBet[]) => {
      const seen = seenRef.current[tab];
      let added = 0;
      for (const row of rows) {
        const id = String(row.betId);
        if (seen.has(id)) continue;
        seen.add(id);
        added += 1;
      }
      if (added > 0 && tab !== activeTab) {
        setUnread((prev) => ({ ...prev, [tab]: prev[tab] + added }));
      }
    },
    [activeTab]
  );

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    bump("live", liveRows);
  }, [bump, liveRows]);
  React.useEffect(() => {
    if (!hydratedRef.current) return;
    bump("mine", myRows);
  }, [bump, myRows]);

  // Clearing on activate is intentional — clicking the tab acknowledges new rows.
  const clear = React.useCallback((tab: AuditTab) => {
    setUnread((prev) => (prev[tab] === 0 ? prev : { ...prev, [tab]: 0 }));
  }, []);

  return { unread, clear };
}

export function GameRoomAuditLedger({
  game,
  betAmount: _betAmount,
  recentBets,
  playerAddress,
  assetAddress,
  assetSymbol = "UNIT",
  assetDecimals = 6,
  assetContexts = [],
  chainId,
  gameMeta,
  releaseMeta
}: {
  game: GameMeta;
  /** Currently unused — kept for backward compat with existing callers. */
  betAmount?: number;
  recentBets: readonly GameAuditBet[];
  playerAddress?: string;
  assetAddress?: string;
  assetSymbol?: string;
  assetDecimals?: number;
  /** Active casino pool assets on this release; used to format mixed-asset row feeds. */
  assetContexts?: readonly PoolAssetContext[];
  /** Active chain — drives explorer links and the chain badge in the header. */
  chainId?: number;
  /** Release metadata for fixed, chain-configured game presentation values. */
  gameMeta?: ReleaseGamePresentationMeta;
  /** Release defaults, including the chain's default house edge. */
  releaseMeta?: ReleasePresentationMeta;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [stateFilter, setStateFilter] = React.useState<StateFilter>("all");

  // Tab is URL-driven (?tab=) so it's deep-linkable, shareable, and survives
  // refresh. Falls back to "live" for missing/invalid values.
  const tabParam = searchParams.get("tab");
  const activeTab: AuditTab = AUDIT_TABS.includes(tabParam as AuditTab)
    ? (tabParam as AuditTab)
    : "live";

  const playerBetsQuery = usePlayerBets({
    enabled: Boolean(playerAddress && activeTab === "mine"),
    player: playerAddress,
    limit: 50
  });
  const playerBets = React.useMemo(
    () =>
      (playerBetsQuery.data ?? []).filter(
        (row) => !game.gameId || row.gameId?.toLowerCase() === game.gameId.toLowerCase()
      ),
    [game.gameId, playerBetsQuery.data]
  );
  const filteredPlayerBets = React.useMemo(
    () => playerBets.filter((row) => matchesStateFilter(row, stateFilter)),
    [playerBets, stateFilter]
  );

  const { unread, clear } = useUnreadBadge(recentBets, playerBets, activeTab);

  const handleTab = React.useCallback(
    (tab: AuditTab) => {
      clear(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "live") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [clear, pathname, router, searchParams]
  );

  const chain = chainId != null ? getAppChain(chainId) : undefined;

  const tabs: Array<{ id: AuditTab; label: string }> = [
    { id: "live", label: t("casino.room.audit.tabs.live") },
    { id: "mine", label: t("casino.room.audit.tabs.mine") },
    { id: "leaderboard", label: t("casino.room.audit.tabs.leaderboard") },
    { id: "analytics", label: t("casino.room.audit.tabs.analytics") },
    { id: "info", label: t("casino.room.audit.tabs.info") }
  ];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.18), transparent)"
        }}
      />
      <div className="flex flex-col gap-3 border-b border-border-soft md:flex-row md:items-center md:justify-between">
        <nav
          aria-label={t("casino.room.audit.tabs.live")}
          className="flex items-stretch gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            const unreadCount = unread[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTab(tab.id)}
                className={cn(
                  "relative whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors md:px-4 md:py-4 md:text-sm",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-fg-subtle hover:text-fg"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  {tab.label}
                  {!active && unreadCount > 0 && (
                    <span
                      role="status"
                      aria-label={t("casino.room.audit.newActivityBadge", { n: unreadCount })}
                      className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold leading-none text-fg-inverse motion-safe:animate-pulse"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
        {chain && (
          <div className="mr-4 hidden shrink-0 items-center gap-2 rounded-full border border-border-soft bg-surface-1 px-3 py-1 md:mr-6 md:flex">
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                chain.environment === "mainnet" ? "bg-brand" : "bg-accent"
              )}
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
              {t("casino.room.audit.onChain", { chain: chain.shortName })}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-5 md:px-6 md:py-6">
        {activeTab === "live" && (
          <BetTable
            rows={recentBets}
            kind="live"
            t={t}
            assetSymbol={assetSymbol}
            assetDecimals={assetDecimals}
            assetContexts={assetContexts}
            emptyKey="live"
            chainId={chainId}
          />
        )}
        {activeTab === "mine" && (
          <MyBetsPanel
            connected={Boolean(playerAddress)}
            isLoading={playerBetsQuery.isLoading}
            rows={filteredPlayerBets}
            t={t}
            assetSymbol={assetSymbol}
            assetDecimals={assetDecimals}
            assetContexts={assetContexts}
            chainId={chainId}
            stateFilter={stateFilter}
            onStateFilterChange={setStateFilter}
          />
        )}
        {activeTab === "leaderboard" && (
          <LeaderboardPanel
            gameId={game.gameId}
            t={t}
            locale={locale}
            assetSymbol={assetSymbol}
            assetDecimals={assetDecimals}
            assetAddress={assetAddress}
            chainId={chainId}
            playerAddress={playerAddress}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsPanel
            assetAddress={assetAddress}
            assetSymbol={assetSymbol}
            assetDecimals={assetDecimals}
            gameId={game.gameId}
            t={t}
            locale={locale}
          />
        )}
        {activeTab === "info" && (
          <GameInfoPanel slug={game.slug} t={t} gameMeta={gameMeta} releaseMeta={releaseMeta} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Bet tables
 * ──────────────────────────────────────────────────────────────────────── */

function BetTable({
  rows,
  kind,
  t,
  assetSymbol,
  assetDecimals,
  assetContexts,
  emptyKey,
  multipliers,
  chainId
}: {
  rows: readonly GameAuditBet[];
  kind: "live" | "mine" | "top";
  t: Translate;
  assetSymbol: string;
  assetDecimals: number;
  assetContexts?: readonly PoolAssetContext[];
  emptyKey: "live" | "mine" | "top";
  multipliers?: number[];
  chainId?: number;
}) {
  if (rows.length === 0) {
    return <EmptyState message={t(`casino.room.audit.emptyStates.${emptyKey}`)} />;
  }

  const showTime = kind !== "top";
  const showPlayer = kind !== "mine";
  const showState = kind === "mine";
  const gridStyle = { gridTemplateColumns: tableColumnTemplate(showTime, showPlayer, showState) };
  const chain = chainId != null ? getAppChain(chainId) : undefined;

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="min-w-[640px]">
        <header
          style={gridStyle}
          className="grid items-center gap-3 border-b border-border-soft pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle"
        >
          {showTime && <span>{t("casino.room.audit.columns.time")}</span>}
          {showPlayer && <span>{t("casino.room.audit.columns.player")}</span>}
          <span>{t("casino.room.audit.columns.stake")}</span>
          <span>{t("casino.room.audit.columns.multiplier")}</span>
          <span>{t("casino.room.audit.columns.payout")}</span>
          {showState && <span>{t("casino.room.audit.columns.state")}</span>}
          <span className="text-right">·</span>
        </header>
        <ol className="mt-2 flex flex-col gap-1.5">
          {rows.map((row, index) => {
            const betId = String(row.betId);
            const stake = toBigOrNull(row.stake);
            const payout = getCasinoCashReturned(row) ?? null;
            const rowAsset = resolveRowAsset(row, {
              assetContexts,
              fallbackDecimals: assetDecimals,
              fallbackSymbol: assetSymbol
            });
            const multiplier = multipliers?.[index] ?? computeMultiplier(stake, payout);
            const isWin = stake != null && payout != null && payout > stake;
            const isLoss =
              stake != null && payout != null && payout < stake && row.state === "finalized";
            const txHash = row.finalizedTxHash ?? row.terminalTxHash ?? row.lastTxHash;
            const explorerUrl = getExplorerTxUrl(chainId, txHash);
            const playerExplorerUrl = getExplorerAddressUrl(chainId, row.player);
            return (
              <li
                key={row.id ?? `${betId}-${index}`}
                style={gridStyle}
                className="grid items-center gap-3 rounded-lg border border-border-soft bg-surface-0 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
              >
                {showTime && (
                  <span className="font-mono text-xs text-fg-muted">
                    {formatRelativeTime(row.updatedAt, t)}
                  </span>
                )}
                {showPlayer && (
                  <span className="font-mono text-xs text-fg">
                    {playerExplorerUrl ? (
                      <a
                        href={playerExplorerUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-brand"
                      >
                        {shortHex(row.player)}
                      </a>
                    ) : (
                      shortHex(row.player)
                    )}
                  </span>
                )}
                <span className="font-mono text-xs font-semibold text-fg">
                  {formatAmount(stake, rowAsset.decimals, rowAsset.symbol)}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    multiplier == null
                      ? "text-fg-subtle"
                      : multiplier >= 1
                        ? "text-accent"
                        : "text-fg-subtle"
                  )}
                >
                  {multiplier == null ? "—" : `${multiplier.toFixed(2)}×`}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    isWin ? "text-success" : isLoss ? "text-fg-subtle opacity-70" : "text-fg-muted"
                  )}
                >
                  {formatAmount(payout, rowAsset.decimals, rowAsset.symbol)}
                </span>
                {showState && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                    {labelForState(row.state, t)}
                  </span>
                )}
                <RowLink
                  betId={betId}
                  explorerUrl={explorerUrl}
                  chainShortName={chain?.shortName}
                  t={t}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function RowLink({
  betId,
  explorerUrl,
  chainShortName,
  t
}: {
  betId: string;
  explorerUrl: string | null;
  chainShortName?: string;
  t: Translate;
}) {
  const base =
    "ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-border-soft bg-surface-1 text-fg-muted transition-colors hover:border-brand/40 hover:text-fg";
  if (explorerUrl) {
    const label = chainShortName
      ? t("casino.room.audit.openOnExplorerWithChain", { chain: chainShortName })
      : t("casino.room.audit.openOnExplorer");
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        className={base}
      >
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
      </a>
    );
  }
  // Fallback: internal portfolio route still works even without a tx hash
  // (e.g. for very-fresh local-only bets the indexer hasn't seen).
  return (
    <Link
      href={`/portfolio/activity/${betId}`}
      aria-label={t("casino.room.audit.viewBet", { betId })}
      className={base}
    >
      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
    </Link>
  );
}

function MyBetsPanel({
  connected,
  isLoading,
  rows,
  t,
  assetSymbol,
  assetDecimals,
  assetContexts,
  chainId,
  stateFilter,
  onStateFilterChange
}: {
  connected: boolean;
  isLoading: boolean;
  rows: readonly GameAuditBet[];
  t: Translate;
  assetSymbol: string;
  assetDecimals: number;
  assetContexts?: readonly PoolAssetContext[];
  chainId?: number;
  stateFilter: StateFilter;
  onStateFilterChange: (next: StateFilter) => void;
}) {
  if (!connected) {
    return <EmptyState message={t("casino.room.audit.emptyStates.connectWallet")} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <StateFilterStrip value={stateFilter} onChange={onStateFilterChange} t={t} />
      {isLoading && rows.length === 0 ? (
        <EmptyState message="…" />
      ) : (
        <BetTable
          rows={rows}
          kind="mine"
          t={t}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          assetContexts={assetContexts}
          emptyKey="mine"
          chainId={chainId}
        />
      )}
    </div>
  );
}

function StateFilterStrip({
  value,
  onChange,
  t
}: {
  value: StateFilter;
  onChange: (next: StateFilter) => void;
  t: Translate;
}) {
  const options: StateFilter[] = ["all", "pending", "won", "lost", "refunded"];
  return (
    <div role="tablist" aria-label="state" className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-border-soft bg-surface-0 text-fg-muted hover:border-brand/40 hover:text-fg"
            )}
          >
            {t(`casino.room.audit.filters.${opt}`)}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Game info tab
 * ──────────────────────────────────────────────────────────────────────── */

function GameInfoPanel({
  slug,
  t,
  gameMeta,
  releaseMeta
}: {
  slug: string;
  t: Translate;
  gameMeta?: ReleaseGamePresentationMeta;
  releaseMeta?: ReleasePresentationMeta;
}) {
  const tagline = safeT(t, `casino.room.gameInfo.${slug}.tagline`);
  const houseEdge = formatHouseEdge(gameMeta, slug, releaseMeta);
  const houseEdgeBps = resolveHouseEdgeBps(gameMeta, slug, releaseMeta);
  const bets = readBets(t, slug).map((bet) => applyGameInfoMultiplier(bet, slug, houseEdgeBps, t));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="rounded-xl border border-border-soft bg-surface-0 p-5 shadow-e1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
          {t("casino.room.audit.howToPlayLabel")}
        </div>
        <p className="mt-2 text-sm leading-6 text-fg">{tagline}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            {t("casino.room.audit.houseEdgeLabel")}
          </span>
          <span className="font-mono text-xs font-bold text-accent">{houseEdge}</span>
        </div>
      </aside>

      <section className="rounded-xl border border-border-soft bg-surface-0 p-5 shadow-e1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
          {t("casino.room.audit.betTypesLabel")}
        </div>
        <div className="mt-3 overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                <th className="pb-2 pr-4 font-bold">{t("casino.room.audit.columns.bet")}</th>
                <th className="pb-2 pr-4 font-bold">{t("casino.room.audit.columns.coverage")}</th>
                <th className="pb-2 font-bold">{t("casino.room.audit.columns.multiplier")}</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet, index) => (
                <tr
                  key={bet.key}
                  className={cn(
                    "border-t border-border-soft transition-colors hover:bg-surface-2",
                    index === 0 && "border-t-0"
                  )}
                >
                  <td className="py-2 pr-4 font-semibold text-fg">{bet.label}</td>
                  <td className="py-2 pr-4 text-fg-muted">{bet.coverage}</td>
                  <td className="py-2 font-mono font-bold text-accent">{bet.multiplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-fg-muted">
          {t("casino.room.audit.infoFormulaNote")}
        </p>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Leaderboard tab
 * ──────────────────────────────────────────────────────────────────────── */

type LeaderboardView = "turnover" | "topWin";

function LeaderboardPanel({
  gameId,
  t,
  locale,
  assetAddress,
  assetSymbol,
  assetDecimals,
  chainId,
  playerAddress
}: {
  gameId?: string;
  t: Translate;
  locale: string;
  assetAddress?: string;
  assetSymbol: string;
  assetDecimals: number;
  chainId?: number;
  /** Connected wallet — its row/card is highlighted as "You" when present. */
  playerAddress?: string;
}) {
  const [view, setView] = React.useState<LeaderboardView>("turnover");
  const [windowDays, setWindowDays] = React.useState<number | undefined>(undefined);
  const me = playerAddress?.toLowerCase();
  const board = useCasinoLeaderboard({
    asset: assetAddress,
    by: view,
    gameId,
    limit: 10,
    windowDays,
    player: playerAddress
  });

  const rows = board.data?.rows ?? [];
  const unavailable = board.data?.source === "unavailable";
  const chain = chainId != null ? getAppChain(chainId) : undefined;
  const turnoverRows: LeaderboardRow[] = rows.flatMap((row) => {
    if (row.betCount == null || row.settledCount == null || row.turnover == null) return [];
    return [
      {
        betCount: row.betCount,
        player: row.player,
        rank: row.rank,
        turnover: row.turnover
      }
    ];
  });
  const topWinRows = rows.flatMap((row): GameAuditBet[] => {
    if (!row.betId || !row.stake || !row.multiplierPpm) return [];
    return [
      {
        betId: row.betId,
        gameId: row.gameId,
        id: `top-win:${row.betId}`,
        payout: row.payout,
        refundAmount: "0",
        player: row.player,
        stake: row.stake,
        state: "finalized"
      }
    ];
  });
  const topWinMultipliers = rows.flatMap((row) =>
    row.betId && row.stake && row.multiplierPpm ? [Number(row.multiplierPpm) / 1_000_000] : []
  );
  const hasRenderableRows = view === "topWin" ? topWinRows.length > 0 : turnoverRows.length > 0;

  // "Your rank" — only when the connected wallet is ranked but sits outside the
  // rendered top rows (otherwise the inline "You" highlight already covers it).
  const youRank = board.data?.you ?? null;
  const meInTopRows = !!me && turnoverRows.some((row) => row.player.toLowerCase() === me);
  const showYourRank =
    view === "turnover" && !!me && !!youRank && !meInTopRows && playerAddress != null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* turnover ↔ top-wins toggle */}
        <div
          role="tablist"
          aria-label={t("casino.room.audit.leaderboard.title")}
          className="flex gap-1.5"
        >
          {(["turnover", "topWin"] as LeaderboardView[]).map((option) => {
            const active = option === view;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border-soft bg-surface-0 text-fg-muted hover:border-brand/40 hover:text-fg"
                )}
              >
                {t(`casino.room.audit.leaderboard.views.${option}`)}
              </button>
            );
          })}
        </div>
        <WindowToggle value={windowDays} onChange={setWindowDays} t={t} />
      </div>

      {unavailable || !hasRenderableRows ? (
        <EmptyState message={t("casino.room.audit.leaderboard.empty")} />
      ) : view === "topWin" ? (
        <BetTable
          rows={topWinRows}
          kind="top"
          t={t}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          emptyKey="top"
          multipliers={topWinMultipliers}
          chainId={chainId}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Podium — top 3 get a dedicated gold/silver/bronze treatment to
              drive aspiration. Reordered to silver-gold-bronze for a podium
              shape on >=sm. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {podiumOrder(turnoverRows.slice(0, 3)).map((row) => (
              <PodiumCard
                key={row.player}
                row={row}
                t={t}
                locale={locale}
                assetSymbol={assetSymbol}
                assetDecimals={assetDecimals}
                chainId={chainId}
                isMe={!!me && row.player.toLowerCase() === me}
              />
            ))}
          </div>

          {/* Ranks 4+ as a compact list. */}
          {turnoverRows.length > 3 && (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[420px]">
                <header className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 border-b border-border-soft pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                  <span>#</span>
                  <span>{t("casino.room.audit.columns.player")}</span>
                  <span className="text-right">{t("casino.room.audit.columns.bets")}</span>
                  <span className="text-right">{t("casino.room.audit.columns.volume")}</span>
                </header>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {turnoverRows.slice(3).map((row) => {
                    const explorer = getExplorerAddressUrl(chainId, row.player);
                    const isMe = !!me && row.player.toLowerCase() === me;
                    return (
                      <li
                        key={row.player}
                        className={cn(
                          "grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                          isMe ? "border-brand/60 bg-brand-soft" : "border-border-soft bg-surface-0"
                        )}
                      >
                        <span className="font-mono text-xs font-bold text-fg-subtle">
                          {row.rank}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-fg">
                          {explorer ? (
                            <a
                              href={explorer}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="truncate hover:text-brand"
                            >
                              {shortHex(row.player)}
                            </a>
                          ) : (
                            <span className="truncate">{shortHex(row.player)}</span>
                          )}
                          {isMe && <YouPill t={t} />}
                        </span>
                        <span className="text-right font-mono text-xs text-fg-muted">
                          {row.betCount.toLocaleString(locale)}
                        </span>
                        <span className="text-right font-mono text-xs font-bold text-fg">
                          {formatTokenAmount(
                            BigInt(row.turnover),
                            assetDecimals,
                            assetSymbol,
                            locale
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}

          {/* Your position — surfaced when the connected wallet is ranked but
              outside the visible top rows, so players always see where they
              stand (and how far to climb). */}
          {showYourRank && youRank && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                {t("casino.room.audit.leaderboard.yourPosition")}
              </span>
              <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[420px]">
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border border-brand/60 bg-brand-soft px-4 py-3 text-sm ring-2 ring-brand">
                    <span className="font-mono text-xs font-bold text-brand">{youRank.rank}</span>
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-fg">
                      <span className="truncate">{shortHex(playerAddress)}</span>
                      <YouPill t={t} />
                    </span>
                    <span className="text-right font-mono text-xs text-fg-muted">
                      {youRank.betCount.toLocaleString(locale)}
                    </span>
                    <span className="text-right font-mono text-xs font-bold text-fg">
                      {formatTokenAmount(
                        BigInt(youRank.turnover),
                        assetDecimals,
                        assetSymbol,
                        locale
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {chain && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {t("casino.room.audit.onChain", { chain: chain.shortName })} ·{" "}
          {t(
            view === "topWin"
              ? "casino.room.audit.leaderboard.scopeTopWin"
              : "casino.room.audit.leaderboard.scope"
          )}
        </p>
      )}
    </div>
  );
}

type LeaderboardRow = {
  rank: number;
  player: string;
  betCount: number;
  turnover: string;
};

/** Reorder [1st,2nd,3rd] → [2nd,1st,3rd] so the winner sits center on a podium. */
function podiumOrder(top: readonly LeaderboardRow[]): LeaderboardRow[] {
  if (top.length === 3) return [top[1]!, top[0]!, top[2]!];
  return [...top];
}

const PODIUM_STYLE: Record<number, { ring: string; medal: string; label: string }> = {
  1: { ring: "border-accent/60 bg-accent-soft", medal: "bg-accent text-fg-inverse", label: "🥇" },
  2: { ring: "border-border bg-surface-2", medal: "bg-surface-3 text-fg", label: "🥈" },
  3: { ring: "border-border-soft bg-surface-1", medal: "bg-surface-3 text-fg-muted", label: "🥉" }
};

function PodiumCard({
  row,
  t,
  locale,
  assetSymbol,
  assetDecimals,
  chainId,
  isMe
}: {
  row: LeaderboardRow;
  t: Translate;
  locale: string;
  assetSymbol: string;
  assetDecimals: number;
  chainId?: number;
  isMe?: boolean;
}) {
  const style = PODIUM_STYLE[row.rank] ?? PODIUM_STYLE[3]!;
  const explorer = getExplorerAddressUrl(chainId, row.player);
  // The winner card lifts slightly to read as a podium center.
  const elevated = row.rank === 1;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 text-center shadow-e1",
        style.ring,
        elevated && "sm:-translate-y-2",
        isMe && "ring-2 ring-brand"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
          style.medal
        )}
        aria-hidden
      >
        {style.label}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-fg">
        {explorer ? (
          <a href={explorer} target="_blank" rel="noreferrer noopener" className="hover:text-brand">
            {shortHex(row.player)}
          </a>
        ) : (
          shortHex(row.player)
        )}
        {isMe && <YouPill t={t} />}
      </span>
      <span
        className="w-full truncate font-mono text-sm font-bold text-fg"
        title={formatTokenAmount(BigInt(row.turnover), assetDecimals, assetSymbol, locale)}
      >
        {formatTokenAmount(BigInt(row.turnover), assetDecimals, assetSymbol, locale)}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        {row.betCount.toLocaleString(locale)} {t("casino.room.audit.columns.bets")}
      </span>
    </div>
  );
}

/** Small "You" marker for the connected wallet's leaderboard row/card. */
function YouPill({ t }: { t: Translate }) {
  return (
    <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-fg-inverse">
      {t("casino.room.audit.leaderboard.you")}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Analytics tab
 * ──────────────────────────────────────────────────────────────────────── */

/** Ratio of two bigint strings as a percentage string, e.g. "99.01%". */
function percentOf(numerator: string, denominator: string): string | null {
  const den = BigInt(denominator || "0");
  if (den === 0n) return null;
  const num = BigInt(numerator || "0");
  // basis points for 2-decimal precision
  const bps = Number((num * 10000n) / den) / 100;
  return `${bps.toFixed(2)}%`;
}

/** Analytics dimension: the current game vs the whole casino. */
type AnalyticsScope = "game" | "all";

/** Time windows offered on analytics + leaderboard. `days` undefined = all-time. */
const WINDOW_OPTIONS: Array<{ days?: number; key: "all" | "d1" | "d7" | "d30" }> = [
  { key: "all" },
  { days: 1, key: "d1" },
  { days: 7, key: "d7" },
  { days: 30, key: "d30" }
];

/** Shared 24h / 7d / 30d / All time-range selector. */
function WindowToggle({
  value,
  onChange,
  t
}: {
  value?: number;
  onChange: (days?: number) => void;
  t: Translate;
}) {
  return (
    <div
      role="tablist"
      aria-label={t("casino.room.audit.analytics.windowLabel")}
      className="flex flex-wrap gap-1.5"
    >
      {WINDOW_OPTIONS.map((option) => {
        const active = option.days === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.days)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-border-soft bg-surface-0 text-fg-muted hover:border-brand/40 hover:text-fg"
            )}
          >
            {t(`casino.room.audit.analytics.windows.${option.key}`)}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsPanel({
  assetAddress,
  assetSymbol,
  assetDecimals,
  gameId,
  t,
  locale
}: {
  assetAddress?: string;
  assetSymbol: string;
  assetDecimals: number;
  gameId?: string;
  t: Translate;
  locale: string;
}) {
  const [scope, setScope] = React.useState<AnalyticsScope>("game");
  const [windowDays, setWindowDays] = React.useState<number | undefined>(undefined);
  const stats = useCasinoStats({ asset: assetAddress, windowDays });
  // "All games" drops the per-game filter on both the metrics and the trend.
  const timeseries = useCasinoTimeseries({
    asset: assetAddress,
    days: 7,
    gameId: scope === "all" ? undefined : gameId
  });
  const game = stats.data?.games.find(
    (g) => !gameId || g.gameId.toLowerCase() === gameId.toLowerCase()
  );
  const metrics = scope === "all" ? stats.data?.stats : game;
  const unavailable = stats.data?.source === "unavailable";
  const decimals = stats.data?.asset.decimals ?? assetDecimals;
  const symbol = stats.data?.asset.symbol ?? assetSymbol;
  const trendPoints = timeseries.data?.source === "postgres" ? timeseries.data.points : [];

  // This game ↔ all games. Stays mounted even on the empty state so the player
  // can switch back to a populated scope.
  const scopeToggle = (
    <div role="tablist" aria-label={t("casino.room.audit.tabs.analytics")} className="flex gap-1.5">
      {(["game", "all"] as AnalyticsScope[]).map((option) => {
        const active = option === scope;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setScope(option)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-border-soft bg-surface-0 text-fg-muted hover:border-brand/40 hover:text-fg"
            )}
          >
            {t(`casino.room.audit.analytics.views.${option}`)}
          </button>
        );
      })}
    </div>
  );

  if (unavailable || !metrics) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {scopeToggle}
          <WindowToggle value={windowDays} onChange={setWindowDays} t={t} />
        </div>
        <EmptyState message={t("casino.room.audit.analytics.empty")} />
      </div>
    );
  }

  // RTP = total payout / total wagered. Gain ratio = winning bets / all bets.
  // Both are indexed best-effort observations, not the contract's design edge.
  const rtp = percentOf(metrics.payout, metrics.turnover);
  const gainRatio =
    metrics.betCount > 0 ? `${((metrics.wonCount / metrics.betCount) * 100).toFixed(2)}%` : null;

  // Headline metric — RTP. Highlighted to drive the "high payout" perception.
  const headline = {
    label: t("casino.room.audit.analytics.rtp"),
    value: rtp ?? "—"
  };
  const cards: Array<{ key: string; label: string; value: string; tone?: "win" }> = [
    {
      key: "wagered",
      label: t("casino.room.audit.analytics.wagered"),
      value: formatTokenAmount(BigInt(metrics.turnover), decimals, symbol, locale)
    },
    {
      key: "payout",
      label: t("casino.room.audit.analytics.payout"),
      value: formatTokenAmount(BigInt(metrics.payout), decimals, symbol, locale),
      tone: "win"
    },
    {
      key: "transactions",
      label: t("casino.room.audit.analytics.transactions"),
      value: metrics.betCount.toLocaleString(locale)
    },
    {
      key: "won",
      label: t("casino.room.audit.analytics.won"),
      value: metrics.wonCount.toLocaleString(locale),
      tone: "win"
    },
    {
      key: "gainRatio",
      label: t("casino.room.audit.analytics.gainRatio"),
      value: gainRatio ?? "—"
    },
    {
      key: "players",
      label: t("casino.room.audit.analytics.players"),
      value: metrics.uniquePlayers.toLocaleString(locale)
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {scopeToggle}
        <WindowToggle value={windowDays} onChange={setWindowDays} t={t} />
      </div>
      {/* Headline RTP — large, accent-framed. */}
      <div className="rounded-xl border border-accent/30 bg-accent-soft p-5 shadow-e1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
          {headline.label}
        </div>
        <div className="mt-1 font-mono text-4xl font-bold text-accent">{headline.value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
          {t("casino.room.audit.analytics.bestEffort")}
        </div>
      </div>

      <VolumeTrend decimals={decimals} locale={locale} points={trendPoints} symbol={symbol} t={t} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-border-soft bg-surface-0 p-4 shadow-e1"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {card.label}
            </div>
            <div
              className={cn(
                "mt-2 truncate font-mono text-xl font-bold",
                card.tone === "win" ? "text-success" : "text-fg"
              )}
              title={card.value}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeTrend({
  decimals,
  locale,
  points,
  symbol,
  t
}: {
  decimals: number;
  locale: string;
  points: Array<{ date: string; turnover: string }>;
  symbol: string;
  t: Translate;
}) {
  if (points.length === 0) return null;

  const chartPoints: TrendChartPoint[] = points.map((point) => ({
    date: point.date,
    value: BigInt(point.turnover || "0")
  }));

  return (
    <div className="rounded-xl border border-border-soft bg-surface-0 p-4 shadow-e1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
            {t("casino.room.audit.analytics.trend")}
          </div>
          <div className="mt-1 text-xs text-fg-muted">
            {t("casino.room.audit.analytics.trendWindow")}
          </div>
        </div>
        <span className="rounded-full border border-border-soft bg-surface-1 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {t("casino.room.audit.analytics.bestEffort")}
        </span>
      </div>
      <TrendChart
        className="mt-4"
        points={chartPoints}
        ariaLabel={t("casino.room.audit.analytics.trend")}
        formatValue={(value) => formatTokenAmount(value, decimals, symbol, locale)}
        formatDate={(date) => formatDayLabel(date, locale)}
        tooltipRows={(point) => [
          {
            label: t("casino.room.audit.analytics.volume"),
            value: formatTokenAmount(point.value, decimals, symbol, locale)
          }
        ]}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function matchesStateFilter(row: GameAuditBet, filter: StateFilter): boolean {
  if (filter === "all") return true;
  const stake = toBigOrNull(row.stake);
  const payout = getCasinoCashReturned(row) ?? null;
  const mapped = mapBetState(row.state);
  if (filter === "pending") return mapped === "pending";
  if (filter === "refunded") return mapped === "cancelled";
  // win/loss only meaningful once the bet has a terminal payout.
  if (mapped === "pending" || row.state !== "finalized") return false;
  if (filter === "won") return stake != null && payout != null && payout > stake;
  if (filter === "lost") return stake != null && payout != null && payout < stake;
  return true;
}

function tableColumnTemplate(showTime: boolean, showPlayer: boolean, showState: boolean) {
  return [
    showTime ? "minmax(0, 0.9fr)" : null,
    showPlayer ? "minmax(0, 1fr)" : null,
    "minmax(0, 1fr)",
    "minmax(0, 0.7fr)",
    "minmax(0, 1fr)",
    showState ? "minmax(0, 0.7fr)" : null,
    "44px"
  ]
    .filter(Boolean)
    .join(" ");
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border-soft py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">{message}</p>
    </div>
  );
}

function toBigOrNull(value?: string | bigint | number): bigint | null {
  if (value == null || value === "") return null;
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    return null;
  }
}

type RowAssetFormat = {
  decimals: number;
  symbol: string;
};

function resolveRowAsset(
  row: GameAuditBet,
  {
    assetContexts,
    fallbackDecimals,
    fallbackSymbol
  }: {
    assetContexts?: readonly PoolAssetContext[];
    fallbackDecimals: number;
    fallbackSymbol: string;
  }
): RowAssetFormat {
  const rowAsset = row.asset?.toLowerCase();
  if (rowAsset) {
    const byAsset = assetContexts?.find(
      (context) => context.asset.address.toLowerCase() === rowAsset
    );
    if (byAsset) {
      return { decimals: byAsset.asset.decimals, symbol: byAsset.asset.symbol };
    }
  }

  if (row.poolId != null) {
    const byPool = assetContexts?.find((context) => String(context.poolId) === String(row.poolId));
    if (byPool) {
      return { decimals: byPool.asset.decimals, symbol: byPool.asset.symbol };
    }
  }

  return { decimals: fallbackDecimals, symbol: fallbackSymbol };
}

function formatAmount(value: bigint | null, decimals: number, asset: string) {
  if (value == null) return "—";
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const fracStr = String(frac).padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fracStr} ${asset}`;
}

function computeMultiplier(stake: bigint | null, payout: bigint | null): number | null {
  if (!stake || stake === 0n || payout == null) return null;
  return Number((payout * 1_000_000n) / stake) / 1_000_000;
}

function formatRelativeTime(ts: number | undefined, t: Translate): string {
  if (!ts) return "—";
  const normalized = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  const ms = Date.now() - normalized;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return t("casino.room.audit.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("casino.room.audit.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("casino.room.audit.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("casino.room.audit.daysAgo", { n: days });
}

function labelForState(state: string | undefined, t: Translate): string {
  const mapped = mapBetState(state);
  return t(`casino.room.audit.stateLabel.${mapped}`);
}

function safeT(t: Translate, key: string): string {
  try {
    return t(key);
  } catch {
    return key;
  }
}

function readBets(t: Translate, slug: string): GameInfoBet[] {
  try {
    const raw = t.raw(`casino.room.gameInfo.${slug}.bets`);
    if (Array.isArray(raw)) return raw as GameInfoBet[];
  } catch {
    // fall through
  }
  return [];
}

function formatInfoMultiplier(multiplier: number, houseEdgeBps: number) {
  const adjusted = applyHouseEdgeToMultiplier(multiplier, houseEdgeBps);
  if (!Number.isFinite(adjusted) || adjusted <= 0) return "0×";
  return `${adjusted.toFixed(2)}×`;
}

function formatMaxInfoMultiplier(multiplier: number, houseEdgeBps: number, t: Translate) {
  return t("casino.room.audit.maxMultiplier", {
    multiplier: formatInfoMultiplier(multiplier, houseEdgeBps)
  });
}

function applyGameInfoMultiplier(
  bet: GameInfoBet,
  slug: string,
  houseEdgeBps: number,
  t: Translate
): GameInfoBet {
  const multiplier = resolveGameInfoGrossMultiplier(slug, bet.key);
  if (multiplier == null) return bet;
  const adjusted =
    isMaxStyleInfoBet(slug, bet.key) || slug === "plinko" || slug === "slots"
      ? formatMaxInfoMultiplier(multiplier, houseEdgeBps, t)
      : formatInfoMultiplier(multiplier, houseEdgeBps);
  return { ...bet, multiplier: adjusted };
}

function isMaxStyleInfoBet(slug: string, key: string) {
  return (slug === "keno" && key !== "p1") || (slug === "sic-bo" && key === "singleFace");
}

function resolveGameInfoGrossMultiplier(slug: string, key: string): number | undefined {
  if (slug === "roulette") {
    if (key === "straight") return rouletteReserveMultiplier(["0"]);
    if (key === "redBlack" || key === "evenOdd" || key === "lowHigh")
      return rouletteReserveMultiplier(["RED"]);
    if (key === "dozen") return rouletteReserveMultiplier(["1st 12"]);
    if (key === "column") return rouletteReserveMultiplier(["col1"]);
  }
  if (slug === "coin-toss") return 2;
  if (slug === "keno") {
    const spotCount = Number(key.replace(/^p/, ""));
    return Number.isInteger(spotCount) ? kenoMaxMultiplier(spotCount) : undefined;
  }
  if (slug === "plinko") {
    if (key === "low" || key === "medium" || key === "high") return plinkoMaxMultiplier(key);
  }
  if (slug === "slots") return slotsMaxMultiplier();
  if (slug === "baccarat") {
    if (key === "player" || key === "banker" || key === "tie") return baccaratMultiplier(key);
  }
  if (slug === "sic-bo") {
    if (key === "smallBig") return sicBoMultiplier("small", 0);
    if (key === "anyTriple") return sicBoMultiplier("anyTriple", 0);
    if (key === "specificTriple") return sicBoMultiplier("specificTriple", 1);
    if (key === "specificDouble") return sicBoMultiplier("specificDouble", 1);
    if (key === "singleFace") return sicBoMultiplier("singleFace", 1);
  }
  return undefined;
}
