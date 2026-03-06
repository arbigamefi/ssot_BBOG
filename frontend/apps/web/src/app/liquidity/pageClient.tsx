"use client";

import * as React from "react";

import type { DomainBankSnapshot, DomainBankPosition } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  AssetSelector,
  type AssetOption,
  Button,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  StatCard,
  TabBar,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";

type Tab = "deposit" | "withdraw" | "redeem";

const TABS = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "redeem", label: "Redeem" },
];

export function LiquidityPageClient() {
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();

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
    () => (release?.assets[0]?.address as `0x${string}`) ?? (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(
    () => release?.assets.find((a) => a.address.toLowerCase() === asset.toLowerCase()),
    [release?.assets, asset]
  );
  const decimals = assetMeta?.decimals ?? 18;

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
  }, [sdk, ready, asset]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Tab + form state
  const [tab, setTab] = React.useState<Tab>("deposit");
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | undefined>();

  // Max values
  const [maxWithdrawAmt, setMaxWithdrawAmt] = React.useState<bigint | null>(null);
  const [maxRedeemAmt, setMaxRedeemAmt] = React.useState<bigint | null>(null);

  React.useEffect(() => {
    if (!sdk || !sdk.account) return;
    const acct = sdk.account;
    if (tab === "withdraw") {
      void sdk.bank.maxWithdraw(acct).then(setMaxWithdrawAmt).catch(() => setMaxWithdrawAmt(null));
    } else if (tab === "redeem") {
      void sdk.bank.maxRedeem(acct).then(setMaxRedeemAmt).catch(() => setMaxRedeemAmt(null));
    }
  }, [sdk, tab, snapshot]);

  React.useEffect(() => {
    setAmount("");
    setFormError(undefined);
  }, [tab]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);
    const acct = sdk.account;

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError("Amount must be positive");
        return;
      }
      setBusy(true);

      if (tab === "deposit") {
        const res = await sdk.bank.deposit(parsed, acct);
        if (!res.ok) { setFormError(res.error?.message ?? "Deposit failed"); return; }
        toast.success(`Deposited ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`, {
          description: res.shares != null ? `Received ${formatUnits(res.shares, decimals)} shares` : undefined,
        });
      } else if (tab === "withdraw") {
        const res = await sdk.bank.withdraw(parsed, acct, acct);
        if (!res.ok) { setFormError(res.error?.message ?? "Withdraw failed"); return; }
        toast.success(`Withdrew ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`);
      } else {
        const res = await sdk.bank.redeem(parsed, acct, acct);
        if (!res.ok) { setFormError(res.error?.message ?? "Redeem failed"); return; }
        toast.success(`Redeemed ${formatUnits(parsed, decimals)} shares`);
      }
      setAmount("");
      void fetchData();
    } catch (e) {
      setFormError((e as Error)?.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }, [sdk, readOnly, tab, amount, decimals, assetMeta, fetchData]);

  if (!release) {
    return (
      <Placeholder title="Liquidity" description={readOnlyReason ?? "No embedded release available."} specPath="docs/frontend/PAGE-SPECS/030-LIQUIDITY.md" />
    );
  }

  const sym = assetMeta?.symbol ?? "???";
  const freeLiq = snapshot ? snapshot.totalAssets - snapshot.totalReserved : 0n;

  return (
    <PageTransition pageKey="liquidity">
      <PageHeader
        title="Liquidity"
        description="Provide liquidity to earn yield as the house. Your deposits back all on-chain bets."
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading} className="border-slate-700 text-slate-300 hover:text-white">
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {/* Asset selector */}
      <div className="mb-6">
        <AssetSelector assets={assetOptions} value={asset} onValueChange={setAsset} showAddress />
      </div>

      {loadError && <ErrorCallout title="Load error" message={loadError} />}

      {/* Stats ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="🏦"
          label={`Total Assets (${sym})`}
          value={snapshot ? formatUnits(snapshot.totalAssets, decimals) : "—"}
        />
        <StatCard
          icon="🔒"
          label="Reserved"
          value={snapshot ? formatUnits(snapshot.totalReserved, decimals) : "—"}
        />
        <StatCard
          icon="💧"
          label="Free Liquidity"
          value={snapshot ? formatUnits(freeLiq, decimals) : "—"}
        />
        <StatCard
          icon="📊"
          label="Your Shares"
          value={position ? formatUnits(position.shares, decimals) : sdk?.account ? "0" : "—"}
          subValue={position ? `≈ ${formatUnits(position.assetsEquivalent, decimals)} ${sym}` : undefined}
        />
      </div>

      {/* Actions panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <TabBar tabs={TABS} activeKey={tab} onTabChange={(k) => setTab(k as Tab)} />
          {readOnly && <span className="text-xs text-amber-400">Read-only mode</span>}
        </div>

        {!sdk?.account ? (
          <ConnectWalletPrompt action={`${tab} liquidity`} />
        ) : (
          <div className="space-y-4">
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
                disabled={readOnly}
                className="bg-slate-800/50 border-slate-700 text-white"
              />
              {tab === "withdraw" && maxWithdrawAmt != null && maxWithdrawAmt > 0n && (
                <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setAmount(formatUnits(maxWithdrawAmt, decimals))}>
                  Max: {formatUnits(maxWithdrawAmt, decimals)} {sym}
                </button>
              )}
              {tab === "redeem" && maxRedeemAmt != null && maxRedeemAmt > 0n && (
                <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setAmount(formatUnits(maxRedeemAmt, decimals))}>
                  Max: {formatUnits(maxRedeemAmt, decimals)} shares
                </button>
              )}
            </div>

            {formError && <ErrorCallout title="Error" message={formError} />}

            <Button
              onClick={() => void handleSubmit()}
              disabled={readOnly || busy || !amount}
              className="w-full sm:w-auto"
            >
              {busy ? "Processing…" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
