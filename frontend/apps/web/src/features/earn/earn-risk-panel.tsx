import * as React from "react";
import { useTranslations } from "next-intl";
import { formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

export function EarnRiskPanel({
  data,
  decimals,
  symbol,
  releaseDigest
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  releaseDigest?: string;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const s = data?.snapshot;
  const rows = [
    ["vaultCash", s?.vaultCash],
    ["bankCash", s?.bankCash],
    ["playerDebt", s?.playerPayableTotal],
    ["protocolDebt", s?.protocolFeesPayable],
    ["referralDebt", s?.externalPayablesTotal],
    ["vaultSurplus", s?.vaultSurplus],
    ["bankSurplus", s?.bankSurplus]
  ] as const;
  return (
    <div className="divide-y divide-border-soft">
      <p className="px-5 py-4 text-sm leading-6 text-fg-muted">{t("earn.nft.riskTerms")}</p>
      {rows.map(([key, value]) => (
        <div key={key} className="flex flex-wrap justify-between gap-3 px-5 py-4">
          <span className="text-sm text-fg-muted">{t(`earn.nft.${key}`)}</span>
          <span className="font-mono font-bold text-fg">
            {formatTokenAmount(value, decimals, symbol, 6)}
          </span>
        </div>
      ))}
      <p className="px-5 py-4 text-sm text-fg-muted">{t("earn.nft.surplusDetail")}</p>
      <p className="px-5 py-4 text-xs text-fg-subtle">
        {t("earn.risk.release.label")}: {shortHex(releaseDigest)}
      </p>
    </div>
  );
}
