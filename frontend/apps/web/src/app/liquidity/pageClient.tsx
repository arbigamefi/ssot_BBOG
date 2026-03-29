"use client";

import * as React from "react";

import type { DomainBankPosition, DomainBankSnapshot, DomainError } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  AssetSelector,
  type AssetOption,
  Button,
  GlassCard,
  AuditTabs,
  CopyButton,
  ErrorCallout,
  Input,
  Label,
  StatusBadge,
  TxStatusChip,
  TxStepper,
  toast,
  cn,
  StatBlock,
  CyberInputGroup
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction, useSequencedTxAction } from "../../features/tx/useDirectTxAction";
import {
  InformationCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon
} from "@heroicons/react/24/outline";

type Tab = "deposit" | "withdraw" | "redeem";

const TABS = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "redeem", label: "Redeem" }
];

const CAPITAL_POSTURE_SERIES = [
  24, 26, 28, 30, 31, 34, 36, 38, 40, 42, 45, 48, 50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 78
];

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

function formatBps(value?: number) {
  return value == null ? "—" : `${value} bps`;
}

function formatPctFromBps(value?: number) {
  return value == null ? "—" : `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function shortHex(val?: string) {
  if (!val) return "—";
  return `${val.slice(0, 6)}...${val.slice(-4)}`;
}

function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 4
) {
  if (value == null) return "—";
  const raw = formatUnits(value, decimals);
  const neg = raw.startsWith("-");
  const normalized = neg ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  const body = `${neg ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
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
  subtitle: string;
  status: React.ComponentProps<typeof TxStatusChip>["status"];
  steps: React.ComponentProps<typeof TxStepper>["steps"];
  hasActivity: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  explorerBaseUrl?: string;
  onReset: () => void;
  idleMessage: string;
};

function ActionTrace({
  title,
  subtitle,
  status,
  steps,
  hasActivity,
  error,
  txHash,
  blockNumber,
  explorerBaseUrl,
  onReset,
  idleMessage
}: ActionTraceProps) {
  if (!hasActivity && !error) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0a0a]/50 p-3 text-xs text-white/40 text-center font-mono">
        {idleMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <ErrorCallout
          title="Transaction error"
          message={error.message}
          details={serializeErrorDetails(error)}
        />
      ) : null}
      <div className="scale-95 origin-top">
        <TxStepper
          title={title}
          subtitle={`Status: ${status} · ${subtitle}`}
          steps={steps}
          footer={
            <div className="space-y-1.5 text-[11px] text-white/40">
              {txHash ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{shortHex(txHash)}</span>
                  {explorerBaseUrl ? (
                    <a
                      href={`${explorerBaseUrl}/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                    >
                      View explorer
                    </a>
                  ) : null}
                </div>
              ) : null}
              {blockNumber ? <div>Block: {blockNumber}</div> : null}
              {hasActivity ? (
                <div className="pt-2">
                  <button
                    onClick={onReset}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Reset terminal
                  </button>
                </div>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}

export function LiquidityPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  // Asset selection
  const assetOptions: AssetOption[] = React.useMemo(
    () =>
      (release?.assets ?? []).map((a) => ({
        address: a.address as `0x${string}`,
        symbol: a.symbol,
        decimals: a.decimals,
        label: `${a.symbol} (${a.decimals})`
      })),
    [release?.assets]
  );
  const [asset, setAsset] = React.useState<`0x${string}`>(
    () => (release?.assets[0]?.address as `0x${string}`) ?? (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(
    () => release?.assets.find((a) => a.address.toLowerCase() === asset.toLowerCase()),
    [release?.assets, asset]
  );
  const decimals = assetMeta?.decimals ?? 18;
  const primaryAsset = release?.assets[0]?.address?.toLowerCase();
  const writesSupportedForSelectedAsset = !primaryAsset || asset.toLowerCase() === primaryAsset;

  // Bank snapshot + position
  const [snapshot, setSnapshot] = React.useState<DomainBankSnapshot | null>(null);
  const [position, setPosition] = React.useState<DomainBankPosition | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!sdk || !ready) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const snap = await sdk.bank.getSnapshot(asset);
      setSnapshot(snap);
      if (sdk.account) {
        const pos = await sdk.bank.getPosition(asset, sdk.account);
        setPosition(pos);
      } else {
        setPosition(null);
      }
    } catch (e) {
      setLoadError((e as Error)?.message ?? "Failed to fetch bank data");
    } finally {
      setLoading(false);
    }
  }, [asset, ready, sdk]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Tab + form state
  const [tab, setTab] = React.useState<Tab>("deposit");
  const [amount, setAmount] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();

  const depositFlow = useSequencedTxAction({
    finalAction: "DEPOSIT",
    steps: [
      {
        key: "preflight",
        title: "Preflight",
        description: "Validate inputs and simulate flow."
      },
      {
        key: "approve",
        title: "Approve Bank",
        description: "Set ERC20 allowance.",
        action: "APPROVE_DEPOSIT",
        optional: true
      },
      {
        key: "deposit",
        title: "Deposit Assets",
        description: "Broadcast Bank.deposit.",
        action: "DEPOSIT"
      }
    ]
  });

  const withdrawFlow = useDirectTxAction({
    action: "WITHDRAW",
    labels: { preflight: "Preflight", submit: "Submit", confirm: "Confirm" },
    descriptions: {
      preflight: "Validate constraints.",
      submit: "Broadcast Bank.withdraw.",
      confirm: "Wait for receipt."
    }
  });

  const redeemFlow = useDirectTxAction({
    action: "REDEEM",
    labels: { preflight: "Preflight", submit: "Submit", confirm: "Confirm" },
    descriptions: {
      preflight: "Validate constraints.",
      submit: "Broadcast Bank.redeem.",
      confirm: "Wait for receipt."
    }
  });

  const currentFlow =
    tab === "deposit" ? depositFlow : tab === "withdraw" ? withdrawFlow : redeemFlow;

  const [maxWithdrawAmt, setMaxWithdrawAmt] = React.useState<bigint | null>(null);
  const [maxRedeemAmt, setMaxRedeemAmt] = React.useState<bigint | null>(null);

  React.useEffect(() => {
    if (!sdk || !sdk.account || !writesSupportedForSelectedAsset) {
      setMaxWithdrawAmt(null);
      setMaxRedeemAmt(null);
      return;
    }
    const acct = sdk.account;
    if (tab === "withdraw") {
      void sdk.bank
        .maxWithdraw(acct)
        .then(setMaxWithdrawAmt)
        .catch(() => setMaxWithdrawAmt(null));
    } else if (tab === "redeem") {
      void sdk.bank
        .maxRedeem(acct)
        .then(setMaxRedeemAmt)
        .catch(() => setMaxRedeemAmt(null));
    }
  }, [sdk, tab, snapshot, writesSupportedForSelectedAsset]);

  React.useEffect(() => {
    setAmount("");
    setFormError(undefined);
  }, [tab, asset]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);
    const acct = sdk.account;

    if (!writesSupportedForSelectedAsset) {
      setFormError("Write flows currently support only the primary asset.");
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError("Amount must be positive");
        return;
      }

      const id = toast.loading("Processing transaction...");
      if (tab === "deposit") {
        const res = await depositFlow.execute(() => sdk.bank.deposit(parsed, acct));
        if (!res.ok) {
          toast.dismiss(id);
          return;
        }
        toast.success(`Deposited ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`, {
          id
        });
      } else if (tab === "withdraw") {
        const res = await withdrawFlow.execute(() => sdk.bank.withdraw(parsed, acct, acct));
        if (!res.ok) {
          toast.dismiss(id);
          return;
        }
        toast.success(`Withdrew ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`, {
          id
        });
      } else {
        const res = await redeemFlow.execute(() => sdk.bank.redeem(parsed, acct, acct));
        if (!res.ok) {
          toast.dismiss(id);
          return;
        }
        toast.success(`Redeemed ${formatUnits(parsed, decimals)} shares`, { id });
      }

      setAmount("");
      void fetchData();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Transaction failed");
    }
  }, [
    amount,
    assetMeta?.symbol,
    decimals,
    depositFlow,
    fetchData,
    readOnly,
    redeemFlow,
    sdk,
    tab,
    withdrawFlow,
    writesSupportedForSelectedAsset
  ]);

  if (!release) {
    return (
      <Placeholder
        title="Liquidity"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="-"
      />
    );
  }

  const sym = assetMeta?.symbol ?? "???";
  const navBacking = snapshot?.totalAssets;
  const reserved = snapshot?.totalReserved;
  const freeCapital =
    snapshot && snapshot.totalAssets > snapshot.totalReserved
      ? snapshot.totalAssets - snapshot.totalReserved
      : 0n;
  const currentActionError = currentFlow.error;
  const maxActionAmount =
    tab === "withdraw" ? maxWithdrawAmt : tab === "redeem" ? maxRedeemAmt : null;

  return (
    <PageTransition pageKey="liquidity">
      {/* Immersive Terminal Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[150px] pointer-events-none rounded-full z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] pointer-events-none rounded-full z-0" />

      {/* Terminal Layout */}
      <div className="flex flex-col h-[calc(100vh-80px)] max-h-[900px] overflow-hidden">
        {/* TOP COMPACT HEADER & STATS */}
        <header className="shrink-0 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4 relative z-10 px-2">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Protocol
              Liquidity Terminal
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              {sym} Isolated Bankroll
            </h1>
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar">
            {/* Extremely dense stat blocks */}
            <div className="flex flex-col px-4 py-2 bg-[#050505] border border-white/5 rounded-xl min-w-[140px] shadow-inner">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                Total NAV
              </span>
              <span className="text-lg font-mono text-emerald-400 font-bold">
                {formatTokenAmount(navBacking, decimals, sym, 2)}
              </span>
            </div>
            <div className="flex flex-col px-4 py-2 bg-[#050505] border border-white/5 rounded-xl min-w-[140px] shadow-inner">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                Free Capital
              </span>
              <span className="text-lg font-mono text-blue-400 font-bold">
                {formatTokenAmount(freeCapital, decimals, sym, 2)}
              </span>
            </div>
            <div className="flex flex-col px-4 py-2 bg-[#050505] border border-white/5 rounded-xl min-w-[140px] shadow-inner">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                Liabilities
              </span>
              <span className="text-lg font-mono text-amber-400 font-bold">
                {formatTokenAmount(reserved, decimals, sym, 2)}
              </span>
            </div>
          </div>
        </header>

        {/* SPLIT PANE WORKSPACE */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 relative z-10 px-2 pb-4">
          {/* LEFT: CHART & DATA VIEW */}
          <div className="flex flex-col gap-4 min-h-0">
            {/* Chart Area */}
            <div className="flex-[2] rounded-2xl bg-[#030303] border border-white/10 overflow-hidden flex flex-col relative shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)]">
              <div className="absolute top-4 left-5 z-10">
                <h3 className="text-[13px] font-bold text-white flex items-center gap-2 tracking-wide font-sans">
                  <ChartBarIcon className="w-4 h-4 text-emerald-500" /> Capital Posture Series
                </h3>
              </div>
              <div className="absolute top-4 right-4 z-10 flex bg-[#0a0a0a] rounded-lg p-0.5 border border-white/5 shadow-md">
                {["1W", "1M", "ALL"].map((tf, i) => (
                  <button
                    key={tf}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      i === 1 ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Chart Graphic Area */}
              <div className="flex-1 relative flex items-end justify-between px-1 pt-16">
                <svg
                  className="absolute inset-x-0 bottom-0 w-full h-[70%] text-emerald-500/20 pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#10b981", stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0 }} />
                  </linearGradient>
                  <path
                    d="M0,100 L0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5 L100,100 Z"
                    fill="url(#grad1)"
                  />
                  <path
                    d="M0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1"
                    style={{ filter: "drop-shadow(0 0 3px rgba(52,211,153,0.5))" }}
                  />
                </svg>
                {CAPITAL_POSTURE_SERIES.map((h, i) => (
                  <div
                    key={i}
                    className="w-[3%] bg-emerald-500/10 border-t border-emerald-400/30 rounded-t-[2px] transition-all relative z-10"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Terminal Details & Info */}
            <div className="flex-[1] flex gap-4 min-h-0">
              <div className="flex-1 rounded-2xl bg-[#050505] border border-white/5 p-4 flex flex-col justify-center">
                <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Position Valuation
                </h4>
                <div className="text-2xl font-mono font-bold text-white tracking-tight">
                  {position ? formatTokenAmount(position.assetsEquivalent, decimals, sym) : "—"}
                </div>
                <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">
                  1 Share ≈ 1.05 {sym}
                </div>
              </div>
              <div className="flex-1 rounded-2xl bg-[#050505] border border-white/5 p-4 flex flex-col justify-center gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Bank Address</span>
                  <span className="text-white/80 font-mono tracking-tighter">
                    {shortHex(snapshot?.bank)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Total Assets</span>
                  <span className="text-white/80 font-mono">
                    {formatTokenAmount(navBacking, decimals, sym, 2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Liquidity Floor</span>
                  <span className="text-white/80 font-mono">
                    {formatTokenAmount(
                      snapshot?.minLiquidityBps != null
                        ? (snapshot.totalAssets * BigInt(snapshot.minLiquidityBps)) / 10_000n
                        : undefined,
                      decimals,
                      sym,
                      2
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: ACTION MODULE */}
          <div className="flex flex-col min-h-0">
            {!sdk?.account ? (
              <div className="h-full rounded-2xl border border-blue-500/20 bg-[#020202] p-8 flex items-center justify-center">
                <ConnectWalletPrompt action="interact with bankroll" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl h-full flex flex-col relative overflow-hidden shadow-2xl">
                {/* Compact Interface Tabs */}
                <div className="flex border-b border-white/10">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key as Tab)}
                      className={cn(
                        "flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-all relative",
                        tab === t.key
                          ? "text-white"
                          : "text-white/40 hover:text-white/70 hover:bg-white/5"
                      )}
                    >
                      {t.label}
                      {tab === t.key && (
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5 flex-1 flex flex-col overflow-y-auto hide-scrollbar custom-scrollbar">
                  {/* Amount Input */}
                  <div className="bg-[#050505] border border-white/10 rounded-xl p-4 mb-5 group focus-within:border-blue-500/50 transition-colors shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                        Amount
                      </span>
                      <button
                        onClick={() => {
                          if (tab === "withdraw" && maxWithdrawAmt)
                            setAmount(formatUnits(maxWithdrawAmt, decimals));
                          if (tab === "redeem" && maxRedeemAmt)
                            setAmount(formatUnits(maxRedeemAmt, decimals));
                        }}
                        disabled={tab === "deposit" || maxActionAmount == null}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {tab === "deposit"
                          ? "Wallet"
                          : `Max ${formatTokenAmount(maxActionAmount ?? undefined, decimals, tab === "redeem" ? "shares" : "", 2)}`}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-3xl font-mono font-black text-white w-full outline-none placeholder:text-white/10"
                      />
                      <span className="text-white/50 font-bold">
                        {tab === "redeem" ? "SHARES" : sym}
                      </span>
                    </div>
                  </div>

                  {/* Fact Sheet Rows */}
                  <div className="space-y-3 text-xs mb-6 px-1">
                    <div className="flex justify-between items-center text-white/50">
                      <span>Expected APY</span>
                      <span className="text-white">—</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50">
                      <span>Lockup</span>
                      <span className="text-white">0 Epochs (Instant)</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50">
                      <span>Network Fee</span>
                      <span className="text-white font-mono">Wallet est.</span>
                    </div>
                  </div>

                  {formError && (
                    <div className="mb-4 text-[11px] text-rose-400 italic bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                      {formError}
                    </div>
                  )}

                  <div className="mt-auto flex flex-col gap-4">
                    <button
                      onClick={() => void handleSubmit()}
                      disabled={
                        readOnly || currentFlow.busy || !amount || !writesSupportedForSelectedAsset
                      }
                      className={cn(
                        "w-full py-4 rounded-xl text-black font-extrabold text-[13px] uppercase tracking-widest transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]",
                        tab === "deposit"
                          ? "bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] focus:ring-emerald-500"
                          : "bg-blue-500 hover:bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] focus:ring-blue-500",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      {currentFlow.busy
                        ? "Executing..."
                        : tab === "deposit"
                          ? "Supply Liquidity"
                          : tab === "withdraw"
                            ? "Withdraw Assets"
                            : "Redeem Shares"}
                    </button>

                    {currentFlow.hasActivity && (
                      <div className="border border-white/5 rounded-xl bg-[#030303] overflow-hidden">
                        <ActionTrace
                          title={
                            tab === "deposit"
                              ? "Deposit Trace"
                              : tab === "withdraw"
                                ? "Withdraw Trace"
                                : "Redeem Trace"
                          }
                          subtitle="Blockchain sync."
                          status={currentFlow.status}
                          steps={currentFlow.steps}
                          hasActivity={currentFlow.hasActivity}
                          error={currentActionError}
                          txHash={currentFlow.txHash}
                          blockNumber={currentFlow.journalEntry?.blockNumber}
                          explorerBaseUrl={explorerBaseUrl}
                          onReset={currentFlow.reset}
                          idleMessage="Standing by..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
