"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { DomainBet } from "@ssot/ssot";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { useBetsByGame } from "../../../../features/betting/useBetsByGame";
import { useIndexer } from "../../../../features/ops/useIndexer";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { useSSOTRuntime } from "../../../../ssot/runtime";
import { usePlaceBetStepper } from "../../../../features/betting/usePlaceBetStepper";
import { useConnectModal } from "../../../../app-shell/WalletButton";
import { toGameMeta, type GameMeta } from "../../../../features/casino/room/model";
import { calculateGameWinChance } from "../../../../features/casino/room/params";
import { executeGamePlaceBetAction } from "../../../../features/casino/room/place-bet-action";
import {
  formatGameMaxPayout,
  formatHouseEdge,
  getGameDisplayName
} from "../../../../features/casino/room/presentation";
import { GameRoomBetPanel } from "../../../../features/casino/room/bet-panel";
import {
  useBetStepperFailureToast,
  useVrfTimeoutToast
} from "../../../../features/casino/room/feedback";
import { useGameWalletBalance, useKenoStrobeSpots } from "../../../../features/casino/room/hooks";
import {
  useGameResolutionEffect,
  type CasinoRoundResult,
  type GameHistoryEntry
} from "../../../../features/casino/room/resolution";
import { GameRoomRightPane } from "../../../../features/casino/room/right-pane";
import { GameRoomShell } from "../../../../features/casino/room/game-room-shell";
import {
  useCasinoRoundWatcher,
  useCasinoVrfQuote,
  type CasinoRoundPhase
} from "../../../../features/casino/room/casino-round";

const GameRoomAuditLedger = dynamic(
  () =>
    import("../../../../features/casino/room/audit-ledger").then((mod) => mod.GameRoomAuditLedger),
  {
    loading: () => (
      <div className="rounded-lg border border-border bg-surface-1 p-6 text-sm font-bold uppercase tracking-[0.18em] text-fg-subtle">
        Loading audit stream
      </div>
    ),
    ssr: false
  }
);

/* ─── Main Logic ─── */

