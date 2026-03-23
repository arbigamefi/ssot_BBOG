"use client";

import * as React from "react";
import Link from "next/link";

type Address = `0x${string}`;

import { Button, CopyButton, ErrorCallout, Input, TxStepper, toast } from "@ssot/ui";
import {
  ChartPieIcon,
  CubeTransparentIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  ShareIcon,
  UsersIcon
} from "@heroicons/react/24/outline";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function shortHex(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate the address and simulate Hub.bindReferrer().",
      submit: "Broadcast the bindReferrer transaction through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const hasBoundReferrer = currentReferrer != null && currentReferrer !== ZERO_ADDRESS;

  const fetchReferrer = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const referrer = await sdk.hub.referrerOf(sdk.account);
      setCurrentReferrer(referrer as Address);
    } catch (error) {
      setLoadError((error as Error)?.message ?? "Failed to fetch referrer");
    } finally {
      setLoading(false);
    }
  }, [ready, sdk]);

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
    const address = trimmed as Address;
    if (address.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("Cannot set yourself as your own referrer");
      return;
    }
    if (address === ZERO_ADDRESS) {
      setFormError("Cannot bind to zero address");
      return;
    }
    try {
      const result = await bindFlow.execute(() => sdk.hub.bindReferrer(address));
      if (!result.ok) return;
      toast.success("Referrer bound successfully");
      setReferrerInput("");
      void fetchReferrer();
    } catch (error) {
      toast.error((error as Error)?.message ?? "Transaction failed");
    }
  }, [bindFlow, fetchReferrer, readOnly, referrerInput, sdk]);

  const referralLink = React.useMemo(() => {
    if (!sdk?.account || typeof window === "undefined") return null;
    return `${window.location.origin}/?ref=${sdk.account}`;
  }, [sdk?.account]);

  const activityRows = React.useMemo(() => {
    return bindFlow.txHash
      ? [
          {
            label: "Bound upstream referrer",
            hash: bindFlow.txHash,
            value: shortHex(currentReferrer ?? undefined)
          }
        ]
      : [];
  }, [bindFlow.txHash, currentReferrer]);

  return (
    <PageTransition pageKey="referral">
      <main className="relative mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:py-16">
        <header className="mb-4 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">
              <ShareIcon className="h-4 w-4" />
              Zero-Reconciliation Engine
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 md:text-5xl">
              Distribute &amp; Earn On-Chain
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/50">
              Traditional platforms rely on manual spreadsheets and delayed payouts. Our SSOT
              architecture splits marketing budgets at the exact block a bet is settled. Fully
              transparent, instantly claimable.
            </p>
          </div>

          {referralLink ? (
            <CopyButton
              value={referralLink}
              label="Generate Link"
              className="h-12 rounded-xl bg-purple-500 px-6 py-3 font-bold text-black shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-colors hover:bg-purple-400"
            />
          ) : (
            <ConnectWalletPrompt action="generate referral link" />
          )}
        </header>

        {readOnly ? (
          <ErrorCallout
            title="Read-only session"
            message={readOnlyReason ?? "Writes are disabled for this release context."}
          />
        ) : null}

        {loadError ? <ErrorCallout title="Referral state unavailable" message={loadError} /> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Earned (USDC)",
              value: "—",
              helper: "Awaiting indexed affiliate receipts",
              accent: "purple",
              icon: <CurrencyDollarIcon className="h-8 w-8 text-purple-400" />
            },
            {
              label: "Active Organics",
              value: "—",
              helper: "Wallet graph not yet indexed",
              accent: "fuchsia",
              icon: <UsersIcon className="h-8 w-8 text-fuchsia-400" />
            },
            {
              label: "Direct Network Volume",
              value: "—",
              helper: "Protocol events not exposed here yet",
              accent: "blue",
              icon: <ChartPieIcon className="h-8 w-8 text-blue-400" />
            },
            {
              label: "Unclaimed Rebates",
              value: "—",
              helper: hasBoundReferrer
                ? "Upstream binding confirmed"
                : "Bind once to finalize path",
              accent: "emerald",
              icon: <CubeTransparentIcon className="h-8 w-8 text-emerald-400" />
            }
          ].map((item) => (
            <div
              key={item.label}
              className={
                item.accent === "purple"
                  ? "relative overflow-hidden rounded-[2rem] border-2 border-purple-500/20 bg-gradient-to-br from-[#0c051a] to-[#050505] p-8 shadow-[inset_0_0_40px_rgba(168,85,247,0.05),0_10px_40px_rgba(0,0,0,0.5)]"
                  : item.accent === "emerald"
                    ? "rounded-[2rem] border-2 border-emerald-500/10 bg-[#050510] p-8 shadow-[inset_0_0_40px_rgba(16,185,129,0.02),0_10px_40px_rgba(0,0,0,0.5)]"
                    : "rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)]"
              }
            >
              {item.accent === "purple" ? (
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-500/10 blur-[50px]" />
              ) : null}
              {item.icon}
              <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                {item.label}
              </div>
              <div
                className={
                  item.accent === "emerald"
                    ? "mt-2 text-3xl font-mono font-extrabold text-emerald-400 md:text-4xl"
                    : item.accent === "purple"
                      ? "mt-2 text-3xl font-mono font-extrabold text-white md:text-4xl"
                      : "mt-2 text-3xl font-mono font-bold text-white md:text-4xl"
                }
              >
                {item.value}
              </div>
              <div className="mt-2 text-xs text-white/40">{item.helper}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section className="relative flex h-[500px] flex-col overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#080311] to-[#040208] p-8 shadow-[inset_0_2px_40px_rgba(0,0,0,0.8)]">
            <div className="absolute -right-10 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-[90px]" />
            <div className="relative z-10 mb-8 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Skyline Isometric Map</h3>
                <p className="mt-2 text-sm text-white/40">
                  Visualizing your on-chain downline and rebate splits in realtime.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-mono text-purple-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                {hasBoundReferrer ? "BOUND" : "IDLE"}
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center perspective-[1200px]">
              <div
                className="relative flex h-full w-full items-center justify-center"
                style={{
                  transform: "rotateX(60deg) rotateZ(-30deg)",
                  transformStyle: "preserve-3d"
                }}
              >
                <div className="absolute h-24 w-24 rounded-full border-[4px] border-purple-300 bg-gradient-to-br from-purple-500/80 to-fuchsia-600/80 shadow-[0_0_50px_rgba(168,85,247,0.6)]" />
                <div
                  className="absolute text-2xl font-extrabold text-white"
                  style={{ transform: "rotateX(-60deg) rotateZ(30deg)" }}
                >
                  YOU
                </div>
                <div className="absolute h-[250px] w-[250px] animate-[spin_10s_linear_infinite] rounded-full border-[2px] border-purple-500/30" />
                <div className="absolute h-[450px] w-[450px] animate-[spin_20s_linear_infinite_reverse] rounded-full border-[2px] border-dashed border-fuchsia-500/20" />
                {[0, 90, 180, 270].map((deg, index) => (
                  <div
                    key={index}
                    className="absolute flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-400 bg-purple-900/80 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                    style={{ transform: `rotate(${deg}deg) translate(125px) rotate(-${deg}deg)` }}
                  >
                    <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_10px_white]" />
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 rounded-[1.5rem] border border-dashed border-white/8 bg-black/20 px-5 py-4 text-center text-sm text-white/42">
                Affiliate settlement events are not indexed yet. When they are, this map should
                resolve into a real wallet graph.
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="relative overflow-hidden rounded-[2.5rem] border-2 border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 to-[#050505] p-8 shadow-[inset_0_2px_20px_rgba(217,70,239,0.05),0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-[60px]" />
              <h3 className="text-xl font-bold text-fuchsia-400">Master Protocol Link</h3>

              {!sdk?.account ? (
                <div className="mt-6">
                  <ConnectWalletPrompt action="copy referral link" />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#050505] p-4 shadow-inner">
                    <span className="truncate font-mono text-sm text-fuchsia-100">
                      {referralLink}
                    </span>
                    <CopyButton value={referralLink ?? ""} label="Copy referral link" />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      Default Split Rate
                    </span>
                    <span className="font-mono font-bold text-emerald-400">Protocol managed</span>
                  </div>

                  {hasBoundReferrer ? (
                    <div className="rounded-[1.5rem] border border-emerald-400/14 bg-emerald-400/[0.05] p-5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                        Active upstream
                      </div>
                      <div className="mt-3 text-3xl font-black tracking-tight text-white">
                        {shortHex(currentReferrer ?? undefined)}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/44">
                        This wallet is already bound. The route now behaves as a read-only audit
                        surface for the affiliate relationship.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Input
                        value={referrerInput}
                        onChange={(event) => setReferrerInput(event.target.value)}
                        placeholder="0x... upstream address"
                        disabled={readOnly || bindFlow.busy}
                        className="h-12 rounded-2xl border-white/10 bg-black/25 text-white placeholder:text-white/28"
                      />
                      {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
                      <button
                        type="button"
                        onClick={() => void handleBind()}
                        disabled={readOnly || bindFlow.busy || !referrerInput.trim()}
                        className="w-full rounded-xl bg-fuchsia-500 px-4 py-4 font-bold text-black transition-colors hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {bindFlow.busy ? "Binding referrer..." : "Configure Rebate Rules"}
                      </button>
                    </div>
                  )}

                  {bindFlow.hasActivity ? (
                    <TxStepper
                      title="Bind trace"
                      steps={bindFlow.steps}
                      footer={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={bindFlow.reset}
                          className="h-auto px-0 text-white/30 hover:text-white"
                        >
                          Reset trace
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              )}
            </section>

            <section className="flex flex-1 flex-col rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <h3 className="text-lg font-bold text-white">Recent Network Activity</h3>

              <div className="mt-6 flex flex-1 flex-col gap-3">
                {activityRows.length ? (
                  activityRows.map((row) => (
                    <div
                      key={row.hash}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#050505] p-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-white/80">{row.value}</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                          {row.label}
                        </span>
                      </div>
                      {explorerBaseUrl ? (
                        <a
                          href={`${explorerBaseUrl}/tx/${row.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                          Open
                        </a>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/24">
                          —
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/8 bg-black/20 px-6 py-12 text-center text-sm text-white/42">
                    No indexed referral activity is available yet. This surface will stay sparse
                    until the runtime exposes affiliate receipts.
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-white/5 pt-6 text-center">
                <Link
                  href="/bets"
                  className="text-xs font-bold uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white"
                >
                  View Full Ledger ↗
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
