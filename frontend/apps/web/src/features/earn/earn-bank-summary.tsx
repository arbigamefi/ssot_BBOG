import * as React from "react";
import { useTranslations } from "next-intl";
import { formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

export function EarnBankSummary({
  data,
  decimals,
  symbol,
  loading,
  error
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  loading: boolean;
  error?: string;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const snapshot = error ? undefined : data?.snapshot;
  const rows = [
    ["poolCapital", snapshot?.L],
    ["freeCapital", snapshot?.lpFreeCapital],
    ["lockedCapital", snapshot?.K],
    ["pendingPrincipal", snapshot?.P],
    ["grossReserve", snapshot?.R],
    ["bettingCapital", snapshot?.G]
  ] as const;
  return (
    <div className="divide-y divide-border-soft">
      {error ? (
        <p role="alert" className="p-5 text-warn">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="p-5 text-fg-muted">
          {t("earn.nft.loading")}
        </p>
      ) : null}
      {rows.map(([key, value]) => (
        <div key={key} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-fg-subtle">
              {t(`earn.nft.${key}`)}
            </div>
            <p className="mt-1 text-sm text-fg-muted">{t(`earn.nft.${key}Detail`)}</p>
          </div>
          <div className="font-mono text-lg font-bold text-fg">
            {formatTokenAmount(value, decimals, symbol, 4)}
          </div>
        </div>
      ))}
      <p className="px-5 py-4 text-xs text-fg-muted">
        Bank {shortHex(snapshot?.bank)} · Vault {shortHex(snapshot?.vault)}
      </p>
    </div>
  );
}
