import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CircleStackIcon,
  CodeBracketSquareIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

import { shortDigest } from "./format";

export function HomeHero({
  reserveFloor,
  totalAssets,
  releaseDigest,
  roomCount,
  copy
}: {
  reserveFloor: string;
  totalAssets: string;
  releaseDigest?: string;
  roomCount: number;
  copy: {
    channel: string;
    title: string;
    description: string;
    enterCasino: string;
    viewBank: string;
    consoleLabel: string;
    live: string;
    metrics: {
      freeReserve: string;
      bankAssets: string;
      rooms: string;
    };
    proofRows: Array<{
      title: string;
      detail: string;
    }>;
    pendingDigest: string;
  };
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface-0">
      <div className="mx-auto grid min-h-[calc(100vh-88px)] max-w-[1440px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)] lg:items-center lg:px-10">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fg-muted shadow-e1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {copy.channel}
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[1.03] tracking-normal text-fg md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-fg-muted md:text-xl">
            {copy.description}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/casino"
              className="inline-flex items-center justify-center gap-3 rounded-md bg-brand px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover"
            >
              {copy.enterCasino} <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/earn"
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface-1 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg transition hover:bg-surface-2"
            >
              {copy.viewBank}
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-lg border border-border bg-surface-1 shadow-e3">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">
                  {copy.consoleLabel}
                </div>
                <div className="mt-1 font-mono text-sm text-fg-muted">
                  {shortDigest(releaseDigest, copy.pendingDigest)}
                </div>
              </div>
              <div className="rounded-md border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-accent">
                {copy.live}
              </div>
            </div>

            <div className="grid grid-cols-1 border-b border-border md:grid-cols-3">
              <HeroMetric
                icon={<CircleStackIcon className="h-5 w-5" />}
                label={copy.metrics.freeReserve}
                value={reserveFloor}
              />
              <HeroMetric label={copy.metrics.bankAssets} value={totalAssets} />
              <HeroMetric label={copy.metrics.rooms} value={roomCount.toString()} />
            </div>

            <div className="grid gap-3 p-5">
              <ProofRow
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                title={copy.proofRows[0]?.title ?? ""}
                detail={copy.proofRows[0]?.detail ?? ""}
              />
              <ProofRow
                icon={<CodeBracketSquareIcon className="h-5 w-5" />}
                title={copy.proofRows[1]?.title ?? ""}
                detail={copy.proofRows[1]?.detail ?? ""}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  icon,
  label,
  value
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border p-5 md:border-r last:md:border-r-0">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="font-mono text-2xl font-black text-fg">{value}</div>
    </div>
  );
}

function ProofRow({
  icon,
  title,
  detail
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[40px_1fr] gap-4 rounded-md border border-border-soft bg-surface-2 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-soft text-brand">
        {icon}
      </div>
      <div>
        <div className="font-bold text-fg">{title}</div>
        <div className="mt-1 text-sm leading-6 text-fg-muted">{detail}</div>
      </div>
    </div>
  );
}
