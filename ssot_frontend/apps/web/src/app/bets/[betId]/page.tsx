"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { DomainBet } from "@ssot/ssot";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  ErrorCallout,
  TxStepper,
  type StepState,
  type TxStepItem,
  toast,
} from "@ssot/ui";
import { useQuery } from "@tanstack/react-query";

import { useSSOTRuntime } from "../../../ssot/runtime";
import { useSSOTSDK } from "../../../ssot/sdk";
import { useRelease } from "../../../ssot/release/ReleaseProvider";

// ——— helpers ———
function Metric({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-mono text-sm">
        {value}
        {copyable && value !== "—" && <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />}
      </span>
    </div>
  );
}

function stateToStep(state: string, target: string): StepState {
  const ORDER = ["placed", "randomReady", "finalized"];
  const ci = ORDER.indexOf(state);
  const ti = ORDER.indexOf(target);
  if (state === "refunded") return target === "placed" ? "done" : "error";
  if (ci > ti) return "done";
  if (ci === ti) return "active";
  return "todo";
}

function buildLifecycleSteps(state: string): TxStepItem[] {
  if (state === "refunded") {
    return [
      { title: "Placed", state: "done" },
      { title: "Refunded", description: "Bet was refunded", state: "done" },
    ];
  }
  return [
    { title: "Placed", state: stateToStep(state, "placed") },
    { title: "Random Ready", description: "VRF delivered random word", state: stateToStep(state, "randomReady") },
    { title: "Finalized", description: "Bet settled with payout", state: stateToStep(state, "finalized") },
  ];
}

