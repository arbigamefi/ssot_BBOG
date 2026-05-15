import * as React from "react";
import {
  ArrowPathIcon,
  ClockIcon,
  LockClosedIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";

import { formatTokenAmount, shortHex } from "./format";
import type { ClaimsData } from "./types";

export function ClaimsBuckets({
  data,
  decimals,
  symbol,
  loading,
  error
}: {
  data: ClaimsData;
  decimals: number;
  symbol: string;
  loading: boolean;
  error?: string;
}) {
  const buckets = data.buckets;
  const snapshot = data.snapshot;

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-md border border-border bg-surface-1 shadow-e2">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-black text-fg">
            <SparklesIcon className="h-5 w-5 text-brand" />
            XP bucket ledger
          </div>
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
            {loading ? "syncing" : "read model"}
          </span>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <BucketCard
            icon={<SparklesIcon className="h-5 w-5" />}
            label="Accrued"
            value={formatTokenAmount(buckets?.accrued, decimals, symbol)}
            detail="Claimable XP currently credited to the payee."
          />
          <BucketCard
            icon={<LockClosedIcon className="h-5 w-5" />}
            label="Locked"
            value={formatTokenAmount(buckets?.locked, decimals, symbol)}
            detail="XP that requires unlock conditions before extraction."
          />
          <BucketCard
            icon={<ClockIcon className="h-5 w-5" />}
            label="Holdback"
            value={formatTokenAmount(buckets?.holdback, decimals, symbol)}
            detail="Pending buffer awaiting a holdback sync."
          />
          <BucketCard
            icon={<ArrowPathIcon className="h-5 w-5" />}
            label="Releasable"
            value={formatTokenAmount(buckets?.holdbackReleasable, decimals, symbol)}
            detail="Holdback amount currently releasable by protocol rules."
          />
        </div>

        {error ? (
          <div className="border-t border-border px-5 py-4 text-sm text-danger">{error}</div>
        ) : null}
      </div>

      <div className="grid gap-4">
        <BucketCard
          label="Protocol fees"
          value={formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2)}
          detail={`External payables ${formatTokenAmount(
            snapshot?.externalPayablesTotal,
            decimals,
            symbol,
            2
          )}`}
        />
        <BucketCard
          label="Bank reference"
          value={shortHex(snapshot?.bank)}
          detail={`Reserved ${formatTokenAmount(snapshot?.totalReserved, decimals, symbol, 2)} · Assets ${formatTokenAmount(
            snapshot?.totalAssets,
            decimals,
            symbol,
            2
          )}`}
        />
      </div>
    </section>
  );
}

function BucketCard({
  icon,
  label,
  value,
  detail
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-5 shadow-e1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-mono text-2xl font-black text-fg">{value}</div>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{detail}</p>
    </div>
  );
}
