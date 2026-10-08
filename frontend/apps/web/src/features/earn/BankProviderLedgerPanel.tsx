import * as React from "react";
import { useTranslations } from "next-intl";
import type { EarnProviderLedgerEntry } from "./types";
import { formatTokenAmount, shortHex } from "./format";

export function BankProviderLedgerPanel({
  connected,
  decimals,
  entries,
  error,
  explorerBaseUrl,
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  cashFlowComplete = false,
  symbol
}: {
  connected: boolean;
  decimals: number;
  entries: EarnProviderLedgerEntry[];
  error?: string;
  explorerBaseUrl?: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  cashFlowComplete?: boolean;
  symbol: string;
}) {
  const t = useTranslations();
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <h2 className="text-lg font-bold">{t("earn.nft.history")}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{t("earn.nft.historyDetail")}</p>
      </div>
      {!connected ? <p className="p-5">{t("earn.actions.connectWallet")}</p> : null}
      {error ? (
        <p role="alert" className="p-5 text-warn">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="p-5">
          {t("earn.nft.loading")}
        </p>
      ) : null}
      {connected && !loading && !error && entries.length === 0 ? (
        <p className="p-5 text-fg-muted">{t("earn.nft.historyEmpty")}</p>
      ) : null}
      <div className="divide-y divide-border-soft">
        {entries.map((entry) => (
          <article key={entry.id} className="space-y-2 p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-bold">
                {t(`earn.nft.action.${entry.action}`)} · NFT #{entry.depositId.toString()}
              </span>
              <span className="font-mono">
                {entry.action === "transfer"
                  ? t("earn.nft.noCashFlow")
                  : formatTokenAmount(entry.assets, decimals, symbol, 6)}
              </span>
            </div>
            {entry.action === "deposit" ? (
              <p className="text-xs text-fg-muted">
                {t("earn.nft.payer")}: {shortHex(entry.payer)} · {t("earn.nft.initialOwner")}:{" "}
                {shortHex(entry.owner)}
              </p>
            ) : null}
            {entry.action === "withdraw" ? (
              <p className="text-xs text-fg-muted">
                {t("earn.nft.receiver")}: {shortHex(entry.owner)}
              </p>
            ) : null}
            {entry.action === "transfer" ? (
              <p className="text-xs text-fg-muted">
                {shortHex(entry.from)} → {shortHex(entry.to)}
              </p>
            ) : null}
            {explorerBaseUrl ? (
              <a
                href={`${explorerBaseUrl}/tx/${entry.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-brand"
              >
                {t("earn.toast.viewTransaction")}
              </a>
            ) : null}
          </article>
        ))}
      </div>
      {connected && !cashFlowComplete ? (
        <p className="px-5 py-3 text-xs text-fg-subtle">{t("earn.nft.historyIncomplete")}</p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
          className="m-5 font-bold text-brand"
        >
          {t(loadingMore ? "earn.ledger.loadingMore" : "earn.ledger.loadMore")}
        </button>
      ) : null}
    </section>
  );
}
