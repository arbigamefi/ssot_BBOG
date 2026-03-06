"use client";

import * as React from "react";

import type { DomainXPBuckets } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  Button,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  StatCard,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";

export function ClaimsPageClient() {
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  const assetMeta = release?.assets[0];
  const decimals = assetMeta?.decimals ?? 18;
  const sym = assetMeta?.symbol ?? "XP";

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
  }, [sdk, ready]);

  React.useEffect(() => {
    void fetchXPBuckets();
  }, [fetchXPBuckets]);

  // XP claim form
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");
  const [xpClaimBusy, setXPClaimBusy] = React.useState(false);
  const [xpClaimError, setXPClaimError] = React.useState<string | undefined>();

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setXPClaimError(undefined);
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount, decimals);
      if (parsed <= 0n) { setXPClaimError("Amount must be positive"); return; }
      setXPClaimBusy(true);
      const res = await sdk.bank.claimXPAccrued(parsed, sdk.account);
      if (!res.ok) { setXPClaimError(res.error?.message ?? "XP claim failed"); return; }
      toast.success(`Claimed ${formatUnits(parsed, decimals)} XP`);
      setXPClaimAmount("");
      void fetchXPBuckets();
    } catch (e) {
      setXPClaimError((e as Error)?.message ?? "XP claim failed");
    } finally {
      setXPClaimBusy(false);
    }
  }, [sdk, readOnly, xpClaimAmount, decimals, fetchXPBuckets]);

  // Sync holdback
  const [syncBusy, setSyncBusy] = React.useState(false);
  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setSyncBusy(true);
    try {
      const res = await sdk.bank.syncXPHoldback(sdk.account);
      if (!res.ok) { toast.error(res.error?.message ?? "Sync holdback failed"); return; }
      toast.success("Holdback synced");
      void fetchXPBuckets();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Sync holdback failed");
    } finally {
      setSyncBusy(false);
    }
  }, [sdk, readOnly, fetchXPBuckets]);

  // Protocol fee claim
  const [pfAmount, setPFAmount] = React.useState("");
  const [pfBusy, setPFBusy] = React.useState(false);
  const [pfError, setPFError] = React.useState<string | undefined>();

  const handleClaimPF = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setPFError(undefined);
    try {
      const parsed = parseDecimalToUnits(pfAmount, decimals);
      if (parsed <= 0n) { setPFError("Amount must be positive"); return; }
      setPFBusy(true);
      const res = await sdk.bank.claimProtocolFees(parsed, sdk.account);
      if (!res.ok) { setPFError(res.error?.message ?? "Protocol fee claim failed"); return; }
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${sym} protocol fees`);
      setPFAmount("");
    } catch (e) {
      setPFError((e as Error)?.message ?? "Protocol fee claim failed");
    } finally {
      setPFBusy(false);
    }
  }, [sdk, readOnly, pfAmount, decimals, sym]);

  if (!release) {
    return <Placeholder title="Claims" description={readOnlyReason ?? "No embedded release available."} specPath="docs/frontend/PAGE-SPECS/050-CLAIMS.md" />;
  }

  const hasWallet = Boolean(sdk?.account);

  return (
    <PageTransition pageKey="claims">
      <PageHeader
        title="Claims"
        description="View and claim your XP rewards and protocol fees."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchXPBuckets()} disabled={xpLoading || !hasWallet} className="border-slate-700 text-slate-300">
              {xpLoading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleSyncHoldback()} disabled={syncBusy || readOnly || !hasWallet} className="border-slate-700 text-slate-300">
              {syncBusy ? "Syncing…" : "Sync Holdback"}
            </Button>
          </div>
        }
      />

      {/* XP Stats ribbon */}
      {!hasWallet ? (
        <div className="mb-8">
          <ConnectWalletPrompt action="view XP buckets" />
        </div>
      ) : xpError ? (
        <div className="mb-8"><ErrorCallout title="XP load error" message={xpError} /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="💰" label="Accrued (Claimable)" value={xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "—"} />
          <StatCard icon="🔒" label="Locked (Vesting)" value={xpBuckets ? formatUnits(xpBuckets.locked, decimals) : "—"} />
          <StatCard icon="⏳" label="Holdback" value={xpBuckets ? formatUnits(xpBuckets.holdback, decimals) : "—"} />
          <StatCard icon="🔓" label="Holdback Releasable" value={xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "—"} />
        </div>
      )}

      {/* Claim XP Form */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Claim Accrued XP</h3>
            <p className="text-xs text-slate-400">{readOnly ? "Read-only mode — claims are disabled." : "Withdraw accrued XP to your wallet."}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="xp-amount" className="text-slate-300">Amount</Label>
            <Input id="xp-amount" inputMode="decimal" placeholder="0.00" value={xpClaimAmount} onChange={(e) => setXPClaimAmount(e.target.value)} disabled={readOnly || !hasWallet} className="bg-slate-800/50 border-slate-700 text-white" />
            {xpBuckets && (
              <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setXPClaimAmount(formatUnits(xpBuckets.accrued, decimals))}>
                Max: {formatUnits(xpBuckets.accrued, decimals)}
              </button>
            )}
          </div>
          {xpClaimError && <ErrorCallout title="Error" message={xpClaimError} />}
          <Button onClick={() => void handleClaimXP()} disabled={readOnly || xpClaimBusy || !xpClaimAmount || !hasWallet}>
            {xpClaimBusy ? "Claiming…" : "Claim XP"}
          </Button>
        </div>

        {/* Protocol Fee Claim */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Protocol Fee Claim</h3>
            <p className="text-xs text-slate-400">Governance only — claim protocol fees accrued in the Bank.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-amount" className="text-slate-300">Amount ({sym})</Label>
            <Input id="pf-amount" inputMode="decimal" placeholder="0.00" value={pfAmount} onChange={(e) => setPFAmount(e.target.value)} disabled={readOnly || !hasWallet} className="bg-slate-800/50 border-slate-700 text-white" />
          </div>
          {pfError && <ErrorCallout title="Error" message={pfError} />}
          <Button onClick={() => void handleClaimPF()} disabled={readOnly || pfBusy || !pfAmount || !hasWallet}>
            {pfBusy ? "Claiming…" : "Claim Protocol Fees"}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
