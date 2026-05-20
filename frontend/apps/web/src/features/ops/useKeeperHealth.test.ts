import { describe, expect, it } from "vitest";

import { deriveKeeperHealthView, type KeeperHealthSnapshot } from "./useKeeperHealth";

const labels = {
  unavailable: "Unavailable",
  unavailableDefault: "No keeper health snapshot has been published.",
  stale: "Stale",
  invalidTimestamp: "Keeper snapshot timestamp is invalid.",
  staleAge: (seconds: number) => `Keeper snapshot is ${seconds}s old.`,
  degraded: "Degraded",
  degradedDefault: "Keeper reported a degraded status.",
  stopped: "Stopped",
  stoppedDetail: "Keeper process reported a stopped status.",
  starting: "Starting",
  startingDetail: (role: string) => `Keeper ${role} is starting.`,
  healthy: "Healthy",
  healthyDetail: (role: string, seconds: number) => `Keeper ${role} updated ${seconds}s ago.`
};

const baseSnapshot: KeeperHealthSnapshot = {
  schemaVersion: 1,
  status: "running",
  role: "primary",
  chainId: 84532,
  gameHub: "0x1111111111111111111111111111111111111111",
  vrfHub: "0x2222222222222222222222222222222222222222",
  keeper: "0x3333333333333333333333333333333333333333",
  startedAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:10.000Z",
  lastScannedBlock: "100",
  queueDepth: 0
};

describe("deriveKeeperHealthView", () => {
  it("treats a fresh running snapshot as healthy", () => {
    expect(
      deriveKeeperHealthView({
        labels,
        snapshot: baseSnapshot,
        nowMs: Date.parse("2026-05-17T00:00:20.000Z")
      })
    ).toMatchObject({
      label: "Healthy",
      tone: "success"
    });
  });

  it("warns when the snapshot is missing or stale", () => {
    expect(deriveKeeperHealthView({ labels, snapshot: null, loadError: "HTTP 404" })).toMatchObject(
      {
        label: "Unavailable",
        tone: "warn",
        detail: "HTTP 404"
      }
    );

    expect(
      deriveKeeperHealthView({
        labels,
        snapshot: baseSnapshot,
        nowMs: Date.parse("2026-05-17T00:03:00.000Z")
      })
    ).toMatchObject({
      label: "Stale",
      tone: "warn"
    });
  });

  it("marks degraded and stopped snapshots as danger", () => {
    expect(
      deriveKeeperHealthView({
        labels,
        snapshot: { ...baseSnapshot, status: "degraded", lastError: "simulate reverted" },
        nowMs: Date.parse("2026-05-17T00:00:20.000Z")
      })
    ).toMatchObject({
      label: "Degraded",
      tone: "danger",
      detail: "simulate reverted"
    });

    expect(
      deriveKeeperHealthView({
        labels,
        snapshot: { ...baseSnapshot, status: "stopped" },
        nowMs: Date.parse("2026-05-17T00:00:20.000Z")
      })
    ).toMatchObject({
      label: "Stopped",
      tone: "danger"
    });
  });
});
