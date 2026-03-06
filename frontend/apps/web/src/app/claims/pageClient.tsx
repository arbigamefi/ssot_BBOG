"use client";

import * as React from "react";

import type { DomainError, DomainXPBuckets } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  StatCard,
  TxStatusChip,
  TxStepper,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";

function getExplorerBaseUrl(chainId: number) {
  switch (chainId) {
    case 84532:
      return "https://sepolia.basescan.org";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return undefined;
  }
}

function serializeErrorDetails(error?: DomainError) {
  if (!error?.details) return undefined;
  return JSON.stringify(
    error.details,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}

type ActionTraceProps = {
  title: string;
  status: React.ComponentProps<typeof TxStatusChip>["status"];
  steps: React.ComponentProps<typeof TxStepper>["steps"];
  hasActivity: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  explorerBaseUrl?: string;
  onReset: () => void;
};

function ActionTrace({
  title,
  status,
  steps,
  hasActivity,
  error,
  txHash,
  blockNumber,
  explorerBaseUrl,
  onReset,
}: ActionTraceProps) {
  if (!hasActivity && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
        This action uses the standard preflight → stepper → receipt → journal flow once executed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorCallout
          title="Transaction error"
          message={error.message}
          details={serializeErrorDetails(error)}
        />
      ) : null}

      <TxStepper
        title={title}
        subtitle={`Status: ${status}`}
        steps={steps}
        footer={
          <div className="space-y-2 text-xs text-slate-400">
            {txHash ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{txHash}</span>
                {explorerBaseUrl ? (
                  <a
                    href={`${explorerBaseUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    View tx
                  </a>
                ) : null}
              </div>
            ) : null}
            {blockNumber ? <div>Block: {blockNumber}</div> : null}
            {hasActivity ? (
              <div>
                <Button variant="ghost" size="sm" onClick={onReset} className="h-auto px-0 text-slate-400 hover:text-white">
                  Reset trace
                </Button>
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

export function ClaimsPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  const assetMeta = release?.assets[0];
  const decimals = assetMeta?.decimals ?? 18;
  const sym = assetMeta?.symbol ?? "XP";
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const xpClaimFlow = useDirectTxAction({
    action: "CLAIM_XP_ACCRUED",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate claim amount and simulate the bank call.",
      submit: "Broadcast claimXPAccrued through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const syncHoldbackFlow = useDirectTxAction({
    action: "SYNC_XP_HOLDBACK",
    labels: {
      preflight: "Preflight",
      submit: "Submit sync",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate the sync action before signing.",
      submit: "Broadcast syncXPHoldback through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const protocolFeeFlow = useDirectTxAction({
    action: "CLAIM_PROTOCOL_FEES",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate governance eligibility and simulate the bank call.",
      submit: "Broadcast claimProtocolFees through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  // XP buckets state
  const [xpBuckets, setXPBuckets] = React.useState<DomainXPBuckets | null>(null);
  const [xpLoading, setXPLoading] = React.useState(false);
  const [xpError, setXPError] = React.useState<string | undefined>();

  const fetchXPBuckets = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setXPLoading(true);
    setXPError(undefined);
    try {
      const buckets = await sdk.bank.getXPBuckets(sdk.account);
      setXPBuckets(buckets);
    } catch (e) {
      setXPError((e as Error)?.message ?? "Failed to fetch XP buckets");
    } finally {
      setXPLoading(false);
    }
  }, [ready, sdk]);

  React.useEffect(() => {
    void fetchXPBuckets();
  }, [fetchXPBuckets]);

  // XP claim form
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const res = await xpClaimFlow.execute(() => sdk.bank.claimXPAccrued(parsed, sdk.account!));
      if (!res.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} XP`);
      setXPClaimAmount("");
      void fetchXPBuckets();
    } catch (e) {
      toast.error((e as Error)?.message ?? "XP claim failed");
    }
  }, [decimals, fetchXPBuckets, readOnly, sdk, xpClaimAmount, xpClaimFlow]);

  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const res = await syncHoldbackFlow.execute(() => sdk.bank.syncXPHoldback(sdk.account!));
      if (!res.ok) return;
      toast.success("Holdback synced");
      void fetchXPBuckets();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Sync holdback failed");
    }
  }, [fetchXPBuckets, readOnly, sdk, syncHoldbackFlow]);

  // Protocol fee claim
  const [pfAmount, setPFAmount] = React.useState("");

  const handleClaimPF = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(pfAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const res = await protocolFeeFlow.execute(() =>
        sdk.bank.claimProtocolFees(parsed, sdk.account!)
      );
      if (!res.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${sym} protocol fees`);
      setPFAmount("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Protocol fee claim failed");
    }
  }, [decimals, pfAmount, protocolFeeFlow, readOnly, sdk, sym]);

  if (!release) {
    return (
      <Placeholder
        title="Claims"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/frontend/PAGE-SPECS/045-CLAIMS.md"
      />
    );
  }

  const hasWallet = Boolean(sdk?.account);

  return (
    <PageTransition pageKey="claims">
      <PageHeader
        title="Claims"
        description="Claim XP, sync holdback, and execute governed fee withdrawals with a standardized transaction trace."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchXPBuckets()}
            disabled={xpLoading || !hasWallet}
            className="border-slate-700 text-slate-300"
          >
            {xpLoading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {!hasWallet ? (
        <div className="mb-8">
          <ConnectWalletPrompt action="view XP buckets" />
        </div>
      ) : xpError ? (
        <div className="mb-8">
          <ErrorCallout title="XP load error" message={xpError} />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon="💰"
            label="Accrued (Claimable)"
            value={xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "—"}
          />
          <StatCard
            icon="🔒"
            label="Locked (Vesting)"
            value={xpBuckets ? formatUnits(xpBuckets.locked, decimals) : "—"}
          />
          <StatCard
            icon="⏳"
            label="Holdback"
            value={xpBuckets ? formatUnits(xpBuckets.holdback, decimals) : "—"}
          />
          <StatCard
            icon="🔓"
            label="Holdback Releasable"
            value={xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "—"}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-white">Claim Accrued XP</CardTitle>
              <TxStatusChip status={xpClaimFlow.status} />
            </div>
            <CardDescription className="text-slate-400">
              {readOnly
                ? "Read-only mode is active, so claims are disabled."
                : "Withdraw accrued XP to your wallet through the standard transaction flow."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="xp-amount" className="text-slate-300">
                Amount
              </Label>
              <Input
                id="xp-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={xpClaimAmount}
                onChange={(e) => setXPClaimAmount(e.target.value)}
                disabled={readOnly || !hasWallet || xpClaimFlow.busy}
                className="border-slate-700 bg-slate-800/50 text-white"
              />
              {xpBuckets ? (
                <button
                  type="button"
                  className="text-xs text-emerald-400 hover:underline"
                  onClick={() => setXPClaimAmount(formatUnits(xpBuckets.accrued, decimals))}
                >
                  Max: {formatUnits(xpBuckets.accrued, decimals)}
                </button>
              ) : null}
            </div>

            <Button
              onClick={() => void handleClaimXP()}
              disabled={readOnly || xpClaimFlow.busy || !xpClaimAmount || !hasWallet}
            >
              {xpClaimFlow.busy ? "Running…" : "Claim XP"}
            </Button>

            <ActionTrace
              title="XP Claim Trace"
              status={xpClaimFlow.status}
              steps={xpClaimFlow.steps}
              hasActivity={xpClaimFlow.hasActivity}
              error={xpClaimFlow.error}
              txHash={xpClaimFlow.txHash}
              blockNumber={xpClaimFlow.journalEntry?.blockNumber}
              explorerBaseUrl={explorerBaseUrl}
              onReset={xpClaimFlow.reset}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-white">Sync Holdback</CardTitle>
              <TxStatusChip status={syncHoldbackFlow.status} />
            </div>
            <CardDescription className="text-slate-400">
              Release eligible holdback into the accrued bucket before claiming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
              Current releasable amount:{" "}
              <span className="font-mono text-white">
                {xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "—"} {sym}
              </span>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleSyncHoldback()}
              disabled={readOnly || syncHoldbackFlow.busy || !hasWallet}
              className="border-slate-700 text-slate-200 hover:text-white"
            >
              {syncHoldbackFlow.busy ? "Running…" : "Sync Holdback"}
            </Button>

            <ActionTrace
              title="Holdback Sync Trace"
              status={syncHoldbackFlow.status}
              steps={syncHoldbackFlow.steps}
              hasActivity={syncHoldbackFlow.hasActivity}
              error={syncHoldbackFlow.error}
              txHash={syncHoldbackFlow.txHash}
              blockNumber={syncHoldbackFlow.journalEntry?.blockNumber}
              explorerBaseUrl={explorerBaseUrl}
              onReset={syncHoldbackFlow.reset}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-white">Protocol Fee Claim</CardTitle>
              <TxStatusChip status={protocolFeeFlow.status} />
            </div>
            <CardDescription className="text-slate-400">
              Governance-only action. Unauthorized callers will fail at preflight or execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pf-amount" className="text-slate-300">
                Amount ({sym})
              </Label>
              <Input
                id="pf-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={pfAmount}
                onChange={(e) => setPFAmount(e.target.value)}
                disabled={readOnly || !hasWallet || protocolFeeFlow.busy}
                className="border-slate-700 bg-slate-800/50 text-white"
              />
            </div>

            <Button
              onClick={() => void handleClaimPF()}
              disabled={readOnly || protocolFeeFlow.busy || !pfAmount || !hasWallet}
            >
              {protocolFeeFlow.busy ? "Running…" : "Claim Protocol Fees"}
            </Button>

            <ActionTrace
              title="Protocol Fee Trace"
              status={protocolFeeFlow.status}
              steps={protocolFeeFlow.steps}
              hasActivity={protocolFeeFlow.hasActivity}
              error={protocolFeeFlow.error}
              txHash={protocolFeeFlow.txHash}
              blockNumber={protocolFeeFlow.journalEntry?.blockNumber}
              explorerBaseUrl={explorerBaseUrl}
              onReset={protocolFeeFlow.reset}
            />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
