"use client";

import * as React from "react";
type Address = `0x${string}`;

import {
  Button,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  CopyButton,
  toast,
} from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function ReferralPageClient() {
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  const [currentReferrer, setCurrentReferrer] = React.useState<Address | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  const [referrerInput, setReferrerInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | undefined>();

  const hasBoundReferrer = currentReferrer != null && currentReferrer !== ZERO_ADDRESS;

  const fetchReferrer = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const ref = await sdk.hub.referrerOf(sdk.account);
      setCurrentReferrer(ref as Address);
    } catch (e) {
      setLoadError((e as Error)?.message ?? "Failed to fetch referrer");
    } finally {
      setLoading(false);
    }
  }, [sdk, ready]);

  React.useEffect(() => {
    void fetchReferrer();
  }, [fetchReferrer]);

  const handleBind = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);
    const trimmed = referrerInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setFormError("Please enter a valid Ethereum address (0x...)");
      return;
    }
    const addr = trimmed as Address;
    if (addr.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("Cannot set yourself as your own referrer");
      return;
    }
    if (addr === ZERO_ADDRESS) {
      setFormError("Cannot bind to zero address");
      return;
    }
    setBusy(true);
    try {
      const res = await sdk.hub.bindReferrer(addr);
      if (!res.ok) { setFormError(res.error?.message ?? "Bind referrer failed"); return; }
      toast.success("Referrer bound successfully", {
        description: `Your referrer is now ${addr.slice(0, 6)}...${addr.slice(-4)}`,
      });
      setReferrerInput("");
      void fetchReferrer();
    } catch (e) {
      setFormError((e as Error)?.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }, [sdk, readOnly, referrerInput, fetchReferrer]);

  if (!release) {
    return (
      <PageTransition pageKey="referral">
        <PageHeader title="Referral" description={readOnlyReason ?? "No embedded release available."} />
      </PageTransition>
    );
  }

  return (
    <PageTransition pageKey="referral">
      <PageHeader
        title="Referral"
        description="Earn XP rewards by referring friends. Share your referral link and earn a portion of their play."
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchReferrer()} disabled={loading || !sdk?.account} className="border-slate-700 text-slate-300">
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {loadError && <ErrorCallout title="Load error" message={loadError} />}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current referrer status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Current Referrer</h3>
            <p className="text-xs text-slate-400">Your currently bound referrer address on the Hub contract.</p>
          </div>
          {!sdk?.account ? (
            <ConnectWalletPrompt action="view your referrer" />
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
              Loading…
            </div>
          ) : hasBoundReferrer ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-white">Referrer bound</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 p-3">
                <span className="font-mono text-sm text-slate-300 break-all flex-1">{currentReferrer}</span>
                <CopyButton value={currentReferrer!} label="Copy referrer address" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-400">No referrer bound yet</span>
            </div>
          )}
        </div>

        {/* Bind referrer form */}
        {!hasBoundReferrer && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Bind Referrer</h3>
              <p className="text-xs text-slate-400">This is a one-time action and cannot be changed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referrer-address" className="text-slate-300">Referrer Address</Label>
              <Input
                id="referrer-address"
                placeholder="0x..."
                value={referrerInput}
                onChange={(e) => setReferrerInput(e.target.value)}
                disabled={readOnly || !sdk?.account}
                className="bg-slate-800/50 border-slate-700 text-white font-mono"
              />
            </div>
            {formError && <ErrorCallout title="Error" message={formError} />}
            <Button
              onClick={() => void handleBind()}
              disabled={readOnly || busy || !referrerInput.trim() || !sdk?.account}
            >
              {busy ? "Binding…" : "Bind Referrer"}
            </Button>
          </div>
        )}
      </div>

      {readOnly && (
        <p className="mt-6 text-sm text-amber-400/80">Read-only mode — transactions are disabled. {readOnlyReason}</p>
      )}
    </PageTransition>
  );
}
