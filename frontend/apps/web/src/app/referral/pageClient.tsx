"use client";

import * as React from "react";
type Address = `0x${string}`;

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  TxStatusChip,
  TxStepper,
  toast,
} from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

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

export function ReferralPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const [currentReferrer, setCurrentReferrer] = React.useState<Address | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  const [referrerInput, setReferrerInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();

  const bindFlow = useDirectTxAction({
    action: "BIND_REFERRER",
    labels: {
      preflight: "Preflight",
      submit: "Submit bind",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate the address and simulate Hub.bindReferrer().",
      submit: "Broadcast the bindReferrer transaction through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

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
    try {
      const res = await bindFlow.execute(() => sdk.hub.bindReferrer(addr));
      if (!res.ok) {
        return;
      }
      toast.success("Referrer bound successfully", {
        description: `Your referrer is now ${addr.slice(0, 6)}...${addr.slice(-4)}`,
      });
      setReferrerInput("");
      void fetchReferrer();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Transaction failed");
    }
  }, [bindFlow, fetchReferrer, readOnly, referrerInput, sdk]);

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
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Current Referrer</CardTitle>
            <CardDescription className="text-slate-400">
              Your currently bound referrer address on the Hub contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                  <span className="flex-1 break-all font-mono text-sm text-slate-300">{currentReferrer}</span>
                  <CopyButton value={currentReferrer!} label="Copy referrer address" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-400">No referrer bound yet</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bind referrer form */}
        {!hasBoundReferrer && (
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-white">Bind Referrer</CardTitle>
                <TxStatusChip status={bindFlow.status} />
              </div>
              <CardDescription className="text-slate-400">
                This is a one-time action and cannot be changed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="referrer-address" className="text-slate-300">
                  Referrer Address
                </Label>
                <Input
                  id="referrer-address"
                  placeholder="0x..."
                  value={referrerInput}
                  onChange={(e) => setReferrerInput(e.target.value)}
                  disabled={readOnly || !sdk?.account || bindFlow.busy}
                  className="border-slate-700 bg-slate-800/50 font-mono text-white"
                />
              </div>

              {formError ? <ErrorCallout title="Validation error" message={formError} /> : null}
              {bindFlow.error ? (
                <ErrorCallout title="Transaction error" message={bindFlow.error.message} />
              ) : null}

              <Button
                onClick={() => void handleBind()}
                disabled={readOnly || bindFlow.busy || !referrerInput.trim() || !sdk?.account}
              >
                {bindFlow.busy ? "Binding…" : "Bind Referrer"}
              </Button>

              {bindFlow.hasActivity ? (
                <TxStepper
                  title="Bind Referrer Trace"
                  subtitle={`Status: ${bindFlow.status}`}
                  steps={bindFlow.steps}
                  footer={
                    <div className="space-y-2 text-xs text-slate-400">
                      {bindFlow.txHash ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono">{bindFlow.txHash}</span>
                          {explorerBaseUrl ? (
                            <a
                              href={`${explorerBaseUrl}/tx/${bindFlow.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-300 transition-colors hover:text-emerald-200"
                            >
                              View tx
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                      {bindFlow.journalEntry?.blockNumber ? (
                        <div>Block: {bindFlow.journalEntry.blockNumber}</div>
                      ) : null}
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={bindFlow.reset}
                          className="h-auto px-0 text-slate-400 hover:text-white"
                        >
                          Reset trace
                        </Button>
                      </div>
                    </div>
                  }
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
                  Binding uses the standard preflight → stepper → receipt → journal flow.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {readOnly && (
        <p className="mt-6 text-sm text-amber-400/80">Read-only mode — transactions are disabled. {readOnlyReason}</p>
      )}
    </PageTransition>
  );
}
