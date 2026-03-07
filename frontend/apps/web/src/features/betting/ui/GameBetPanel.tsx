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
    if (!account) return "Connect wallet to play";
    if (relCtx.readOnly) return "Read-only release";
    if (state.status === "reconciled" && state.betId !== undefined) return "Open bet";
    if (state.status === "planning") return "Reviewing bet...";
    if (state.status === "submitting") return "Submitting bet...";
    if (state.plan) return state.plan.preview.needsApproval ? "Approve and place bet" : "Place bet";
    return "Review bet";
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-[34rem] rounded-[2rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(10,15,28,0.98),rgba(7,12,24,0.98))] p-4 shadow-2xl shadow-slate-950/40 sm:p-5">
          <div className="h-full">{children}</div>
        </section>

        <aside className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-2xl shadow-slate-950/40">
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bet slip</div>
                <div className="mt-1 text-base font-semibold text-white">{game.label}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {assetMeta?.symbol ?? "Asset"} balance
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {account ? walletBalanceDisplay : "Connect wallet"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="bet.amount" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Bet amount
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

            <div className="grid grid-cols-3 gap-2">
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

            <div className="border-t border-slate-800 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Number of bets</div>
                  <div className="mt-1 text-xs text-slate-500">Adjust how many rounds this ticket should cover.</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-lg font-bold text-white">
                  {betCount}
                </div>
              </div>

              <div className="mt-4 space-y-2">
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
            </div>

            <div className="border-t border-slate-800 pt-5">
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">{selectionSignal.label}</span>
                  <span className="max-w-[10rem] text-right font-semibold text-white">{selectionSignal.value}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">Total stake</span>
                  <span className="text-right font-semibold text-white">
                    {totalStake === null || !assetMeta
                      ? "—"
                      : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">Allowance</span>
                  <span className="text-right text-white">{allowanceHint}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400">RNG fee</span>
                  <span className="text-right text-white">
                    {state.plan ? state.plan.preview.vrfFee.toString() : "Generated after review"}
                  </span>
                </div>
                {selectionSignal.helper ? <div className="pt-1 text-xs leading-5 text-slate-500">{selectionSignal.helper}</div> : null}
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => void handlePrimaryAction()}
              disabled={primaryDisabled}
              className="w-full rounded-[1.6rem] bg-violet-500 text-lg normal-case text-white hover:bg-violet-400"
            >
              {primaryLabel}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>{account ? `Ready on chain ${release.chainId}` : "Wallet connection required for planning and submission."}</span>
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

      {!account ? (
        <button
          type="button"
          onClick={() => openConnectModal?.()}
          className="w-full rounded-[1.75rem] border border-violet-400/20 bg-violet-500/15 px-6 py-5 text-center text-xl font-black tracking-tight text-white shadow-[0_24px_70px_rgba(76,29,149,0.24)] transition-colors hover:bg-violet-500/20"
        >
          Connect wallet to play.
        </button>
      ) : null}

      {showDetails ? (
        <details
          className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 shadow-xl shadow-slate-950/30"
          open={showDetails}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            Quote and transaction details
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