export function GamePageClient({ slug }: { slug: string }) {
  const { release, readOnlyReason, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
  const { indexerStatus } = useIndexer();

  const isSynced =
    indexerStatus?.latestBlock &&
    indexerStatus?.lastSyncedBlock &&
    indexerStatus.latestBlock <= indexerStatus.lastSyncedBlock;

  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item: any) => item.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release?.gamesMeta, slug]);

  const recentBetsQuery = useBetsByGame(game?.gameId, 12);
  const refetchRecentBets = recentBetsQuery.refetch;
  const recentBets = recentBetsQuery.data ?? [];

  // Local State
  const [betAmount, setBetAmount] = React.useState<number>(10);
  const [isPending, setIsPending] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const [terminalBet, setTerminalBet] = React.useState<DomainBet | null>(null);
  const [resultProof, setResultProof] = React.useState<CasinoRoundResult | null>(null);

  // Game-specific params
  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);

  // Simulation state
  const [flipCount, setFlipCount] = React.useState(0);
  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [kenoResultDrawn, setKenoResultDrawn] = React.useState<number[]>([]);

  // History state for widgets
  const [gameHistory, setGameHistory] = React.useState<GameHistoryEntry[]>([]);
  // C1: Multi-roll controls
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0); // 0 = disabled
  const [stopLoss, setStopLoss] = React.useState<number>(0); // 0 = disabled
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const walletBalance = useGameWalletBalance({ sdk, assets: release?.assets });

  const { planNow, executeNow, state, reset } = usePlaceBetStepper();
  const { openConnectModal } = useConnectModal();
  const { db } = useSSOTRuntime();
  const vrfQuote = useCasinoVrfQuote({ sdk, betCount });
  const handleRoundTerminal = React.useCallback(
    (bet: DomainBet) => {
      setIsPending(false);
      setTerminalBet(bet);
      void refetchRecentBets?.();
    },
    [refetchRecentBets]
  );
  const roundWatcher = useCasinoRoundWatcher({
    sdk,
    betId: state.betId,
    active: state.status === "reconciled",
    refundTimeoutSeconds: release?.refundTimeoutSeconds,
    onTerminal: handleRoundTerminal
  });
  const roundPhase = React.useMemo<CasinoRoundPhase>(() => {
    if (state.status === "planning") return "loading_quote";
    if (state.status === "submitting" || state.status === "mined") return "placing";
    if (roundWatcher.phase !== "idle") return roundWatcher.phase;
    return vrfQuote.phase === "loading_quote" ? "loading_quote" : "ready";
  }, [roundWatcher.phase, state.status, vrfQuote.phase]);
  const isRoundAnimating =
    isPending ||
    state.status === "planning" ||
    state.status === "submitting" ||
    state.status === "mined" ||
    roundWatcher.isLive;
  const animatingKenoSpots = useKenoStrobeSpots({
    isPending: isRoundAnimating,
    gameSlug: game?.slug
  });

  useBetStepperFailureToast({ status: state.status, error: state.error });
  useVrfTimeoutToast(roundPhase === "timeout_soft");

  useGameResolutionEffect({
    terminalBet,
    recentBets,
    db,
    setIsPending,
    setShowResult,
    setResultProof,
    reset
  });

  if (!release || !game)
    return (
      <ProductStateCard
        title="Module Not Found"
        description={readOnlyReason ?? "Game not found."}
      />
    );

  // A5: Live houseEdge and maxPayout from release gamesMeta
  const gameMeta = release?.gamesMeta?.find((m: any) => m.slug === game.slug);
  const houseEdge = formatHouseEdge(gameMeta, game.slug);
  const usdcDecimals = release?.assets?.find((a: any) => a.symbol === "USDC")?.decimals ?? 6;
  const maxPayout = formatGameMaxPayout({ gameMeta, slug: game.slug, usdcDecimals });

  // B2: Accurate win-chance using proper math per game module
  const winChance = calculateGameWinChance({
    slug: game.slug,
    diceTarget,
    diceDirection,
    rouletteSpots,
    kenoSpots
  });

  const multiplier = winChance === 0 ? 0 : 99 / winChance;
  const expectedPayout = betAmount * multiplier;

  const handlePlaceBet = () => {
    setTerminalBet(null);
    setResultProof(null);
    return executeGamePlaceBetAction({
      account: sdk?.account,
      openConnectModal,
      release,
      game,
      winChance,
      state,
      reset,
      setShowResult,
      executeNow,
      planNow,
      betAmount,
      betCount,
      stopGain,
      stopLoss,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots
    });
  };

  const LeftPane = (
    <GameRoomBetPanel
      game={game}
      walletBalance={walletBalance}
      isSynced={Boolean(isSynced)}
      betAmount={betAmount}
      onBetAmountChange={setBetAmount}
      betCount={betCount}
      onBetCountChange={setBetCount}
      stopGain={stopGain}
      onStopGainChange={setStopGain}
      stopLoss={stopLoss}
      onStopLossChange={setStopLoss}
      advancedOpen={advancedOpen}
      onAdvancedOpenChange={setAdvancedOpen}
      isPending={isRoundAnimating}
      state={state}
      hasAccount={Boolean(sdk?.account)}
      winChance={winChance}
      multiplier={multiplier}
      expectedPayout={expectedPayout}
      coinSide={coinSide}
      onCoinSideChange={setCoinSide}
      rouletteSpots={rouletteSpots}
      onRouletteClear={() => setRouletteSpots([])}
      kenoSpots={kenoSpots}
      onKenoChange={setKenoSpots}
      onKenoResetResult={() => setKenoResultDrawn([])}
      roundPhase={roundPhase}
      vrfQuote={vrfQuote.quote}
      vrfQuoteError={vrfQuote.quoteError}
      activeBetId={state.betId}
      activeRequestId={roundWatcher.bet?.requestId}
      roundError={roundWatcher.error}
      manualSettleAvailable={roundWatcher.manualSettleAvailable}
      onManualSettle={roundWatcher.manualSettle}
      manualRefundAvailable={roundWatcher.manualRefundAvailable}
      onManualRefund={roundWatcher.manualRefund}
      onPlaceBet={handlePlaceBet}
    />
  );

  const RightPane = (
    <GameRoomRightPane
      gameSlug={game.slug}
      coinSide={coinSide}
      flipCount={flipCount}
      gameHistory={gameHistory}
      recentBets={recentBets}
      isPending={isRoundAnimating}
      showResult={showResult}
      resultNum={resultNum}
      diceDirection={diceDirection}
      diceTarget={diceTarget}
      multiplier={multiplier}
      winChance={winChance}
      rouletteSpots={rouletteSpots}
      kenoSpots={kenoSpots}
      animatingKenoSpots={animatingKenoSpots}
      kenoResultDrawn={kenoResultDrawn}
      resultProof={resultProof}
      chainId={chainId}
      assetSymbol="USDC"
      assetDecimals={usdcDecimals}
      onDiceDirectionChange={setDiceDirection}
      onDiceTargetChange={setDiceTarget}
      onRouletteChange={setRouletteSpots}
      onKenoChange={setKenoSpots}
      onKenoResetResult={() => setKenoResultDrawn([])}
    />
  );

  const AuditLedger = (
    <GameRoomAuditLedger game={game} betAmount={betAmount} recentBets={recentBets} />
  );

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <GameRoomShell
        gameName={getGameDisplayName(game)}
        houseEdge={houseEdge}
        maxPayout={maxPayout}
        isInteractive={true}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
      />
    </PageTransition>
  );
}
