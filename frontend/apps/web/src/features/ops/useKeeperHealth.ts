"use client";

import * as React from "react";

import type { OpsStatusTone } from "./types";

export type KeeperHealthSnapshot = {
  schemaVersion: 1;
  status: "starting" | "running" | "degraded" | "stopped";
  role: "primary" | "backup";
  chainId: number;
  gameHub: string;
  vrfHub: string;
  keeper: string;
  startedAt: string;
  updatedAt: string;
  lastScannedBlock?: string;
  queueDepth: number;
  lastEnqueuedAt?: string;
  lastEnqueued?: {
    source: string;
    betId: string;
    requestId?: string;
    blockNumber?: string;
    txHash?: string;
  };
  lastFinalizeSuccessAt?: string;
  lastFinalizeSuccess?: {
    betId: string;
    txHash: string;
    latencyMs: number;
  };
  lastFinalizeFailureAt?: string;
  lastFinalizeFailure?: {
    betId: string;
    reason: string;
    retryable: boolean;
  };
  lastError?: string;
};

export type KeeperHealthView = {
  label: string;
  tone: OpsStatusTone;
  detail: string;
};

export type KeeperHealthLabels = {
  unavailable: string;
  unavailableDefault: string;
  stale: string;
  invalidTimestamp: string;
  staleAge: (seconds: number) => string;
  degraded: string;
  degradedDefault: string;
  stopped: string;
  stoppedDetail: string;
  starting: string;
  startingDetail: (role: string) => string;
  healthy: string;
  healthyDetail: (role: string, seconds: number) => string;
};

const HEALTH_URL = "/ops/casino-keeper-health.json";
const STALE_MS = 2 * 60 * 1000;

export function deriveKeeperHealthView({
  snapshot,
  loadError,
  nowMs = Date.now(),
  labels
}: {
  snapshot: KeeperHealthSnapshot | null;
  loadError?: string;
  nowMs?: number;
  labels: KeeperHealthLabels;
}): KeeperHealthView {
  if (!snapshot) {
    return {
      label: labels.unavailable,
      tone: "warn",
      detail: loadError ?? labels.unavailableDefault
    };
  }

  const updatedMs = Date.parse(snapshot.updatedAt);
  const ageMs = Number.isFinite(updatedMs)
    ? Math.max(0, nowMs - updatedMs)
    : Number.POSITIVE_INFINITY;
  const ageSeconds = Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : undefined;

  if (!Number.isFinite(ageMs) || ageMs > STALE_MS) {
    return {
      label: labels.stale,
      tone: "warn",
      detail: ageSeconds == null ? labels.invalidTimestamp : labels.staleAge(ageSeconds)
    };
  }

  if (snapshot.status === "degraded" || snapshot.lastError) {
    return {
      label: labels.degraded,
      tone: "danger",
      detail: snapshot.lastError ?? labels.degradedDefault
    };
  }

  if (snapshot.status === "stopped") {
    return {
      label: labels.stopped,
      tone: "danger",
      detail: labels.stoppedDetail
    };
  }

  if (snapshot.status === "starting") {
    return {
      label: labels.starting,
      tone: "warn",
      detail: labels.startingDetail(snapshot.role)
    };
  }

  return {
    label: labels.healthy,
    tone: "success",
    detail: labels.healthyDetail(snapshot.role, ageSeconds ?? 0)
  };
}

export function useKeeperHealth(labels: KeeperHealthLabels) {
  const [snapshot, setSnapshot] = React.useState<KeeperHealthSnapshot | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch(HEALTH_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSnapshot((await response.json()) as KeeperHealthSnapshot);
      setLoadError(undefined);
      setNowMs(Date.now());
    } catch (error) {
      setSnapshot(null);
      setLoadError((error as Error)?.message ?? labels.unavailableDefault);
      setNowMs(Date.now());
    }
  }, [labels]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    snapshot,
    view: deriveKeeperHealthView({ snapshot, loadError, nowMs, labels }),
    refresh
  };
}
