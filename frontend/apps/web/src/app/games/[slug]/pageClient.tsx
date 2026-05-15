"use client";

import * as React from "react";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";

import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { usePlaceBetStepper } from "../../../features/betting/usePlaceBetStepper";
import { useConnectModal } from "../../../app/providers/WalletButton";
import { toGameMeta, type GameMeta } from "../../../features/games/room/model";
import { calculateGameWinChance } from "../../../features/games/room/params";
import { executeGamePlaceBetAction } from "../../../features/games/room/place-bet-action";
import {
  formatGameMaxPayout,
  formatHouseEdge,
  getGameDisplayName
} from "../../../features/games/room/presentation";
import { GameRoomAuditLedger } from "../../../features/games/room/audit-ledger";
import { GameRoomBetPanel } from "../../../features/games/room/bet-panel";
import {
  useBetStepperFailureToast,
  useVrfTimeoutToast
} from "../../../features/games/room/feedback";
import { useGameWalletBalance, useKenoStrobeSpots } from "../../../features/games/room/hooks";
import {
  useGameResolutionEffect,
  type GameHistoryEntry
} from "../../../features/games/room/resolution";
import { GameRoomRightPane } from "../../../features/games/room/right-pane";
import { GameRoomShell } from "../../../features/games/room/game-room-shell";

/* ─── Main Logic ─── */

export function GamePageClient({ slug }: { slug: string }) {
  const { release, readOnlyReason } = useRelease();
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
  const recentBets = recentBetsQuery.data ?? [];

  // Local State
  const [betAmount, setBetAmount] = React.useState<number>(10);
  const [isPending, setIsPending] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);

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
  const animatingKenoSpots = useKenoStrobeSpots({ isPending, gameSlug: game?.slug });

  const { planNow, executeNow, state, reset } = usePlaceBetStepper();
  const { openConnectModal } = useConnectModal();
  const { db } = useSSOTRuntime();

  useBetStepperFailureToast({ status: state.status, error: state.error });
  useVrfTimeoutToast(isPending);

  useGameResolutionEffect({
    status: state.status,
    betId: state.betId,
    recentBets,
    db,
    gameSlug: game?.slug ?? "",
    coinSide,
    diceDirection,
    diceTarget,
    rouletteSpots,
    kenoSpots,
    setIsPending,
    setShowResult,
    setFlipCount,
    setResultNum,
    setKenoResultDrawn,
    setGameHistory,
    reset
  });

  if (!release || !game)
    return (
      <Placeholder
        title="Module Not Found"
        description={readOnlyReason ?? "Game not found."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
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

  const handlePlaceBet = () =>
    executeGamePlaceBetAction({
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
      isPending={isPending}
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
      isPending={isPending}
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
      expectedPayout={expectedPayout}
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
