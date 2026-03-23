"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { Hex, PlaceBetInput } from "@ssot/ssot/sdk";
import { encodeStakeSpec } from "@ssot/ssot/encoding";
import { Button, ErrorCallout, Input, Label, SharedBetSlip } from "@ssot/ui";

import type { SSOTRelease } from "@ssot/ssot/release";

import { useConnectModal } from "../../../app/providers/WalletButton";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { usePlaceBetStepper } from "../usePlaceBetStepper";
import { formatUnits, parseDecimalToUnits } from "../model/units";
import { cn } from "@ssot/ui";

import { BetPanelShell } from "./BetPanelShell";

type GameMeta = {
  gameId: Hex;
  slug: string;
  label: string;
};

type StakeSpecFormValue = {
  amountPerRoll: string;
  betCount: string;
  stopGain?: string;
  stopLoss?: string;
};

export type GameBetPanelProps = {
  release: SSOTRelease;
  game: GameMeta;
  description?: string;
  getEncodedParams: () => Hex;
  inputFingerprint: string;
  selectionSignal: {
    label: string;
    value: string;
    helper?: string;
  };
  layout?: "slip-right" | "slip-left";
  variant?: "room" | "immersive" | "prototype";
  children: React.ReactNode;
};

function normalizeBetCount(raw: string, min = 1, max = 100) {
  const parsed = Number(raw || "");
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function getRouletteCoverage(selectionValue: string) {
  const normalized = selectionValue.trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized.startsWith("straight")) return 1;
  if (normalized.startsWith("split")) return 2;
  if (normalized.startsWith("street")) return 3;
  if (normalized.startsWith("corner")) return 4;
  if (normalized.startsWith("six line")) return 6;
  if (normalized.startsWith("column")) return 12;
  if (normalized.includes("12")) return 12;
  if (
    normalized === "red" ||
    normalized === "black" ||
    normalized === "odd" ||
    normalized === "even" ||
    normalized === "1-18" ||
    normalized === "19-36"
  ) {
    return 18;
  }
  return 0;
}

