"use client";

import * as React from "react";

import { toast } from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { ImmersiveGameLayout } from "../../../components/ImmersiveGameLayout";

import { encodeStakeSpec } from "@ssot/ssot/encoding";
import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { usePlaceBetStepper } from "../../../features/betting/usePlaceBetStepper";
import { useConnectModal } from "../../../app/providers/WalletButton";
import { toGameMeta, type GameMeta } from "../../../features/games/room/model";
import { buildGameParams, calculateGameWinChance } from "../../../features/games/room/params";
import {
  formatGameMaxPayout,
  formatHouseEdge,
  getGameDisplayName,
  getGameThemeColor
} from "../../../features/games/room/presentation";
import { simulateGameResult } from "../../../features/games/room/simulation";
import { GameRoomAuditLedger } from "../../../features/games/room/audit-ledger";
import { GameRoomBetPanel } from "../../../features/games/room/bet-panel";
import { useGameWalletBalance, useKenoStrobeSpots } from "../../../features/games/room/hooks";
import { GameRoomRightPane } from "../../../features/games/room/right-pane";

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
  const [gameHistory, setGameHistory] = React.useState<any[]>([]);
  // C1: Multi-roll controls
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0); // 0 = disabled
  const [stopLoss, setStopLoss] = React.useState<number>(0); // 0 = disabled
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const walletBalance = useGameWalletBalance({ sdk, assets: release?.assets });
  const animatingKenoSpots = useKenoStrobeSpots({ isPending, gameSlug: game?.slug });

  if (!release || !game)
    return (
      <Placeholder
        title="Module Not Found"
        description={readOnlyReason ?? "Game not found."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );

  const themeColor = getGameThemeColor(game.slug);

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

  const { planNow, executeNow, state, reset } = usePlaceBetStepper();
  const { openConnectModal } = useConnectModal();
  const { db } = useSSOTRuntime();

  // B3: Toast when stepper enters failed state
  const prevStatusRef = React.useRef<string>("");
  React.useEffect(() => {
    if (state.status === "failed" && prevStatusRef.current !== "failed") {
      const errMsg = (state as any)?.error?.message ?? "Transaction failed. Please try again.";
      toast.error(errMsg);
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  // B3: VRF timeout warning toast at 60 seconds
  const pendingStartRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (isPending) {
      pendingStartRef.current = Date.now();
      const timer = setTimeout(() => {
        if (isPending) {
          toast.warning("Waiting for oracle… VRF resolution can take 30–120s on testnets.", {
            duration: 20000,
            id: "vrf-timeout"
          });
        }
      }, 60000);
      return () => clearTimeout(timer);
    } else {
      pendingStartRef.current = null;
    }
  }, [isPending]);

  const handlePlaceBet = async () => {
    if (!sdk?.account) {
      openConnectModal?.();
      return;
    }
    if (!game || (game.slug !== "dice" && winChance === 0)) return;

    if (state.status === "reconciled" || state.status === "failed") {
      reset();
      setShowResult(false);
      return;
    }

    if (state.plan) {
      await executeNow();
      return;
    }

    try {
      const gameParams = buildGameParams({
        slug: game.slug,
        diceTarget,
        coinSide,
        rouletteSpots,
        kenoSpots
      });
      if (!gameParams.ok) {
        toast.error(gameParams.message);
        return;
      }
      const params = gameParams.params;

      const usdcAsset = release.assets.find((a: any) => a.symbol === "USDC");
      const decimals = usdcAsset?.decimals || 6;
      const amountPerRoll = BigInt(betAmount) * BigInt(Math.pow(10, decimals));
      const totalStake = amountPerRoll * BigInt(betCount);

      const stakeSpecBytes = encodeStakeSpec({
        amountPerRoll,
        betCount,
        stopGain: stopGain > 0 ? BigInt(stopGain) * BigInt(Math.pow(10, decimals)) : 0n,
        stopLoss: stopLoss > 0 ? BigInt(stopLoss) * BigInt(Math.pow(10, decimals)) : 0n
      });

      // planNow dispatches to the state machine (returns void)
      await planNow({
        chainId: release.chainId,
        gameId: game.gameId,
        asset: (usdcAsset?.address ||
          "0x0000000000000000000000000000000000000000") as `0x${string}`,
        betCount,
        stake: totalStake,
        params,
        stakeSpec: stakeSpecBytes,
        maxHouseEdgeBps: 10000
      });
      // B3: Errors are surfaced via state.status==='failed' and the toast above
    } catch (e: any) {
      toast.error(e?.message ?? "An unexpected error occurred.");
      console.error(e);
    }
  };

  const latestBetIdRef = React.useRef<bigint | undefined>();
  React.useEffect(() => {
    if (state.status === "reconciled" && state.betId !== undefined) {
      if (latestBetIdRef.current !== state.betId) {
        latestBetIdRef.current = state.betId;
        setIsPending(true); // Switch to waiting for VRF visuals
      }

      // B1: Detect finalized state from BetRow directly (BetRow.state === "finalized")
      // mapBetState maps "finalized" → "settled", NOT "won"/"lost" — so we check raw state
      const myBet = recentBets.find((b) => b.betId.toString() === state.betId?.toString());
      if (myBet && (myBet.state === "finalized" || myBet.state === "refunded")) {
        setIsPending(false);
        setShowResult(true);

        // B1: Determine win/loss by querying payout from hubEvents argsJson
        // We do this asynchronously using the lastTxHash from this bet
        const resolvePayout = async () => {
          let win = false;
          try {
            if (db) {
              // Query the BetFinalized hubEvent for this bet via lastTxHash
              const events = await db.hubEvents
                .where("txHash")
                .equals(myBet.lastTxHash)
                .filter((ev) => ev.eventName === "BetFinalized")
                .toArray();
              const finalizedEvent = events[0];
              if (finalizedEvent) {
                const args = JSON.parse(finalizedEvent.argsJson);
                const payout = BigInt(args?.payout ?? args?.totalPayout ?? "0");
                const stake = BigInt(args?.stake ?? "0");
                // Win = received a payout above the stake amount (edge < 100%)
                win = payout > stake;
              }
            }
          } catch {
            // Fallback: if db query fails, leave win = false (conservative)
          }

          const simulated = simulateGameResult({
            slug: game?.slug ?? "",
            win,
            coinSide,
            diceDirection,
            diceTarget,
            rouletteSpots,
            kenoSpots
          });

          if (simulated.flipCoin) setFlipCount((c) => c + 1);
          if (game?.slug === "dice" || game?.slug === "roulette") {
            setResultNum(simulated.value);
          }
          if (simulated.kenoDrawn) {
            setKenoResultDrawn(simulated.kenoDrawn);
          }

          setGameHistory((prev) => [{ val: simulated.value, win }, ...prev].slice(0, 5));
          setTimeout(() => setShowResult(false), 8000);
          reset();
        };

        void resolvePayout();
      }
    }
  }, [
    state.status,
    state.betId,
    recentBets,
    game?.slug,
    coinSide,
    diceDirection,
    diceTarget,
    rouletteSpots,
    kenoSpots,
    db,
    reset
  ]);

  const LeftPane = (
    <GameRoomBetPanel
      game={game}
      themeColor={themeColor}
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
    <GameRoomAuditLedger
      game={game}
      themeColor={themeColor}
      betAmount={betAmount}
      recentBets={recentBets}
    />
  );

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <ImmersiveGameLayout
        gameName={getGameDisplayName(game)}
        themeColor={themeColor}
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
