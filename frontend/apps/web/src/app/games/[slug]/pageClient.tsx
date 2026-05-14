"use client";

import * as React from "react";
import {
  CurrencyDollarIcon,
  WalletIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

import { cn, toast } from "@ssot/ui";

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
import { simulateGameResult } from "../../../features/games/room/simulation";
import {
  CoinSideSelector,
  KenoSelectionPanel,
  RouletteSelectionPanel
} from "../../../features/games/room/controls";
import { GameRoomAuditLedger } from "../../../features/games/room/audit-ledger";
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
  // A1: Live wallet balance from sdk.bank.getAssetBalance
  const [walletBalance, setWalletBalance] = React.useState<string | null>(null);

  // Game-specific params
  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);

  // Simulation state
  const [flipCount, setFlipCount] = React.useState(0);
  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [animatingKenoSpots, setAnimatingKenoSpots] = React.useState<number[]>([]);
  const [kenoResultDrawn, setKenoResultDrawn] = React.useState<number[]>([]);

  // History state for widgets
  const [gameHistory, setGameHistory] = React.useState<any[]>([]);
  // C1: Multi-roll controls
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0); // 0 = disabled
  const [stopLoss, setStopLoss] = React.useState<number>(0); // 0 = disabled
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  // A1: Fetch live wallet balance when sdk & account are ready
  React.useEffect(() => {
    if (!sdk?.account || !release?.assets) return;
    const usdcAsset = release.assets.find((a: any) => a.symbol === "USDC");
    if (!usdcAsset?.address) return;
    sdk.bank
      .getAssetBalance(usdcAsset.address as `0x${string}`, sdk.account)
      .then((raw: bigint) => {
        const decimals: number = usdcAsset.decimals ?? 6;
        const formatted = (Number(raw) / Math.pow(10, decimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setWalletBalance(`${formatted} USDC`);
      })
      .catch(() => setWalletBalance(null));
  }, [sdk?.account, release?.assets]);

  // Keno strobe effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPending && game?.slug === "keno") {
      interval = setInterval(() => {
        const rnd: number[] = [];
        while (rnd.length < 8) {
          const num = Math.floor(Math.random() * 40) + 1;
          if (!rnd.includes(num)) rnd.push(num);
        }
        setAnimatingKenoSpots(rnd);
      }, 80);
    } else {
      setAnimatingKenoSpots([]);
    }
    return () => clearInterval(interval);
  }, [isPending, game?.slug]);

  if (!release || !game)
    return (
      <Placeholder
        title="Module Not Found"
        description={readOnlyReason ?? "Game not found."}
        specPath="docs/frontend/PAGE-SPECS/010-GAMES.md"
      />
    );

  const themeColor: any =
    game.slug === "dice"
      ? "purple"
      : game.slug === "roulette"
        ? "emerald"
        : game.slug === "coin-toss"
          ? "amber"
          : "fuchsia";

  // A5: Live houseEdge and maxPayout from release gamesMeta
  const gameMeta = release?.gamesMeta?.find((m: any) => m.slug === game.slug) as any;
  const houseEdgeBps: number = gameMeta?.houseEdgeBps ?? (game.slug === "roulette" ? 270 : 100);
  const houseEdge = `${(houseEdgeBps / 100).toFixed(2)}%`;
  const maxPayoutRaw: bigint | undefined = gameMeta?.maxPayout
    ? BigInt(String(gameMeta.maxPayout))
    : undefined;
  const usdcDecimals = release?.assets?.find((a: any) => a.symbol === "USDC")?.decimals ?? 6;
  const maxPayout = maxPayoutRaw
    ? `${(Number(maxPayoutRaw) / Math.pow(10, usdcDecimals)).toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC`
    : game.slug === "roulette"
      ? "100,000 USDC"
      : game.slug === "keno"
        ? "500,000 USDC"
        : "25,000 USDC";

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

  const handleAmountChange = (val: number) => {
    const rounded = Math.floor(Math.max(1, val));
    setBetAmount(rounded);
  };

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
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-white/60 flex items-center gap-2">
          <WalletIcon className="w-4 h-4" /> Wallet Balance
        </span>
        <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">
          {/* A4: Live wallet balance — shows syncing until both indexer is caught-up and balance fetched */}
          {!isSynced ? "Syncing..." : (walletBalance ?? "—")}
        </span>
      </div>

      {game.slug === "roulette" && (
        <RouletteSelectionPanel spots={rouletteSpots} onClear={() => setRouletteSpots([])} />
      )}

      {game.slug === "coin-toss" && <CoinSideSelector coinSide={coinSide} onChange={setCoinSide} />}

      {game.slug === "keno" && (
        <KenoSelectionPanel
          spots={kenoSpots}
          onChange={setKenoSpots}
          onResetResult={() => setKenoResultDrawn([])}
        />
      )}

      <div className="mb-6">
        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
          Bet Amount
        </label>
        <div
          className={cn(
            "bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative shadow-inner",
            isPending ? "opacity-50" : "focus-within:border-white/20"
          )}
        >
          <div className="flex items-center px-4 pt-2">
            <CurrencyDollarIcon className="w-6 h-6 text-white/20" />
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right"
            />
          </div>
          <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
            <button
              onClick={() => handleAmountChange(1)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              Min
            </button>
            <button
              onClick={() => handleAmountChange(betAmount / 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              1/2
            </button>
            <button
              onClick={() => handleAmountChange(betAmount * 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              2x
            </button>
            <button
              onClick={() => {
                // C1: Use live wallet balance for Max button
                const rawBalance = walletBalance
                  ? parseFloat(walletBalance.replace(/,/g, "").replace(" USDC", ""))
                  : 1450;
                handleAmountChange(Math.floor(rawBalance));
              }}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      {/* C1: Multi-Roll Controls */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">
            Rolls
          </label>
          {betCount > 1 && (
            <span className="text-[10px] font-mono text-white/30">
              Total: {(betAmount * betCount).toLocaleString()} USDC
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setBetCount(n)}
              disabled={isPending}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border transition-all",
                betCount === n
                  ? themeColor === "purple"
                    ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                    : themeColor === "emerald"
                      ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      : themeColor === "amber"
                        ? "bg-amber-500 border-amber-300 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                        : "bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]"
                  : "bg-[#0a0a0a] border-white/10 text-white/40 hover:border-white/20 hover:text-white"
              )}
            >
              {n === 1 ? "1x" : `${n}x`}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={100}
            value={betCount}
            onChange={(e) => setBetCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            disabled={isPending}
            className="w-14 text-center bg-[#0a0a0a] border border-white/10 rounded-xl text-xs font-mono text-white focus:border-white/30 focus:outline-none"
          />
        </div>
      </div>

      {/* C1: Advanced Controls (collapsible) */}
      <div className="mb-6">
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-white/25 hover:text-white/50 transition-colors pb-2 border-b border-white/5"
        >
          <span>Advanced</span>
          <span className={cn("transition-transform duration-200", advancedOpen && "rotate-180")}>
            ▼
          </span>
        </button>
        {advancedOpen && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
                Stop Gain (USDC)
              </label>
              <input
                type="number"
                min={0}
                value={stopGain}
                onChange={(e) => setStopGain(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0 = off"
                className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
                Stop Loss (USDC)
              </label>
              <input
                type="number"
                min={0}
                value={stopLoss}
                onChange={(e) => setStopLoss(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0 = off"
                className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-red-500/40 focus:outline-none"
              />
            </div>
            {(stopGain > 0 || stopLoss > 0) && (
              <div className="col-span-2 text-[9px] text-white/20 font-mono">
                {stopGain > 0 && (
                  <span className="text-emerald-400/50">↑ Stop at +{stopGain} USDC gain</span>
                )}
                {stopGain > 0 && stopLoss > 0 && <span className="mx-2">·</span>}
                {stopLoss > 0 && (
                  <span className="text-red-400/50">↓ Stop at {stopLoss} USDC loss</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
            Multiplier <InformationCircleIcon className="w-3 h-3" />
          </span>
          <span
            className={cn(
              "text-2xl font-mono font-bold transición-all",
              themeColor === "emerald"
                ? "text-emerald-400"
                : themeColor === "purple"
                  ? "text-purple-400"
                  : "text-amber-400"
            )}
          >
            {multiplier.toFixed(2)}x
          </span>
        </div>
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
            Win Chance <ChartBarIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-white">{winChance.toFixed(2)}%</span>
        </div>
        <div className="col-span-2 bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] select-none">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1">
            Expected Payout
          </span>
          <span
            className={cn(
              "text-3xl font-mono font-extrabold flex items-baseline gap-2",
              themeColor === "emerald"
                ? "text-emerald-400"
                : themeColor === "purple"
                  ? "text-purple-400"
                  : themeColor === "amber"
                    ? "text-amber-400"
                    : "text-fuchsia-400"
            )}
          >
            {expectedPayout.toFixed(2)}{" "}
            <span
              className={cn(
                "text-sm font-bold",
                themeColor === "emerald"
                  ? "text-emerald-500/50"
                  : themeColor === "purple"
                    ? "text-purple-500/50"
                    : themeColor === "amber"
                      ? "text-amber-500/50"
                      : "text-fuchsia-500/50"
              )}
            >
              USDC
            </span>
          </span>
        </div>
      </div>

      {state.status === "failed" && state.error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
          <div className="text-xs font-bold font-mono">{state.error.message}</div>
        </div>
      )}

      <button
        onClick={handlePlaceBet}
        disabled={
          isPending ||
          state.status === "planning" ||
          state.status === "submitting" ||
          state.status === "mined" ||
          (game.slug !== "dice" && winChance === 0)
        }
        className={cn(
          "mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-2xl transition-all border-b-[4px]",
          isPending ||
            state.status === "reconciled" ||
            state.status === "submitting" ||
            state.status === "mined" ||
            state.status === "planning"
            ? "bg-[#111] opacity-50 cursor-not-allowed border-black text-white/50 shadow-none hover:bg-[#111]"
            : state.status === "failed"
              ? "bg-red-600 border-red-800 text-white hover:bg-red-500"
              : game.slug === "dice"
                ? "bg-purple-600 border-purple-800 text-white hover:bg-purple-500"
                : game.slug === "roulette"
                  ? "bg-emerald-600 border-emerald-800 text-white hover:bg-emerald-500"
                  : game.slug === "coin-toss"
                    ? coinSide === "HEADS"
                      ? "bg-amber-500 border-amber-700 text-amber-950 hover:bg-amber-400"
                      : "bg-indigo-600 border-indigo-800 text-white hover:bg-indigo-500"
                    : "bg-fuchsia-600 border-fuchsia-800 text-white hover:bg-fuchsia-500"
        )}
      >
        {!sdk?.account
          ? "CONNECT WALLET"
          : state.status === "failed"
            ? "TRANSACTION FAILED - RETRY"
            : isPending || state.status === "reconciled"
              ? "WAITING FOR VRF..."
              : state.status === "mined" || state.status === "submitting"
                ? "CONFIRM IN WALLET..."
                : state.plan
                  ? state.plan.preview.needsApproval
                    ? "APPROVE TICKET"
                    : "CONFIRM TICKET"
                  : state.status === "planning"
                    ? "REVIEWING TICKET..."
                    : "PLACE BET"}
      </button>
    </>
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
        gameName={
          game.slug === "dice"
            ? "Precision Dice"
            : game.slug === "roulette"
              ? "European Roulette"
              : game.slug === "keno"
                ? "Keno Draft"
                : game.label
        }
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
