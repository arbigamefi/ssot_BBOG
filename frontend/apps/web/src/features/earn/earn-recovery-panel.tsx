import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DomainRecoveryPosition } from "@ssot/ssot";
import { formatTokenAmount } from "./format";

export function EarnRecoveryPanel({
  items,
  connected,
  receiver,
  snapshotBlock,
  snapshotTime,
  complete,
  loading,
  loadingMore,
  hasMore,
  error,
  paused,
  disabled,
  busy,
  decimals,
  symbol,
  onLoadMore,
  onRefresh,
  onClaim
}: {
  items: readonly DomainRecoveryPosition[];
  connected: boolean;
  receiver?: string;
  snapshotBlock?: bigint;
  snapshotTime?: bigint;
  complete: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  paused: boolean;
  disabled: boolean;
  busy: boolean;
  decimals: number;
  symbol: string;
  onLoadMore: () => void;
  onRefresh: () => void;
  onClaim: (epochId: bigint) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const snapshotDate = snapshotTime == null ? null : new Date(Number(snapshotTime) * 1000);
  const buttonClass =
    "min-h-11 rounded-md border border-border px-4 py-3 text-sm font-bold text-fg transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <section
      aria-labelledby="earn-recovery-title"
      className="rounded-md border border-border bg-surface-1 p-5 shadow-e2"
    >
      <h2 id="earn-recovery-title" className="text-lg font-bold text-fg">
        {t("earn.recovery.title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{t("earn.recovery.detail")}</p>
      {snapshotBlock != null && snapshotDate && !Number.isNaN(snapshotDate.getTime()) ? (
        <p className="mt-2 text-xs text-fg-subtle">
          {t("earn.recovery.snapshot", {
            block: snapshotBlock.toString(),
            time: snapshotDate.toLocaleString(locale)
          })}
        </p>
      ) : null}
      {!connected ? (
        <p className="mt-3 text-sm text-fg-muted">{t("earn.actions.connectWallet")}</p>
      ) : (
        <>
          {receiver ? (
            <p className="mt-3 break-all text-xs leading-5 text-fg-muted">
              {t("earn.recovery.receiver", { receiver })}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="mt-3 text-sm text-fg-muted">
              {t("earn.recovery.loading")}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-warn">
              {t("earn.recovery.error")}
            </p>
          ) : null}
          {!loading && !complete ? (
            <p role="status" className="mt-3 text-sm text-warn">
              {t("earn.recovery.incomplete")}
            </p>
          ) : null}
          {!loading && complete && items.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">{t("earn.recovery.empty")}</p>
          ) : null}
          <div className="mt-4 space-y-4">
            {items.map((item) => (
              <section
                key={item.epochId.toString()}
                aria-label={t("earn.recovery.epoch", { epoch: item.epochId.toString() })}
                className="rounded-md border border-border bg-surface-0 p-4"
              >
                <h3 className="font-bold text-fg">
                  {t("earn.recovery.epoch", { epoch: item.epochId.toString() })}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-fg-muted">{t("earn.recovery.units")}</dt>
                    <dd className="mt-1 break-all font-mono text-fg">
                      {formatTokenAmount(item.shares, decimals, undefined, 6)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted">{t("earn.recovery.claimable")}</dt>
                    <dd className="mt-1 break-all font-mono text-fg">
                      {formatTokenAmount(item.claimableAssets, decimals, symbol, decimals)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted">{t("earn.recovery.upperBound")}</dt>
                    <dd className="mt-1 break-all font-mono text-fg">
                      {formatTokenAmount(item.pendingAssets, decimals, symbol, decimals)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-5 text-fg-muted">
                  {t("earn.recovery.upperBoundDetail")}
                </p>
                <p className="mt-2 text-sm text-fg-muted">
                  {item.remainingHolds > 0n
                    ? t("earn.recovery.remainingHolds", { count: item.remainingHolds.toString() })
                    : t("earn.recovery.settled")}
                </p>
                {paused ? <p className="mt-2 text-xs text-warn">{t("earn.async.paused")}</p> : null}
                <button
                  type="button"
                  className={`${buttonClass} mt-3`}
                  disabled={disabled || busy || paused || error || item.claimableAssets === 0n}
                  onClick={() => onClaim(item.epochId)}
                >
                  {t("earn.recovery.claim")}
                </button>
              </section>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {hasMore ? (
              <button
                type="button"
                className={buttonClass}
                disabled={loadingMore || busy}
                onClick={onLoadMore}
              >
                {t(loadingMore ? "earn.ledger.loadingMore" : "earn.recovery.loadMore")}
              </button>
            ) : null}
            <button
              type="button"
              className={buttonClass}
              disabled={loading || busy}
              onClick={onRefresh}
            >
              {t("earn.recovery.refresh")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
