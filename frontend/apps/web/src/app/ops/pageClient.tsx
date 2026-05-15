"use client";

import * as React from "react";

import { PageTransition } from "../../components/PageTransition";
import { shortHex } from "../../features/ops/format";
import { OpsEventTrail } from "../../features/ops/ops-event-trail";
import { OpsHero } from "../../features/ops/ops-hero";
import { OpsReleasePanel } from "../../features/ops/ops-release-panel";
import { OpsWorkerPanel } from "../../features/ops/ops-worker-panel";
import type {
  OpsKeyValueRow,
  OpsMetric,
  OpsStatusTone,
  OpsTrailRow
} from "../../features/ops/types";
import { useIndexer } from "../../features/ops/useIndexer";
import { useRelease } from "../../ssot/release/ReleaseProvider";

export function OpsPageClient() {
  const { release } = useRelease();
  const { indexerStatus, syncNow, refreshIndexerStatus } = useIndexer();

  const health = React.useMemo(
    () => deriveHealth(indexerStatus?.lagBlocks, indexerStatus?.config?.confirmations),
    [indexerStatus?.config?.confirmations, indexerStatus?.lagBlocks]
  );

  const metrics = React.useMemo<OpsMetric[]>(
    () => [
      {
        label: "Release digest",
        value: shortHex(release?.releaseDigest),
        detail: "Canonical bundle currently served by the frontend."
      },
      {
        label: "Indexer lag",
        value:
          typeof indexerStatus?.lagBlocks === "number" ? `${indexerStatus.lagBlocks} blocks` : "—",
        detail:
          typeof indexerStatus?.config?.confirmations === "number"
            ? `Healthy window: ${indexerStatus.config.confirmations} confirmations.`
            : "Confirmation window unavailable.",
        tone: health.tone
      },
      {
        label: "Safe head",
        value: String(indexerStatus?.safeHeadBlock ?? "—"),
        detail: "Worker-confirmed event horizon used by room surfaces."
      },
      {
        label: "Worker state",
        value: indexerStatus?.running ? "Running" : "Stopped",
        detail:
          typeof indexerStatus?.config?.pollIntervalMs === "number"
            ? `Polling every ${Math.round(indexerStatus.config.pollIntervalMs / 1000)}s.`
            : "Worker polling unavailable.",
        tone: indexerStatus?.running ? "success" : "warn"
      }
    ],
    [health.tone, indexerStatus, release?.releaseDigest]
  );

  const releaseRows = React.useMemo(
    () => [
      { label: "Network", value: release?.name ?? "—" },
      { label: "Chain id", value: String(release?.chainId ?? "—") },
      { label: "Release digest", value: shortHex(release?.releaseDigest) },
      { label: "Hub", value: shortHex(release?.contracts.hub) },
      { label: "VRF Hub", value: shortHex(release?.contracts.vrfHub) },
      { label: "Bank registry", value: shortHex(release?.contracts.bankRegistry) },
      { label: "Primary bank", value: shortHex(release?.assets?.[0]?.bank) },
      { label: "Manifest", value: "release-latest.json" }
    ],
    [release]
  );

  const workerRows = React.useMemo<OpsKeyValueRow[]>(
    () => [
      {
        label: "Health",
        value: health.label,
        detail:
          typeof indexerStatus?.lagBlocks === "number"
            ? `Current lag is ${indexerStatus.lagBlocks} blocks.`
            : "Lag data unavailable.",
        tone: health.tone
      },
      {
        label: "Confirmations",
        value:
          typeof indexerStatus?.config?.confirmations === "number"
            ? `${indexerStatus.config.confirmations} blocks`
            : "—",
        detail: "Finality window before the UI reflects settled state."
      },
      {
        label: "Rewind window",
        value:
          typeof indexerStatus?.config?.rewindBlocks === "number"
            ? `${indexerStatus.config.rewindBlocks} blocks`
            : "—",
        detail: "Replay buffer used to recover from transient misses."
      },
      {
        label: "Batch size",
        value:
          typeof indexerStatus?.config?.batchSize === "number"
            ? `${indexerStatus.config.batchSize.toLocaleString("en-US")} events`
            : "—",
        detail: "Maximum event slice processed per sweep."
      },
      {
        label: "Latest block",
        value: String(indexerStatus?.latestBlock ?? "—"),
        detail: "Latest block observed by the worker public client."
      },
      {
        label: "Last error",
        value: indexerStatus?.lastError ?? "None",
        detail: "Last worker error surfaced by the runtime provider.",
        tone: indexerStatus?.lastError ? "danger" : "success"
      }
    ],
    [health, indexerStatus]
  );

  const trail = React.useMemo<OpsTrailRow[]>(
    () => [
      {
        time: indexerStatus?.lastRunAt
          ? new Date(indexerStatus.lastRunAt).toLocaleTimeString()
          : "Recent",
        block: String(indexerStatus?.lastSyncedBlock ?? "—"),
        event: "Indexer sweep",
        status: indexerStatus?.running ? "Completed" : "Paused",
        tone: indexerStatus?.running ? "success" : "warn",
        context:
          typeof indexerStatus?.config?.batchSize === "number"
            ? `${indexerStatus.config.batchSize.toLocaleString("en-US")} events per sweep`
            : "Awaiting worker config"
      },
      {
        time: "Live",
        block: String(indexerStatus?.safeHeadBlock ?? "—"),
        event: "Safe head advance",
        status: health.label,
        tone: health.tone,
        context:
          typeof indexerStatus?.lagBlocks === "number"
            ? `${indexerStatus.lagBlocks} lag blocks`
            : "Lag unknown"
      },
      {
        time: "Release",
        block: shortHex(release?.releaseDigest),
        event: "Release identity",
        status: "Locked",
        tone: "success",
        context: release?.name ?? "Embedded release"
      }
    ],
    [health, indexerStatus, release?.name, release?.releaseDigest]
  );

  return (
    <PageTransition pageKey="ops">
      <div className="space-y-8">
        <OpsHero metrics={metrics} />
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <OpsReleasePanel
            rows={releaseRows}
            onSync={() => void syncNow()}
            onRefresh={refreshIndexerStatus}
          />
          <OpsWorkerPanel rows={workerRows} />
        </div>
        <OpsEventTrail rows={trail} />
      </div>
    </PageTransition>
  );
}

function deriveHealth(
  lag?: number,
  confirmations?: number
): { label: string; tone: OpsStatusTone } {
  if (typeof lag !== "number" || typeof confirmations !== "number") {
    return { label: "Unknown", tone: "default" };
  }
  if (lag <= confirmations) return { label: "Healthy", tone: "success" };
  if (lag <= confirmations * 3) return { label: "Behind", tone: "warn" };
  return { label: "Stalled", tone: "danger" };
}
