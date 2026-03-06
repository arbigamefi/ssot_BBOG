"use client";

import * as React from "react";

import type { Hex, PlaceBetInput } from "@ssot/ssot/sdk";
import { encodeStakeSpec } from "@ssot/ssot/encoding";
import {
  AssetSelector,
  type AssetOption,
  Card,
  CardContent,
  ErrorCallout,
  Input,
  Label,
  StakeSpecForm,
  type StakeSpecFormValue,
} from "@ssot/ui";

import type { SSOTRelease } from "@ssot/ssot/release";

import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { usePlaceBetStepper } from "../usePlaceBetStepper";
import { formatUnits, parseDecimalToUnits } from "../model/units";

import { BetPanelShell } from "./BetPanelShell";

type GameMeta = {
  gameId: Hex;
  slug: string;
  label: string;
};

export type GameBetPanelProps = {
  release: SSOTRelease;
  game: GameMeta;
  description?: string;
  /** Returns encoded bytes params for the game module (may throw). */
  getEncodedParams: () => Hex;
  children: React.ReactNode;
};

export function GameBetPanel({ release, game, description, getEncodedParams, children }: GameBetPanelProps) {
  const relCtx = useRelease();
  const { state, planNow, executeNow, reconcileNow, bindNow, reconciling, binding, reset } = usePlaceBetStepper();

  const assetOptions: AssetOption[] = React.useMemo(
    () =>
      (release.assets ?? []).map((a) => ({
        address: a.address as `0x${string}`,
        symbol: a.symbol,
        decimals: a.decimals,
        label: `${a.symbol} (${a.decimals})`,
      })),
    [release.assets]
  );

  const [asset, setAsset] = React.useState<`0x${string}`>(
    () => (release.assets[0]?.address as `0x${string}`) ?? (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(() => release.assets.find((a) => a.address.toLowerCase() === asset.toLowerCase()), [release.assets, asset]);

  const [stakeSpec, setStakeSpec] = React.useState<StakeSpecFormValue>({
    amountPerRoll: "0.10",
    betCount: "1",
    stopGain: "0",
    stopLoss: "0",
  });

  const [maxHouseEdgeBps, setMaxHouseEdgeBps] = React.useState<number>(2500);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

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
      const betCount = Math.max(1, Math.min(100, Math.floor(Number(stakeSpec.betCount || ""))));
      if (!Number.isFinite(betCount) || betCount <= 0) throw new Error("betCount must be a positive integer");

      const amountPerRoll = parseDecimalToUnits(stakeSpec.amountPerRoll, assetMeta.decimals);
      const stopGain = parseDecimalToUnits(stakeSpec.stopGain || "0", assetMeta.decimals);
      const stopLoss = parseDecimalToUnits(stakeSpec.stopLoss || "0", assetMeta.decimals);
      const stake = amountPerRoll * BigInt(betCount);

      const params = getEncodedParams();
      const stakeSpecBytes = encodeStakeSpec({ amountPerRoll, betCount, stopGain, stopLoss });

      const input: PlaceBetInput = {
        chainId: release.chainId,
        gameId: game.gameId,
        asset: assetMeta.address as any,
        betCount,
        stake,
        params,
        stakeSpec: stakeSpecBytes,
        maxHouseEdgeBps: Math.max(0, Math.min(10_000, Math.floor(maxHouseEdgeBps))),
      };

      await planNow(input);
    } catch (e) {
      setFormError((e as Error)?.message ?? "Invalid input");
    }
  }, [assetMeta, game.gameId, getEncodedParams, maxHouseEdgeBps, planNow, relCtx.readOnly, release.chainId, stakeSpec]);

  const title = game.label;

  const totalStake = React.useMemo(() => {
    if (!assetMeta) return null;
    try {
      const betCount = Math.max(1, Math.min(100, Math.floor(Number(stakeSpec.betCount || ""))));
      if (!Number.isFinite(betCount) || betCount <= 0) return null;
      const amountPerRoll = parseDecimalToUnits(stakeSpec.amountPerRoll, assetMeta.decimals);
      return amountPerRoll * BigInt(betCount);
    } catch {
      return null;
    }
  }, [assetMeta, stakeSpec.amountPerRoll, stakeSpec.betCount]);

  return (
    <div className="space-y-4">
      {formError ? <ErrorCallout title="Input error" message={formError} /> : null}

      <BetPanelShell title={title} description={description} state={state} onPlan={plan} onExecute={() => void executeNow()} onReconcile={() => void reconcileNow()} onBind={(betId) => void bindNow(betId)} reconciling={reconciling} binding={binding} onReset={onReset}>
        <div className="grid gap-4 md:grid-cols-2">
          <AssetSelector
            assets={assetOptions}
            value={asset}
            onValueChange={(v) => setAsset(v)}
            showAddress={false}
            error={!assetMeta ? "Selected asset not found in release" : undefined}
          />
          <div className="space-y-2">
            <Label htmlFor="max-he">Max house edge (bps)</Label>
            <Input
              id="max-he"
              inputMode="numeric"
              value={String(maxHouseEdgeBps)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setMaxHouseEdgeBps(Math.max(0, Math.min(10_000, Math.floor(n))));
              }}
            />
            <div className="text-xs text-muted-foreground">Used as a user tolerance bound (BPS). 10000 = 100%.</div>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="text-sm font-medium">Game parameters</div>
                {children}
              </div>
              <div className="space-y-4">
                <div className="text-sm font-medium">Stake</div>
                <StakeSpecForm
                  value={stakeSpec}
                  onChange={setStakeSpec}
                  unitHint={assetMeta ? `${assetMeta.symbol} (${assetMeta.decimals})` : undefined}
                  betCountMin={1}
                  betCountMax={100}
                  defaultShowAdvanced={false}
                />

                <div className="rounded-xl border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Total stake</span>
                    <span className="font-mono">
                      {totalStake === null || !assetMeta ? "—" : `${formatUnits(totalStake, assetMeta.decimals)} ${assetMeta.symbol}`}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Total stake is computed locally from amountPerRoll × betCount.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </BetPanelShell>
    </div>
  );
}
