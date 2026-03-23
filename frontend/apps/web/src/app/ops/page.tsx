"use client";

import * as React from "react";
import { AuditTabs, AuditTableCell, AuditTableHeader, AuditTableRow, Button, cn } from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { TrustStatsStrip } from "../../components/TrustStatsStrip";
import { TrustTableShell } from "../../components/TrustTableShell";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useIndexer } from "../../features/ops/useIndexer";

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function OpsPage() {
  const { release } = useRelease();
  const { indexerStatus, syncNow, refreshIndexerStatus } = useIndexer();

  const latest = indexerStatus?.latestBlock;
  const safe = indexerStatus?.safeHeadBlock;
  const lastSynced = indexerStatus?.lastSyncedBlock;
  const lag = indexerStatus?.lagBlocks;
  const conf = indexerStatus?.config?.confirmations;
  const rewind = indexerStatus?.config?.rewindBlocks;
  const pollMs = indexerStatus?.config?.pollIntervalMs;
  const batchSize = indexerStatus?.config?.batchSize;
  const healthLabel =
    typeof lag === "number" && typeof conf === "number"
      ? lag <= conf
        ? "Healthy"
        : lag <= conf * 3
          ? "Behind"
          : "Stalled"
      : "Unknown";

  const workerTrail = [
    {
      time: indexerStatus?.lastRunAt
        ? new Date(indexerStatus.lastRunAt).toLocaleTimeString()
        : "Recent",
      block: String(lastSynced ?? "—"),
      event: "Indexer sweep",
      status: indexerStatus?.running ? "Completed" : "Paused",
      context: batchSize ? `${batchSize} events per sweep` : "Awaiting worker config"
    },
    {
      time: "Live",
      block: String(safe ?? "—"),
      event: "Safe head advance",
      status: healthLabel,
      context: typeof lag === "number" ? `${lag} lag blocks` : "Lag unknown"
    },
    {
      time: "Release",
      block: shortHex(release?.releaseDigest),
      event: "Release identity",
      status: "Locked",
      context: release?.name ?? "Embedded release"
    }
  ];

  return (
    <PageTransition pageKey="ops">
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:py-16">
        <header className="max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Operational proof
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
            Release & Worker Pulse
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/48 md:text-[15px]">
            A trust-facing control surface for release identity, indexer health, and
            room-operational proof. The route stays institutional and table-first so LPs and
            operators can verify live system state quickly.
          </p>
        </header>

        <TrustStatsStrip
          items={[
            {
              label: "Release digest",
              value: shortHex(release?.releaseDigest),
              helper: "Canonical bundle currently served by the frontend.",
              accent: "cyan"
            },
            {
              label: "Indexer lag",
              value: typeof lag === "number" ? `${lag} blocks` : "—",
              helper:
                typeof conf === "number"
                  ? `Healthy window: ${conf} confirmations`
                  : "Confirmation window unavailable.",
              accent:
                healthLabel === "Healthy" ? "emerald" : healthLabel === "Behind" ? "amber" : "slate"
            },
            {
              label: "Safe head",
              value: String(safe ?? "—"),
              helper: "Worker-confirmed event horizon used for room surfaces.",
              accent: "slate"
            },
            {
              label: "Worker state",
              value: indexerStatus?.running ? "Running" : "Stopped",
              helper:
                typeof pollMs === "number"
                  ? `Polling every ${Math.round(pollMs / 1000)}s`
                  : "Worker polling unavailable.",
              accent: indexerStatus?.running ? "emerald" : "amber"
            }
          ]}
        />

        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <TrustTableShell
            eyebrow="Release bundle"
            title="Canonical release proof"
            description="This panel gives LPs and operators a clean answer to one question: what exact release, chain, and contract surface is the product presenting right now?"
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void syncNow()}
                  className="border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                  Sync indexer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshIndexerStatus}
                  className="border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                  Refresh status
                </Button>
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Chain", release?.name ?? "—"],
                ["Release digest", shortHex(release?.releaseDigest)],
                ["Hub", shortHex(release?.contracts.hub)],
                ["VRF Hub", shortHex(release?.contracts.vrfHub)],
                ["Asset bank", shortHex(release?.assets?.[0]?.bank)],
                ["Manifest", "release-latest.json"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    {label}
                  </div>
                  <div className="mt-3 font-mono text-sm text-white">{value}</div>
                </div>
              ))}
            </div>
          </TrustTableShell>

          <TrustTableShell
            eyebrow="Worker health"
            title="Operational focus"
            description="Room surfaces depend on a healthy indexer. These summaries stay compact and explicit so operators can catch drift before it leaks into player views."
          >
            <div className="space-y-4">
              {[
                [
                  "Confirmations",
                  conf ? `${conf} blocks` : "—",
                  "Finality window enforced before the UI reflects settled state."
                ],
                [
                  "Rewind window",
                  rewind ? `${rewind} blocks` : "—",
                  "Worker replay buffer used to recover from transient misses."
                ],
                [
                  "Batch size",
                  batchSize ? `${batchSize} events` : "—",
                  "Maximum event slice processed per sweep."
                ],
                [
                  "Health",
                  healthLabel,
                  typeof lag === "number"
                    ? `Current lag is ${lag} blocks.`
                    : "Lag data unavailable."
                ]
              ].map(([label, value, copy]) => (
                <div key={label} className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="font-mono text-sm text-white/82">{value}</div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/44">{copy}</div>
                </div>
              ))}
            </div>
          </TrustTableShell>
        </div>

        <TrustTableShell
          eyebrow="Worker event trail"
          title="Recent operational receipts"
          description="A compact trail of worker and release events. This stays table-first and low-drama so the trust route reads like a precise control surface."
        >
          <AuditTabs
            className="mt-0 border-white/8 bg-black/20"
            activeColorClass="border-cyan-400/70 text-cyan-200"
            tabs={["Operations"]}
            activeTab="Operations"
          >
            <AuditTableHeader>
              <div className="grid grid-cols-[1.1fr_1.1fr_1fr_1.1fr_72px] gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                <div>Time / Block</div>
                <div>Event</div>
                <div>Status</div>
                <div>Context</div>
                <div className="text-right">Flow</div>
              </div>
            </AuditTableHeader>

            <div className="flex flex-col gap-3">
              {workerTrail.map((row) => (
                <div
                  key={`${row.time}-${row.event}`}
                  className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(6,9,15,0.96))] p-4"
                >
                  <div className="grid grid-cols-[1.1fr_1.1fr_1fr_1.1fr_72px] items-center gap-4">
                    <AuditTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-white">{row.time}</span>
                        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/24">
                          {row.block}
                        </span>
                      </div>
                    </AuditTableCell>
                    <AuditTableCell>{row.event}</AuditTableCell>
                    <AuditTableCell>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                          row.status === "Healthy" ||
                            row.status === "Completed" ||
                            row.status === "Locked"
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : row.status === "Behind"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              : "border-white/10 bg-white/[0.05] text-white/68"
                        )}
                      >
                        {row.status}
                      </span>
                    </AuditTableCell>
                    <AuditTableCell>
                      <span className="text-sm leading-6 text-white/48">{row.context}</span>
                    </AuditTableCell>
                    <AuditTableCell className="justify-end text-[11px] font-bold uppercase tracking-[0.18em] text-white/30">
                      Live
                    </AuditTableCell>
                  </div>
                </div>
              ))}
            </div>
          </AuditTabs>
        </TrustTableShell>
      </main>
    </PageTransition>
  );
}
