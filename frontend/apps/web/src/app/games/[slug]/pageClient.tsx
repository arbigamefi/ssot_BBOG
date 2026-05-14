"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CurrencyDollarIcon,
  WalletIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

import {
  AuditTabs,
  AuditTableHeader,
  AuditTableRow,
  AuditTableCell,
  StatusBadge,
  cn
} from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { ImmersiveGameLayout } from "../../../components/ImmersiveGameLayout";

import { toast } from "@ssot/ui";
import { encodeStakeSpec } from "@ssot/ssot/encoding";
import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { usePlaceBetStepper } from "../../../features/betting/usePlaceBetStepper";
import { useConnectModal } from "../../../app/providers/WalletButton";
import {
  EUROPEAN_WHEEL_ORDER,
  RED_NUMBER_SET,
  kenoMultiplier,
  mapBetState,
  shortHex,
  toGameMeta,
  type GameMeta
} from "../../../features/games/room/model";
import { buildGameParams, calculateGameWinChance } from "../../../features/games/room/params";
import { simulateGameResult } from "../../../features/games/room/simulation";
import {
  CoinSideSelector,
  KenoSelectionPanel,
  RouletteSelectionPanel
} from "../../../features/games/room/controls";
import { CoinTossStage, DiceStage } from "../../../features/games/room/stages";

/* ─── Main Logic ─── */

