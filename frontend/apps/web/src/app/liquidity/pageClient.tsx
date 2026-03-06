"use client";

import * as React from "react";

import type { DomainBankPosition, DomainBankSnapshot, DomainError } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  AssetSelector,
  type AssetOption,
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
  StatCard,
  TabBar,
  TxStatusChip,
  TxStepper,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction, useSequencedTxAction } from "../../features/tx/useDirectTxAction";

type Tab = "deposit" | "withdraw" | "redeem";

const TABS = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "redeem", label: "Redeem" },
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
  idleMessage,
}: ActionTraceProps) {
  if (!hasActivity && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
        {idleMessage}
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
        subtitle={`Status: ${status} · ${subtitle}`}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-auto px-0 text-slate-400 hover:text-white"
                >
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
        label: `${a.symbol} (${a.decimals})`,
      })),
    [release?.assets]
  );
  const [asset, setAsset] = React.useState<`0x${string}`>(
    () =>
      (release?.assets[0]?.address as `0x${string}`) ??
      (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(
    () => release?.assets.find((a) => a.address.toLowerCase() === asset.toLowerCase()),
    [release?.assets, asset]
  );
  const decimals = assetMeta?.decimals ?? 18;
  const primaryAsset = release?.assets[0]?.address?.toLowerCase();
  const writesSupportedForSelectedAsset =
    !primaryAsset || asset.toLowerCase() === primaryAsset;

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
        description: "Validate inputs and simulate the liquidity flow.",
      },
      {
        key: "approve",
        title: "Approve Bank",
        description: "Set exact ERC20 allowance for the Bank if required.",
        action: "APPROVE_DEPOSIT",
        optional: true,
      },
      {
        key: "deposit",
        title: "Deposit Assets",
        description: "Broadcast Bank.deposit and wait for receipt.",
        action: "DEPOSIT",
      },
    ],
  });

  const withdrawFlow = useDirectTxAction({
    action: "WITHDRAW",
    labels: {
      preflight: "Preflight",
      submit: "Submit withdraw",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate withdraw amount and simulate the Bank call.",
      submit: "Broadcast Bank.withdraw through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const redeemFlow = useDirectTxAction({
    action: "REDEEM",
    labels: {
      preflight: "Preflight",
      submit: "Submit redeem",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate redeem amount and simulate the Bank call.",
      submit: "Broadcast Bank.redeem through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const currentFlow =
    tab === "deposit"
      ? depositFlow
      : tab === "withdraw"
        ? withdrawFlow
        : redeemFlow;

  // Max values
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
      setFormError("Write flows currently support only the primary asset from the active release.");
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError("Amount must be positive");
        return;
      }

      if (tab === "deposit") {
        const res = await depositFlow.execute(() => sdk.bank.deposit(parsed, acct));
        if (!res.ok) return;
        toast.success(`Deposited ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`, {
          description:
            res.shares != null
              ? `Received ${formatUnits(res.shares, decimals)} shares`
              : undefined,
        });
      } else if (tab === "withdraw") {
        const res = await withdrawFlow.execute(() => sdk.bank.withdraw(parsed, acct, acct));
        if (!res.ok) return;
        toast.success(`Withdrew ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`);
      } else {
        const res = await redeemFlow.execute(() => sdk.bank.redeem(parsed, acct, acct));
        if (!res.ok) return;
        toast.success(`Redeemed ${formatUnits(parsed, decimals)} shares`);
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
    writesSupportedForSelectedAsset,
  ]);

  if (!release) {
    return (
      <Placeholder
        title="Liquidity"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/frontend/PAGE-SPECS/030-LIQUIDITY.md"
      />
    );
  }

  const sym = assetMeta?.symbol ?? "???";
  const freeLiq = snapshot ? snapshot.totalAssets - snapshot.totalReserved : 0n;

  const actionTraceTitle =
    tab === "deposit"
      ? "Deposit Trace"
      : tab === "withdraw"
        ? "Withdraw Trace"
        : "Redeem Trace";
  const actionTraceSubtitle =
    tab === "deposit"
      ? "Deposit may include an exact-approval step before Bank.deposit."
      : tab === "withdraw"
        ? "Withdraw burns value-equivalent shares through Bank.withdraw."
        : "Redeem burns shares directly through Bank.redeem.";

  const currentActionError = currentFlow.error;

  return (
    <PageTransition pageKey="liquidity">
      <PageHeader
        title="Liquidity"
        description="Provide liquidity to earn yield as the house. Your deposits back all on-chain bets."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData()}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <div className="mb-6">
        <AssetSelector assets={assetOptions} value={asset} onValueChange={setAsset} showAddress />
      </div>

      {loadError ? <ErrorCallout title="Load error" message={loadError} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard icon="🏦" label={`Total Assets (${sym})`} value={snapshot ? formatUnits(snapshot.totalAssets, decimals) : "—"} />
        <StatCard icon="🔒" label="Reserved" value={snapshot ? formatUnits(snapshot.totalReserved, decimals) : "—"} />
        <StatCard icon="💧" label="Free Liquidity" value={snapshot ? formatUnits(freeLiq, decimals) : "—"} />
        <StatCard icon="📉" label="Min Liquidity" value={formatBps(snapshot?.minLiquidityBps)} />
        <StatCard icon="💸" label="Protocol Fees" value={snapshot ? formatUnits(snapshot.protocolFeesPayable ?? 0n, decimals) : "—"} />
        <StatCard icon="🧾" label="External Payables" value={snapshot ? formatUnits(snapshot.externalPayablesTotal ?? 0n, decimals) : "—"} />
        <StatCard icon="📊" label="Your Shares" value={position ? formatUnits(position.shares, decimals) : sdk?.account ? "0" : "—"} />
        <StatCard icon="🪙" label="Assets Equivalent" value={position ? formatUnits(position.assetsEquivalent, decimals) : sdk?.account ? "0" : "—"} />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          Bank
          <span className="font-mono text-slate-200">{snapshot?.bank ?? "—"}</span>
          {snapshot?.bank ? <CopyButton value={snapshot.bank} label="Copy bank address" /> : null}
        </span>
        <span>Updated block: {snapshot?.updatedAtBlock?.toString() ?? "—"}</span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="overflow-x-auto">
            <TabBar tabs={TABS} activeKey={tab} onTabChange={(k) => setTab(k as Tab)} />
          </div>
          <div className="flex items-center gap-3">
            {readOnly ? <span className="text-xs text-amber-400">Read-only mode</span> : null}
            <TxStatusChip status={currentFlow.status} />
          </div>
        </div>

        {!sdk?.account ? (
          <ConnectWalletPrompt action={`${tab} liquidity`} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="border-slate-800 bg-slate-950/40">
              <CardHeader>
                <CardTitle className="text-white">
                  {tab === "deposit"
                    ? `Deposit ${sym}`
                    : tab === "withdraw"
                      ? `Withdraw ${sym}`
                      : `Redeem ${sym} Shares`}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {tab === "deposit"
                    ? "Deposits may trigger an exact ERC20 approval before the bank call."
                    : tab === "withdraw"
                      ? "Withdraw calculates the required shares for the requested asset amount."
                      : "Redeem burns shares directly for assets from the Bank."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="liq-amount" className="text-slate-300">
                    {tab === "redeem" ? "Shares to redeem" : `${sym} amount`}
                  </Label>
                  <Input
                    id="liq-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={readOnly || currentFlow.busy}
                    className="border-slate-700 bg-slate-800/50 text-white"
                  />
                  {tab === "withdraw" && maxWithdrawAmt != null && maxWithdrawAmt > 0n ? (
                    <button
                      type="button"
                      className="text-xs text-emerald-400 hover:underline"
                      onClick={() => setAmount(formatUnits(maxWithdrawAmt, decimals))}
                    >
                      Max: {formatUnits(maxWithdrawAmt, decimals)} {sym}
                    </button>
                  ) : null}
                  {tab === "redeem" && maxRedeemAmt != null && maxRedeemAmt > 0n ? (
                    <button
                      type="button"
                      className="text-xs text-emerald-400 hover:underline"
                      onClick={() => setAmount(formatUnits(maxRedeemAmt, decimals))}
                    >
                      Max: {formatUnits(maxRedeemAmt, decimals)} shares
                    </button>
                  ) : null}
                </div>

                {!writesSupportedForSelectedAsset ? (
                  <ErrorCallout
                    title="Write scope mismatch"
                    message="The current SDK write helpers target the primary asset in the embedded release. Switch back to the primary asset before submitting liquidity actions."
                  />
                ) : null}

                {formError ? <ErrorCallout title="Validation error" message={formError} /> : null}
                {currentActionError ? (
                  <ErrorCallout
                    title="Transaction error"
                    message={currentActionError.message}
                    details={serializeErrorDetails(currentActionError)}
                  />
                ) : null}

                <Button
                  onClick={() => void handleSubmit()}
                  disabled={readOnly || currentFlow.busy || !amount || !writesSupportedForSelectedAsset}
                  className="w-full sm:w-auto"
                >
                  {currentFlow.busy ? "Processing…" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              </CardContent>
            </Card>

            <ActionTrace
              title={actionTraceTitle}
              subtitle={actionTraceSubtitle}
              status={currentFlow.status}
              steps={currentFlow.steps}
              hasActivity={currentFlow.hasActivity}
              error={currentActionError}
              txHash={currentFlow.txHash}
              blockNumber={currentFlow.journalEntry?.blockNumber}
              explorerBaseUrl={explorerBaseUrl}
              onReset={currentFlow.reset}
              idleMessage="Liquidity actions use the standard preflight → stepper → receipt → journal flow."
            />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
