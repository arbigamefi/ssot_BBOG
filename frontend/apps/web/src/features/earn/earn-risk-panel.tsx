import * as React from "react";
import { useTranslations } from "next-intl";
import { ClipboardDocumentCheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";

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
}) {
  const t = useTranslations();
  const snapshot = data?.snapshot;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <RiskCard
        icon={<LockClosedIcon className="h-5 w-5" />}
        label={t("earn.risk.custody.label")}
        title={t("earn.risk.custody.title")}
        detail={t("earn.risk.custody.detail")}
      />
      <RiskCard
        icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
        label={t("earn.risk.release.label")}
        title={shortHex(releaseDigest)}
        detail={t("earn.risk.release.detail")}
      />
      <RiskCard
        label={t("earn.risk.protocolFees.label")}
        title={formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2)}
        detail={t("earn.risk.protocolFees.detail", {
          externalPayables: formatTokenAmount(snapshot?.externalPayablesTotal, decimals, symbol, 2),
          assets: formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2)
        })}
      />
    </section>
  );
}

function RiskCard({
  icon,
  label,
  title,
  detail
}: {
  icon?: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <h3 className="mt-3 text-xl font-black text-fg">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{detail}</p>
    </div>
  );
}
