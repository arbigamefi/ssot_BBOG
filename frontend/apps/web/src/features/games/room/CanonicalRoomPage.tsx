"use client";

import * as React from "react";

import { StatusBadge, cn } from "@ssot/ui";
import type { Hex } from "@ssot/ssot/sdk";

import { Placeholder } from "../../../components/Placeholder";
import { LowerRoomTabs, type LowerRoomTab } from "../../../components/LowerRoomTabs";
import { GameBetPanel } from "../../betting/ui/GameBetPanel";
import { useBetsByGame } from "../../bets/useBetsByGame";
import { getGamePresentation } from "../presentation";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";

type SelectionSignal = {
  label: string;
  value: string;
  helper?: string;
};

type CanonicalRoomPageProps = {
  slug: string;
  inputFingerprint: string;
  selectionSignal: SelectionSignal;
  getEncodedParams: () => Hex;
  children: React.ReactNode;
  detailsTitle?: string;
  detailSections?: Array<{ title: string; body: string }>;
};

type ReleaseGameMeta = {
  gameId: Hex;
  slug: string;
  label: string;
  module?: Hex;
};

function shortHex(value?: string | null) {
  if (!value) return "Wallet pending";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function toTimestamp(value?: number | null) {
  if (!value) return "Pending";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Pending";
  }
}

function getLedgerStatus(state?: string) {
  const normalized = String(state ?? "").toLowerCase();
  if (normalized.includes("won")) return "won";
  if (normalized.includes("lost")) return "lost";
  if (normalized.includes("refund")) return "cancelled";
  if (normalized.includes("settled") || normalized.includes("final")) return "settled";
  return "pending";
}

function getPrototypeRoomTitle(slug: string, label: string) {
  switch (slug) {
    case "roulette":
      return "European Roulette";
    case "dice":
      return "Precision Dice";
    case "coin-toss":
      return "Coin Toss";
    case "keno":
      return "Keno Matrix";
    default:
      return label;
  }
}

function getHouseEdge(slug: string) {
  switch (slug) {
    case "roulette":
      return "2.70%";
    case "coin-toss":
      return "1.50%";
    default:
      return "1.00%";
  }
}

function getMaxPayout(slug: string) {
  switch (slug) {
    case "roulette":
      return "100,000 USDC";
    case "keno":
      return "500,000 USDC";
    default:
      return "25,000 USDC";
  }
}

