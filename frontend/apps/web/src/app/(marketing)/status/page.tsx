import * as React from "react";
import type { Metadata } from "next";

import {
  getSupportedAppChains,
  resolveDefaultAppChainId,
  type AppChain
} from "../../../app-shell/chain-registry";
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

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

type StatusSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSelectedChainId(chains: readonly AppChain[], searchParams: StatusSearchParams) {
  const requested = Number(firstParam(searchParams.chainId));
  if (Number.isInteger(requested) && chains.some((chain) => chain.id === requested)) {
    return requested;
  }

  const defaultChainId = resolveDefaultAppChainId(process.env.NEXT_PUBLIC_CHAIN_ID);
  if (chains.some((chain) => chain.id === defaultChainId)) return defaultChainId;
  return chains[0]?.id;
}

function runtimeModeLabel() {
  return process.env.NEXT_PUBLIC_ENV?.trim() || process.env.NODE_ENV || "development";
}

function displayRuntimeMode(runtimeMode: string, isLocalDevelopment: boolean) {
  return isLocalDevelopment ? `${runtimeMode} / local dev` : runtimeMode;
}

function ChainStatusSummary({ chain, snapshot }: { chain: AppChain; snapshot: HealthzSnapshot }) {
  const cards = buildCards(snapshot);
  return (
    <section className="rounded-lg border border-border-soft bg-surface-1 p-5">
      <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-fg">{chain.name}</h2>
            <span className="rounded-full border border-border-soft bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
              {chain.environment}
            </span>
          </div>
          <p className="mt-2 font-mono text-sm text-fg-muted">chainId {snapshot.chainId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={snapshot.status} />
          <a
            className="rounded-full border border-border-soft bg-surface-2 px-4 py-2 text-sm font-semibold text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            href={`/api/healthz?chainId=${chain.id}`}
          >
            JSON
          </a>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border-soft bg-surface-0 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Generated
          </p>
          <p className="mt-3 truncate font-mono text-sm font-semibold text-fg">
            {snapshot.generatedAt}
          </p>
        </div>
        <div className="rounded-lg border border-border-soft bg-surface-0 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Keeper age
          </p>
          <p className="mt-3 font-mono text-xl font-semibold text-fg">
            {formatAge(snapshot.checks.keeper.ageMs)}
          </p>
        </div>
        <div className="rounded-lg border border-border-soft bg-surface-0 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Index source
          </p>
          <p className="mt-3 truncate font-mono text-xl font-semibold text-fg">
            {snapshot.checks.betIndex.source}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <CheckCard key={`${chain.id}-${card.label}`} {...card} />
        ))}
      </div>
    </section>
  );
}

export default async function StatusPage({
  searchParams
}: {
  searchParams?: Promise<StatusSearchParams>;
}) {
  const chains = getSupportedAppChains();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedChainId = resolveSelectedChainId(chains, resolvedSearchParams);
  const snapshots = await Promise.all(
    chains.map(async (chain) => ({
      chain,
      snapshot: await getHealthzSnapshot({ chainId: chain.id })
    }))
  );
  const selected = snapshots.find(({ chain }) => chain.id === selectedChainId) ?? snapshots[0];
  const runtimeMode = runtimeModeLabel();
  const isLocalDevelopment = process.env.NODE_ENV !== "production";
  const showDevelopmentDiagnostics =
    isLocalDevelopment || runtimeMode.toLowerCase() !== "production";

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
              Per-chain readiness checks for release metadata, casino keeper finalization, and the
              durable bet index.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={selected?.snapshot.status ?? "degraded"} />
            <span className="rounded-full border border-border-soft bg-surface-1 px-4 py-2 text-sm font-semibold text-fg-muted">
              {displayRuntimeMode(runtimeMode, isLocalDevelopment)}
            </span>
            <a
              className="rounded-full border border-border-soft bg-surface-1 px-4 py-2 text-sm font-semibold text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              href={`/api/healthz?chainId=${selected?.chain.id ?? ""}`}
            >
              Selected JSON
            </a>
          </div>
        </header>

        {showDevelopmentDiagnostics ? (
          <section className="rounded-lg border border-info/25 bg-info/10 px-4 py-3 text-sm text-fg-muted">
            <span className="font-semibold text-fg">Development diagnostics.</span> Keeper and
            bet-index checks reflect the local processes and per-chain health files. A stopped local
            keeper is shown as degraded for that chain; it is not a production outage.
          </section>
        ) : null}

        <nav
          aria-label="Chain status"
          role="tablist"
          className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {snapshots.map(({ chain, snapshot }) => (
            <a
              key={chain.id}
              aria-selected={chain.id === selected?.chain.id}
              className={classNames(
                "min-w-[14rem] rounded-lg border p-4 text-left transition-colors",
                chain.id === selected?.chain.id
                  ? "border-brand bg-brand-soft text-fg"
                  : "border-border-soft bg-surface-1 text-fg-muted hover:border-border-strong hover:text-fg"
              )}
              href={`/status?chainId=${chain.id}`}
              role="tab"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
                    {chain.environment}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-fg">{chain.name}</p>
                  <p className="mt-1 font-mono text-sm text-fg-muted">chainId {chain.id}</p>
                </div>
                <StatusBadge status={snapshot.status} />
              </div>
            </a>
          ))}
        </nav>

        {selected ? (
          <ChainStatusSummary chain={selected.chain} snapshot={selected.snapshot} />
        ) : null}
      </div>
    </main>
  );
}
