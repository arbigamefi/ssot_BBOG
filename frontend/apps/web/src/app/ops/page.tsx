"use client";

import { PageHeader, StatCard, Button, Badge } from "@ssot/ui";
import { PageTransition } from "../../components/PageTransition";
import { useIndexer } from "../../features/ops/useIndexer";

export default function OpsPage() {
  const { indexerStatus, syncNow, refreshIndexerStatus } = useIndexer();

  const latest = indexerStatus?.latestBlock;
  const safe = indexerStatus?.safeHeadBlock;
  const lastSynced = indexerStatus?.lastSyncedBlock;
  const lag = indexerStatus?.lagBlocks;
  const conf = indexerStatus?.config?.confirmations;
  const rewind = indexerStatus?.config?.rewindBlocks;
  const pollMs = indexerStatus?.config?.pollIntervalMs;
  const batchSize = indexerStatus?.config?.batchSize;

  const maxLag = typeof conf === "number" ? Math.max(1, conf * 3) : 36;
  const healthPct = typeof lag === "number" ? Math.max(0, 100 - Math.min(100, Math.round((lag / maxLag) * 100))) : undefined;
  const healthLabel = typeof lag === "number" && typeof conf === "number"
    ? lag <= conf ? "healthy" : lag <= conf * 3 ? "behind" : "stalled"
    : "—";
  const healthColor = healthLabel === "healthy" ? "text-emerald-400" : healthLabel === "behind" ? "text-amber-400" : "text-rose-400";

  return (
    <PageTransition pageKey="ops">
      <PageHeader
        title="Ops"
        description="Indexer health and diagnostics. The indexer runs in a Web Worker, processing Hub events with a confirmations window."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void syncNow()} className="border-slate-700 text-slate-300 hover:text-white">
              Sync Now
            </Button>
            <Button variant="outline" size="sm" onClick={refreshIndexerStatus} className="border-slate-700 text-slate-300 hover:text-white">
              Refresh
            </Button>
          </div>
        }
      />

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Badge variant={indexerStatus?.running ? "default" : "secondary"}>
          {indexerStatus?.running ? "● Running" : "○ Stopped"}
        </Badge>
        <Badge variant="outline">confirmations: {conf ?? "—"}</Badge>
        <Badge variant="outline">rewind: {rewind ?? "—"}</Badge>
        <Badge variant="outline">poll: {typeof pollMs === "number" ? `${Math.round(pollMs / 1000)}s` : "—"}</Badge>
        <Badge variant="outline">batch: {batchSize ?? "—"}</Badge>
      </div>

      {/* Block stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📡" label="Latest Block" value={String(latest ?? "—")} />
        <StatCard icon="🛡" label="Safe Head" value={String(safe ?? "—")} />
        <StatCard icon="✅" label="Last Synced" value={String(lastSynced ?? "—")} />
        <StatCard
          icon="📊"
          label="Lag / Health"
          value={String(lag ?? "—")}
          subValue={healthLabel}
          trend={healthLabel === "healthy" ? "up" : healthLabel === "behind" ? "neutral" : "down"}
        />
      </div>

      {/* Health bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Indexer health (0–{maxLag} lag blocks window)</span>
          <span className={`font-mono text-sm font-medium ${healthColor}`}>
            {typeof healthPct === "number" ? `${healthPct}%` : "—"}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${healthLabel === "healthy" ? "bg-emerald-500" : healthLabel === "behind" ? "bg-amber-500" : "bg-rose-500"
              }`}
            style={{ width: typeof healthPct === "number" ? `${healthPct}%` : "0%" }}
          />
        </div>

        {/* Extra info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="text-slate-400">
            Hub: <span className="font-mono text-slate-300">{indexerStatus?.hub ?? "—"}</span>
          </div>
          <div className="text-slate-400">
            Last run: <span className="font-mono text-slate-300">{indexerStatus?.lastRunAt ? new Date(indexerStatus.lastRunAt).toLocaleTimeString() : "—"}</span>
          </div>
          {indexerStatus?.lastError && (
            <div className="col-span-2 text-slate-400">
              Last error: <span className="font-mono text-xs text-rose-400">{indexerStatus.lastError}</span>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
