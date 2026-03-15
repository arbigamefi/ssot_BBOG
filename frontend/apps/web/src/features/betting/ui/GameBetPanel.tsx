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
  variant?: "room" | "immersive";
  children: React.ReactNode;
};

function normalizeBetCount(raw: string, min = 1, max = 100) {
  const parsed = Number(raw || "");
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
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
  children,
}: GameBetPanelProps) {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const relCtx = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const { state, planNow, executeNow, reconcileNow, bindNow, reconciling, binding, reset } = usePlaceBetStepper();

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
    stopLoss: "0",
  });
  const [maxHouseEdgeBps, setMaxHouseEdgeBps] = React.useState<number>(2500);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  const account = sdk?.account;
  const betCount = React.useMemo(() => normalizeBetCount(stakeSpec.betCount), [stakeSpec.betCount]);
  const isRouletteRoom = game.slug === "roulette";
  const outcomeStepTitle = isRouletteRoom ? "Choose the table bet" : "Choose the outcome";
  const quickStakePresets = ["0.10", "0.50", "1.00", "5.00"];

  const inputDigest = React.useMemo(
    () =>
      [
        inputFingerprint,
        asset,
        stakeSpec.amountPerRoll,
        stakeSpec.betCount,
        stakeSpec.stopGain ?? "",
        stakeSpec.stopLoss ?? "",
        maxHouseEdgeBps,
      ].join("|"),
    [asset, inputFingerprint, maxHouseEdgeBps, stakeSpec.amountPerRoll, stakeSpec.betCount, stakeSpec.stopGain, stakeSpec.stopLoss]
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
        sdk.bank.getAllowance(assetMeta.address as `0x${string}`, account),
      ]);
      return { walletBalance, allowance };
    },
    refetchInterval: 10_000,
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

  const setAmountUnits = React.useCallback(
    (nextUnits: bigint) => {
      if (!assetMeta) return;
      const bounded = nextUnits < 0n ? 0n : nextUnits;
      setStakeSpec((current) => ({
        ...current,
        amountPerRoll: formatUnits(bounded, assetMeta.decimals),
      }));
    },
    [assetMeta]
  );

  const applyAmountPreset = React.useCallback((nextAmount: string) => {
    setStakeSpec((current) => ({
      ...current,
      amountPerRoll: nextAmount,
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
        stopLoss,
      });

      const input: PlaceBetInput = {
        chainId: release.chainId,
        gameId: game.gameId,
        asset: assetMeta.address as any,
        betCount: normalizedBetCount,
        stake,
        params,
        stakeSpec: stakeSpecBytes,
        maxHouseEdgeBps: Math.max(0, Math.min(10_000, Math.floor(maxHouseEdgeBps))),
      };

      await planNow(input);
    } catch (error) {
      setFormError((error as Error)?.message ?? "Invalid input");
    }
  }, [assetMeta, game.gameId, getEncodedParams, maxHouseEdgeBps, planNow, relCtx.readOnly, release.chainId, stakeSpec]);

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
    if (!account) return "Connect wallet";
    if (relCtx.readOnly) return "Read-only release";
    if (state.status === "reconciled" && state.betId !== undefined) return "Open bet";
    if (state.status === "planning") return "Reviewing ticket...";
    if (state.status === "submitting") return "Submitting ticket...";
    if (state.plan) return state.plan.preview.needsApproval ? "Approve and place ticket" : "Place ticket";
    return "Review ticket";
  }, [account, relCtx.readOnly, state.betId, state.plan, state.status]);

  const primaryDisabled = React.useMemo(() => {
    if (relCtx.readOnly) return true;
    if (isBusy) return true;
    if (!account) return false;
    return !assetMeta;
  }, [account, assetMeta, isBusy, relCtx.readOnly]);

  const showDetails = state.status !== "idle" || Boolean(state.plan) || Boolean(state.error);

  return (
    <div className="space-y-6">
      {formError ? <ErrorCallout title="Input error" message={formError} /> : null}

      <div className={`flex flex-col xl:flex-row gap-6 ${layout === "slip-left" ? "xl:flex-row-reverse" : ""}`}>
        <section
          className={cn(
            "flex-1 min-h-[34rem] rounded-[2rem]",
            variant === "room" ? (
              isRouletteRoom
                ? "border shadow-2xl shadow-slate-950/40 border-fuchsia-400/15 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.12),transparent_26%),linear-gradient(180deg,rgba(21,11,40,0.98),rgba(7,12,24,0.98))]"
                : "border shadow-2xl shadow-slate-950/40 border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_26%),linear-gradient(180deg,rgba(21,11,40,0.98),rgba(7,12,24,0.98))]"
            ) : "bg-transparent"
          )}
        >
          <div className={`flex h-full flex-col ${isRouletteRoom ? "min-h-full" : ""}`}>
            {variant === "room" && !isRouletteRoom ? (
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live table
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">{outcomeStepTitle}</div>
                </div>
                <div className="max-w-[12rem] text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{selectionSignal.label}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{selectionSignal.value}</div>
                </div>
              </div>
            ) : null}

            <div className={cn(
              isRouletteRoom ? "min-h-full" : "min-h-0 flex-1",
              variant === "room" ? "p-4 sm:p-5" : "p-0"
            )}>
              {children}
            </div>
          </div>
        </section>

        <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
          <SharedBetSlip
            glowColorClass={isRouletteRoom ? "bg-fuchsia-500/10 border-fuchsia-500/20" : "bg-violet-500/10 border-violet-500/20"}
            primaryActionClass={isRouletteRoom ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-violet-600 hover:bg-violet-500"}
            amountValue={stakeSpec.amountPerRoll}
            onAmountChange={(val) => setStakeSpec((cur) => ({ ...cur, amountPerRoll: val }))}
            assetSymbol={assetMeta?.symbol ?? "USDC"}
            assetOptions={assets.map((a) => ({ address: a.address, symbol: a.symbol }))}
            selectedAsset={asset}
            onAssetChange={(val) => setAsset(val as `0x${string}`)}
            balanceHint={balanceHint}
            quickChips={quickStakePresets}
            onQuickChip={applyAmountPreset}
            actionLabel={primaryLabel}
            actionDisabled={primaryDisabled}
            onAction={() => void handlePrimaryAction()}
            summaryContent={
              <div className="flex flex-col gap-3 px-1 text-sm">
                <div className="flex justify-between items-start text-xs">
                  <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">{selectionSignal.label}</span>
                  <span className="font-bold text-white text-right max-w-[12rem]">{selectionSignal.value}</span>
                </div>
                {selectionSignal.helper && (
                  <div className="text-xs text-white/50">{selectionSignal.helper}</div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-xs">
                  <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Total Stake</span>
                  <span className="font-mono font-bold text-white">
                    {totalStake === null || !assetMeta ? "—" : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                  </span>
                </div>
              </div>
            }
          >
            {/* Number of Rounds Configuration */}
            <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-[#050505]">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{isRouletteRoom ? "Number of spins" : "Number of bets"}</span>
                  <span className="font-mono text-sm font-bold text-white">{betCount}</span>
               </div>
               <input
                  type="range"
                  min="1" max="100" step="1"
                  value={betCount}
                  onChange={(event) =>
                    setStakeSpec((current) => ({
                      ...current,
                      betCount: String(normalizeBetCount(event.target.value)),
                    }))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
               />
               <div className="grid grid-cols-4 gap-2 mt-2">
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

            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40 px-1 pt-1 font-semibold uppercase tracking-wide">
              <span>
                {account
                  ? `Allowance: ${allowanceHint}`
                  : "Review quote before submitting"}
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

            {/* Advanced details mapped from details...summary */}
            <details className="rounded-xl border border-white/5 bg-[#050505] p-3 -mt-2">
              <summary className="cursor-pointer list-none text-xs font-bold text-white/60 hover:text-white">Advanced limits</summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="bet.stopGain" className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Stop gain
                  </Label>
                  <Input
                    id="bet.stopGain"
                    inputMode="decimal"
                    value={stakeSpec.stopGain ?? ""}
                    onChange={(event) => setStakeSpec((current) => ({ ...current, stopGain: event.target.value }))}
                    className="border-white/10 bg-transparent text-white focus:border-white/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bet.stopLoss" className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Stop loss
                  </Label>
                  <Input
                    id="bet.stopLoss"
                    inputMode="decimal"
                    value={stakeSpec.stopLoss ?? ""}
                    onChange={(event) => setStakeSpec((current) => ({ ...current, stopLoss: event.target.value }))}
                    className="border-white/10 bg-transparent text-white focus:border-white/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bet.maxHouseEdge" className="text-xs font-bold uppercase tracking-wider text-white/40">
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
          </SharedBetSlip>
        </div>
      </div>

      {showDetails ? (
        <details
          className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 shadow-xl shadow-slate-950/30"
          open={showDetails}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">Quote and transaction trace</summary>
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
