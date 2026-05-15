import * as React from "react";
import { LinkIcon, ShieldCheckIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import type { ReferralMetric } from "./types";

export function ReferralHero({
  wallet,
  metrics
}: {
  wallet: string;
  metrics: readonly ReferralMetric[];
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-accent">
          <UserGroupIcon className="h-4 w-4" />
          Referral registry
        </div>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight text-fg md:text-5xl">
          Affiliate referrals.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-fg-muted">
          Bind an upstream referrer once, generate a wallet-specific invite link, and keep the
          referral control surface tied to the active release manifest.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
              Referral control plane
            </div>
            <div className="mt-2 font-mono text-sm text-fg-muted">{wallet}</div>
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3 text-accent">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-border-soft bg-surface-0 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                  {metric.label}
                </div>
                <LinkIcon className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 font-mono text-xl font-black text-fg">{metric.value}</div>
              <div className="mt-1 text-xs leading-5 text-fg-muted">{metric.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
