"use client";

import { NFT_WITHDRAWAL_ONE } from "@ssot/ssot/sdk";

import * as React from "react";

import { useLocale, useTranslations } from "next-intl";
import { type DomainDepositPosition, type DomainDepositWithdrawalQuote } from "@ssot/ssot";
import { formatTokenAmount, shortHex } from "./format";
import { formatUnits, parseDecimalToUnits } from "../betting/model/units";

export function parseWithdrawalPercent(input: string): bigint | undefined {
  try {
    const percent = parseDecimalToUnits(input, 10);
    return percent > 0n && percent <= NFT_WITHDRAWAL_ONE ? percent : undefined;
  } catch {
    return undefined;
  }
}

export function EarnNftPanel({
  items,
  selectedId,
  onSelect,
  percent,
  onPercentChange,
  quote,
  quotePending,
  error,
  connected,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onWithdraw,
  disabled,
  busy,
  decimals,
  symbol
}: {
  items: DomainDepositPosition[];
  selectedId?: bigint;
  onSelect: (id: bigint) => void;
  percent: string;
  onPercentChange: (value: string) => void;
  quote?: DomainDepositWithdrawalQuote;
  quotePending: boolean;
  error: boolean;
  connected: boolean;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onWithdraw: () => void;
  disabled: boolean;
  busy: boolean;
  decimals: number;
  symbol: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const selected = items.find((item) => item.depositId === selectedId);
  const reason = quote?.reason ?? selected?.status;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-fg-muted">{t("earn.nft.withdrawTerms")}</p>
      {!connected ? <p>{t("earn.actions.connectWallet")}</p> : null}
      {loading ? <p role="status">{t("earn.nft.loading")}</p> : null}
      {error ? (
        <p role="alert" className="text-warn">
          {t("earn.nft.unavailable")}
        </p>
      ) : null}
      {connected && !loading && !error && items.length === 0 ? <p>{t("earn.nft.empty")}</p> : null}
      <div className="space-y-2" role="radiogroup" aria-label={t("earn.nft.deposits")}>
        {items.map((item) => (
          <button
            key={item.depositId.toString()}
            type="button"
            role="radio"
            aria-checked={selectedId === item.depositId}
            disabled={busy}
            onClick={() => onSelect(item.depositId)}
            className={`w-full rounded-md border p-3 text-left ${selectedId === item.depositId ? "border-brand bg-brand-soft" : "border-border bg-surface-0"}`}
          >
            <span className="flex justify-between gap-2 font-bold">
              <span>NFT #{item.depositId.toString()}</span>
              <span>{formatTokenAmount(item.assets, decimals, symbol, 6)}</span>
            </span>
            <span className="mt-1 block text-xs text-fg-muted">
              {t("earn.nft.owner")}: {shortHex(item.owner)}
            </span>
            <span className="mt-1 block text-xs text-fg-muted">
              {t("earn.nft.withdrawAfter")}:{" "}
              {new Date(Number(item.withdrawAfter) * 1000).toLocaleString(locale)}
            </span>
            <span className="mt-1 block text-xs text-fg-muted">
              {t("earn.nft.maxNow")}: {formatTokenAmount(item.maxAssets, decimals, symbol, 6)} (
              {formatUnits(item.maxPercent, 10)}%)
            </span>
            <span className="mt-1 block text-xs text-fg-muted">
              {t(`earn.nft.status.${item.status}`)}
            </span>
          </button>
        ))}
      </div>
      {hasMore ? (
        <button
          type="button"
          disabled={loadingMore || busy}
          onClick={onLoadMore}
          className="text-sm font-bold text-brand"
        >
          {t(loadingMore ? "earn.ledger.loadingMore" : "earn.ledger.loadMore")}
        </button>
      ) : null}
      {selected ? (
        <div className="space-y-3 rounded-md border border-border bg-surface-0 p-3">
          <label htmlFor="earn-withdraw-percent" className="block text-sm font-bold">
            {t("earn.nft.percent")}
          </label>
          <div className="flex gap-2">
            <input
              id="earn-withdraw-percent"
              inputMode="decimal"
              value={percent}
              disabled={busy}
              onChange={(event) => onPercentChange(event.target.value)}
              className="w-full min-w-0 rounded border border-border bg-surface-1 p-2"
            />
            <button
              type="button"
              disabled={busy || selected.maxPercent === 0n}
              onClick={() => onPercentChange(formatUnits(selected.maxPercent, 10))}
              className="shrink-0 text-sm font-bold text-brand"
            >
              {t("earn.actions.balance.useMax")}
            </button>
          </div>
          <p className="text-sm text-fg-muted">
            {t("earn.nft.estimated")}: {formatTokenAmount(quote?.assets, decimals, symbol, 6)}
          </p>
          {reason && reason !== "ready" ? (
            <p role="status" className="text-sm text-warn">
              {t(`earn.nft.status.${reason}`)}
            </p>
          ) : null}
          {parseWithdrawalPercent(percent) == null ? (
            <p role="status" className="text-sm text-warn">
              {t("earn.nft.status.invalidPercent")}
            </p>
          ) : null}
          <p className="text-xs leading-5 text-fg-muted">{t("earn.nft.partialRelock")}</p>
          <button
            type="button"
            onClick={onWithdraw}
            disabled={disabled || busy || error || quotePending || !quote?.executable}
            className="w-full rounded-md bg-brand px-4 py-3 font-bold text-fg-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(quote?.closeOnly ? "earn.nft.close" : "earn.nft.withdraw")}
          </button>
        </div>
      ) : null}
      <p className="text-xs leading-5 text-fg-subtle">{t("earn.nft.sharedLimit")}</p>
    </div>
  );
}
