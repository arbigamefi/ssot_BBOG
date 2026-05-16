import { describe, expect, it } from "vitest";

import { deriveKeeperHealthView, type KeeperHealthSnapshot } from "./useKeeperHealth";

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
        snapshot: baseSnapshot,
        nowMs: Date.parse("2026-05-17T00:00:20.000Z")
      })
    ).toMatchObject({
      label: "Healthy",
      tone: "success"
    });
  });

  it("warns when the snapshot is missing or stale", () => {
    expect(deriveKeeperHealthView({ snapshot: null, loadError: "HTTP 404" })).toMatchObject({
      label: "Unavailable",
      tone: "warn",
      detail: "HTTP 404"
    });

    expect(
      deriveKeeperHealthView({
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
        snapshot: { ...baseSnapshot, status: "stopped" },
        nowMs: Date.parse("2026-05-17T00:00:20.000Z")
      })
    ).toMatchObject({
      label: "Stopped",
      tone: "danger"
    });
  });
});