export function GamePageClient({ slug }: { slug: string }) {
  const router = useRouter();
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
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
      {/* ANIMATION STYLES */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
         @keyframes dice-roll-3d { 0% { transform: rotateX(0deg) rotateY(0deg) scale(0.8); } 50% { transform: rotateX(540deg) rotateY(720deg) scale(1.2); } 100% { transform: rotateX(1080deg) rotateY(1440deg) scale(1); } }
         @keyframes toss-anim { 0% { transform: rotateX(20deg) rotateY(0deg) translateY(0px); } 50% { transform: rotateX(80deg) rotateY(900deg) translateY(-400px) scale(1.5); } 100% { transform: rotateX(20deg) rotateY(${flipCount * 1800 + (coinSide === "TAILS" ? 180 : 0)}deg) translateY(0px); } }
         @keyframes spin-coin-fast { 0% { transform: rotateX(10deg) rotateY(0deg) scale(1.2); } 100% { transform: rotateX(10deg) rotateY(360deg) scale(1.2); } }
       `
        }}
      />

      {/* C2: Live Bets Tracker — shows real chain state of recent bets */}
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
        <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/90 backdrop-blur-xl shadow-2xl min-w-[200px] max-w-[260px]">
          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1 w-full">
            {game.slug === "dice"
              ? "RECENT ROLLS"
              : game.slug === "roulette"
                ? "RECENT NUMBERS"
                : game.slug === "keno"
                  ? "RECENT DRAWS"
                  : "RECENT FLIPS"}
          </div>
          {/* Session history from this session */}
          {gameHistory.length > 0 && (
            <div className="flex gap-1.5 justify-end flex-wrap w-full">
              {gameHistory.map((res, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border",
                    res.win
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {game.slug === "coin-toss" ? (
                    res.val === 1 ? (
                      "H"
                    ) : (
                      "T"
                    )
                  ) : game.slug === "keno" ? (
                    res.val
                  ) : game.slug === "roulette" ? (
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px]",
                        res.val === 0
                          ? "bg-emerald-500"
                          : RED_NUMBER_SET.has(res.val)
                            ? "bg-red-600"
                            : "bg-zinc-700"
                      )}
                    >
                      {res.val}
                    </span>
                  ) : (
                    res.val
                  )}
                </div>
              ))}
            </div>
          )}
          {/* C2: Live chain bets from indexer */}
          {recentBets.length > 0 && (
            <div className="w-full border-t border-white/5 pt-2 mt-1 flex flex-col gap-1">
              {recentBets.slice(0, 3).map((bet) => (
                <div key={bet.id} className="flex justify-between items-center">
                  <span className="text-[9px] font-mono text-white/30">
                    #{bet.betId.toString().slice(-6)}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                      bet.state === "finalized"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : bet.state === "refunded"
                          ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          : bet.state === "randomReady"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}
                  >
                    {bet.state === "finalized"
                      ? "SETTLED"
                      : bet.state === "refunded"
                        ? "REFUNDED"
                        : bet.state === "randomReady"
                          ? "VRF READY"
                          : "PLACED"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {gameHistory.length === 0 && recentBets.length === 0 && (
            <span className="text-[10px] text-white/10 px-2 py-1">Waiting for first play...</span>
          )}
        </div>
      </div>

      {/* DICE STAGE */}
      {game.slug === "dice" && (
        <DiceStage
          isPending={isPending}
          showResult={showResult}
          resultNum={resultNum}
          diceDirection={diceDirection}
          diceTarget={diceTarget}
          multiplier={multiplier}
          winChance={winChance}
          onDirectionChange={setDiceDirection}
          onTargetChange={setDiceTarget}
        />
      )}

      {/* COIN TOSS STAGE */}
      {game.slug === "coin-toss" && (
        <CoinTossStage
          isPending={isPending}
          showResult={showResult}
          resultNum={resultNum}
          coinSide={coinSide}
        />
      )}

      {/* ROULETTE STAGE */}
      {game.slug === "roulette" && (
        <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pb-6 z-10 overflow-hidden">
          {/* CENTRAL REALISTIC EUROPEAN WHEEL */}
          <div className="relative z-10 flex-1 w-full flex items-center justify-center min-h-[220px]">
            {/* Cinematic Top Light */}
            <div className="absolute top-0 inset-x-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_70%)] pointer-events-none" />

            {/* Mahogany Rim & Golden Ring */}
            <div className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] lg:w-[380px] lg:h-[380px] rounded-full border-[10px] md:border-[16px] border-[#2C1810] shadow-[0_20px_50px_rgba(0,0,0,1),inset_0_0_20px_black] ring-2 ring-[#B8860B] flex items-center justify-center p-1 md:p-2 relative bg-[#111] transform-gpu transition-all hover:scale-[1.02]">
              {/* Inner Rotating Drum */}
              <div
                className={cn(
                  "w-full h-full rounded-full relative flex items-center justify-center transition-all duration-[3000ms] overflow-hidden border border-[#B8860B]/40",
                  isPending
                    ? "animate-[spin_4s_cubic-bezier(0.1,0.7,0.1,1)_forwards] blur-[0.5px]"
                    : "rotate-0"
                )}
                style={{
                  background: `conic-gradient(from -4.86deg, ${EUROPEAN_WHEEL_ORDER.map(
                    (num, i) => {
                      const color =
                        num === 0 ? "#059669" : RED_NUMBER_SET.has(num) ? "#b91c1c" : "#1a1a1a";
                      const deg = 360 / 37;
                      return `${color} ${i * deg}deg ${(i + 1) * deg}deg`;
                    }
                  ).join(", ")})`
                }}
              >
                {/* 37 Number Pockets Labels */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                    <div
                      key={num}
                      className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                      style={{ transform: `rotate(${i * (360 / 37)}deg)` }}
                    >
                      <div className="w-[20px] h-[40px] md:h-[50px] lg:h-[55px] flex items-center justify-center text-[10px] md:text-[14px] lg:text-[16px] font-black font-mono text-white mt-0.5 md:mt-2 [text-shadow:0_1px_2px_black]">
                        {num}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Perfect Metal Frets (3D Rendered) */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
                  {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                    <div
                      key={`fret-${num}`}
                      className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                      style={{ transform: `rotate(${i * (360 / 37) + 360 / 37 / 2}deg)` }}
                    >
                      <div className="w-[2px] h-[60px] md:h-[80px] bg-gradient-to-b from-[#FDE047] via-[#B8860B] to-transparent shadow-[1px_0_2px_rgba(0,0,0,0.5)]" />
                    </div>
                  ))}
                </div>

                {/* Central Multi-Faceted Metallic Turret */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE047,#B8860B_70%,#4527A0)] shadow-[0_0_50px_rgba(0,0,0,1),inset_0_0_30px_black] border-[5px] border-[#222] flex items-center justify-center z-10">
                  <div className="w-22 h-22 md:w-28 md:h-28 rounded-full bg-[radial-gradient(circle_at_center,#111,#000)] shadow-[inset_0_0_15px_black] flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 via-gray-200 to-gray-800 shadow-2xl border border-white/20" />
                  </div>
                  {/* Diamond-Cut Turret Spinners */}
                  {[0, 45, 90, 135].map((deg) => (
                    <div
                      key={deg}
                      className="absolute w-full h-[12px] bg-[#FDE047]/25 mix-blend-overlay blur-[0.5px]"
                      style={{ transform: `rotate(${deg}deg)` }}
                    />
                  ))}
                </div>

                {/* Inner Ball Track Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[260px] md:h-[260px] lg:w-[290px] lg:h-[290px] rounded-full border border-[#B8860B]/20 bg-black/60 shadow-[inset_0_0_30px_black] z-0" />
              </div>

              {/* HIGH-INTENSITY SPINNING BALL */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full z-20 pointer-events-none transition-transform",
                  isPending ? "animate-[spin_2s_linear_infinite_reverse]" : "duration-1000 ease-out"
                )}
                style={
                  !isPending && showResult && resultNum !== null
                    ? {
                        transform: `rotate(${EUROPEAN_WHEEL_ORDER.indexOf(resultNum) * (360 / 37)}deg)`
                      }
                    : {}
                }
              >
                <div
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all",
                    isPending
                      ? "top-[12px] md:top-[16px] shadow-[0_0_15px_white,-10px_0px_10px_black] scale-125 blur-[1.5px] duration-[2000ms]"
                      : "top-[40px] md:top-[50px] lg:top-[55px] shadow-[0_0_10px_white,-5px_5px_12px_black] scale-100 duration-1000"
                  )}
                />
              </div>
            </div>
          </div>

          {/* MASSIVE INTERACTIVE ROULETTE BOARD */}
          <div className="relative z-20 w-fit max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar pointer-events-auto transform-gpu origin-bottom scale-[0.85] sm:scale-95 xl:scale-100 pb-2 px-1">
            <div className="bg-[#0B1A12] border-[4px] border-[#222] rounded-[1.2rem] md:rounded-[1.5rem] p-2 md:p-3 sm:p-4 shadow-[0_30px_60px_rgba(0,0,0,1),inset_0_0_40px_rgba(0,0,0,0.9)] min-w-[500px] md:min-w-fit relative overflow-hidden flex flex-col gap-1.5">
              {/* Velvet Texture & Material Effects */}
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-25 pointer-events-none mix-blend-overlay" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

              <div className="flex">
                {/* ZERO SPOT */}
                <button
                  onClick={() =>
                    setRouletteSpots(
                      rouletteSpots.includes("0")
                        ? rouletteSpots.filter((s) => s !== "0")
                        : [...rouletteSpots, "0"]
                    )
                  }
                  className={cn(
                    "w-10 sm:w-12 md:w-14 rounded-l-lg md:rounded-l-xl border flex items-center justify-center font-mono font-black text-lg md:text-xl transition-all relative overflow-hidden group",
                    rouletteSpots.includes("0")
                      ? "bg-emerald-400 border-emerald-300 text-black shadow-[0_0_40px_rgba(52,211,153,0.8),inset_0_2px_10px_white] z-10 scale-[1.05]"
                      : "bg-[#093d25] border-[#105e3a] text-emerald-100 hover:bg-[#0c4e30]"
                  )}
                >
                  <div className="relative z-10">0</div>
                  {rouletteSpots.includes("0") && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent animate-pulse" />
                  )}
                </button>

                <div className="flex flex-col gap-1.5 ml-1.5">
                  {[3, 2, 1].map((rN, rI) => (
                    <div key={rN} className="flex gap-1.5">
                      {Array.from({ length: 12 }).map((_, cI) => {
                        const num = cI * 3 + rN;
                        const isS = rouletteSpots.includes(num.toString());
                        return (
                          <button
                            key={num}
                            onClick={() =>
                              setRouletteSpots(
                                isS
                                  ? rouletteSpots.filter((s) => s !== num.toString())
                                  : [...rouletteSpots, num.toString()]
                              )
                            }
                            className={cn(
                              "w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center font-mono font-black text-xs md:text-sm border transition-all relative rounded shadow-lg group overflow-hidden",
                              isS
                                ? "bg-white text-black scale-110 z-10 border-white shadow-[0_0_30px_white,inset_0_2px_5px_rgba(0,0,0,0.2)]"
                                : RED_NUMBER_SET.has(num)
                                  ? "bg-[#7f1d1d] hover:bg-[#991b1b] text-red-100 border-[#991b1b] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]"
                                  : "bg-[#1f2937] hover:bg-[#374151] text-gray-200 border-[#374151] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]"
                            )}
                          >
                            <span className="relative z-10">{num}</span>
                            {isS && (
                              <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent shadow-inner" />
                            )}
                          </button>
                        );
                      })}
                      <button className="w-10 sm:w-12 md:w-14 border border-white/10 bg-white/5 text-[9px] md:text-[10px] font-black text-white/30 hover:text-white transition-all uppercase tracking-tighter hover:bg-white/10 rounded-r-md">
                        2:1
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* DOZENS */}
              <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px] mt-1">
                {["1st 12", "2nd 12", "3rd 12"].map((doz) => (
                  <button
                    key={doz}
                    onClick={() =>
                      setRouletteSpots(
                        rouletteSpots.includes(doz)
                          ? rouletteSpots.filter((s) => s !== doz)
                          : [...rouletteSpots, doz]
                      )
                    }
                    className={cn(
                      "flex-1 py-1.5 md:py-2 border font-black text-[9px] md:text-[11px] uppercase transition-all rounded-md relative overflow-hidden",
                      rouletteSpots.includes(doz)
                        ? "bg-emerald-500 border-white text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10 scale-[1.02]"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {doz}
                  </button>
                ))}
              </div>

              {/* OUTSIDE BETS */}
              <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px]">
                {["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].map((o) => (
                  <button
                    key={o}
                    onClick={() =>
                      setRouletteSpots(
                        rouletteSpots.includes(o)
                          ? rouletteSpots.filter((s) => s !== o)
                          : [...rouletteSpots, o]
                      )
                    }
                    className={cn(
                      "flex-1 py-1.5 md:py-2 border font-black text-[8px] md:text-[10px] uppercase transition-all rounded-md flex items-center justify-center relative shadow-inner overflow-hidden",
                      rouletteSpots.includes(o)
                        ? "bg-emerald-500 border-white text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10 scale-[1.02]"
                        : "bg-white/5 border-white/10 text-white/30 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {o === "RED" ? (
                      <div className="w-3 h-3 md:w-4 md:h-4 bg-red-600 rounded-sm shadow-[0_0_15px_rgba(220,38,38,0.5),inset_0_2px_5px_white/30]" />
                    ) : o === "BLACK" ? (
                      <div className="w-3 h-3 md:w-4 md:h-4 bg-zinc-900 rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5),inset_0_2px_5px_white/10]" />
                    ) : (
                      o
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KENO STAGE */}
      {game.slug === "keno" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
          {/* Ambient Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.05)_0%,transparent_70%)] pointer-events-none" />

          {/* DYNAMIC PAYOUT LADDER */}
          <div className="w-full max-w-[800px] mb-8 bg-[#0a0a0a]/90 backdrop-blur-3xl rounded-[2rem] border border-white/10 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative z-20">
            <div className="absolute top-0 left-0 bottom-0 w-32 bg-gradient-to-r from-fuchsia-900/20 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <div
                className="text-[10px] text-fuchsia-500/70 font-black uppercase tracking-widest mr-4 flex-shrink-0"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Payouts
              </div>
              {Array.from({ length: Math.max(5, kenoSpots.length + 1) }).map((_, hits) => {
                const pay =
                  hits === 0
                    ? 0
                    : Math.pow(Math.max(1, hits - Math.floor(kenoSpots.length / 3)), 1.8);
                const isCurrentTarget = kenoSpots.length > 0 && hits === kenoSpots.length;
                return (
                  <div
                    key={hits}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[70px] h-16 rounded-[1rem] border-2 transition-all",
                      isCurrentTarget
                        ? "bg-fuchsia-600/20 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.3)] scale-105"
                        : pay > 0
                          ? "bg-[#111] border-white/5"
                          : "bg-transparent border-transparent opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[9px] uppercase font-bold tracking-widest mb-1",
                        isCurrentTarget ? "text-fuchsia-300" : "text-white/40"
                      )}
                    >
                      {hits} Hits
                    </span>
                    <span
                      className={cn(
                        "text-sm font-mono font-black",
                        isCurrentTarget
                          ? "text-white drop-shadow-[0_0_8px_white]"
                          : pay > 0
                            ? "text-fuchsia-400"
                            : "text-white/20"
                      )}
                    >
                      {pay.toFixed(2)}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "relative z-10 w-full max-w-[800px] bg-[#050505]/95 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_2px_20px_rgba(255,255,255,0.05)] transition-all",
              isPending ? "scale-[0.98] drop-shadow-[0_0_50px_rgba(217,70,239,0.2)]" : ""
            )}
          >
            <div className="grid grid-cols-8 md:grid-cols-10 gap-3 relative z-10">
              {Array.from({ length: 40 }).map((_, i) => {
                const n = i + 1;
                const isS = kenoSpots.includes(n);
                const isA = isPending && animatingKenoSpots.includes(n);
                const isDrawnWinner =
                  !isPending && showResult && kenoResultDrawn.includes(n) && isS;
                const isDrawnMiss = !isPending && showResult && kenoResultDrawn.includes(n) && !isS;
                const isMissedPick =
                  !isPending && showResult && !kenoResultDrawn.includes(n) && isS;

                return (
                  <button
                    key={n}
                    disabled={isPending || showResult}
                    onClick={() => {
                      if (isS) setKenoSpots(kenoSpots.filter((x) => x !== n));
                      else if (kenoSpots.length < 10) setKenoSpots([...kenoSpots, n]);
                      setKenoResultDrawn([]);
                    }}
                    className={cn(
                      "aspect-square rounded-2xl flex items-center justify-center font-mono font-black text-xl md:text-2xl transition-all border-2 relative overflow-hidden group",
                      isA
                        ? "bg-fuchsia-400 text-black shadow-[0_0_30px_rgba(217,70,239,0.8),inset_0_0_10px_white] z-20 scale-110 border-white duration-75"
                        : isDrawnWinner
                          ? "bg-emerald-500 border-white text-black shadow-[0_0_40px_rgba(16,185,129,0.8),inset_0_0_15px_white] scale-110 z-30 animate-[pulse_1s_ease-in-out_infinite]"
                          : isDrawnMiss
                            ? "bg-white/20 border-white/40 text-white z-20 shadow-lg scale-105"
                            : isMissedPick
                              ? "bg-fuchsia-900/40 border-fuchsia-900 text-fuchsia-800 opacity-50 shadow-inner scale-95"
                              : isS
                                ? "bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 text-white border-fuchsia-300 shadow-[0_10px_20px_rgba(217,70,239,0.4),inset_0_2px_10px_rgba(255,255,255,0.2)] hover:scale-105 hover:-translate-y-1 z-10"
                                : "bg-[#0B0B0B] border-white/5 text-white/20 hover:bg-[#1f1f1f] hover:border-white/20 hover:text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                    )}
                  >
                    <span className="relative z-10 drop-shadow-md">{n}</span>
                    {isS && !isDrawnWinner && !isMissedPick && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>

            {!isPending && !showResult && kenoSpots.length === 0 && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="bg-[#050505]/80 backdrop-blur-xl px-12 py-5 rounded-full border border-white/10 text-white/50 font-black tracking-[0.4em] uppercase text-sm shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
                  Select 1 to 10 Spots
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULT OVERLAYS */}
      {showResult && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in pointer-events-auto">
          <div className="p-12 rounded-[4rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden transition-all scale-110">
            <div className="absolute inset-0 blur-[100px] opacity-20 bg-emerald-500 animate-pulse" />
            <h3 className="text-xl font-bold text-white/40 uppercase tracking-[0.3em] mb-6">
              Verification Success
            </h3>
            <div
              className={cn(
                "text-7xl font-mono font-black mb-8 w-64 h-36 rounded-[2.5rem] flex items-center justify-center border-4 bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(52,211,153,0.3)]"
              )}
            >
              {game.slug === "coin-toss"
                ? coinSide === "TAILS"
                  ? "TAILS"
                  : "HEADS"
                : (resultNum ?? 42)}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-emerald-400 font-black text-lg tracking-widest mb-2 flex items-center gap-2">
                DIRECT PREDICTION HIT{" "}
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_emerald]" />
              </span>
              <span className="text-5xl font-mono text-white font-black">
                +{expectedPayout.toFixed(2)} <span className="text-xl opacity-30">USDC</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const AuditLedger = (
    <div className="flex flex-col pointer-events-auto overflow-hidden">
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
        <AuditTabs
          activeColorClass={cn(
            themeColor === "emerald"
              ? "border-emerald-400 text-emerald-400"
              : "border-purple-400 text-purple-400"
          )}
        >
          <AuditTableHeader>
            <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] text-white/20 font-black uppercase tracking-[0.2em] text-[10px] px-6 w-full">
              <div>Timestamp / Auth</div>
              <div>Submodule</div>
              <div>Wager Parameters</div>
              <div>Settlement State</div>
              <div className="text-right">Audit</div>
            </div>
          </AuditTableHeader>
          <div className="flex flex-col gap-2 mt-4 px-2">
            {recentBets.length > 0 ? (
              recentBets.map((r, i) => (
                <AuditTableRow
                  key={i}
                  className="hover:bg-white/[0.03] transition-all border border-white/5 py-5 px-6 rounded-2xl bg-black/20 group"
                >
                  <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] items-center w-full">
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span className="text-white font-mono text-xs font-bold">
                          {new Date().toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] font-mono text-white/30">
                          {shortHex(r.player)}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className="font-black text-white/90 text-sm">{game.label}</span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "font-black font-mono text-xs mb-1",
                            themeColor === "emerald" ? "text-emerald-500" : "text-purple-500"
                          )}
                        >
                          {game.slug.toUpperCase()} SELECTION
                        </span>
                        <span className="text-[10px] text-white/40 font-mono tracking-tight">
                          {betAmount} USDC · ID: {r.betId.toString().slice(-12)}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>
                      <StatusBadge status={mapBetState(r.state)} />
                    </AuditTableCell>
                    <AuditTableCell className="justify-end">
                      <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group-hover:scale-110 border border-white/5">
                        ↗
                      </button>
                    </AuditTableCell>
                  </div>
                </AuditTableRow>
              ))
            ) : (
              <div className="py-24 text-center border-2 border-white/5 rounded-3xl border-dashed">
                <div className="text-white/5 text-[10px] font-black uppercase tracking-[0.5em] mb-2">
                  Immutable Audit Stream
                </div>
                <div className="text-white/20 text-xs font-bold font-mono">
                  STANDBY FOR ON-CHAIN TRANSACTION EMIT...
                </div>
              </div>
            )}
          </div>
        </AuditTabs>
      </div>
    </div>
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
