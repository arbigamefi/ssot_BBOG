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
import { ArbiGameFiLockup, ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";
import { GameBetPanel } from "../../../features/betting/ui/GameBetPanel";
import { clampNumber, parseBigIntFromInput } from "../../../features/betting/model/units";
import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { getGamePresentation } from "../../../features/games/presentation";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";

type GameMeta = {
  gameId: `0x${string}`;
  slug: string;
  label: string;
  module: `0x${string}`;
  paramsEncoding?: string;
};

type ActivityView = "all" | "open" | "settled" | "refunded";
type InfoView = "activity" | "guide" | "protocol";

type Tone = {
  label: string;
  description: string;
  className: string;
  trend: "up" | "neutral" | "down";
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

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "—";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

function summarizeLag(lagBlocks?: number): Tone {
  if (typeof lagBlocks !== "number") {
    return {
      label: "Waiting for sync",
      description: "Indexer lag is not available yet.",
      className: "border-slate-400/30 bg-slate-400/10 text-slate-100",
      trend: "neutral",
    };
  }
  if (lagBlocks <= 3) {
    return {
      label: "Fresh facts",
      description: `Lag ${lagBlocks} blocks.`,
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      trend: "up",
    };
  }
  if (lagBlocks <= 12) {
    return {
      label: "Catching up",
      description: `Lag ${lagBlocks} blocks.`,
      className: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      trend: "neutral",
    };
  }
  return {
    label: "Delayed feed",
    description: `Lag ${lagBlocks} blocks.`,
    className: "border-rose-400/30 bg-rose-400/10 text-rose-100",
    trend: "down",
  };
}

function summarizeRoomPulse(rows: BetRow[]): Tone {
  if (rows.length === 0) {
    return {
      label: "Quiet room",
      description: "No indexed activity in the current local window.",
      className: "border-slate-400/30 bg-slate-400/10 text-slate-100",
      trend: "neutral",
    };
  }

  const freshCount = rows.filter((row) => {
    if (!row.updatedAt) return false;
    return Date.now() - row.updatedAt <= 30 * 60_000;
  }).length;

  if (freshCount >= 4) {
    return {
      label: "Hot table",
      description: `${freshCount} recent bets landed in the last 30 minutes.`,
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      trend: "up",
    };
  }
  if (freshCount >= 1) {
    return {
      label: "Warm table",
      description: `${freshCount} fresh bet${freshCount === 1 ? "" : "s"} in the last 30 minutes.`,
      className: "border-sky-400/30 bg-sky-400/10 text-sky-100",
      trend: "up",
    };
  }
  return {
    label: "Archive view",
    description: "The table has history, but nothing new in the last 30 minutes.",
    className: "border-violet-400/30 bg-violet-400/10 text-violet-100",
    trend: "neutral",
  };
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
    { key: "activity", label: "Live Bets" },
    { key: "guide", label: "Playbook" },
    { key: "protocol", label: "Room Facts" },
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
        helper: "Lower caps generally push toward lower hit rate and higher upside.",
      };
    case "coin-toss":
      return {
        value: coinSide === "heads" ? "Heads" : "Tails",
        label: "Selected side",
        helper: "Binary room with the simplest possible parameter surface.",
      };
    case "roulette":
      {
        const summary = summarizeRouletteSelection(rouletteSelection);
        return {
          value: summary.display,
          label: "Active bet",
          helper: summary.helper,
        };
      }
    case "keno":
      {
        const selected = countMaskSelections(kenoMask);
        return {
          value: selected == null ? "Invalid" : `${selected} pick${selected === 1 ? "" : "s"}`,
          label: "Packed selection",
          helper:
            selected == null
              ? "The Keno mask is invalid. Use the board to rebuild a valid selection."
              : "Pick your numbers on the board first, then size the ticket in the stake console.",
        };
      }
    default:
      return {
        value: "Release",
        label: "Current mode",
        helper: "This room inherits the standard release-routed betting flow.",
      };
  }
}

