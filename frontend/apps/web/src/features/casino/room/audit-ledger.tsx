import * as React from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { mapBetState, shortHex, type GameMeta } from "./model";
import { usePlayerBets } from "../../betting/usePlayerBets";
import {
  getAppChain,
  getExplorerAddressUrl,
  getExplorerTxUrl
} from "../../../app-shell/chain-registry";

/** Loose row shape that covers both the indexer `BetRow` and any test stub. */
export type GameAuditBet = {
  id?: string;
  betId: string | number | bigint;
  player?: string;
  state?: string;
  stake?: string | bigint | number;
  payout?: string | bigint | number;
  updatedAt?: number;
  gameId?: string;
  /** Indexer-supplied tx hashes — used for explorer links. */
  finalizedTxHash?: string;
  terminalTxHash?: string;
  lastTxHash?: string;
};

type AuditTab = "live" | "mine" | "top" | "info";
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
function useUnreadBadge(
  liveRows: readonly GameAuditBet[],
  myRows: readonly GameAuditBet[],
  topRows: readonly GameAuditBet[],
  activeTab: AuditTab
) {
  // Per-tab "seen" sets — sets of bet IDs we've already shown to the user.
  const seenRef = React.useRef<Record<AuditTab, Set<string>>>({
    live: new Set(),
    mine: new Set(),
    top: new Set(),
    info: new Set()
  });
  const [unread, setUnread] = React.useState<Record<AuditTab, number>>({
    live: 0,
    mine: 0,
    top: 0,
    info: 0
  });

  // On first render, mark everything currently visible as seen — we don't
  // want stale rows to count as "new" the moment the user lands on the page.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    for (const row of liveRows) seenRef.current.live.add(String(row.betId));
    for (const row of myRows) seenRef.current.mine.add(String(row.betId));
    for (const row of topRows) seenRef.current.top.add(String(row.betId));
  }, [liveRows, myRows, topRows]);

  const bump = React.useCallback(
    (tab: AuditTab, rows: readonly GameAuditBet[], winsOnly: boolean) => {
      const seen = seenRef.current[tab];
      let added = 0;
      for (const row of rows) {
        const id = String(row.betId);
        if (seen.has(id)) continue;
        if (winsOnly) {
          const stake = toBigOrNull(row.stake);
          const payout = toBigOrNull(row.payout);
          if (!stake || !payout || payout <= stake) {
            // Still mark as seen so a later state transition doesn't double-count.
            seen.add(id);
            continue;
          }
        }
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
    bump("live", liveRows, false);
  }, [bump, liveRows]);
  React.useEffect(() => {
    if (!hydratedRef.current) return;
    bump("mine", myRows, false);
  }, [bump, myRows]);
  React.useEffect(() => {
    if (!hydratedRef.current) return;
    bump("top", topRows, true);
  }, [bump, topRows]);

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
  assetSymbol = "USDC",
  assetDecimals = 6,
  chainId
}: {
  game: GameMeta;
  /** Currently unused — kept for backward compat with existing callers. */
  betAmount?: number;
  recentBets: readonly GameAuditBet[];
  playerAddress?: string;
  assetSymbol?: string;
  assetDecimals?: number;
  /** Active chain — drives explorer links and the chain badge in the header. */
  chainId?: number;
}) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = React.useState<AuditTab>("live");
  const [stateFilter, setStateFilter] = React.useState<StateFilter>("all");

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

  // Top wins = finalized bets with a payout > stake, ranked by multiplier desc.
  const topBets = React.useMemo(() => {
    const scored: Array<{ row: GameAuditBet; multiplier: number }> = [];
    for (const row of recentBets) {
      const stake = toBigOrNull(row.stake);
      const payout = toBigOrNull(row.payout);
      if (!stake || stake === 0n || !payout || payout <= stake) continue;
      const ratio = Number((payout * 1_000_000n) / stake) / 1_000_000;
      scored.push({ row, multiplier: ratio });
    }
    scored.sort((a, b) => b.multiplier - a.multiplier);
    return scored.slice(0, 10);
  }, [recentBets]);
  const topRows = React.useMemo(() => topBets.map((s) => s.row), [topBets]);

  const { unread, clear } = useUnreadBadge(recentBets, playerBets, topRows, activeTab);

  const handleTab = React.useCallback(
    (tab: AuditTab) => {
      setActiveTab(tab);
      clear(tab);
    },
    [clear]
  );

  const chain = chainId != null ? getAppChain(chainId) : undefined;

  const tabs: Array<{ id: AuditTab; label: string }> = [
    { id: "live", label: t("casino.room.audit.tabs.live") },
    { id: "mine", label: t("casino.room.audit.tabs.mine") },
    { id: "top", label: t("casino.room.audit.tabs.top") },
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
          className="scrollbar-hide flex items-stretch gap-1 overflow-x-auto px-4 md:px-6"
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
            chainId={chainId}
            stateFilter={stateFilter}
            onStateFilterChange={setStateFilter}
          />
        )}
        {activeTab === "top" && (
          <BetTable
            rows={topRows}
            kind="top"
            t={t}
            assetSymbol={assetSymbol}
            assetDecimals={assetDecimals}
            emptyKey="top"
            multipliers={topBets.map((s) => s.multiplier)}
            chainId={chainId}
          />
        )}
        {activeTab === "info" && <GameInfoPanel slug={game.slug} t={t} />}
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
  emptyKey,
  multipliers,
  chainId
}: {
  rows: readonly GameAuditBet[];
  kind: "live" | "mine" | "top";
  t: Translate;
  assetSymbol: string;
  assetDecimals: number;
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
            const payout = toBigOrNull(row.payout);
            const multiplier = multipliers?.[index] ?? computeMultiplier(stake, payout);
            const isWin = stake != null && payout != null && payout > stake;
            const isLoss =
              stake != null && payout != null && payout <= stake && (row.state ?? "").length > 0;
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
                  {formatAmount(stake, assetDecimals, assetSymbol)}
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
                  {formatAmount(payout, assetDecimals, assetSymbol)}
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

function GameInfoPanel({ slug, t }: { slug: string; t: Translate }) {
  const tagline = safeT(t, `casino.room.gameInfo.${slug}.tagline`);
  const houseEdge = safeT(t, `casino.room.gameInfo.${slug}.houseEdge`);
  const bets = readBets(t, slug);

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
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function matchesStateFilter(row: GameAuditBet, filter: StateFilter): boolean {
  if (filter === "all") return true;
  const stake = toBigOrNull(row.stake);
  const payout = toBigOrNull(row.payout);
  const mapped = mapBetState(row.state);
  if (filter === "pending") return mapped === "pending";
  if (filter === "refunded") return mapped === "cancelled";
  // win/loss only meaningful once the bet has a terminal payout.
  if (mapped === "pending") return false;
  if (filter === "won") return stake != null && payout != null && payout > stake;
  if (filter === "lost") return stake != null && payout != null && payout <= stake;
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
