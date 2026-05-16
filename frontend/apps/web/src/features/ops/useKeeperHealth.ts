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

const HEALTH_URL = "/ops/casino-keeper-health.json";
const STALE_MS = 2 * 60 * 1000;

export function deriveKeeperHealthView({
  snapshot,
  loadError,
  nowMs = Date.now()
}: {
  snapshot: KeeperHealthSnapshot | null;
  loadError?: string;
  nowMs?: number;
}): KeeperHealthView {
  if (!snapshot) {
    return {
      label: "Unavailable",
      tone: "warn",
      detail: loadError ?? "No keeper health snapshot has been published."
    };
  }

  const updatedMs = Date.parse(snapshot.updatedAt);
  const ageMs = Number.isFinite(updatedMs)
    ? Math.max(0, nowMs - updatedMs)
    : Number.POSITIVE_INFINITY;
  const ageSeconds = Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : undefined;

  if (!Number.isFinite(ageMs) || ageMs > STALE_MS) {
    return {
      label: "Stale",
      tone: "warn",
      detail:
        ageSeconds == null
          ? "Keeper snapshot timestamp is invalid."
          : `Keeper snapshot is ${ageSeconds}s old.`
    };
  }

  if (snapshot.status === "degraded" || snapshot.lastError) {
    return {
      label: "Degraded",
      tone: "danger",
      detail: snapshot.lastError ?? "Keeper reported a degraded status."
    };
  }

  if (snapshot.status === "stopped") {
    return {
      label: "Stopped",
      tone: "danger",
      detail: "Keeper process reported a stopped status."
    };
  }

  if (snapshot.status === "starting") {
    return {
      label: "Starting",
      tone: "warn",
      detail: `Keeper ${snapshot.role} is starting.`
    };
  }

  return {
    label: "Healthy",
    tone: "success",
    detail: `Keeper ${snapshot.role} updated ${ageSeconds ?? 0}s ago.`
  };
}

export function useKeeperHealth() {
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
      setLoadError((error as Error)?.message ?? "Keeper health unavailable");
      setNowMs(Date.now());
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    snapshot,
    view: deriveKeeperHealthView({ snapshot, loadError, nowMs }),
    refresh
  };
}
