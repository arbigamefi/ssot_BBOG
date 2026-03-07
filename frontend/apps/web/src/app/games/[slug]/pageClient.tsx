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
  ReleaseBadge,
  RouletteParamsForm,
  StatCard,
  StatusBadge,
  TabBar,
  type BetStatus,
  type DataTableColumn,
  type TabBarItem,
} from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
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
  rouletteMask: string,
  kenoMask: string
) {
  switch (slug) {
    case "dice":
      return {
        value: diceCap,
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
      return {
        value: rouletteMask,
        label: "Active mask",
        helper: "Legacy mask encoding stays bound to the active release manifest.",
      };
    case "keno":
      return {
        value: kenoMask,
        label: "Packed pick",
        helper: "Packed selection must stay non-zero and release-compatible.",
      };
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

  const [diceCap, setDiceCap] = React.useState<string>("50");
  const [coinSide, setCoinSide] = React.useState<"heads" | "tails">("heads");
  const [rouletteMask, setRouletteMask] = React.useState<string>("0x12345");
  const [kenoMask, setKenoMask] = React.useState<string>("0xabcde");

  React.useEffect(() => {
    setDiceCap("50");
    setCoinSide("heads");
    setRouletteMask("0x12345");
    setKenoMask("0xabcde");
    setActivityView("all");
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
  const stateBreakdown = summarizeStateBreakdown(recentBets);
  const activityTabs = buildActivityTabs(recentBets);
  const filteredRecentBets = filterRecentBets(recentBets, activityView);
  const paramSignal = getCurrentParamSignal(game.slug, diceCap, coinSide, rouletteMask, kenoMask);
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
        return <RouletteParamsForm mask={rouletteMask} onMaskChange={setRouletteMask} />;
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
      case "roulette":
        return encoder.encode({ mask: parseBigIntFromInput(rouletteMask) });
      case "keno":
        return encoder.encode({ mask: parseBigIntFromInput(kenoMask) });
      default:
        throw new Error(`Unsupported game slug: ${game.slug}`);
    }
  };

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/60 px-6 py-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className={`pointer-events-none absolute inset-0 ${presentation.theme.ambientClassName}`} />

          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/games"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/50 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  All Games
                </Link>
                <ReleaseBadge
                  networkName={release.name}
                  hubShort={shortHex(release.contracts.hub)}
                  digestShort={release.releaseDigest.slice(0, 8)}
                />
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${presentation.theme.badgeClassName}`}
                >
                  {presentation.roomLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800/40 hover:text-white"
                >
                  <Link href="#bet-panel">Open Bet Console</Link>
                </Button>
                <Button asChild size="sm" variant="glass">
                  <Link href="/bets">Open Ledger</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.92fr)]">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${roomPulse.className}`}>
                    {roomPulse.label}
                  </div>
                  <div className="space-y-3">
                    <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                      {presentation.icon} {game.label}
                    </h1>
                    <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                      {presentation.detailDescription}
                    </p>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">{presentation.roomSummary}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-slate-700/70 bg-slate-950/50 px-3 py-1.5 text-slate-300">
                    Assets: {assetLabels || "—"}
                  </span>
                  <span className="rounded-full border border-slate-700/70 bg-slate-950/50 px-3 py-1.5 text-slate-300">
                    Params: {game.paramsEncoding ?? "release-defined"}
                  </span>
                  <span className="rounded-full border border-slate-700/70 bg-slate-950/50 px-3 py-1.5 text-slate-300">
                    Module: {shortHex(game.module)}
                  </span>
                  <span className="rounded-full border border-slate-700/70 bg-slate-950/50 px-3 py-1.5 text-slate-300">
                    Synced block: {indexerStatus?.lastSyncedBlock ?? "—"}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Recent Bets"
                    value={formatCount(recentBets.length)}
                    subValue={roomPulse.label}
                    trend={roomPulse.trend}
                  />
                  <StatCard
                    label="Settled Window"
                    value={formatCount(stateBreakdown.settled)}
                    subValue={`${formatCount(stateBreakdown.open)} open`}
                    trend={stateBreakdown.settled >= stateBreakdown.open ? "up" : "neutral"}
                  />
                  <StatCard
                    label="Supported Assets"
                    value={formatCount(release.assets.length)}
                    subValue={assetLabels || "release-defined"}
                  />
                  <StatCard
                    label="Indexer Lag"
                    value={typeof indexerStatus?.lagBlocks === "number" ? `${indexerStatus.lagBlocks}` : "—"}
                    subValue={lagTone.label}
                    trend={lagTone.trend}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {presentation.playbook.map((step, index) => (
                    <div
                      key={`${game.slug}-playbook-${index}`}
                      className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Step 0{index + 1}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 p-6 shadow-2xl ${presentation.theme.stageClassName}`}>
                <div className="pointer-events-none absolute -right-12 -top-10 text-[8rem] opacity-10">
                  {presentation.icon}
                </div>
                <div className="pointer-events-none absolute inset-x-10 bottom-0 h-32 rounded-full bg-white/5 blur-3xl" />

                <div className="relative space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Current game signal
                      </div>
                      <div className="mt-3 text-5xl font-black tracking-tight text-white sm:text-6xl">
                        {paramSignal.value}
                      </div>
                      <div className={`mt-2 text-sm font-medium ${presentation.theme.accentClassName}`}>
                        {paramSignal.label}
                      </div>
                    </div>

                    <div
                      className={`inline-flex items-center justify-center rounded-3xl border px-4 py-3 text-5xl shadow-lg ${presentation.theme.badgeClassName}`}
                    >
                      {presentation.icon}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
                    {paramSignal.helper}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Room pulse</div>
                      <div className="mt-2 text-lg font-bold text-white">{roomPulse.label}</div>
                      <div className="mt-1 text-sm text-slate-400">{roomPulse.description}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Facts stream</div>
                      <div className="mt-2 text-lg font-bold text-white">{lagTone.label}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {indexerStatus?.lastSyncedBlock != null
                          ? `Synced through block ${indexerStatus.lastSyncedBlock}.`
                          : lagTone.description}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release truth</div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        <div className="text-slate-500">Game ID</div>
                        <div className="mt-1 font-mono text-slate-100">{shortHex(game.gameId)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Params encoding</div>
                        <div className="mt-1 font-mono text-slate-100">{game.paramsEncoding ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="-mx-2 overflow-x-auto px-2 pb-1">
              <div className="inline-flex gap-2">
                {(release.gamesMeta ?? []).map((item) => {
                  const active = item.slug === game.slug;
                  return (
                    <Link
                      key={item.slug}
                      href={`/games/${item.slug}`}
                      className={
                        active
                          ? `rounded-full border px-4 py-2 text-sm font-semibold shadow-lg ${presentation.theme.badgeClassName}`
                          : "rounded-full border border-slate-700/70 bg-slate-950/50 px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.58fr)_minmax(320px,0.82fr)]">
          <div id="bet-panel">
            <GameBetPanel
              release={release}
              game={{ gameId: game.gameId, slug: game.slug, label: game.label }}
              description={`Release-routed Hub.placeBet flow for ${game.label}.`}
              getEncodedParams={getEncodedParams}
            >
              {renderParamsForm()}
            </GameBetPanel>
          </div>

          <div className="space-y-6 self-start xl:sticky xl:top-24">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader className="border-b border-slate-800/70 pb-4">
                <CardTitle className="text-lg text-white">Control Room</CardTitle>
                <CardDescription className="text-slate-400">
                  Fast read on the room configuration, local facts health, and release-routed surfaces.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 text-sm">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current param</div>
                  <div className="mt-2 text-lg font-bold text-white">{paramSignal.value}</div>
                  <div className="mt-1 text-slate-400">{paramSignal.label}</div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Room state</div>
                  <div className="mt-2 text-lg font-bold text-white">{roomPulse.label}</div>
                  <div className="mt-1 text-slate-400">{roomPulse.description}</div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Indexer health</div>
                  <div className="mt-2 text-lg font-bold text-white">{lagTone.label}</div>
                  <div className="mt-1 text-slate-400">{lagTone.description}</div>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset universe</div>
                  <div className="mt-2 text-lg font-bold text-white">{formatCount(release.assets.length)}</div>
                  <div className="mt-1 text-slate-400">{assetLabels || "No release assets"}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader className="border-b border-slate-800/70 pb-4">
                <CardTitle className="text-lg text-white">How to Play</CardTitle>
                <CardDescription className="text-slate-400">
                  Product guidance only. Route validity and settlement still come from release truth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {presentation.playbook.map((step, index) => (
                  <div key={`${game.slug}-guide-${index}`} className="flex items-start gap-3">
                    <div className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${presentation.theme.badgeClassName}`}>
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
              <CardHeader className="border-b border-slate-800/70 pb-4">
                <CardTitle className="text-lg text-white">Execution Notes</CardTitle>
                <CardDescription className="text-slate-400">
                  Keep the page professional, but never outrun protocol semantics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6 text-sm leading-6 text-slate-300">
                <p>VRF fees are quoted during planning and attached as native value when the bet is submitted.</p>
                <p>Token approvals target the Bank contract for the selected asset, never the Hub directly.</p>
                <p>If the live table is empty after a recent tx, wait for local sync or jump to the full bet ledger.</p>
                {explorerModuleUrl ? (
                  <p>
                    Explorer surface:{" "}
                    <a
                      href={explorerModuleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-emerald-300 transition-colors hover:text-emerald-200"
                    >
                      {shortHex(game.module)}
                    </a>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader className="flex flex-col gap-4 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg text-white">Live Table</CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  Indexer-scoped activity for this release game. Click a row to inspect the full bet timeline.
                </CardDescription>
              </div>
              <TabBar
                tabs={activityTabs}
                activeKey={activityView}
                onTabChange={(next) => setActivityView(next as ActivityView)}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-6">
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
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader className="border-b border-slate-800/70 pb-4">
              <CardTitle className="text-lg text-white">Protocol Truth</CardTitle>
              <CardDescription className="text-slate-400">
                Presentation can be expressive, but release identity and indexer facts still define what is real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release Truth</div>
                <div className="space-y-2 text-sm text-slate-300">
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

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {presentation.helpLabel}
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{presentation.helpDescription}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Local facts</div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 text-sm text-slate-300">
                  <div>Recent room window: {formatCount(recentBets.length)} indexed bets</div>
                  <div className="mt-2">
                    Synced block {indexerStatus?.lastSyncedBlock ?? "—"} · Lag {indexerStatus?.lagBlocks ?? "—"} blocks
                  </div>
                  {explorerModuleUrl ? (
                    <div className="mt-2">
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
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