export function GameBetPanel({
  release,
  game,
  description: _description,
  getEncodedParams,
  inputFingerprint,
  selectionSignal,
  layout = "slip-right",
  variant = "room",
  children
}: GameBetPanelProps) {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const relCtx = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { state, planNow, executeNow, reconcileNow, bindNow, reconciling, binding, reset } =
    usePlaceBetStepper();

  const assets = release.assets ?? [];
  const [asset, setAsset] = React.useState<`0x${string}`>(
    () => (assets[0]?.address as `0x${string}`) ?? (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(
    () => assets.find((candidate) => candidate.address.toLowerCase() === asset.toLowerCase()),
    [asset, assets]
  );

  const [stakeSpec, setStakeSpec] = React.useState<StakeSpecFormValue>({
    amountPerRoll: "0.10",
    betCount: "1",
    stopGain: "0",
    stopLoss: "0"
  });
  const [maxHouseEdgeBps, setMaxHouseEdgeBps] = React.useState<number>(2500);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  const account = sdk?.account;
  const betCount = React.useMemo(() => normalizeBetCount(stakeSpec.betCount), [stakeSpec.betCount]);
  const isRouletteRoom = game.slug === "roulette";
  const isPrototypeVariant = variant === "prototype";
  const outcomeStepTitle = isRouletteRoom ? "Choose the table bet" : "Choose the outcome";
  const quickStakePresets =
    isRouletteRoom && isPrototypeVariant
      ? ["Min", "1/2", "2x", "Max"]
      : isRouletteRoom
        ? ["1/2", "2x", "Max"]
        : ["0.10", "0.50", "1.00", "5.00"];

  const inputDigest = React.useMemo(
    () =>
      [
        inputFingerprint,
        asset,
        stakeSpec.amountPerRoll,
        stakeSpec.betCount,
        stakeSpec.stopGain ?? "",
        stakeSpec.stopLoss ?? "",
        maxHouseEdgeBps
      ].join("|"),
    [
      asset,
      inputFingerprint,
      maxHouseEdgeBps,
      stakeSpec.amountPerRoll,
      stakeSpec.betCount,
      stakeSpec.stopGain,
      stakeSpec.stopLoss
    ]
  );

  const lastDigestRef = React.useRef(inputDigest);
  React.useEffect(() => {
    if (lastDigestRef.current === inputDigest) return;
    lastDigestRef.current = inputDigest;
    setFormError(undefined);
    if (state.status !== "idle") reset();
  }, [inputDigest, reset, state.status]);

  const { data: assetFacts, isLoading: assetFactsLoading } = useQuery({
    queryKey: ["ssot", "game-bet-panel", release.releaseDigest, account, asset],
    enabled: Boolean(ready && sdk && account && assetMeta),
    queryFn: async () => {
      if (!sdk || !account || !assetMeta) return null;
      const [walletBalance, allowance] = await Promise.all([
        sdk.bank.getAssetBalance(assetMeta.address as `0x${string}`, account),
        sdk.bank.getAllowance(assetMeta.address as `0x${string}`, account)
      ]);
      return { walletBalance, allowance };
    },
    refetchInterval: 10_000
  });

  const totalStake = React.useMemo(() => {
    if (!assetMeta) return null;
    try {
      const amountPerRoll = parseDecimalToUnits(stakeSpec.amountPerRoll || "0", assetMeta.decimals);
      return amountPerRoll * BigInt(betCount);
    } catch {
      return null;
    }
  }, [assetMeta, betCount, stakeSpec.amountPerRoll]);

  const balanceHint = React.useMemo(() => {
    if (!assetMeta) return "Choose an asset first.";
    if (!account) return `Connect wallet to load ${assetMeta.symbol} balance.`;
    if (assetFactsLoading) return `Loading ${assetMeta.symbol} balance...`;
    if (!assetFacts) return `Wallet balance unavailable for ${assetMeta.symbol}.`;
    return `${formatUnits(assetFacts.walletBalance, assetMeta.decimals)} ${assetMeta.symbol}`;
  }, [account, assetFacts, assetFactsLoading, assetMeta]);

  const allowanceHint = React.useMemo(() => {
    if (!assetMeta || !assetFacts) return "Pending wallet data";
    return `${formatUnits(assetFacts.allowance, assetMeta.decimals)} ${assetMeta.symbol}`;
  }, [assetFacts, assetMeta]);

  const walletBalanceDisplay = React.useMemo(() => {
    if (!assetMeta || !assetFacts) return "—";
    return `${formatUnits(assetFacts.walletBalance, assetMeta.decimals)} ${assetMeta.symbol}`;
  }, [assetFacts, assetMeta]);

  const rouletteCoverage = React.useMemo(
    () => (isRouletteRoom ? getRouletteCoverage(selectionSignal.value) : 0),
    [isRouletteRoom, selectionSignal.value]
  );

  const rouletteWinChanceDisplay = React.useMemo(() => {
    if (!isRouletteRoom || rouletteCoverage <= 0) return "0%";
    return `${((rouletteCoverage / 37) * 100).toFixed(2)}%`;
  }, [isRouletteRoom, rouletteCoverage]);

  const rouletteGrossMultiplier = React.useMemo(() => {
    if (!isRouletteRoom || rouletteCoverage <= 0) return 0;
    return 36 / rouletteCoverage;
  }, [isRouletteRoom, rouletteCoverage]);

  const rouletteTargetPayoutDisplay = React.useMemo(() => {
    if (!isRouletteRoom || !assetMeta || totalStake === null || rouletteGrossMultiplier <= 0) {
      return assetMeta ? `0 ${assetMeta.symbol}` : "0";
    }
    const grossUnits = totalStake * BigInt(rouletteGrossMultiplier);
    return `${formatUnits(grossUnits, assetMeta.decimals)} ${assetMeta.symbol}`;
  }, [assetMeta, isRouletteRoom, rouletteGrossMultiplier, totalStake]);

  const quoteVrfFeeDisplay = React.useMemo(() => {
    if (!state.plan || !assetMeta) return "Review quote";
    return `${formatUnits(state.plan.preview.vrfFee, assetMeta.decimals)} ${assetMeta.symbol}`;
  }, [assetMeta, state.plan]);

  const quoteApprovalDisplay = React.useMemo(() => {
    if (!state.plan) return account ? "Quote pending" : "Connect wallet";
    return state.plan.preview.needsApproval ? "Approval required" : "Ready to place";
  }, [account, state.plan]);

  const setAmountUnits = React.useCallback(
    (nextUnits: bigint) => {
      if (!assetMeta) return;
      const bounded = nextUnits < 0n ? 0n : nextUnits;
      setStakeSpec((current) => ({
        ...current,
        amountPerRoll: formatUnits(bounded, assetMeta.decimals)
      }));
    },
    [assetMeta]
  );

  const applyAmountPreset = React.useCallback((nextAmount: string) => {
    setStakeSpec((current) => ({
      ...current,
      amountPerRoll: nextAmount
    }));
  }, []);

  const handleAmountShortcut = React.useCallback(
    (mode: "half" | "double" | "max") => {
      if (!assetMeta) return;
      if (mode === "max") {
        if (!assetFacts?.walletBalance) return;
        setAmountUnits(assetFacts.walletBalance / BigInt(Math.max(1, betCount)));
        return;
      }

      try {
        const current = parseDecimalToUnits(stakeSpec.amountPerRoll || "0", assetMeta.decimals);
        setAmountUnits(mode === "half" ? current / 2n : current * 2n);
      } catch {
        setAmountUnits(0n);
      }
    },
    [assetFacts, assetMeta, betCount, setAmountUnits, stakeSpec.amountPerRoll]
  );

  const handleQuickChip = React.useCallback(
    (chip: string) => {
      if (chip === "1/2") {
        handleAmountShortcut("half");
        return;
      }
      if (chip === "Min") {
        applyAmountPreset("1.00");
        return;
      }
      if (chip === "2x") {
        handleAmountShortcut("double");
        return;
      }
      if (chip === "Max") {
        handleAmountShortcut("max");
        return;
      }
      applyAmountPreset(chip);
    },
    [applyAmountPreset, handleAmountShortcut]
  );

  const onReset = React.useCallback(() => {
    setFormError(undefined);
    reset();
  }, [reset]);

  const plan = React.useCallback(async () => {
    setFormError(undefined);
    if (relCtx.readOnly) {
      setFormError("Read-only: release snapshot is not usable for writes.");
      return;
    }
    if (!assetMeta) {
      setFormError("Selected asset is not available in this release.");
      return;
    }

    try {
      const normalizedBetCount = normalizeBetCount(stakeSpec.betCount);
      const amountPerRoll = parseDecimalToUnits(stakeSpec.amountPerRoll, assetMeta.decimals);
      const stopGain = parseDecimalToUnits(stakeSpec.stopGain || "0", assetMeta.decimals);
      const stopLoss = parseDecimalToUnits(stakeSpec.stopLoss || "0", assetMeta.decimals);
      const stake = amountPerRoll * BigInt(normalizedBetCount);
      const params = getEncodedParams();
      const stakeSpecBytes = encodeStakeSpec({
        amountPerRoll,
        betCount: normalizedBetCount,
        stopGain,
        stopLoss
      });

      const input: PlaceBetInput = {
        chainId: release.chainId,
        gameId: game.gameId,
        asset: assetMeta.address as any,
        betCount: normalizedBetCount,
        stake,
        params,
        stakeSpec: stakeSpecBytes,
        maxHouseEdgeBps: Math.max(0, Math.min(10_000, Math.floor(maxHouseEdgeBps)))
      };

      await planNow(input);
    } catch (error) {
      setFormError((error as Error)?.message ?? "Invalid input");
    }
  }, [
    assetMeta,
    game.gameId,
    getEncodedParams,
    maxHouseEdgeBps,
    planNow,
    relCtx.readOnly,
    release.chainId,
    stakeSpec
  ]);

  const handlePrimaryAction = React.useCallback(async () => {
    if (!account) {
      openConnectModal?.();
      return;
    }

    if (state.status === "reconciled" && state.betId !== undefined) {
      router.push(`/bets/${state.betId.toString()}`);
      return;
    }

    if (state.plan) {
      await executeNow();
      return;
    }

    await plan();
  }, [account, executeNow, openConnectModal, plan, router, state.betId, state.plan, state.status]);

  const isBusy = state.status === "planning" || state.status === "submitting";
  const primaryLabel = React.useMemo(() => {
    if (!account) return isRouletteRoom ? "Connect" : "Connect wallet";
    if (relCtx.readOnly) return "Read-only release";
    if (state.status === "reconciled" && state.betId !== undefined) return "Open bet";
    if (state.status === "planning") return "Reviewing ticket...";
    if (state.status === "submitting") return "Submitting ticket...";
    if (state.plan)
      return state.plan.preview.needsApproval ? "Approve and place ticket" : "Place ticket";
    return "Review ticket";
  }, [account, isRouletteRoom, relCtx.readOnly, state.betId, state.plan, state.status]);

  const primaryDisabled = React.useMemo(() => {
    if (relCtx.readOnly) return true;
    if (isBusy) return true;
    if (!account) return false;
    return !assetMeta;
  }, [account, assetMeta, isBusy, relCtx.readOnly]);

  const showDetails = state.status !== "idle" || Boolean(state.plan) || Boolean(state.error);
  const prototypeRouletteDeck =
    isPrototypeVariant && layout === "slip-left" && isRouletteRoom ? (
      <div className="flex h-full flex-col gap-6">
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <span className="text-sm font-bold text-white/60">Wallet Balance</span>
          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-sm font-bold text-white">
            {walletBalanceDisplay}
          </span>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-[#050505] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
              Selected Targets
            </span>
            <span className="text-xs font-bold text-white/40">
              {rouletteCoverage > 0 ? `${rouletteCoverage} live` : "Pick the board"}
            </span>
          </div>

          <div className="flex min-h-[3.75rem] flex-wrap gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white">
              {selectionSignal.value}
            </div>
            {selectionSignal.helper ? (
              <div className="w-full text-xs leading-6 text-white/34">{selectionSignal.helper}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-[#050505] p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,1)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">
              Bet Amount (Total)
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
              0.00 {assetMeta?.symbol ?? "USDC"}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-black/30 px-4 py-4">
            <input
              type="text"
              value={stakeSpec.amountPerRoll}
              onChange={(event) =>
                setStakeSpec((current) => ({
                  ...current,
                  amountPerRoll: event.target.value
                }))
              }
              className="w-full bg-transparent text-[2.5rem] font-mono font-black tracking-[-0.06em] text-white outline-none placeholder:text-white/16"
              placeholder="0.00"
            />
            <div className="text-lg font-black uppercase tracking-[0.08em] text-white/72">
              {assetMeta?.symbol ?? "USDC"}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {quickStakePresets.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleQuickChip(chip)}
                className="rounded-[1rem] border border-white/8 bg-white/[0.04] py-3 text-base font-bold text-white/84 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-[#050505] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
              Number of bets
            </span>
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-sm font-bold text-white">
              {betCount}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setStakeSpec((current) => ({
                  ...current,
                  betCount: String(Math.max(1, betCount - 1))
                }))
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition-colors hover:bg-white/[0.08]"
            >
              −
            </button>
            <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-lg font-bold text-white">
              {betCount}
            </div>
            <button
              type="button"
              onClick={() =>
                setStakeSpec((current) => ({
                  ...current,
                  betCount: String(Math.min(100, betCount + 1))
                }))
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition-colors hover:bg-white/[0.08]"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#050505] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
              Net Win Chance
            </div>
            <div className="mt-2 text-2xl font-mono font-black text-white">
              {rouletteWinChanceDisplay}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-[#050505] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
              Max Payout
            </div>
            <div className="mt-2 text-2xl font-mono font-black text-emerald-300">
              {rouletteGrossMultiplier > 0 ? `${rouletteGrossMultiplier.toFixed(2)}x` : "0.00x"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handlePrimaryAction()}
          disabled={primaryDisabled}
          className={cn(
            "mt-auto w-full rounded-[1.4rem] py-5 text-xl font-extrabold text-black transition-all disabled:cursor-not-allowed disabled:text-white/30 disabled:shadow-none",
            isRouletteRoom
              ? "border-b-[4px] border-emerald-300 bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.28)] hover:bg-emerald-400 disabled:border-emerald-900 disabled:bg-emerald-900/40"
              : "border-b-[4px] border-violet-300 bg-violet-500 shadow-[0_0_40px_rgba(168,85,247,0.28)] hover:bg-violet-400 disabled:border-violet-900 disabled:bg-violet-900/40"
          )}
        >
          {primaryLabel}
        </button>

        <div className="rounded-[1.4rem] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/64">
          <div className="flex items-center justify-between gap-3">
            <span>Settlement quote</span>
            <span className="font-mono text-white">{rouletteTargetPayoutDisplay}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>RNG fee</span>
            <span className="font-mono text-white">{quoteVrfFeeDisplay}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>Approval</span>
            <span
              className={cn(
                "font-medium",
                !state.plan
                  ? "text-slate-200"
                  : state.plan.preview.needsApproval
                    ? "text-amber-300"
                    : "text-emerald-300"
              )}
            >
              {quoteApprovalDisplay}
            </span>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {formError ? <ErrorCallout title="Input error" message={formError} /> : null}

      <div
        className={cn(
          isPrototypeVariant
            ? "flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl lg:flex-row"
            : "flex flex-col gap-6 xl:flex-row",
          !isPrototypeVariant && layout === "slip-left" ? "xl:flex-row-reverse" : ""
        )}
      >
        {isPrototypeVariant && layout === "slip-left" ? (
          <div className="w-full flex-shrink-0 bg-gradient-to-b from-white/[0.05] to-transparent p-6 md:p-8 lg:w-[420px] xl:w-[450px]">
            {prototypeRouletteDeck ?? (
              <SharedBetSlip
                showHeader={false}
                topMeta={`${assetMeta?.symbol ?? "USDC"} balance: ${assetFacts ? formatUnits(assetFacts.walletBalance, assetMeta?.decimals ?? 6) : "0"}`}
                amountHeaderValue={`0.00 ${assetMeta?.symbol ?? "USDC"}`}
                inputAccessory={
                  <>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500 text-[13px] font-black text-white">
                      ⛓
                    </span>
                    <span className="text-sm font-semibold text-white/70">⌄</span>
                  </>
                }
                glowColorClass="bg-transparent border-transparent"
                primaryActionClass="bg-violet-600 hover:bg-violet-500"
                amountValue={stakeSpec.amountPerRoll}
                onAmountChange={(val) => setStakeSpec((cur) => ({ ...cur, amountPerRoll: val }))}
                assetSymbol={assetMeta?.symbol ?? "USDC"}
                assetOptions={assets.map((a) => ({ address: a.address, symbol: a.symbol }))}
                selectedAsset={asset}
                onAssetChange={(val) => setAsset(val as `0x${string}`)}
                quickChips={quickStakePresets}
                onQuickChip={handleQuickChip}
                actionLabel={primaryLabel}
                actionDisabled={primaryDisabled}
                onAction={() => void handlePrimaryAction()}
                showModeSwitch={false}
                summaryAfterChildren
                className="rounded-none border-0 bg-transparent p-0 shadow-none"
                summaryContent={
                  <div className="grid gap-4 text-sm text-white/82">
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                        Multiplier
                      </div>
                      <div className="mt-2 font-mono text-2xl font-black text-violet-300">
                        {selectionSignal.value}
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                        Win chance
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {selectionSignal.helper ?? "Room lane"}
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                        Expected payout
                      </div>
                      <div className="mt-2 font-mono text-3xl font-black text-emerald-300">
                        {totalStake === null || !assetMeta
                          ? "—"
                          : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                      </div>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-4">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">Number of bets</span>
                      <span className="inline-flex min-w-[3.4rem] items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm font-bold text-white">
                        {betCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={betCount}
                      onChange={(event) =>
                        setStakeSpec((current) => ({
                          ...current,
                          betCount: String(normalizeBetCount(event.target.value))
                        }))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
                    />
                  </div>
                </div>
              </SharedBetSlip>
            )}
          </div>
        ) : null}

        <section
          className={cn(
            isPrototypeVariant
              ? "relative flex-1 overflow-hidden bg-[#030303] p-4 md:p-8"
              : "flex-1 min-h-[34rem] rounded-[2rem]",
            variant === "room"
              ? isRouletteRoom
                ? "bg-transparent shadow-none border-0"
                : "border shadow-2xl shadow-slate-950/40 border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_26%),linear-gradient(180deg,rgba(21,11,40,0.98),rgba(7,12,24,0.98))]"
              : "bg-transparent"
          )}
        >
          <div
            className={cn(
              "flex h-full flex-col",
              isRouletteRoom ? "min-h-full" : "",
              isPrototypeVariant ? "relative z-10" : ""
            )}
          >
            {variant === "room" && !isRouletteRoom ? (
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live table
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">{outcomeStepTitle}</div>
                </div>
                <div className="max-w-[12rem] text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {selectionSignal.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {selectionSignal.value}
                  </div>
                </div>
              </div>
            ) : null}

            {isPrototypeVariant ? (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-purple-500/10 via-fuchsia-600/5 to-transparent blur-[100px] transition-all duration-1000 group-hover:scale-[1.05]" />
            ) : null}

            <div
              className={cn(
                isRouletteRoom ? "min-h-full" : "min-h-0 flex-1",
                variant === "room" ? (isRouletteRoom ? "p-0" : "p-4 sm:p-5") : "p-0"
              )}
            >
              {children}
            </div>

            {isPrototypeVariant ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_top,black,transparent)]" />
            ) : null}
          </div>
        </section>

        {!isPrototypeVariant ? (
          <div
            className={cn(
              "w-full flex-shrink-0 flex flex-col gap-3",
              isRouletteRoom ? "xl:w-[300px]" : "xl:w-[380px]"
            )}
          >
            <SharedBetSlip
              showHeader={!isRouletteRoom}
              topMeta={
                isRouletteRoom
                  ? `${assetMeta?.symbol ?? "USDC"} balance: ${assetFacts ? formatUnits(assetFacts.walletBalance, assetMeta?.decimals ?? 6) : "0"}`
                  : undefined
              }
              amountHeaderValue={isRouletteRoom ? `0.00 ${assetMeta?.symbol ?? "USDC"}` : undefined}
              inputAccessory={
                isRouletteRoom ? (
                  <>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500 text-[13px] font-black text-white">
                      ⛓
                    </span>
                    <span className="text-sm font-semibold text-white/70">⌄</span>
                  </>
                ) : undefined
              }
              slipLabel="Bet slip"
              slipTitle={isRouletteRoom ? "Roulette ticket" : "Room ticket"}
              slipDescription={
                isRouletteRoom
                  ? "Build the ticket without leaving the table."
                  : "Amount, repeats, and quote stay on one compact rail."
              }
              glowColorClass={
                isRouletteRoom
                  ? "bg-transparent border-transparent"
                  : "bg-violet-500/10 border-violet-500/20"
              }
              primaryActionClass={
                isRouletteRoom
                  ? "bg-[#6978ff] hover:bg-[#7482ff]"
                  : "bg-violet-600 hover:bg-violet-500"
              }
              amountValue={stakeSpec.amountPerRoll}
              onAmountChange={(val) => setStakeSpec((cur) => ({ ...cur, amountPerRoll: val }))}
              assetSymbol={assetMeta?.symbol ?? "USDC"}
              assetOptions={assets.map((a) => ({ address: a.address, symbol: a.symbol }))}
              selectedAsset={asset}
              onAssetChange={(val) => setAsset(val as `0x${string}`)}
              balanceHint={isRouletteRoom ? undefined : balanceHint}
              quickChips={quickStakePresets}
              onQuickChip={handleQuickChip}
              actionLabel={primaryLabel}
              actionDisabled={primaryDisabled}
              onAction={() => void handlePrimaryAction()}
              showModeSwitch={!isRouletteRoom}
              summaryBare={isRouletteRoom}
              summaryAfterChildren={isRouletteRoom}
              footerNote={
                isRouletteRoom ? undefined : "Connected wallet required to place room tickets."
              }
              className={
                isRouletteRoom
                  ? "rounded-[1.8rem] border-white/12 bg-[#0a0b10] p-5 shadow-[0_28px_80px_rgba(2,6,23,0.48)]"
                  : undefined
              }
              summaryContent={
                isRouletteRoom ? (
                  <div className="space-y-2 border-t border-white/10 pt-4 text-sm text-white/78">
                    <div className="flex items-center justify-between gap-3">
                      <span>Win chance:</span>
                      <span className="font-mono">{rouletteWinChanceDisplay}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Target payout:</span>
                      <span className="font-mono">{rouletteTargetPayoutDisplay}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>RNG fee:</span>
                      <span className="font-mono">{quoteVrfFeeDisplay}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Approval:</span>
                      <span
                        className={cn(
                          "font-medium",
                          !state.plan
                            ? "text-slate-200"
                            : state.plan.preview.needsApproval
                              ? "text-amber-300"
                              : "text-emerald-300"
                        )}
                      >
                        {quoteApprovalDisplay}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 px-1 text-sm">
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
                      <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        {selectionSignal.label}
                      </div>
                      <div className="mt-1 text-[15px] font-semibold text-white">
                        {selectionSignal.value}
                      </div>
                      {selectionSignal.helper ? (
                        <div className="mt-1.5 text-xs leading-5 text-white/50">
                          {selectionSignal.helper}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        Wallet
                      </span>
                      <span className="font-mono font-bold text-white text-right max-w-[12rem]">
                        {walletBalanceDisplay}
                      </span>
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        Bets
                      </span>
                      <span className="font-mono font-bold text-white text-right">{betCount}</span>
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        Stake
                      </span>
                      <span className="font-mono font-bold text-white text-right">
                        {totalStake === null || !assetMeta
                          ? "—"
                          : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                      </span>
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        RNG fee
                      </span>
                      <span className="font-mono font-bold text-white text-right">
                        {quoteVrfFeeDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/6 pt-3 text-xs">
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                        Approval
                      </span>
                      <span
                        className={cn(
                          "font-bold",
                          !state.plan
                            ? "text-slate-200"
                            : state.plan.preview.needsApproval
                              ? "text-amber-300"
                              : "text-emerald-300"
                        )}
                      >
                        {quoteApprovalDisplay}
                      </span>
                    </div>
                  </div>
                )
              }
            >
              {isRouletteRoom ? (
                <div className="grid gap-3 border-y border-white/10 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold text-white">Number of bets</span>
                    <span className="inline-flex min-w-[3.4rem] items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm font-bold text-white">
                      {betCount}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={betCount}
                    onChange={(event) =>
                      setStakeSpec((current) => ({
                        ...current,
                        betCount: String(normalizeBetCount(event.target.value))
                      }))
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-[#050505] p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      Number of bets
                    </span>
                    <span className="font-mono text-sm font-bold text-white">{betCount}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={betCount}
                    onChange={(event) =>
                      setStakeSpec((current) => ({
                        ...current,
                        betCount: String(normalizeBetCount(event.target.value))
                      }))
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
                  />
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {[1, 5, 10, 25].map((preset) => (
                      <button
                        key={`round-${preset}`}
                        type="button"
                        onClick={() =>
                          setStakeSpec((current) => ({ ...current, betCount: String(preset) }))
                        }
                        className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${
                          betCount === preset
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isRouletteRoom ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40 px-1 pt-1 font-semibold uppercase tracking-wide">
                    <span>
                      {account ? `Allowance: ${allowanceHint}` : "Review quote before submitting"}
                    </span>
                    {state.plan ? (
                      <button
                        type="button"
                        onClick={() => void plan()}
                        disabled={isBusy}
                        className="font-bold text-white/60 hover:text-white disabled:opacity-50"
                      >
                        Refresh quote
                      </button>
                    ) : null}
                  </div>

                  <details className="rounded-xl border border-white/5 bg-[#050505] p-3 -mt-2">
                    <summary className="cursor-pointer list-none text-xs font-bold text-white/60 hover:text-white">
                      Advanced limits
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-2">
                        <Label
                          htmlFor="bet.stopGain"
                          className="text-xs font-bold uppercase tracking-wider text-white/40"
                        >
                          Stop gain
                        </Label>
                        <Input
                          id="bet.stopGain"
                          inputMode="decimal"
                          value={stakeSpec.stopGain ?? ""}
                          onChange={(event) =>
                            setStakeSpec((current) => ({
                              ...current,
                              stopGain: event.target.value
                            }))
                          }
                          className="border-white/10 bg-transparent text-white focus:border-white/30"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label
                          htmlFor="bet.stopLoss"
                          className="text-xs font-bold uppercase tracking-wider text-white/40"
                        >
                          Stop loss
                        </Label>
                        <Input
                          id="bet.stopLoss"
                          inputMode="decimal"
                          value={stakeSpec.stopLoss ?? ""}
                          onChange={(event) =>
                            setStakeSpec((current) => ({
                              ...current,
                              stopLoss: event.target.value
                            }))
                          }
                          className="border-white/10 bg-transparent text-white focus:border-white/30"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label
                          htmlFor="bet.maxHouseEdge"
                          className="text-xs font-bold uppercase tracking-wider text-white/40"
                        >
                          Max house edge (bps)
                        </Label>
                        <Input
                          id="bet.maxHouseEdge"
                          inputMode="numeric"
                          value={String(maxHouseEdgeBps)}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (!Number.isFinite(next)) return;
                            setMaxHouseEdgeBps(Math.max(0, Math.min(10_000, Math.floor(next))));
                          }}
                          className="border-white/10 bg-transparent text-white focus:border-white/30"
                        />
                      </div>
                    </div>
                  </details>
                </>
              ) : null}
            </SharedBetSlip>
          </div>
        ) : null}
      </div>

      {showDetails ? (
        <details
          className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 shadow-xl shadow-slate-950/30"
          open={showDetails}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            Quote and transaction trace
          </summary>
          <div className="mt-4">
            <BetPanelShell
              state={state}
              onReconcile={() => void reconcileNow()}
              onBind={(betId) => void bindNow(betId)}
              reconciling={reconciling}
              binding={binding}
              onReset={onReset}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
