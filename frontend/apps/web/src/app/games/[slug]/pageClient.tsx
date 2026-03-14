"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { BetRow } from "@ssot/ssot/indexer";
import { getGameEncoder } from "@ssot/ssot/encoding";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CoinTossParamsForm,
  CopyButton,
  DataTable,
  DiceParamsForm,
  ErrorCallout,
  KenoParamsForm,
  RouletteParamsForm,
  createDefaultRouletteSelection,
  summarizeRouletteSelection,
  type RouletteSelection,
  StatusBadge,
  TabBar,
  type BetStatus,
  type DataTableColumn,
  type TabBarItem,
} from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";
import { ConnectWalletPrompt } from "../../../components/ConnectWalletPrompt";
import { GameBetPanel } from "../../../features/betting/ui/GameBetPanel";
import { clampNumber, parseBigIntFromInput } from "../../../features/betting/model/units";
import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { getGamePresentation } from "../../../features/games/presentation";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";

type GameMeta = {
  gameId: `0x${string}`;
  slug: string;
  label: string;
  module: `0x${string}`;
  paramsEncoding?: string;
};

type ActivityView = "all" | "open" | "settled" | "refunded";
type InfoView = "all-bets" | "my-bets" | "players" | "analytics" | "details";

type PlayerRoomRow = {
  player: string;
  ticketCount: number;
  lastState?: string;
  lastUpdated?: number;
  lastTxHash?: string;
};

function toGameMeta(raw: any): GameMeta {
  return {
    gameId: raw.gameId as `0x${string}`,
    slug: String(raw.slug),
    label: String(raw.label),
    module: raw.module as `0x${string}`,
    paramsEncoding: raw.paramsEncoding ? String(raw.paramsEncoding) : undefined,
  };
}

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "—";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function parseMaskValue(mask: string) {
  const raw = mask.trim();
  if (!raw) return 0n;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) return null;
    return parsed;
  } catch {
    return null;
  }
}

function countMaskSelections(mask: string, limit = 40) {
  const parsed = parseMaskValue(mask);
  if (parsed === null) return null;
  let total = 0;
  for (let index = 0; index < limit; index += 1) {
    if ((parsed & (1n << BigInt(index))) !== 0n) total += 1;
  }
  return total;
}

function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (normalized.includes("won") || normalized.includes("win")) return "won";
  if (normalized.includes("lost") || normalized.includes("lose")) return "lost";
  if (normalized.includes("final") || normalized.includes("settled") || normalized.includes("resolved")) {
    return "settled";
  }
  if (normalized.includes("placed")) return "placed";
  if (normalized.includes("refund")) return "cancelled";
  if (normalized.includes("fail")) return "failed";
  return "pending";
}

function getExplorerBaseUrl(chainId: number) {
  switch (chainId) {
    case 84532:
      return "https://sepolia.basescan.org";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return undefined;
  }
}