export function CanonicalRoomPage({
  slug,
  inputFingerprint,
  selectionSignal,
  getEncodedParams,
  children,
  detailsTitle = "Game details",
  detailSections = []
}: CanonicalRoomPageProps) {
  const { release, readOnlyReason } = useRelease();
  const { sdk } = useSSOTSDK();

  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item) => item.slug === slug);
    return found as ReleaseGameMeta | undefined;
  }, [release?.gamesMeta, slug]);

  const presentation = React.useMemo(
    () => getGamePresentation(slug, game?.label ?? slug),
    [game?.label, slug]
  );
  const roomTitle = React.useMemo(
    () => getPrototypeRoomTitle(slug, game?.label ?? slug),
    [game?.label, slug]
  );
  const houseEdge = React.useMemo(() => getHouseEdge(slug), [slug]);
  const maxPayout = React.useMemo(() => getMaxPayout(slug), [slug]);

  const recentBetsQuery = useBetsByGame(game?.gameId, 18);
  const recentBets = recentBetsQuery.data ?? [];
  const account = sdk?.account?.toLowerCase();

  const roomPlayers = React.useMemo(() => {
    const seen = new Set<string>();
    const players: string[] = [];
    for (const row of recentBets) {
      const player = String(row.player ?? "").toLowerCase();
      if (!player || seen.has(player)) continue;
      seen.add(player);
      players.push(String(row.player));
    }
    return players;
  }, [recentBets]);

  const myBets = React.useMemo(() => {
    if (!account) return [];
    return recentBets.filter((row) => String(row.player ?? "").toLowerCase() === account);
  }, [account, recentBets]);

  const statusCounts = React.useMemo(() => {
    return recentBets.reduce(
      (acc, row) => {
        const status = getLedgerStatus(row.state);
        if (status === "settled" || status === "won" || status === "lost") acc.settled += 1;
        else if (status === "cancelled") acc.refunded += 1;
        else acc.open += 1;
        return acc;
      },
      { open: 0, settled: 0, refunded: 0 }
    );
  }, [recentBets]);

  const tableRows = (rows: any[]) => {
    if (!rows.length) {
      return (
        <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 px-4 py-12 text-center text-sm text-white/42">
          No tickets indexed for this slice yet.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-black/20">
        <div className="grid grid-cols-[1.1fr_1.2fr_0.7fr_0.8fr] border-b border-white/6 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/34">
          <span>Player</span>
          <span>Ticket</span>
          <span>Status</span>
          <span className="text-right">Updated</span>
        </div>
        {rows.map((row) => (
          <div
            key={`${row.chainId}-${row.betId}`}
            className="grid grid-cols-[1.1fr_1.2fr_0.7fr_0.8fr] items-center gap-3 border-t border-white/6 px-4 py-4 text-sm"
          >
            <div className="space-y-1">
              <div className="font-medium text-white">{shortHex(row.player)}</div>
              <div className="text-xs text-white/38">bet #{String(row.betId)}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-white">{selectionSignal.value}</div>
              <div className="text-xs text-white/38">{shortHex(row.txHash)}</div>
            </div>
            <StatusBadge status={getLedgerStatus(row.state)} />
            <div className="text-right text-xs text-white/42">{toTimestamp(row.updatedAt)}</div>
          </div>
        ))}
      </div>
    );
  };

  const tabs = React.useMemo<LowerRoomTab[]>(() => {
    const detailCards = detailSections.length ? detailSections : presentation.previewSteps;

    return [
      {
        id: "all-bets",
        label: "All Bets",
        content: tableRows(recentBets)
      },
      {
        id: "my-bets",
        label: "My Bets",
        content: account ? (
          tableRows(myBets)
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 px-4 py-12 text-center text-sm text-white/42">
            Connect a wallet to filter your room tickets.
          </div>
        )
      },
      {
        id: "players",
        label: "Players",
        content: roomPlayers.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roomPlayers.map((player) => (
              <div
                key={player}
                className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-4"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">
                  Player
                </div>
                <div className="mt-2 font-medium text-white">{shortHex(player)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 px-4 py-12 text-center text-sm text-white/42">
            No player identities indexed for this room yet.
          </div>
        )
      },
      {
        id: "analytics",
        label: "Analytics",
        content: (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Indexed tickets",
                value: recentBets.length.toString(),
                helper: "Recent room flow captured underneath gameplay."
              },
              {
                label: "Players seen",
                value: roomPlayers.length.toString(),
                helper: "Distinct wallets visible in the current room slice."
              },
              {
                label: "Open",
                value: statusCounts.open.toString(),
                helper: "Tickets still awaiting a settled state."
              },
              {
                label: "Settled / refunded",
                value: `${statusCounts.settled} / ${statusCounts.refunded}`,
                helper: "Visible room outcomes and refund paths."
              }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-4"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">
                  {item.label}
                </div>
                <div className="mt-2 text-xl font-black tracking-tight text-white">
                  {item.value}
                </div>
                <div className="mt-2 text-xs leading-5 text-white/42">{item.helper}</div>
              </div>
            ))}
          </div>
        )
      },
      {
        id: "game-details",
        label: "Game Details",
        content: (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/38">
                {detailsTitle}
              </div>
              <div className="mt-3 text-base font-semibold text-white">
                {presentation.helpLabel}
              </div>
              <p className="mt-3 text-sm leading-7 text-white/48">{presentation.helpDescription}</p>
            </div>
            <div className="grid gap-4">
              {detailCards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-4"
                >
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-white/46">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        )
      }
    ];
  }, [
    account,
    detailSections,
    detailsTitle,
    myBets,
    presentation.helpDescription,
    presentation.helpLabel,
    presentation.previewSteps,
    recentBets,
    roomPlayers,
    selectionSignal.value,
    statusCounts
  ]);

  if (!release || !game) {
    return (
      <Placeholder
        title="Room unavailable"
        description={
          readOnlyReason ?? "The requested room is not registered in the active release."
        }
        specPath="docs/frontend/SCREEN-SPECS/004-SHARED-GAME-ROOM-SYSTEM.md"
      />
    );
  }

  return (
    <div className="space-y-6 pb-8 pt-6">
      <section className="rounded-[1.85rem] border border-white/8 bg-[linear-gradient(180deg,rgba(7,10,19,0.9),rgba(4,7,14,0.82))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.24)] md:px-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-400">
                Live SSOT Module
              </span>
            </div>
            <h1 className="text-[2rem] font-extrabold tracking-tight text-white md:text-[2.6rem]">
              {roomTitle}
            </h1>
          </div>

          <div className="hidden gap-6 text-right md:flex">
            <div className="flex min-w-[8rem] flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">
                House Edge
              </span>
              <span
                className={cn(
                  "mt-2 text-lg font-mono font-semibold",
                  slug === "roulette"
                    ? "text-emerald-400"
                    : slug === "coin-toss"
                      ? "text-amber-400"
                      : slug === "keno"
                        ? "text-fuchsia-400"
                        : "text-purple-400"
                )}
              >
                {houseEdge}
              </span>
            </div>
            <div className="flex min-w-[10rem] flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">
                Max Payout
              </span>
              <span className="mt-2 text-lg font-mono font-semibold text-white">{maxPayout}</span>
            </div>
          </div>
        </div>
      </section>

      <GameBetPanel
        release={release}
        game={game}
        description={presentation.roomSummary}
        getEncodedParams={getEncodedParams}
        inputFingerprint={inputFingerprint}
        selectionSignal={selectionSignal}
        layout="slip-left"
        variant="prototype"
      >
        {children}
      </GameBetPanel>

      <LowerRoomTabs
        tabs={tabs}
        className="mt-8 rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-xl"
      />
    </div>
  );
}
