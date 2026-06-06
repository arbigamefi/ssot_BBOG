import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ClipboardDocumentCheckIcon,
  CircleStackIcon,
  LockClosedIcon,
  ScaleIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

import { formatBps, formatPctFromBps, formatTokenAmount, shortHex } from "./format";
import type { EarnBankData } from "./types";

export function EarnRiskPanel({
  data,
  decimals,
  symbol,
  releaseDigest,
  embedded = false
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  releaseDigest?: string;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const snapshot = data?.snapshot;
  const freeReserve = snapshot
    ? snapshot.totalAssets > snapshot.totalReserved
      ? snapshot.totalAssets - snapshot.totalReserved
      : 0n
    : undefined;
  const withdrawalBufferBps = snapshot?.withdrawalBufferBps ?? snapshot?.minLiquidityBps;
  const withdrawalBuffer =
    snapshot?.withdrawalBuffer ??
    (snapshot && withdrawalBufferBps != null
      ? (snapshot.totalAssets * BigInt(withdrawalBufferBps)) / 10_000n
      : undefined);

  const rows = (
    <div className="divide-y divide-border-soft">
      <RiskRow
        icon={<LockClosedIcon className="h-5 w-5" />}
        label={t("earn.risk.custody.label")}
        title={t("earn.risk.custody.title")}
        detail={t("earn.risk.custody.detail")}
      />
      <RiskRow
        icon={<CircleStackIcon className="h-5 w-5" />}
        label={t("earn.risk.buffer.label")}
        title={formatTokenAmount(freeReserve, decimals, symbol, 2)}
        detail={t("earn.risk.buffer.detail", {
          reserved: formatTokenAmount(snapshot?.totalReserved, decimals, symbol, 2)
        })}
      />
      <RiskRow
        icon={<ScaleIcon className="h-5 w-5" />}
        label={t("earn.risk.liquidityFloor.label")}
        title={formatPctFromBps(withdrawalBufferBps)}
        detail={t("earn.risk.liquidityFloor.detail", {
          bps: formatBps(withdrawalBufferBps),
          amount: formatTokenAmount(withdrawalBuffer, decimals, symbol, 2)
        })}
      />
      <RiskRow
        label={t("earn.risk.payables.label")}
        title={formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2)}
        detail={t("earn.risk.payables.detail", {
          externalPayables: formatTokenAmount(snapshot?.externalPayablesTotal, decimals, symbol, 2),
          assets: formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2)
        })}
      />
      <RiskRow
        icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
        label={t("earn.risk.release.label")}
        title={shortHex(releaseDigest)}
        detail={t("earn.risk.release.detail")}
      />
    </div>
  );

  if (embedded) return rows;

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-fg">
          <ShieldCheckIcon className="h-5 w-5 text-brand" />
          {t("earn.risk.title")}
        </div>
        <span className="rounded-full border border-border-soft bg-surface-0 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
          {t("earn.risk.readModel")}
        </span>
      </div>
      {rows}
    </section>
  );
}

function RiskRow({
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
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,0.82fr)_minmax(180px,0.55fr)] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {icon}
          {label}
        </div>
        <p className="mt-1 text-sm leading-5 text-fg-muted">{detail}</p>
      </div>
      <h3 className="truncate font-mono text-lg font-bold text-fg sm:text-right" title={title}>
        {title}
      </h3>
    </div>
  );
}
