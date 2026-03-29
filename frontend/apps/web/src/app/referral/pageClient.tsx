"use client";

import * as React from "react";
import Link from "next/link";

type Address = `0x${string}`;

import { Button, CopyButton, ErrorCallout, Input, TxStepper, TxStatusChip, toast } from "@ssot/ui";
import {
  ChartPieIcon,
  CubeTransparentIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  UsersIcon,
  ShareIcon
} from "@heroicons/react/24/outline";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { cn } from "@ssot/ui";

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

// Reusable Dense Stat Block
function StatBlock({
  label,
  value,
  subtext,
  glowColor = "purple",
  icon: Icon
}: {
  label: string;
  value: string;
  subtext: string;
  glowColor?: "purple" | "fuchsia" | "blue" | "emerald";
  icon?: React.ElementType;
}) {
  const colors = {
    purple:
      "border-purple-500/20 bg-[#0c051a] text-purple-400 shadow-[inset_0_0_30px_rgba(168,85,247,0.03)]",
    fuchsia:
      "border-fuchsia-500/20 bg-[#1a0515] text-fuchsia-400 shadow-[inset_0_0_30px_rgba(217,70,239,0.03)]",
    blue: "border-blue-500/20 bg-[#00050a] text-blue-400 shadow-[inset_0_0_30px_rgba(59,130,246,0.03)]",
    emerald:
      "border-emerald-500/20 bg-[#000a05] text-emerald-400 shadow-[inset_0_0_30px_rgba(16,185,129,0.03)]"
  };
  const labelColors = {
    purple: "text-purple-400/60",
    fuchsia: "text-fuchsia-400/60",
    blue: "text-blue-400/60",
    emerald: "text-emerald-400/60"
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-4", colors[glowColor])}>
      <div
        className={cn(
          "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]",
          labelColors[glowColor]
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-xl font-mono font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[10px] opacity-40 truncate">{subtext}</div>
    </div>
  );
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
      preflight: "Validate address.",
      submit: "Broadcasting transaction.",
      confirm: "Waiting for receipt."
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
      setFormError("Invalid address (0x...)");
      return;
    }
    const address = trimmed as Address;
    if (address.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("Cannot bind self");
      return;
    }
    if (address === ZERO_ADDRESS) {
      setFormError("Cannot bind zero address");
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
            label: "Bound referrer",
            hash: bindFlow.txHash,
            value: shortHex(currentReferrer ?? undefined)
          }
        ]
      : [];
  }, [bindFlow.txHash, currentReferrer]);

  return (
    <PageTransition pageKey="referral">
      <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[1600px] flex-col overflow-hidden px-4 md:px-8 py-6">
        <header className="mb-6 flex shrink-0 items-end justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">
              <ShareIcon className="h-3.5 w-3.5" /> Zero-Reconciliation
            </div>
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 md:text-3xl">
              Partner Portal
            </h1>
          </div>
          {!sdk?.account && <ConnectWalletPrompt action="view portal" />}
        </header>

        {readOnly && (
          <div className="mb-6 shrink-0">
            <ErrorCallout
              title="Read-only session"
              message={readOnlyReason ?? "Writes are disabled for this release context."}
            />
          </div>
        )}
        {loadError && (
          <div className="mb-6 shrink-0">
            <ErrorCallout title="Referral state unavailable" message={loadError} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          {/* Left Column: Link & Stats (w-400px) */}
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[400px]">
            {/* Action Card */}
            <div className="flex flex-col gap-4 rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-[#12051a] to-[#050505] p-5 shadow-[inset_0_0_30px_rgba(217,70,239,0.03)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-400/60">
                Master Link
              </div>

              {!sdk?.account ? (
                <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-xs text-white/30">
                  Connect wallet to gen link
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 p-3 shadow-inner">
                  <span className="truncate font-mono text-[11px] text-fuchsia-100/80">
                    {referralLink}
                  </span>
                  <CopyButton
                    value={referralLink ?? ""}
                    label="Copy link"
                    className="shrink-0 h-8 text-xs bg-fuchsia-500 text-black hover:bg-fuchsia-400"
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase tracking-widest text-white/30">
                  Split Rate
                </span>
                <span className="font-mono text-emerald-400">Protocol Managed</span>
              </div>

              <div className="my-2 border-t border-white/5" />

              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-400/60">
                Upstream Binding
              </div>

              {!sdk?.account ? (
                <div className="text-xs text-white/30">Connect wallet to bind a referrer.</div>
              ) : hasBoundReferrer ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-xs font-bold text-emerald-400/60">BOUND TO</span>
                  <span className="font-mono text-sm font-black text-emerald-400">
                    {shortHex(currentReferrer ?? undefined)}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    value={referrerInput}
                    onChange={(e) => setReferrerInput(e.target.value)}
                    placeholder="0x... referrer address"
                    disabled={readOnly || bindFlow.busy}
                    className="h-10 text-xs rounded-lg border-white/10 bg-black/40 text-white"
                  />
                  {formError && <p className="text-[10px] text-rose-400">{formError}</p>}
                  <button
                    type="button"
                    onClick={() => void handleBind()}
                    disabled={readOnly || bindFlow.busy || !referrerInput.trim()}
                    className="w-full rounded-lg bg-fuchsia-500 py-3 text-xs font-bold text-black hover:bg-fuchsia-400 disabled:opacity-50"
                  >
                    {bindFlow.busy ? "Binding..." : "Confirm Bind"}
                  </button>
                </div>
              )}

              {bindFlow.hasActivity && <TxStepper steps={bindFlow.steps} title="Trace" />}
            </div>

            {/* 2x2 Stats Grid */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <StatBlock
                icon={CurrencyDollarIcon}
                label="Earned"
                value="—"
                subtext="Awaiting sync"
                glowColor="purple"
              />
              <StatBlock
                icon={UsersIcon}
                label="Organics"
                value="—"
                subtext="Pending graph"
                glowColor="fuchsia"
              />
              <StatBlock
                icon={ChartPieIcon}
                label="Volume"
                value="—"
                subtext="Not exposed"
                glowColor="blue"
              />
              <StatBlock
                icon={CubeTransparentIcon}
                label="Rebates"
                value="—"
                subtext={hasBoundReferrer ? "Bound" : "Unbound"}
                glowColor="emerald"
              />
            </div>
          </div>

          {/* Middle Column: 3D Map (flex-1) */}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-[#080311] to-[#040208] shadow-inner">
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute left-6 top-6 z-10 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-mono font-bold text-purple-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
              SKYLINE ISOMETRIC MAP
            </div>

            <div className="relative flex flex-1 items-center justify-center perspective-[800px]">
              <div
                className="relative flex h-full w-full items-center justify-center"
                style={{
                  transform: "rotateX(60deg) rotateZ(-30deg)",
                  transformStyle: "preserve-3d"
                }}
              >
                <div className="absolute h-20 w-20 rounded-full border-[4px] border-purple-300 bg-gradient-to-br from-purple-500/80 to-fuchsia-600/80 shadow-[0_0_30px_rgba(168,85,247,0.6)]" />
                <div
                  className="absolute text-xl font-extrabold text-white"
                  style={{ transform: "rotateX(-60deg) rotateZ(30deg)" }}
                >
                  YOU
                </div>
                <div className="absolute h-[180px] w-[180px] animate-[spin_8s_linear_infinite] rounded-full border-[2px] border-purple-500/40" />
                <div className="absolute h-[280px] w-[280px] animate-[spin_15s_linear_infinite_reverse] rounded-full border-[2px] border-dashed border-fuchsia-500/20" />
                {[0, 120, 240].map((deg, i) => (
                  <div
                    key={i}
                    className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-purple-400 bg-purple-900/80 shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                    style={{ transform: `rotate(${deg}deg) translate(90px) rotate(-${deg}deg)` }}
                  >
                    <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_white]" />
                  </div>
                ))}
              </div>
              <div className="absolute bottom-6 left-6 right-6 text-center text-[10px] text-white/30 uppercase tracking-widest leading-relaxed">
                Affiliate settlement events are pending indexation.
                <br />
                Graph will resolve automatically upon live data flow.
              </div>
            </div>
          </div>

          {/* Right Column: Ledger (w-[350px]) */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#050505] lg:w-[350px]">
            <div className="shrink-0 border-b border-white/5 p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
                Network Log
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activityRows.length ? (
                <div className="flex flex-col gap-2">
                  {activityRows.map((row) => (
                    <div
                      key={row.hash}
                      className="group flex items-center justify-between rounded-lg border border-white/5 bg-[#0a0a0a] p-3 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          {row.label}
                        </span>
                        <span className="font-mono text-xs text-purple-200">{row.value}</span>
                      </div>
                      {explorerBaseUrl ? (
                        <a
                          href={`${explorerBaseUrl}/tx/${row.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-[10px] text-white/20">—</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-white/20 px-4">
                  No recent affiliate binds or payouts registered in this session.
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/5 bg-[#080808] p-4 text-center">
              <Link
                href="/bets"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white"
              >
                View Global Ledger ↗
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
