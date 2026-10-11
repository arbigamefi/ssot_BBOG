import Link from "next/link";
import * as React from "react";
import { useTranslations } from "next-intl";
import { formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

/** The pool-wide LP rules (`earn.nft.poolRules.items.<n>` in every locale); the risk disclaimer has the full text. */
const POOL_RULES = [0, 1, 2, 3, 4] as const;

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
      <section aria-labelledby="earn-pool-rules" className="px-5 py-4">
        <h3 id="earn-pool-rules" className="text-sm font-semibold text-fg">
          {t("earn.nft.poolRules.title")}
        </h3>
        <ul className="mt-3 space-y-2">
          {POOL_RULES.map((index) => (
            <li key={index} className="flex gap-3 text-sm leading-6 text-fg-muted">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{t(`earn.nft.poolRules.items.${index}`)}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/legal/disclaimer"
          className="mt-3 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline"
        >
          {t("earn.nft.poolRules.more")}
        </Link>
      </section>
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
