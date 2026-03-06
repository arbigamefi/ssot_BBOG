"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { BetRow } from "@ssot/ssot/indexer";
import { getGameEncoder } from "@ssot/ssot/encoding";
import {
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
  PageHeader,
  ReleaseBadge,
  RouletteParamsForm,
  StatusBadge,
  type BetStatus,
  type DataTableColumn,
} from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { GameBetPanel } from "../../../features/betting/ui/GameBetPanel";
import { parseBigIntFromInput, clampNumber } from "../../../features/betting/model/units";
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

  // Dice
  const [diceCap, setDiceCap] = React.useState<string>("50");
  // Coin toss
  const [coinSide, setCoinSide] = React.useState<"heads" | "tails">("heads");
  // Roulette
  const [rouletteMask, setRouletteMask] = React.useState<string>("0x12345");
  // Keno
  const [kenoMask, setKenoMask] = React.useState<string>("0xabcde");

  // Reset per game when slug changes to keep UX predictable.
  React.useEffect(() => {
    setDiceCap("50");
    setCoinSide("heads");
    setRouletteMask("0x12345");
    setKenoMask("0xabcde");
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

  /** Build typed params from React state, then delegate to the registry encoder. */
  const getEncodedParams = () => {
    const encoder = getGameEncoder(game.slug);
    if (!encoder) throw new Error(`No encoder registered for slug: ${game.slug}`);

    // Map React UI state → typed encoder params
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
      <PageHeader
        title={`${presentation.icon} ${game.label}`}
        description={presentation.detailDescription}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ReleaseBadge
              networkName={release.name}
              hubShort={shortHex(release.contracts.hub)}
              digestShort={release.releaseDigest.slice(0, 8)}
            />
            <Link
              href="/games"
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All Games
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div>
          <GameBetPanel
            release={release}
            game={{ gameId: game.gameId, slug: game.slug, label: game.label }}
            description={`Release-routed Hub.placeBet flow for ${game.label}.`}
            getEncodedParams={getEncodedParams}
          >
            {renderParamsForm()}
          </GameBetPanel>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader className="border-b border-slate-800/70 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">Recent Bets</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    Indexer-scoped activity for this release game. Click a row to inspect the full bet timeline.
                  </CardDescription>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Synced block {indexerStatus?.lastSyncedBlock ?? "—"}</div>
                  <div>Lag {indexerStatus?.lagBlocks ?? "—"} blocks</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {recentBetsQuery.error ? (
                <ErrorCallout title="Recent bets unavailable" message={recentBetsError} />
              ) : null}
              <DataTable
                columns={recentBetColumns}
                data={recentBets}
                loading={recentBetsQuery.isLoading}
                rowKey={(row) => row.id}
                onRowClick={(row) => router.push(`/bets/${row.betId}`)}
                emptyMessage={`No indexed ${game.label} bets yet. The local indexer may still be catching up.`}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl shadow-slate-950/40">
            <CardHeader className="border-b border-slate-800/70 pb-4">
              <CardTitle className="text-lg text-white">Advanced / Help</CardTitle>
              <CardDescription className="text-slate-400">
                Page presentation is governed here, but routing and execution truth still come from the active release bundle.
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
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{presentation.helpLabel}</div>
                <p className="text-sm leading-relaxed text-slate-300">{presentation.helpDescription}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Execution Notes</div>
                <div className="space-y-2 text-sm leading-relaxed text-slate-300">
                  <p>VRF fees are quoted during planning and attached as native value when the bet is submitted.</p>
                  <p>Token approvals target the Bank contract for the selected asset, never the Hub directly.</p>
                  <p>Recent Bets reflect local indexer state. If the table is empty after a recent tx, wait for sync or open the full bet by tx hash.</p>
                  {explorerBaseUrl ? (
                    <p>
                      Explorer:
                      {" "}
                      <a
                        href={`${explorerBaseUrl}/address/${game.module}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-emerald-300 transition-colors hover:text-emerald-200"
                      >
                        {shortHex(game.module)}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
