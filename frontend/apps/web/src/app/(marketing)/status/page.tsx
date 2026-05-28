import * as React from "react";
import type { Metadata } from "next";

import { getHealthzSnapshot, type HealthzSnapshot } from "../../../server/healthz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "System Status | ArbiGameFi",
  description: "Live readiness checks for the ArbiGameFi release, keeper, and durable bet index."
};

function StatusBadge({ status }: { status: "ok" | "degraded" }) {
  return (
    <span
      className={
        status === "ok"
          ? "rounded-full border border-success/35 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
          : "rounded-full border border-warn/35 bg-warn/10 px-3 py-1 text-xs font-semibold text-warn"
      }
    >
      {status === "ok" ? "Operational" : "Degraded"}
    </span>
  );
}

function formatAge(ageMs: number | null) {
  if (ageMs == null) return "Unknown";
  if (ageMs < 1000) return "<1s";
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m`;
  return `${Math.round(ageMs / 3_600_000)}h`;
}

function CheckCard({
  label,
  status,
  rows,
  message
}: {
  label: string;
  status: "ok" | "degraded";
  rows: Array<[string, React.ReactNode]>;
  message?: string;
}) {
  return (
    <section className="rounded-lg border border-border-soft bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-fg">{label}</h2>
        <StatusBadge status={status} />
      </div>
      <dl className="mt-5 space-y-3">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 border-t border-border-soft pt-3"
          >
            <dt className="text-sm text-fg-muted">{key}</dt>
            <dd className="max-w-[60%] truncate text-right font-mono text-sm text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {message ? (
        <p className="mt-4 rounded-md border border-warn/25 bg-warn/10 px-3 py-2 text-sm text-warn">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function buildCards(snapshot: HealthzSnapshot) {
  return [
    {
      label: "Release",
      status: snapshot.checks.release.status,
      rows: [
        ["Name", snapshot.checks.release.name ?? "Unavailable"],
        ["Warnings", snapshot.checks.release.warnings.length]
      ] as Array<[string, React.ReactNode]>,
      message: snapshot.checks.release.message
    },
    {
      label: "Keeper",
      status: snapshot.checks.keeper.status,
      rows: [
        ["Role", snapshot.checks.keeper.role],
        ["Status", snapshot.checks.keeper.keeperStatus],
        ["Snapshot age", formatAge(snapshot.checks.keeper.ageMs)],
        ["Queue depth", snapshot.checks.keeper.queueDepth]
      ] as Array<[string, React.ReactNode]>,
      message: snapshot.checks.keeper.message
    },
    {
      label: "Bet index",
      status: snapshot.checks.betIndex.status,
      rows: [
        ["Source", snapshot.checks.betIndex.source],
        ["Rows sampled", snapshot.checks.betIndex.rows],
        ["Durable required", snapshot.checks.betIndex.durableRequired ? "Yes" : "No"],
        ["Durable configured", snapshot.checks.betIndex.durableConfigured ? "Yes" : "No"]
      ] as Array<[string, React.ReactNode]>,
      message: snapshot.checks.betIndex.message
    }
  ];
}

export default async function StatusPage() {
  const snapshot = await getHealthzSnapshot();
  const cards = buildCards(snapshot);

  return (
    <main className="min-h-screen bg-surface-0 px-6 py-10 text-fg">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 border-b border-border-soft pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
              ArbiGameFi Status
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-fg">System status</h1>
            <p className="mt-3 max-w-2xl text-base text-fg-muted">
              Live readiness checks for release metadata, casino keeper finalization, and the
              durable bet index.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={snapshot.status} />
            <a
              className="rounded-full border border-border-soft bg-surface-1 px-4 py-2 text-sm font-semibold text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              href="/api/healthz"
            >
              JSON
            </a>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border-soft bg-surface-1 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">Chain</p>
            <p className="mt-3 font-mono text-xl font-semibold text-fg">{snapshot.chainId}</p>
          </div>
          <div className="rounded-lg border border-border-soft bg-surface-1 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Generated
            </p>
            <p className="mt-3 truncate font-mono text-lg font-semibold text-fg">
              {snapshot.generatedAt}
            </p>
          </div>
          <div className="rounded-lg border border-border-soft bg-surface-1 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Schema
            </p>
            <p className="mt-3 font-mono text-xl font-semibold text-fg">
              v{snapshot.schemaVersion}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {cards.map((card) => (
            <CheckCard key={card.label} {...card} />
          ))}
        </section>
      </div>
    </main>
  );
}
