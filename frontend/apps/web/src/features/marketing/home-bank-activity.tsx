import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, CircleStackIcon } from "@heroicons/react/24/outline";

import type { LandingActivity } from "./home-types";

export function HomeBankAndActivity({
  reserveFloor,
  totalAssets,
  releaseDigest,
  activity
}: {
  reserveFloor: string;
  totalAssets: string;
  releaseDigest?: string;
  activity: readonly LandingActivity[];
}) {
  return (
    <section className="border-b border-border bg-surface-1 py-20">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <BankReservePanel
          reserveFloor={reserveFloor}
          totalAssets={totalAssets}
          releaseDigest={releaseDigest}
        />
        <ActivityPanel activity={activity} />
      </div>
    </section>
  );
}

function BankReservePanel({
  reserveFloor,
  totalAssets,
  releaseDigest
}: {
  reserveFloor: string;
  totalAssets: string;
  releaseDigest?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-6 shadow-e2">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-accent">
        <CircleStackIcon className="h-4 w-4" />
        Bank reserve
      </div>
      <h2 className="text-4xl font-black tracking-normal text-fg md:text-5xl">
        Reserve ledger before marketing yield.
      </h2>
      <p className="mt-5 text-base leading-7 text-fg-muted">
        Bank balances and reserved liabilities are displayed from protocol reads. The page does not
        invent APY or hide pending obligations behind a promotional number.
      </p>

      <div className="mt-8 grid gap-3">
        <BankMetric label="Free reserve" value={reserveFloor} />
        <BankMetric label="Total bank assets" value={totalAssets} />
        <BankMetric label="Release digest" value={releaseDigest ?? "Pending"} mono />
      </div>

      <Link
        href="/earn"
        className="mt-8 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-fg transition hover:border-accent/50 hover:text-accent"
      >
        Inspect bank <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ActivityPanel({ activity }: { activity: readonly LandingActivity[] }) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-6 shadow-e2">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            Protocol activity
          </div>
          <h2 className="mt-2 text-2xl font-black text-fg">Latest indexed tickets</h2>
        </div>
        <Link
          href="/portfolio/activity"
          className="text-sm font-bold text-brand hover:text-brand-hover"
        >
          View all
        </Link>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[1fr_1.1fr_96px_72px] border-b border-border bg-surface-2 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>Player</div>
          <div>Room</div>
          <div className="text-right">State</div>
          <div className="text-right">Age</div>
        </div>
        {activity.length > 0 ? (
          activity.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_1.1fr_96px_72px] items-center border-b border-border-soft px-4 py-4 text-sm last:border-b-0"
            >
              <div className="font-mono text-fg-muted">{item.player}</div>
              <div className="font-bold text-fg">{item.game}</div>
              <div className="text-right">
                <span className="rounded-sm border border-border-soft bg-surface-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fg-muted">
                  {item.state}
                </span>
              </div>
              <div className="text-right font-mono text-xs text-fg-subtle">{item.time}</div>
            </div>
          ))
        ) : (
          <div className="px-4 py-12 text-center text-sm text-fg-muted">
            No indexed tickets in this browser session yet.
          </div>
        )}
      </div>
    </div>
  );
}

function BankMetric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-2 font-black text-fg ${mono ? "font-mono text-sm" : "text-xl"}`}>
        {value}
      </div>
    </div>
  );
}