export default function BetDetailPage() {
  const params = useParams<{ betId: string }>();
  const betId = params?.betId;
  const { db } = useSSOTRuntime();
  const { sdk } = useSSOTSDK();
  const { chainId, readOnly, release } = useRelease();

  // Local (indexed) bet row
  const { data: localBet, isLoading: localLoading } = useQuery({
    queryKey: ["ssot", "bet", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async () => {
      if (!db || !betId) return null;
      return await db.bets.get(`${chainId}:${betId}`);
    },
    refetchInterval: 2000,
  });

  // On-chain bet (from SDK getBet)
  const { data: onChainBet, isLoading: onChainLoading, refetch: refetchOnChain } = useQuery({
    queryKey: ["ssot", "getBet", chainId, betId],
    enabled: Boolean(sdk && betId),
    queryFn: async (): Promise<DomainBet | null> => {
      if (!sdk || !betId) return null;
      try {
        return await sdk.hub.getBet(BigInt(betId));
      } catch {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  // Action state
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | undefined>();

  // Use on-chain state if available, fall back to local indexed state
  const betState = onChainBet?.state ?? localBet?.state ?? null;
  const isLoading = localLoading || onChainLoading;

  const canRefund = betState === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = betState === "randomReady" && !readOnly && Boolean(sdk?.account);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || !betId) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const res = await sdk.hub.refund(BigInt(betId));
      if (!res.ok) {
        setActionError(res.error?.message ?? "Refund failed");
        return;
      }
      toast.success("Bet refunded successfully");
      void refetchOnChain();
    } catch (e) {
      setActionError((e as Error)?.message ?? "Refund transaction failed");
    } finally {
      setBusy(false);
    }
  }, [sdk, betId, refetchOnChain]);

  const handleFinalize = React.useCallback(async () => {
    if (!sdk || !betId) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const res = await sdk.hub.finalize(BigInt(betId));
      if (!res.ok) {
        setActionError(res.error?.message ?? "Finalize failed");
        return;
      }
      toast.success("Bet finalized successfully");
      void refetchOnChain();
    } catch (e) {
      setActionError((e as Error)?.message ?? "Finalize transaction failed");
    } finally {
      setBusy(false);
    }
  }, [sdk, betId, refetchOnChain]);

  // Asset symbol lookup
  const assetAddr = onChainBet?.asset ?? localBet?.asset;
  const assetMeta = React.useMemo(
    () => release?.assets.find((a) => a.address.toLowerCase() === assetAddr?.toLowerCase()),
    [release?.assets, assetAddr]
  );
  const sym = assetMeta?.symbol ?? "";
  const decimals = assetMeta?.decimals ?? 18;

  function fmtBigint(v: bigint | undefined): string {
    if (v == null) return "—";
    const units = Number(v) / 10 ** decimals;
    return `${units.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sym}`;
  }

  // ——— Outcome calculation ———
  type Outcome = { kind: "win"; profit: bigint } | { kind: "loss"; loss: bigint } | { kind: "refunded" } | { kind: "pending"; label: string };

  const outcome = React.useMemo((): Outcome | null => {
    if (!onChainBet) return betState ? { kind: "pending", label: betState } : null;
    if (betState === "refunded") return { kind: "refunded" };
    if (betState === "finalized" && onChainBet.payout != null) {
      const profit = onChainBet.payout - onChainBet.stake;
      return profit >= 0n ? { kind: "win", profit } : { kind: "loss", loss: onChainBet.stake - onChainBet.payout };
    }
    return { kind: "pending", label: betState ?? "unknown" };
  }, [onChainBet, betState]);

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/bets" className="hover:underline">
          ← Back to bets
        </Link>
      </div>

      {/* Lifecycle stepper */}
      {betState && (
        <TxStepper
          title={`Bet #${betId}`}
          subtitle={`Current state: ${betState}`}
          steps={buildLifecycleSteps(betState)}
        />
      )}

      {/* Outcome summary */}
      {outcome && (
        <Card data-testid="outcome-card">
          <CardContent className="flex flex-col items-center gap-2 py-6">
            {outcome.kind === "win" && (
              <>
                <Badge className="bg-green-600 text-white hover:bg-green-700" data-testid="outcome-badge">
                  WIN
                </Badge>
                <p className="text-2xl font-bold text-green-600" data-testid="outcome-amount">
                  +{fmtBigint(outcome.profit)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Payout: {fmtBigint(onChainBet?.payout)} | Stake: {fmtBigint(onChainBet?.stake)}
                </p>
              </>
            )}
            {outcome.kind === "loss" && (
              <>
                <Badge variant="destructive" data-testid="outcome-badge">
                  LOSS
                </Badge>
                <p className="text-2xl font-bold text-destructive" data-testid="outcome-amount">
                  -{fmtBigint(outcome.loss)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Payout: {fmtBigint(onChainBet?.payout)} | Stake: {fmtBigint(onChainBet?.stake)}
                </p>
              </>
            )}
            {outcome.kind === "refunded" && (
              <>
                <Badge variant="secondary" data-testid="outcome-badge">
                  REFUNDED
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Stake was returned to player.
                </p>
              </>
            )}
            {outcome.kind === "pending" && (
              <>
                <Badge variant="outline" data-testid="outcome-badge">
                  PENDING
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Awaiting {outcome.label === "placed" ? "VRF random word" : outcome.label === "randomReady" ? "finalization" : outcome.label}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* On-chain bet details */}
      <Card>
        <CardHeader>
          <CardTitle>Bet Details</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading..."
              : onChainBet
                ? "Live on-chain data from Hub.getBet()"
                : localBet
                  ? "From local facts store (indexed events)"
                  : "Not found"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {onChainBet ? (
            <div>
              <Metric label="State" value={onChainBet.state} />
              <Metric label="Game ID" value={onChainBet.gameId} />
              <Metric label="Asset" value={`${assetAddr ?? "—"} ${sym ? `(${sym})` : ""}`} copyable />
              <Metric label="Player" value={onChainBet.player} copyable />
              <Metric label="Stake" value={fmtBigint(onChainBet.stake)} />
              <Metric label="VRF Fee" value={fmtBigint(onChainBet.vrfFeePaid)} />
              {onChainBet.payout != null && <Metric label="Payout" value={fmtBigint(onChainBet.payout)} />}
              {onChainBet.refund != null && <Metric label="Refund" value={fmtBigint(onChainBet.refund)} />}
            </div>
          ) : localBet ? (
            <div>
              <Metric label="State" value={localBet.state} />
              <Metric label="Game ID" value={localBet.gameId ?? "—"} />
              <Metric label="Asset" value={localBet.asset ?? "—"} copyable />
              <Metric label="Player" value={localBet.player ?? "—"} copyable />
              <Metric label="Updated Block" value={String(localBet.updatedBlock)} />
              <Metric label="Last TX" value={localBet.lastTxHash} copyable />
              <Metric label="Last Event" value={localBet.lastEventName} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : "Bet not found. Try syncing the indexer."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {(canRefund || canFinalize) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              {canRefund && "This bet can be refunded (state: placed, may require timeout expiry)."}
              {canFinalize && "This bet has a random word and can be finalized."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionError && <ErrorCallout title="Error" message={actionError} />}
            <div className="flex gap-3">
              {canRefund && (
                <Button
                  variant="destructive"
                  onClick={() => void handleRefund()}
                  disabled={busy}
                >
                  {busy ? "Processing..." : "Refund Bet"}
                </Button>
              )}
              {canFinalize && (
                <Button
                  onClick={() => void handleFinalize()}
                  disabled={busy}
                >
                  {busy ? "Processing..." : "Finalize Bet"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Read-only notice */}
      {readOnly && betState && (betState === "placed" || betState === "randomReady") && (
        <p className="text-sm text-muted-foreground">
          Read-only mode — transactions are disabled.
        </p>
      )}
    </div>
  );
}
