"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { Hex, PlaceBetInput } from "@ssot/ssot/sdk";
import { encodeStakeSpec } from "@ssot/ssot/encoding";
import { Button, ErrorCallout, Input, Label } from "@ssot/ui";

import type { SSOTRelease } from "@ssot/ssot/release";

import { useConnectModal } from "../../../app/providers/WalletButton";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { usePlaceBetStepper } from "../usePlaceBetStepper";
import { formatUnits, parseDecimalToUnits } from "../model/units";

import { BetPanelShell } from "./BetPanelShell";
import { ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";

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
  const ticketStepTitle = "Build the slip";
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

      <div className={`grid gap-6 ${isRouletteRoom ? "xl:grid-cols-[340px_minmax(0,1fr)]" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
        <section
          className={`order-1 min-h-[34rem] rounded-[2rem] border p-4 shadow-2xl shadow-slate-950/40 sm:p-5 xl:order-2 ${
            isRouletteRoom
              ? "overflow-hidden border-fuchsia-400/15 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.12),transparent_26%),linear-gradient(180deg,rgba(21,11,40,0.98),rgba(7,12,24,0.98))] p-0"
              : "border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_26%),linear-gradient(180deg,rgba(21,11,40,0.98),rgba(7,12,24,0.98))]"
          }`}
        >
          {isRouletteRoom ? (
            <div className="min-h-full p-4 sm:p-5">{children}</div>
          ) : (
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/40 px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{game.label} table</div>
                  <div className="mt-1 text-base font-semibold text-white">{outcomeStepTitle}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{selectionSignal.label}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{selectionSignal.value}</div>
                </div>
              </div>

              {selectionSignal.helper ? (
                <div className="rounded-[1.5rem] border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm leading-6 text-slate-400">
                  {selectionSignal.helper}
                </div>
              ) : null}

              <div className="min-h-0 flex-1">{children}</div>
            </div>
          )}
        </section>

        <aside
          className={`order-2 overflow-hidden rounded-[2rem] border shadow-2xl shadow-slate-950/40 xl:order-1 ${
            isRouletteRoom
              ? "border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(26,13,46,0.98),rgba(11,18,34,0.98))]"
              : "border-violet-400/15 bg-[linear-gradient(180deg,rgba(30,14,49,0.98),rgba(11,18,34,0.98))]"
          }`}
        >
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-4 rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3">
              <div className="flex items-center gap-3">
                <ArbiGameFiMark accent={isRouletteRoom ? "cyan" : "emerald"} className="h-11 w-11 rounded-[1rem]" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ticket rail
                  </div>
                  <div className="text-sm font-semibold text-white">{game.label} room slip</div>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Wallet-native
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-white/10 bg-slate-950/45 p-1.5">
              <button
                type="button"
                className="rounded-[1rem] bg-white/10 px-3 py-3 text-sm font-semibold text-white"
              >
                Manual
              </button>
              <button
                type="button"
                disabled
                className="rounded-[1rem] px-3 py-3 text-sm font-semibold text-slate-500"
              >
                Auto
              </button>
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {game.label} slip
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {isRouletteRoom ? "Build the ticket" : ticketStepTitle}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {assetMeta?.symbol ?? "Asset"} wallet
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {account ? walletBalanceDisplay : "Connect wallet"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/35 p-4">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {isRouletteRoom ? "Stake amount" : "Bet amount"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {isRouletteRoom ? "Chip in or type the stake" : "Pick a chip or type the amount"}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">{balanceHint}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bet.amount" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Amount
                </Label>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <Input
                    id="bet.amount"
                    inputMode="decimal"
                    value={stakeSpec.amountPerRoll}
                    onChange={(event) => setStakeSpec((current) => ({ ...current, amountPerRoll: event.target.value }))}
                    className="h-16 rounded-2xl border-slate-700 bg-slate-950/70 text-3xl font-black tracking-tight text-white"
                    placeholder="0.00"
                  />
                  <select
                    value={asset}
                    onChange={(event) => setAsset(event.target.value as `0x${string}`)}
                    className="h-16 rounded-2xl border border-slate-700 bg-slate-950/70 px-3 text-base font-semibold text-white outline-none"
                  >
                    {assets.map((candidate) => (
                      <option key={candidate.address} value={candidate.address}>
                        {candidate.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isRouletteRoom ? (
                <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Quick chips
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-4 gap-2">
                {quickStakePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyAmountPreset(preset)}
                    className={`rounded-full border px-3 py-3 text-sm font-semibold transition-colors ${
                      isRouletteRoom
                        ? "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100 hover:border-fuchsia-200/40 hover:bg-fuchsia-500/20"
                        : "border-violet-300/20 bg-violet-500/10 text-violet-100 hover:border-violet-200/40 hover:bg-violet-500/20"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleAmountShortcut("half")}
                  className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-500"
                >
                  1/2
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountShortcut("double")}
                  className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-500"
                >
                  2x
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountShortcut("max")}
                  disabled={!assetFacts || assetFacts.walletBalance === 0n}
                  className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-500 disabled:opacity-50"
                >
                  Max
                </button>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-5 text-slate-400">
                Chips are shortcuts only. The live quote is still generated from the exact amount, rounds, and table call below.
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/35 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {isRouletteRoom ? "Number of rounds" : "Number of bets"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {isRouletteRoom ? "Choose how many spins to cover" : "Choose how many rounds to cover"}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-lg font-bold text-white">{betCount}</div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={betCount}
                  onChange={(event) =>
                    setStakeSpec((current) => ({
                      ...current,
                      betCount: String(normalizeBetCount(event.target.value)),
                    }))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-violet-400"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[1, 5, 10, 25].map((preset) => (
                  <button
                    key={`round-${preset}`}
                    type="button"
                    onClick={() =>
                      setStakeSpec((current) => ({
                        ...current,
                        betCount: String(preset),
                      }))
                    }
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      betCount === preset
                        ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/35 p-4">
              <div className="mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket summary</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {isRouletteRoom ? "Review the roulette ticket" : "Review the ticket"}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">{selectionSignal.label}</span>
                  <span className="max-w-[10rem] text-right font-semibold text-white">{selectionSignal.value}</span>
                </div>
                {isRouletteRoom && selectionSignal.helper ? (
                  <div className="rounded-2xl border border-fuchsia-400/10 bg-fuchsia-500/5 px-3 py-3 text-xs leading-5 text-slate-300">
                    {selectionSignal.helper}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">Total stake</span>
                  <span className="text-right font-semibold text-white">
                    {totalStake === null || !assetMeta
                      ? "—"
                      : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">Rounds</span>
                  <span className="text-right font-semibold text-white">{betCount}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">Wallet balance</span>
                  <span className="text-right text-white">{walletBalanceDisplay}</span>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-3 text-xs leading-5 text-slate-400">
                  Review builds the live quote first. Approval checks, allowance, and RNG fee stay in the transaction trace until you are ready to sign.
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => void handlePrimaryAction()}
              disabled={primaryDisabled}
              className="w-full rounded-[1.6rem] bg-[linear-gradient(90deg,rgba(168,85,247,1),rgba(236,72,153,0.96))] text-lg normal-case text-white hover:brightness-110"
            >
              {primaryLabel}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {account
                  ? `Ready on chain ${release.chainId}. Allowance now ${allowanceHint}.`
                  : "Connect first, then review the live quote before submitting."}
              </span>
              {state.plan ? (
                <button
                  type="button"
                  onClick={() => void plan()}
                  disabled={isBusy}
                  className="font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-50"
                >
                  Refresh quote
                </button>
              ) : null}
            </div>

            <details className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white">Advanced limits</summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="bet.stopGain" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Stop gain
                  </Label>
                  <Input
                    id="bet.stopGain"
                    inputMode="decimal"
                    value={stakeSpec.stopGain ?? ""}
                    onChange={(event) => setStakeSpec((current) => ({ ...current, stopGain: event.target.value }))}
                    className="border-slate-700 bg-slate-950/70"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bet.stopLoss" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Stop loss
                  </Label>
                  <Input
                    id="bet.stopLoss"
                    inputMode="decimal"
                    value={stakeSpec.stopLoss ?? ""}
                    onChange={(event) => setStakeSpec((current) => ({ ...current, stopLoss: event.target.value }))}
                    className="border-slate-700 bg-slate-950/70"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bet.maxHouseEdge" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                    className="border-slate-700 bg-slate-950/70"
                  />
                </div>
              </div>
            </details>
          </div>
        </aside>
      </div>

      {showDetails ? (
        <details
          className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 shadow-xl shadow-slate-950/30"
          open={showDetails}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">Review and transaction trace</summary>
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
