"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DepositCursor, DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";
import { isLpDepositEnabledForChain } from "../../../app-shell/casino-access";
import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import {
  EarnActionPanel,
  EarnMobileActions,
  type EarnFlowState
} from "../../../features/earn/earn-action-panel";
import { EarnNftPanel, parseWithdrawalPercent } from "../../../features/earn/earn-nft-panel";
import { EarnBankDetails } from "../../../features/earn/earn-bank-details";
import { EarnHero } from "../../../features/earn/earn-hero";
import { buildEarnHeroMetrics } from "../../../features/earn/earn-hero-metrics";
import { BankProviderLedgerPanel } from "../../../features/earn/BankProviderLedgerPanel";
import { BankrollPerformancePanel } from "../../../features/earn/BankrollPerformancePanel";
import { useBankProviderLedger } from "../../../features/earn/useBankProviderLedger";
import { GovernanceQueuePanel } from "../../../features/governance/governance-queue-panel";
import { formatTokenAmount, getExplorerBaseUrl, shortHex } from "../../../features/earn/format";
import type { EarnTab } from "../../../features/earn/types";
import { getPoolAssetContext, type PoolAssetContext } from "../../../features/assets/pool-asset";
import { formatUnits, parseDecimalToUnits } from "../../../features/betting/model/units";
import {
  thrownErrorMessage,
  TxCopyError,
  txErrorMessage
} from "../../../features/tx/tx-error-copy";
import { useDirectTxAction, useSequencedTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";

/** SDK codes whose Earn-specific copy already exists. */
const EARN_ERROR_COPY: Readonly<Record<string, string>> = {
  NOT_DEPOSIT_OWNER: "earn.nft.ownerChanged",
  INSUFFICIENT_FREE_CAPITAL: "earn.nft.status.insufficientFreeCapital",
  LP_UNAVAILABLE: "earn.nft.unavailable",
  NFT_WITHDRAWAL_UNAVAILABLE: "earn.nft.unavailable"
};

export function EarnPageClient() {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const queryClient = useQueryClient();
  const contexts = React.useMemo(
    () =>
      release?.pools
        .map((pool) => getPoolAssetContext(release, pool))
        .filter((context): context is PoolAssetContext =>
          Boolean(context?.bank && context.pool.vault)
        ) ?? [],
    [release]
  );
  const scope = `${chainId}:${release?.releaseDigest ?? ""}:${sdk?.account ?? ""}`;
  const [selection, setSelection] = React.useState<{ scope: string; key: string }>();
  const keyOf = (context: PoolAssetContext) =>
    `${context.poolId}:${context.bank}:${context.pool.vault}`;
  const context =
    (selection?.scope === scope
      ? contexts.find((item) => keyOf(item) === selection.key)
      : undefined) ?? contexts[0];
  const poolId = context?.poolId;
  const poolKey = context ? keyOf(context) : "";
  const decimals = context?.asset.decimals ?? 6;
  const symbol = context?.asset.symbol ?? t("earn.format.assetFallback");
  const [tab, setTab] = React.useState<EarnTab>("deposit");
  const [input, setInput] = React.useState({ scope: "", amount: "" });
  const inputScope = `${scope}:${poolKey}`;
  const amount = input.scope === inputScope ? input.amount : "";
  const setAmount = (value: string) => setInput({ scope: inputScope, amount: value });
  const [withdrawal, setWithdrawal] = React.useState<{
    scope: string;
    id: bigint;
    percent: string;
  }>();
  const actionPanelRef = React.useRef<HTMLDivElement>(null);
  const inFlight = React.useRef(false);
  const [submitting, setSubmitting] = React.useState(false);
  const enabled = Boolean(sdk && ready && poolId && context);
  const snapshotQuery = useQuery({
    queryKey: ["ssot", "earn", "snapshot", scope, poolKey],
    enabled,
    queryFn: async () => {
      const value = await sdk!.bank.getSnapshot(poolId!);
      if (
        value.bank.toLowerCase() !== context!.bank ||
        value.vault.toLowerCase() !== context!.pool.vault!.toLowerCase()
      )
        throw new Error(t("earn.nft.unavailable"));
      return value;
    },
    staleTime: 10_000,
    refetchInterval: 15_000
  });
  const snapshot = snapshotQuery.error ? undefined : snapshotQuery.data;
  const deposits = useInfiniteQuery({
    queryKey: ["ssot", "earn", "deposits", inputScope, snapshot?.updatedAtBlock.toString()],
    enabled: Boolean(enabled && sdk?.account && snapshot),
    initialPageParam: undefined as DepositCursor | undefined,
    queryFn: ({ pageParam }) =>
      sdk!.vault.getDeposits(poolId!, sdk!.account!, {
        cursor: pageParam,
        limit: 25,
        blockNumber: snapshot!.updatedAtBlock
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000
  });
  const items = deposits.error ? [] : (deposits.data?.pages.flatMap((page) => page.items) ?? []);
  const selected =
    (withdrawal?.scope === inputScope
      ? items.find((item) => item.depositId === withdrawal.id)
      : undefined) ?? items[0];
  const percent =
    withdrawal?.scope === inputScope && selected?.depositId === withdrawal.id
      ? withdrawal.percent
      : "100";
  const parsedPercent = parseWithdrawalPercent(percent);
  const setPercent = (value: string) => {
    if (selected) setWithdrawal({ scope: inputScope, id: selected.depositId, percent: value });
  };
  const quoteQuery = useQuery({
    queryKey: [
      "ssot",
      "earn",
      "withdrawQuote",
      inputScope,
      selected?.depositId.toString(),
      parsedPercent?.toString(),
      snapshot?.updatedAtBlock.toString()
    ],
    enabled: Boolean(enabled && snapshot && selected && parsedPercent != null),
    queryFn: () =>
      sdk!.vault.quoteWithdrawal(poolId!, selected!.depositId, parsedPercent!, {
        blockNumber: snapshot!.updatedAtBlock
      }),
    staleTime: 10_000
  });
  const quote = quoteQuery.error || parsedPercent == null ? undefined : quoteQuery.data;
  const wallet = useQuery({
    queryKey: ["ssot", "earn", "wallet", inputScope],
    enabled: Boolean(enabled && sdk?.account),
    queryFn: () => sdk!.bank.getAssetBalance(context!.asset.address, sdk!.account!),
    refetchInterval: 15_000
  });
  const ledger = useBankProviderLedger({
    sdk,
    poolId,
    enabled: Boolean(snapshot),
    endBlock: snapshot?.updatedAtBlock
  });
  const depositFlow = useSequencedTxAction({
    finalAction: "DEPOSIT",
    errorMessage: t("earn.toast.failed"),
    steps: [
      { key: "preflight", title: t("earn.flows.preflight.title") },
      {
        key: "approve",
        title: t("earn.flows.deposit.approveTitle"),
        description: t("earn.nft.approveVault"),
        action: "APPROVE_DEPOSIT",
        optional: true
      },
      { key: "deposit", title: t("earn.actions.submit.deposit"), action: "DEPOSIT" }
    ]
  });
  const labels = {
    preflight: t("earn.flows.preflight.title"),
    submit: t("earn.nft.sign"),
    confirm: t("earn.nft.confirm")
  };
  const withdrawalFlow = useDirectTxAction({
    action: "WITHDRAW",
    labels,
    errorMessage: t("earn.toast.failed")
  });
  const currentFlow = tab === "deposit" ? depositFlow : withdrawalFlow;
  const busy = submitting || depositFlow.busy || withdrawalFlow.busy;
  const flow: EarnFlowState = {
    ...currentFlow,
    busy,
    blockNumber: currentFlow.journalEntry?.blockNumber
  };
  // ADR-0037 §9 D1: LPs deposit while the pool is registered but betting has not started; only the
  // Bank pause (riskInPaused) closes deposits on-chain.
  const depositsEnabled = isLpDepositEnabledForChain(chainId);
  // SDK results and our own refusals (TxCopyError) carry a code; no thrown text reaches the toast.
  const errorCopy = (error: DomainError | undefined) => txErrorMessage(t, error, EARN_ERROR_COPY);
  const writable = Boolean(ready && sdk?.account && poolId && !readOnly);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] }),
      queryClient.invalidateQueries({ queryKey: ["ssot", "account", "assets"] }),
      queryClient.invalidateQueries({ queryKey: ["ssot", "landing", "asset-overview"] })
    ]);

  const submit = async (action: "deposit" | "withdraw") => {
    if (inFlight.current || busy || !writable || !sdk?.account || !poolId || !context) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const account = sdk.account;
      const result =
        action === "deposit"
          ? await depositFlow.execute(async () => {
              if (!depositsEnabled) throw new TxCopyError("earn.actions.depositsClosed.title");
              let assets: bigint;
              try {
                assets = parseDecimalToUnits(amount, decimals);
              } catch {
                throw new TxCopyError("app.txErrors.invalidAmount", { decimals });
              }
              if (assets <= 0n) throw new TxCopyError("earn.errors.positiveAmount");
              const [fresh, balance] = await Promise.all([
                sdk.bank.getSnapshot(poolId),
                sdk.bank.getAssetBalance(context.asset.address, account)
              ]).catch(() => {
                // A failed read never reaches the toast as provider text.
                throw new TxCopyError("earn.nft.unavailable");
              });
              if (fresh.riskInPaused) throw new TxCopyError("earn.nft.depositsPaused");
              if (fresh.lpStatus !== "ready")
                throw new TxCopyError(`earn.nft.status.${fresh.lpStatus}`);
              if (assets > balance) throw new TxCopyError("earn.errors.insufficientWalletBalance");
              return sdk.vault.addDeposit(poolId, assets, account);
            })
          : await withdrawalFlow.execute(async () => {
              if (!selected || parsedPercent == null)
                throw new TxCopyError("earn.nft.status.invalidPercent");
              const fresh = await sdk.vault
                .quoteWithdrawal(poolId, selected.depositId, parsedPercent)
                .catch(() => {
                  throw new TxCopyError("earn.nft.unavailable");
                });
              if (fresh.position.owner.toLowerCase() !== account.toLowerCase())
                throw new TxCopyError("earn.nft.ownerChanged");
              if (!fresh.executable)
                throw new TxCopyError(`earn.nft.status.${fresh.reason ?? fresh.position.status}`);
              return sdk.vault.withdrawDeposit(poolId, selected.depositId, parsedPercent);
            });
      if (!result.ok) {
        toast.error(errorCopy(result.error));
        return;
      }
      toast.success(t(action === "deposit" ? "earn.nft.deposited" : "earn.nft.withdrawn"));
      if (action === "deposit") setAmount("");
      await refresh();
    } catch (error) {
      toast.error(thrownErrorMessage(t, error, "earn.toast.failed"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  if (!release)
    return (
      <ProductStateCard
        title={t("earn.state.noRelease.title")}
        description={readOnlyReason ?? t("earn.state.noRelease.description")}
      />
    );
  return (
    <PageTransition pageKey="earn">
      <div className="space-y-8 pb-28 lg:pb-0">
        <EarnHero
          symbol={symbol}
          bankAddress={shortHex(snapshot?.vault)}
          metrics={buildEarnHeroMetrics({ snapshot, decimals, symbol, t })}
        />
        <GovernanceQueuePanel />
        <BankrollPerformancePanel
          assetAddress={context?.asset.address}
          assetDecimals={decimals}
          assetSymbol={symbol}
          chainPerformance={snapshot}
          vaultAssets={snapshot?.L}
          showIndexedHistory={
            contexts.filter((item) => item.asset.address === context?.asset.address).length === 1
          }
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
          <EarnBankDetails
            data={snapshot ? { snapshot } : undefined}
            decimals={decimals}
            symbol={symbol}
            loading={snapshotQuery.isLoading}
            error={snapshotQuery.error ? t("earn.nft.unavailable") : undefined}
            releaseDigest={release.releaseDigest}
          />
          <div
            id="earn-actions"
            ref={actionPanelRef}
            tabIndex={-1}
            className="min-w-0 scroll-mt-24 outline-none xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1"
          >
            <EarnActionPanel
              tab={tab}
              onTabChange={setTab}
              pools={contexts.map((item) => ({
                key: keyOf(item),
                label: `${item.asset.symbol} · #${item.poolId}`
              }))}
              poolKey={poolKey}
              onPoolChange={(key) => setSelection({ scope, key })}
              amount={amount}
              onAmountChange={setAmount}
              symbol={symbol}
              disabled={
                !writable ||
                !depositsEnabled ||
                snapshot?.riskInPaused !== false ||
                snapshot.lpStatus !== "ready" ||
                busy ||
                !amount
              }
              readOnly={readOnly}
              unsupportedAsset={!context}
              availableLabel={t("earn.actions.balance.wallet")}
              availableValue={formatTokenAmount(
                wallet.error ? undefined : wallet.data,
                decimals,
                symbol,
                6
              )}
              canUseMax={!wallet.error && wallet.data != null && wallet.data > 0n && !busy}
              onUseMax={() => {
                if (wallet.data != null) setAmount(formatUnits(wallet.data, decimals));
              }}
              flow={flow}
              onSubmit={() => void submit("deposit")}
              connected={Boolean(sdk?.account)}
              depositsClosed={!depositsEnabled}
              notice={
                <div className="space-y-2 text-sm leading-6 text-fg-muted">
                  <p>{t("earn.nft.depositTerms")}</p>
                  {snapshot?.riskInPaused ? (
                    <p role="status" className="text-warn">
                      {t("earn.nft.depositsPaused")}
                    </p>
                  ) : snapshot?.lpStatus && snapshot.lpStatus !== "ready" ? (
                    <p role="status" className="text-warn">
                      {t(`earn.nft.status.${snapshot.lpStatus}`)}
                    </p>
                  ) : null}
                  {snapshot?.poolActive === false ? (
                    <p role="status" className="text-fg" data-testid="earn-betting-inactive">
                      {t(
                        snapshot.totalBetsHeld === 0n
                          ? "earn.nft.bettingNotStarted"
                          : "earn.nft.bettingStopped"
                      )}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void refresh()}
                    className="font-bold text-brand"
                  >
                    {t("earn.nft.refresh")}
                  </button>
                </div>
              }
              withdrawContent={
                <EarnNftPanel
                  items={items}
                  selectedId={selected?.depositId}
                  onSelect={(id) => setWithdrawal({ scope: inputScope, id, percent: "100" })}
                  percent={percent}
                  onPercentChange={setPercent}
                  quote={quote}
                  quotePending={quoteQuery.isFetching}
                  error={Boolean(deposits.error || quoteQuery.error || snapshotQuery.error)}
                  connected={Boolean(sdk?.account)}
                  loading={deposits.isLoading}
                  hasMore={Boolean(deposits.hasNextPage)}
                  loadingMore={deposits.isFetchingNextPage}
                  onLoadMore={() => void deposits.fetchNextPage()}
                  onWithdraw={() => void submit("withdraw")}
                  disabled={!writable || !snapshot}
                  busy={busy}
                  decimals={decimals}
                  symbol={symbol}
                />
              }
            />
          </div>
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <BankProviderLedgerPanel
              connected={Boolean(sdk?.account)}
              decimals={decimals}
              entries={ledger.entries}
              error={ledger.error ? t("earn.nft.unavailable") : undefined}
              explorerBaseUrl={getExplorerBaseUrl(chainId)}
              hasMore={Boolean(ledger.hasNextPage)}
              loading={ledger.isLoading}
              loadingMore={ledger.isFetchingNextPage}
              onLoadMore={() => void ledger.fetchNextPage()}
              cashFlowComplete={ledger.coverageComplete}
              symbol={symbol}
            />
          </div>
        </div>
      </div>
      <EarnMobileActions
        tab={tab}
        onTabChange={(value) => {
          setTab(value);
          actionPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </PageTransition>
  );
}