function summarizeLag(lagBlocks?: number) {
  if (typeof lagBlocks !== "number") {
    return { label: "Waiting for sync", className: "border-slate-400/20 bg-white/[0.04] text-slate-200" };
  }
  if (lagBlocks <= 3) {
    return { label: "Fresh facts", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" };
  }
  if (lagBlocks <= 12) {
    return { label: "Catching up", className: "border-amber-300/25 bg-amber-300/10 text-amber-100" };
  }
  return { label: "Delayed feed", className: "border-rose-300/25 bg-rose-300/10 text-rose-100" };
}

function summarizeRoomPulse(rows: BetRow[]) {
  if (rows.length === 0) {
    return { label: "Quiet room", className: "border-white/10 bg-white/[0.04] text-slate-200" };
  }
  const freshCount = rows.filter((row) => row.updatedAt && Date.now() - row.updatedAt <= 30 * 60_000).length;
  if (freshCount >= 4) {
    return { label: "Hot table", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" };
  }
  if (freshCount >= 1) {
    return { label: "Warm table", className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" };
  }
  return { label: "Archive table", className: "border-white/10 bg-white/[0.04] text-slate-200" };
}

function summarizeStateBreakdown(rows: BetRow[]) {
  return rows.reduce(
    (acc, row) => {
      const status = mapBetState(row.state);
      if (status === "settled" || status === "won" || status === "lost") {
        acc.settled += 1;
      } else if (status === "cancelled") {
        acc.refunded += 1;
      } else {
        acc.open += 1;
      }
      return acc;
    },
    { open: 0, settled: 0, refunded: 0 }
  );
}

function buildActivityTabs(rows: BetRow[]): TabBarItem[] {
  const breakdown = summarizeStateBreakdown(rows);
  return [
    { key: "all", label: `All (${rows.length})` },
    { key: "open", label: `Open (${breakdown.open})` },
    { key: "settled", label: `Settled (${breakdown.settled})` },
    { key: "refunded", label: `Refunded (${breakdown.refunded})` },
  ];
}

function buildInfoTabs(): TabBarItem[] {
  return [
    { key: "all-bets", label: "All Bets" },
    { key: "my-bets", label: "My Bets" },
    { key: "players", label: "Players" },
    { key: "analytics", label: "Analytics" },
    { key: "details", label: "Game Details" },
  ];
}

function filterRecentBets(rows: BetRow[], view: ActivityView) {
  return rows.filter((row) => {
    const status = mapBetState(row.state);
    if (view === "all") return true;
    if (view === "open") {
      return status === "pending" || status === "placed" || status === "failed";
    }
    if (view === "settled") {
      return status === "settled" || status === "won" || status === "lost";
    }
    return status === "cancelled";
  });
}

function buildPlayerRows(rows: BetRow[]) {
  const map = new Map<string, PlayerRoomRow>();

  for (const row of rows) {
    if (!row.player) continue;
    const key = row.player.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        player: row.player,
        ticketCount: 1,
        lastState: row.state,
        lastUpdated: row.updatedAt,
        lastTxHash: row.lastTxHash,
      });
      continue;
    }

    current.ticketCount += 1;
    if ((row.updatedAt ?? 0) >= (current.lastUpdated ?? 0)) {
      current.lastUpdated = row.updatedAt;
      current.lastState = row.state;
      current.lastTxHash = row.lastTxHash;
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (right.ticketCount !== left.ticketCount) return right.ticketCount - left.ticketCount;
    return (right.lastUpdated ?? 0) - (left.lastUpdated ?? 0);
  });
}

function getCurrentParamSignal(
  slug: string,
  diceCap: string,
  coinSide: "heads" | "tails",
  rouletteSelection: RouletteSelection,
  kenoMask: string
) {
  switch (slug) {
    case "dice":
      return {
        value: `${diceCap}%`,
        label: "Current cap",
        helper: "Lower caps generally raise upside and lower hit rate.",
      };
    case "coin-toss":
      return {
        value: coinSide === "heads" ? "Heads" : "Tails",
        label: "Selected side",
        helper: "Binary room. One call, one ticket.",
      };
    case "roulette": {
      const summary = summarizeRouletteSelection(rouletteSelection);
      return {
        value: summary.display,
        label: "Active bet",
        helper: summary.helper,
      };
    }
    case "keno": {
      const selected = countMaskSelections(kenoMask);
      return {
        value: selected == null ? "Invalid" : `${selected} pick${selected === 1 ? "" : "s"}`,
        label: "Current board",
        helper:
          selected == null
            ? "The Keno mask is invalid. Rebuild the board."
            : "Pick the board first, then size the ticket on the right.",
      };
    }
    default:
      return {
        value: "Release-defined",
        label: "Current mode",
        helper: "This room inherits the standard release-routed betting flow.",
      };
  }
}

