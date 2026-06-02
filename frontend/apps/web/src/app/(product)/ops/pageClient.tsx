"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { PageTransition } from "../../../components/PageTransition";
import { getDefaultCasinoPoolAssetContext } from "../../../features/assets/pool-asset";
import { shortHex } from "../../../features/ops/format";
import { OpsEventTrail } from "../../../features/ops/ops-event-trail";
import { OpsHero } from "../../../features/ops/ops-hero";
import { OpsReleasePanel } from "../../../features/ops/ops-release-panel";
import { OpsWorkerPanel } from "../../../features/ops/ops-worker-panel";
import type {
  OpsKeyValueRow,
  OpsMetric,
  OpsStatusTone,
  OpsTrailRow
} from "../../../features/ops/types";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useKeeperHealth } from "../../../features/ops/useKeeperHealth";
import { useRelease } from "../../../ssot/release/ReleaseProvider";

export function OpsPageClient() {
  const t = useTranslations("ops");
  const locale = useLocale();
  const { release } = useRelease();
  const primaryCasinoPool = React.useMemo(
    () => (release ? getDefaultCasinoPoolAssetContext(release) : null),
    [release]
  );
  const { indexerStatus, syncNow, refreshIndexerStatus } = useIndexer();
  const keeperLabels = React.useMemo(
    () => ({
      unavailable: t("keeperHealth.unavailable"),
      unavailableDefault: t("keeperHealth.unavailableDefault"),
      stale: t("keeperHealth.stale"),
      invalidTimestamp: t("keeperHealth.invalidTimestamp"),
      staleAge: (seconds: number) => t("keeperHealth.staleAge", { seconds }),
      degraded: t("keeperHealth.degraded"),
      degradedDefault: t("keeperHealth.degradedDefault"),
      stopped: t("keeperHealth.stopped"),
      stoppedDetail: t("keeperHealth.stoppedDetail"),
      starting: t("keeperHealth.starting"),
      startingDetail: (role: string) => t("keeperHealth.startingDetail", { role }),
      healthy: t("keeperHealth.healthy"),
      healthyDetail: (role: string, seconds: number) =>
        t("keeperHealth.healthyDetail", { role, seconds })
    }),
    [t]
  );
  const {
    snapshot: keeperHealth,
    view: keeperHealthView,
    refresh: refreshKeeperHealth
  } = useKeeperHealth(keeperLabels);

  const health = React.useMemo(
    () =>
      deriveHealth({
        lag: indexerStatus?.lagBlocks,
        confirmations: indexerStatus?.config?.confirmations,
        labels: {
          unknown: t("health.unknown"),
          healthy: t("health.healthy"),
          behind: t("health.behind"),
          stalled: t("health.stalled")
        }
      }),
    [indexerStatus?.config?.confirmations, indexerStatus?.lagBlocks, t]
  );

  const refreshOps = React.useCallback(() => {
    refreshIndexerStatus();
    void refreshKeeperHealth();
  }, [refreshIndexerStatus, refreshKeeperHealth]);

  const metrics = React.useMemo<OpsMetric[]>(
    () => [
      {
        label: t("metrics.releaseDigest.label"),
        value: shortHex(release?.releaseDigest),
        detail: t("metrics.releaseDigest.detail")
      },
      {
        label: t("metrics.indexerLag.label"),
        value:
          typeof indexerStatus?.lagBlocks === "number"
            ? t("units.blocks", { count: indexerStatus.lagBlocks })
            : "—",
        detail:
          typeof indexerStatus?.config?.confirmations === "number"
            ? t("metrics.indexerLag.healthyWindow", {
                count: indexerStatus.config.confirmations
              })
            : t("metrics.indexerLag.unavailable"),
        tone: health.tone
      },
      {
        label: t("metrics.safeHead.label"),
        value: String(indexerStatus?.safeHeadBlock ?? "—"),
        detail: t("metrics.safeHead.detail")
      },
      {
        label: t("metrics.workerState.label"),
        value: indexerStatus?.running ? t("status.running") : t("status.stopped"),
        detail:
          typeof indexerStatus?.config?.pollIntervalMs === "number"
            ? t("metrics.workerState.polling", {
                seconds: Math.round(indexerStatus.config.pollIntervalMs / 1000)
              })
            : t("metrics.workerState.unavailable"),
        tone: indexerStatus?.running ? "success" : "warn"
      },
      {
        label: t("metrics.keeperState.label"),
        value: keeperHealthView.label,
        detail: keeperHealthView.detail,
        tone: keeperHealthView.tone
      }
    ],
    [health.tone, indexerStatus, keeperHealthView, release?.releaseDigest, t]
  );

  const releaseRows = React.useMemo(
    () => [
      { label: t("releaseRows.network"), value: release?.name ?? "—" },
      { label: t("releaseRows.chainId"), value: String(release?.chainId ?? "—") },
      { label: t("releaseRows.releaseDigest"), value: shortHex(release?.releaseDigest) },
      { label: t("releaseRows.gameHub"), value: shortHex(release?.contracts.gameHub) },
      { label: t("releaseRows.vrfHub"), value: shortHex(release?.contracts.vrfHub) },
      { label: t("releaseRows.poolRegistry"), value: shortHex(release?.contracts.poolRegistry) },
      { label: t("releaseRows.primaryBank"), value: shortHex(primaryCasinoPool?.bank) },
      { label: t("releaseRows.manifest"), value: "release-latest.json" }
    ],
    [primaryCasinoPool?.bank, release, t]
  );

  const workerRows = React.useMemo<OpsKeyValueRow[]>(
    () => [
      {
        label: t("workerRows.health.label"),
        value: health.label,
        detail:
          typeof indexerStatus?.lagBlocks === "number"
            ? t("workerRows.health.currentLag", { count: indexerStatus.lagBlocks })
            : t("workerRows.health.unavailable"),
        tone: health.tone
      },
      {
        label: t("workerRows.confirmations.label"),
        value:
          typeof indexerStatus?.config?.confirmations === "number"
            ? t("units.blocks", { count: indexerStatus.config.confirmations })
            : "—",
        detail: t("workerRows.confirmations.detail")
      },
      {
        label: t("workerRows.rewindWindow.label"),
        value:
          typeof indexerStatus?.config?.rewindBlocks === "number"
            ? t("units.blocks", { count: indexerStatus.config.rewindBlocks })
            : "—",
        detail: t("workerRows.rewindWindow.detail")
      },
      {
        label: t("workerRows.batchSize.label"),
        value:
          typeof indexerStatus?.config?.batchSize === "number"
            ? t("units.events", {
                count: indexerStatus.config.batchSize.toLocaleString(locale)
              })
            : "—",
        detail: t("workerRows.batchSize.detail")
      },
      {
        label: t("workerRows.latestBlock.label"),
        value: String(indexerStatus?.latestBlock ?? "—"),
        detail: t("workerRows.latestBlock.detail")
      },
      {
        label: t("workerRows.lastError.label"),
        value: indexerStatus?.lastError ?? t("workerRows.lastError.none"),
        detail: t("workerRows.lastError.detail"),
        tone: indexerStatus?.lastError ? "danger" : "success"
      },
      {
        label: t("workerRows.casinoKeeper.label"),
        value: keeperHealthView.label,
        detail: keeperHealthView.detail,
        tone: keeperHealthView.tone
      },
      {
        label: t("workerRows.keeperRole.label"),
        value: keeperHealth?.role ?? "—",
        detail: keeperHealth
          ? t("workerRows.keeperRole.detail", {
              eoa: shortHex(keeperHealth.keeper),
              chainId: keeperHealth.chainId
            })
          : t("workerRows.keeperRole.unavailable")
      },
      {
        label: t("workerRows.keeperQueue.label"),
        value:
          typeof keeperHealth?.queueDepth === "number"
            ? t("units.pending", { count: keeperHealth.queueDepth })
            : "—",
        detail:
          keeperHealth?.lastScannedBlock != null
            ? t("workerRows.keeperQueue.lastScannedBlock", {
                block: keeperHealth.lastScannedBlock
              })
            : t("workerRows.keeperQueue.unavailable"),
        tone:
          typeof keeperHealth?.queueDepth === "number" && keeperHealth.queueDepth > 0
            ? "warn"
            : "default"
      },
      {
        label: t("workerRows.lastKeeperSuccess.label"),
        value: formatIsoTime(keeperHealth?.lastFinalizeSuccessAt, locale),
        detail: keeperHealth?.lastFinalizeSuccess
          ? t("workerRows.lastKeeperSuccess.detail", {
              betId: keeperHealth.lastFinalizeSuccess.betId,
              tx: shortHex(keeperHealth.lastFinalizeSuccess.txHash),
              latencyMs: keeperHealth.lastFinalizeSuccess.latencyMs
            })
          : t("workerRows.lastKeeperSuccess.none"),
        tone: keeperHealth?.lastFinalizeSuccess ? "success" : "warn"
      },
      {
        label: t("workerRows.lastKeeperFailure.label"),
        value: formatIsoTime(keeperHealth?.lastFinalizeFailureAt, locale),
        detail: keeperHealth?.lastFinalizeFailure?.reason ?? t("workerRows.lastKeeperFailure.none"),
        tone: keeperHealth?.lastFinalizeFailure ? "danger" : "success"
      }
    ],
    [health, indexerStatus, keeperHealth, keeperHealthView, locale, t]
  );

  const trail = React.useMemo<OpsTrailRow[]>(
    () => [
      {
        time: indexerStatus?.lastRunAt
          ? new Date(indexerStatus.lastRunAt).toLocaleTimeString(locale)
          : t("trail.recent"),
        block: String(indexerStatus?.lastSyncedBlock ?? "—"),
        event: t("trail.events.indexerSweep"),
        status: indexerStatus?.running ? t("status.completed") : t("status.paused"),
        tone: indexerStatus?.running ? "success" : "warn",
        context:
          typeof indexerStatus?.config?.batchSize === "number"
            ? t("trail.context.eventsPerSweep", {
                count: indexerStatus.config.batchSize.toLocaleString(locale)
              })
            : t("trail.context.awaitingWorkerConfig")
      },
      {
        time: t("trail.live"),
        block: String(indexerStatus?.safeHeadBlock ?? "—"),
        event: t("trail.events.safeHeadAdvance"),
        status: health.label,
        tone: health.tone,
        context:
          typeof indexerStatus?.lagBlocks === "number"
            ? t("trail.context.lagBlocks", { count: indexerStatus.lagBlocks })
            : t("trail.context.lagUnknown")
      },
      {
        time: keeperHealth?.updatedAt
          ? new Date(keeperHealth.updatedAt).toLocaleTimeString(locale)
          : "—",
        block: keeperHealth?.lastScannedBlock ?? "—",
        event: t("trail.events.casinoKeeper"),
        status: keeperHealthView.label,
        tone: keeperHealthView.tone,
        context: keeperHealthView.detail
      },
      {
        time: t("trail.release"),
        block: shortHex(release?.releaseDigest),
        event: t("trail.events.releaseIdentity"),
        status: t("status.locked"),
        tone: "success",
        context: release?.name ?? t("trail.context.embeddedRelease")
      }
    ],
    [
      health,
      indexerStatus,
      keeperHealth,
      keeperHealthView,
      locale,
      release?.name,
      release?.releaseDigest,
      t
    ]
  );

  return (
    <PageTransition pageKey="ops">
      <div className="space-y-8">
        <OpsHero
          metrics={metrics}
          copy={{
            eyebrow: t("hero.eyebrow"),
            title: t("hero.title"),
            description: t("hero.description"),
            summaryLabel: t("hero.summaryLabel"),
            summaryDescription: t("hero.summaryDescription")
          }}
        />
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <OpsReleasePanel
            rows={releaseRows}
            onSync={() => void syncNow()}
            onRefresh={refreshOps}
            copy={{
              eyebrow: t("releasePanel.eyebrow"),
              title: t("releasePanel.title"),
              description: t("releasePanel.description"),
              sync: t("releasePanel.sync"),
              refresh: t("releasePanel.refresh")
            }}
          />
          <OpsWorkerPanel
            rows={workerRows}
            copy={{
              eyebrow: t("workerPanel.eyebrow"),
              title: t("workerPanel.title"),
              description: t("workerPanel.description")
            }}
          />
        </div>
        <OpsEventTrail
          rows={trail}
          copy={{
            eyebrow: t("eventTrail.eyebrow"),
            title: t("eventTrail.title"),
            description: t("eventTrail.description"),
            headers: {
              timeBlock: t("eventTrail.headers.timeBlock"),
              event: t("eventTrail.headers.event"),
              status: t("eventTrail.headers.status"),
              context: t("eventTrail.headers.context"),
              flow: t("eventTrail.headers.flow")
            },
            flowLabel: t("eventTrail.flowLabel"),
            mobileBlockLabel: t("eventTrail.mobileBlockLabel")
          }}
        />
      </div>
    </PageTransition>
  );
}

function deriveHealth({
  lag,
  confirmations,
  labels
}: {
  lag?: number;
  confirmations?: number;
  labels: {
    unknown: string;
    healthy: string;
    behind: string;
    stalled: string;
  };
}): { label: string; tone: OpsStatusTone } {
  if (typeof lag !== "number" || typeof confirmations !== "number") {
    return { label: labels.unknown, tone: "default" };
  }
  if (lag <= confirmations) return { label: labels.healthy, tone: "success" };
  if (lag <= confirmations * 3) return { label: labels.behind, tone: "warn" };
  return { label: labels.stalled, tone: "danger" };
}

function formatIsoTime(value?: string, locale?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return date.toLocaleTimeString(locale);
}