export function GamePageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { release, readOnlyReason, chainId } = useRelease();
  const { indexerStatus } = useIndexer();

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
  const assetLabels = React.useMemo(
    () => (release?.assets ?? []).map((asset) => asset.symbol).join(", "),
    [release?.assets]
  );

  const [activityView, setActivityView] = React.useState<ActivityView>("all");
  const [infoView, setInfoView] = React.useState<InfoView>("activity");

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
    setInfoView("activity");
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
                  className="text-emerald-300 transition-colors hover:text-emerald-200"
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
      <div className="space-y-6">
        <section
          className={`space-y-4 rounded-[2rem] border px-4 py-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:px-6 ${
            isRouletteRoom
              ? "border-fuchsia-400/10 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.08),transparent_28%),linear-gradient(180deg,rgba(4,9,24,0.96),rgba(7,12,24,0.98))]"
              : "border-slate-800 bg-slate-900/60"
          }`}
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="inline-flex gap-2">
              {(release.gamesMeta ?? []).map((item) => {
                const active = item.slug === game.slug;
                return (
                  <Link
                    key={item.slug}
                    href={`/games/${item.slug}`}
                    className={
                      active
                        ? `inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-lg ${presentation.theme.badgeClassName}`
                        : "inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-5 py-3 text-sm font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                    }
                  >
                    <span>{item.label}</span>
                    {active ? <span className="text-[10px] uppercase tracking-[0.14em]">Live</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {isRouletteRoom ? (
              <div className="rounded-[1.75rem] border border-fuchsia-400/10 bg-[linear-gradient(160deg,rgba(7,10,25,0.82),rgba(17,8,29,0.78)),radial-gradient(circle_at_top_right,rgba(201,59,99,0.18),transparent_28%)] px-4 py-4 sm:px-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <ArbiGameFiLockup className="hidden h-10 w-auto sm:block" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${roomPulse.className}`}
                        >
                          {roomPulse.label}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                          <span>Sync</span>
                          <span className="text-white">{lagTone.label}</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        European roulette
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                          {presentation.icon} {game.label}
                        </h1>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                          Table-first room
                        </span>
                      </div>
                      <p className="max-w-2xl text-sm text-slate-400">
                        Standard 0-36 table. One clear ticket at a time.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {["0-36 standard wheel", "Single ticket focus", "Quote before sign", "Visible settlement"].map(
                        (item) => (
                          <div
                            key={item}
                            className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200"
                          >
                            {item}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4 shadow-lg shadow-black/30">
                    <div className="flex items-center gap-3">
                      <ArbiGameFiMark accent="cyan" className="h-11 w-11 rounded-[1rem]" />
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Table brief
                        </div>
                        <div className="text-sm font-semibold text-white">Room-led ticket review</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {["0", "Red", "Black", "1st 12"].map((item, index) => (
                        <div
                          key={item}
                          className={`rounded-[1rem] border px-3 py-3 text-center text-xs font-semibold ${
                            index === 0
                              ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100"
                              : index === 1
                                ? "border-rose-300/30 bg-rose-300/12 text-rose-100"
                                : index === 2
                                  ? "border-slate-200/20 bg-white/[0.04] text-slate-100"
                                  : "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100"
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                      Keep the room header emotional and compact. The actual table call, stake sizing, and quote all stay below in the live ticket flow.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                          {presentation.icon} {game.label}
                        </h1>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${roomPulse.className}`}>
                          {roomPulse.label}
                        </span>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-slate-400">
                        Choose the table call, size the ticket, and only open the trace when you are ready to review the quote
                        or sign.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                  <span>
                    {paramSignal.label}: <span className="font-semibold text-white">{paramSignal.value}</span>
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>
                    Sync: <span className="font-semibold text-white">{lagTone.label}</span>
                  </span>
                </div>
              </>
            )}

            <div id="bet-panel">
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
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader className="space-y-4 border-b border-slate-800/70 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">
                    {infoView === "activity" ? "Recent bets" : infoView === "guide" ? "Playbook" : "Room facts"}
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {infoView === "activity"
                      ? "Recent indexed bets for this room. Open the full ledger only when you need the complete bet timeline."
                      : infoView === "guide"
                        ? "Keep the interaction linear: choose the outcome, size the ticket, then confirm the quote."
                        : "When you need the governed truth, the module path, assets, and sync context stay here instead of crowding the first fold."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {infoView === "activity" ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800/40 hover:text-white"
                    >
                      <Link href="/bets">Open ledger</Link>
                    </Button>
                  ) : null}
                  <TabBar tabs={infoTabs} activeKey={infoView} onTabChange={(next) => setInfoView(next as InfoView)} />
                </div>
              </div>
              {infoView === "activity" ? (
                <TabBar
                  tabs={activityTabs}
                  activeKey={activityView}
                  onTabChange={(next) => setActivityView(next as ActivityView)}
                />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {infoView === "activity" ? (
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

              {infoView === "guide" ? (
                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{presentation.helpLabel}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{presentation.helpDescription}</p>
                  </div>

                  <div className="grid gap-4">
                    {presentation.playbook.map((step, index) => (
                      <div key={`${game.slug}-guide-${index}`} className="flex items-start gap-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-4">
                        <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${presentation.theme.badgeClassName}`}>
                          {index + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white">Step {index + 1}</div>
                          <p className="text-sm leading-6 text-slate-300">{step}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {infoView === "protocol" ? (
                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release truth</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-start justify-between gap-3">
                        <span>Game ID</span>
                        <span className="font-mono text-right text-slate-200">{shortHex(game.gameId)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Module</span>
                        <span className="font-mono text-right text-slate-200">{shortHex(game.module)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Params encoding</span>
                        <span className="max-w-[16rem] text-right font-mono text-xs text-slate-200">
                          {game.paramsEncoding ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span>Supported assets</span>
                        <span className="text-right text-slate-200">{assetLabels || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5 text-sm text-slate-300">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Execution notes</div>
                    <div className="mt-4 space-y-3 leading-6">
                      <div>Recent room window: {formatCount(recentBets.length)} indexed bets.</div>
                      <div>
                        Indexer status: {lagTone.label}
                        {typeof indexerStatus?.lagBlocks === "number" ? ` (${formatCount(indexerStatus.lagBlocks)} blocks)` : ""}.
                      </div>
                      <div>Token approvals always target the asset Bank, never the Hub.</div>
                      {explorerModuleUrl ? (
                        <div>
                          Explorer:{" "}
                          <a
                            href={explorerModuleUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-emerald-300 transition-colors hover:text-emerald-200"
                          >
                            {shortHex(game.module)}
                          </a>
                        </div>
                      ) : null}
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