export function GamePageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { release, readOnlyReason, chainId } = useRelease();
  const { indexerStatus } = useIndexer();
  const { sdk } = useSSOTSDK();

  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item) => item.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release?.gamesMeta, slug]);

  const presentation = getGamePresentation(game?.slug ?? slug, game?.label ?? slug);
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const recentBetsQuery = useBetsByGame(game?.gameId, 8);
  const recentBets = recentBetsQuery.data ?? [];
  const recentBetsError =
    recentBetsQuery.error instanceof Error ? recentBetsQuery.error.message : "Failed to load recent indexed bets.";

  const [activityView, setActivityView] = React.useState<ActivityView>("all");
  const [infoView, setInfoView] = React.useState<InfoView>("all-bets");

  const [diceCap, setDiceCap] = React.useState<string>("50");
  const [coinSide, setCoinSide] = React.useState<"heads" | "tails">("heads");
  const [rouletteSelection, setRouletteSelection] = React.useState<RouletteSelection>(() => createDefaultRouletteSelection());
  const [kenoMask, setKenoMask] = React.useState<string>("0x1f");
  const isRouletteRoom = game?.slug === "roulette";

  React.useEffect(() => {
    setDiceCap("50");
    setCoinSide("heads");
    setRouletteSelection(createDefaultRouletteSelection());
    setKenoMask("0x1f");
    setActivityView("all");
    setInfoView("all-bets");
  }, [slug]);

  if (!release) {
    return (
      <Placeholder
        title="Games"
        description={readOnlyReason ?? "No embedded release available for the connected chain."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  if (!game) {
    return (
      <Placeholder
        title="Unknown game"
        description={`No game with slug '${slug}' found in release bundle gamesMeta. Sync the latest release bundle and retry.`}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );
  }

  const roomPulse = summarizeRoomPulse(recentBets);
  const lagTone = summarizeLag(indexerStatus?.lagBlocks);
  const activityTabs = buildActivityTabs(recentBets);
  const infoTabs = buildInfoTabs();
  const filteredRecentBets = filterRecentBets(recentBets, activityView);
  const myBets = React.useMemo(() => {
    if (!sdk?.account) return [];
    const normalizedAccount = sdk.account.toLowerCase();
    return recentBets.filter((row) => row.player?.toLowerCase() === normalizedAccount);
  }, [recentBets, sdk?.account]);
  const filteredMyBets = React.useMemo(() => filterRecentBets(myBets, activityView), [activityView, myBets]);
  const playerRows = React.useMemo(() => buildPlayerRows(recentBets), [recentBets]);
  const analytics = React.useMemo(() => {
    const breakdown = summarizeStateBreakdown(recentBets);
    const settled = breakdown.settled;
    const open = breakdown.open;
    const refunded = breakdown.refunded;
    const total = recentBets.length;
    const uniquePlayers = playerRows.length;
    const recentUpdates = recentBets.filter((row) => row.updatedAt && Date.now() - row.updatedAt <= 60 * 60_000).length;
    return {
      total,
      settled,
      open,
      refunded,
      uniquePlayers,
      recentUpdates,
      settlementRate: total > 0 ? Math.round((settled / total) * 100) : 0,
    };
  }, [playerRows.length, recentBets]);
  const paramSignal = getCurrentParamSignal(game.slug, diceCap, coinSide, rouletteSelection, kenoMask);
  const explorerModuleUrl = explorerBaseUrl ? `${explorerBaseUrl}/address/${game.module}` : undefined;

  const recentBetColumns: DataTableColumn<BetRow>[] = React.useMemo(
    () => [
      {
        key: "betId",
        header: "Bet ID",
        render: (row) => <span className="font-mono text-white">#{row.betId}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={mapBetState(row.state)} label={row.state} />,
      },
      {
        key: "player",
        header: "Player",
        render: (row) =>
          row.player ? (
            <span className="inline-flex items-center gap-1 font-mono text-slate-300">
              {shortHex(row.player)}
              <span onClick={(event) => event.stopPropagation()}>
                <CopyButton value={row.player} label="Copy player address" />
              </span>
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          ),
      },
      {
        key: "updated",
        header: "Updated",
        render: (row) => <span className="text-slate-400">{formatRelativeTime(row.updatedAt)}</span>,
      },
      {
        key: "tx",
        header: "Tx",
        render: (row) => {
          if (!row.lastTxHash) return <span className="text-slate-500">—</span>;
          return (
            <span className="inline-flex items-center gap-2 font-mono text-slate-400">
              <span>{shortHex(row.lastTxHash)}</span>
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}/tx/${row.lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-200 transition-colors hover:text-cyan-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  View
                </a>
              ) : null}
            </span>
          );
        },
      },
    ],
    [explorerBaseUrl]
  );

  const playerColumns: DataTableColumn<PlayerRoomRow>[] = React.useMemo(
    () => [
      {
        key: "player",
        header: "Player",
        render: (row) => (
          <span className="inline-flex items-center gap-1 font-mono text-slate-300">
            {shortHex(row.player)}
            <span onClick={(event) => event.stopPropagation()}>
              <CopyButton value={row.player} label="Copy player address" />
            </span>
          </span>
        ),
      },
      {
        key: "tickets",
        header: "Tickets",
        render: (row) => <span className="font-semibold text-white">{row.ticketCount}</span>,
      },
      {
        key: "status",
        header: "Latest",
        render: (row) =>
          row.lastState ? <StatusBadge status={mapBetState(row.lastState)} label={row.lastState} /> : <span className="text-slate-500">—</span>,
      },
      {
        key: "updated",
        header: "Last seen",
        render: (row) => <span className="text-slate-400">{formatRelativeTime(row.lastUpdated)}</span>,
      },
      {
        key: "tx",
        header: "Tx",
        render: (row) => {
          if (!row.lastTxHash) return <span className="text-slate-500">—</span>;
          return (
            <span className="inline-flex items-center gap-2 font-mono text-slate-400">
              <span>{shortHex(row.lastTxHash)}</span>
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}/tx/${row.lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-200 transition-colors hover:text-cyan-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  View
                </a>
              ) : null}
            </span>
          );
        },
      },
    ],
    [explorerBaseUrl]
  );

  const renderParamsForm = () => {
    switch (game.slug) {
      case "dice":
        return <DiceParamsForm cap={diceCap} onCapChange={setDiceCap} />;
      case "coin-toss":
        return <CoinTossParamsForm side={coinSide} onSideChange={setCoinSide} />;
      case "roulette":
        return <RouletteParamsForm selection={rouletteSelection} onChange={setRouletteSelection} />;
      case "keno":
        return <KenoParamsForm mask={kenoMask} onMaskChange={setKenoMask} />;
      default:
        return (
          <Placeholder
            title={game.label}
            description={`No params UI implemented for slug '${game.slug}'.`}
            specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
          />
        );
    }
  };

  const getEncodedParams = () => {
    const encoder = getGameEncoder(game.slug);
    if (!encoder) throw new Error(`No encoder registered for slug: ${game.slug}`);

    switch (game.slug) {
      case "dice": {
        const capN = clampNumber(Number(diceCap), 0, 255);
        if (!Number.isFinite(capN) || !Number.isInteger(capN)) throw new Error("Dice cap must be an integer");
        return encoder.encode({ cap: capN });
      }
      case "coin-toss":
        return encoder.encode({ face: coinSide === "heads" });
      case "roulette": {
        switch (rouletteSelection.kind) {
          case "straight":
            return encoder.encode({ kind: "straight", number: rouletteSelection.number });
          case "split":
            return encoder.encode({ kind: "split", first: rouletteSelection.first, second: rouletteSelection.second });
          case "street":
            return encoder.encode({ kind: "street", start: rouletteSelection.start });
          case "corner":
            return encoder.encode({ kind: "corner", start: rouletteSelection.start });
          case "sixLine":
            return encoder.encode({ kind: "sixLine", start: rouletteSelection.start });
          case "dozen":
            return encoder.encode({ kind: "dozen", dozen: rouletteSelection.dozen });
          case "column":
            return encoder.encode({ kind: "column", column: rouletteSelection.column });
          case "red":
          case "black":
          case "odd":
          case "even":
          case "low":
          case "high":
            return encoder.encode({ kind: rouletteSelection.kind });
          case "bitmask":
            return encoder.encode({ kind: "bitmask", mask: parseBigIntFromInput(rouletteSelection.mask) });
          default:
            throw new Error(`Unsupported roulette selection: ${(rouletteSelection as { kind: string }).kind}`);
        }
      }
      case "keno":
        return encoder.encode({ mask: parseBigIntFromInput(kenoMask) });
      default:
        throw new Error(`Unsupported game slug: ${game.slug}`);
    }
  };

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <div className="space-y-6 py-6">
        <section className="space-y-5">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="inline-flex gap-2">
              {(release.gamesMeta ?? []).map((item) => (
                <Link
                  key={item.slug}
                  href={`/games/${item.slug}`}
                  data-active={item.slug === game.slug}
                  className="ag-pill-tab min-w-max px-4 py-2.5 text-sm"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="ag-room-panel rounded-[2.1rem] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-1 pb-5">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${presentation.theme.badgeClassName}`}>
                    {presentation.roomLabel}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${roomPulse.className}`}>
                    {roomPulse.label}
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                    {presentation.icon} {game.label}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    {isRouletteRoom
                      ? "Standard 0-36 European table. Pick the bet on the board, then size the ticket on the right."
                      : "A room-first layout: game selector on top, play surface on the left, bet slip on the right."}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active call</div>
                  <div className="mt-2 text-sm font-semibold text-white">{paramSignal.value}</div>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sync</div>
                  <div className="mt-2 text-sm font-semibold text-white">{lagTone.label}</div>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assets</div>
                  <div className="mt-2 text-sm font-semibold text-white">{(release.assets ?? []).map((asset) => asset.symbol).join(", ") || "—"}</div>
                </div>
              </div>
            </div>

            <div className="pt-5" id="bet-panel">
              <GameBetPanel
                release={release}
                game={{ gameId: game.gameId, slug: game.slug, label: game.label }}
                getEncodedParams={getEncodedParams}
                inputFingerprint={[game.slug, diceCap, coinSide, JSON.stringify(rouletteSelection), kenoMask].join("|")}
                selectionSignal={paramSignal}
              >
                {renderParamsForm()}
              </GameBetPanel>
            </div>
          </div>
        </section>

        <section>
          <Card className="overflow-hidden border-white/8 bg-[#0a1024]/78 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
            <CardHeader className="space-y-4 border-b border-white/8 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">
                    {infoView === "all-bets"
                      ? "All bets"
                      : infoView === "my-bets"
                        ? "My bets"
                        : infoView === "players"
                          ? "Players"
                          : infoView === "analytics"
                            ? "Analytics"
                            : "Game details"}
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {infoView === "all-bets"
                      ? "Watch the whole room after the ticket is built. This stays below the fold."
                      : infoView === "my-bets"
                        ? "Follow your own tickets without mixing them into the full room stream."
                        : infoView === "players"
                          ? "Room participants and their latest visible ticket activity."
                          : infoView === "analytics"
                            ? "Compact room metrics instead of another explanation block."
                            : "How to play and release truth stay here without hijacking the top fold."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {infoView === "all-bets" || infoView === "my-bets" ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-200 hover:border-white/16 hover:bg-white/[0.04] hover:text-white"
                    >
                      <Link href="/bets">Open ledger</Link>
                    </Button>
                  ) : null}
                  <TabBar tabs={infoTabs} activeKey={infoView} onTabChange={(next) => setInfoView(next as InfoView)} />
                </div>
              </div>
              {infoView === "all-bets" || infoView === "my-bets" ? (
                <TabBar tabs={activityTabs} activeKey={activityView} onTabChange={(next) => setActivityView(next as ActivityView)} />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {infoView === "all-bets" ? (
                <>
                  {recentBetsQuery.error ? (
                    <ErrorCallout title="Recent bets unavailable" message={recentBetsError} />
                  ) : null}
                  <DataTable
                    columns={recentBetColumns}
                    data={filteredRecentBets}
                    loading={recentBetsQuery.isLoading}
                    rowKey={(row) => row.id}
                    onRowClick={(row) => router.push(`/bets/${row.betId}`)}
                    emptyMessage={`No ${activityView === "all" ? "" : `${activityView} `}indexed ${game.label} bets yet. The local indexer may still be catching up.`}
                  />
                </>
              ) : null}

              {infoView === "my-bets" ? (
                <>
                  {!sdk?.account ? <ConnectWalletPrompt action="view your room bets" /> : null}
                  {sdk?.account ? (
                    <DataTable
                      columns={recentBetColumns}
                      data={filteredMyBets}
                      loading={recentBetsQuery.isLoading}
                      rowKey={(row) => row.id}
                      onRowClick={(row) => router.push(`/bets/${row.betId}`)}
                      emptyMessage={`No ${activityView === "all" ? "" : `${activityView} `}${game.label} bets found for the connected wallet in local indexed history yet.`}
                    />
                  ) : null}
                </>
              ) : null}

              {infoView === "players" ? (
                <DataTable
                  columns={playerColumns}
                  data={playerRows}
                  loading={recentBetsQuery.isLoading}
                  rowKey={(row) => row.player}
                  emptyMessage={`No indexed ${game.label} players yet. Room participant history will appear once indexed bets arrive.`}
                />
              ) : null}

              {infoView === "analytics" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Total indexed bets", String(analytics.total), "Visible room stream"],
                    ["Unique players", String(analytics.uniquePlayers), "Distinct wallets in local room history"],
                    ["Settlement rate", `${analytics.settlementRate}%`, "Settled share of indexed room tickets"],
                    ["Open tickets", String(analytics.open), "Still live, pending, or unresolved"],
                    ["Refunded", String(analytics.refunded), "Cancelled or refunded tickets"],
                    ["Updated last hour", String(analytics.recentUpdates), "Recent room motion"],
                  ].map(([label, value, note]) => (
                    <div key={label} className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                      <div className="mt-3 text-3xl font-black tracking-tight text-white">{value}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">{note}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {infoView === "details" ? (
                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{presentation.helpLabel}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{presentation.helpDescription}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {presentation.playbook.map((step, index) => (
                      <div key={`${game.slug}-guide-${index}`} className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
                        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${presentation.theme.badgeClassName}`}>
                          {index + 1}
                        </div>
                        <div className="mt-4 text-sm font-semibold text-white">Step {index + 1}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release truth</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-start justify-between gap-3">
                          <span>Game ID</span>
                          <span className="font-mono text-white">{shortHex(game.gameId)}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span>Params encoding</span>
                          <span className="font-mono text-white">{game.paramsEncoding ?? "release-defined"}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span>Assets</span>
                          <span className="text-white">{(release.assets ?? []).map((asset) => asset.symbol).join(", ") || "—"}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span>Module</span>
                          <span className="font-mono text-white">{shortHex(game.module)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5">
                        <div className="flex items-center gap-3">
                          <ArbiGameFiMark accent="cyan" className="h-11 w-11 rounded-[1rem]" />
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Explorer</div>
                            <div className="text-sm font-semibold text-white">Module route</div>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div>Chain {chainId}</div>
                          {explorerModuleUrl ? (
                            <a
                              href={explorerModuleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 font-semibold text-cyan-100"
                            >
                              View module
                            </a>
                          ) : (
                            <div className="text-slate-500">Explorer unavailable for this chain.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Room note</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          The room stays product-first above the fold. Facts, module routes, and explorer links stay here when you need them.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
