import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const syncNow = vi.fn(async () => undefined);
const refreshIndexerStatus = vi.fn();
const refreshKeeperHealth = vi.fn(async () => undefined);

const state = {
  release: {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    contracts: {
      gameHub: "0x1111111111111111111111111111111111111111",
      vrfHub: "0x2222222222222222222222222222222222222222",
      poolRegistry: "0x3333333333333333333333333333333333333333"
    },
    assets: [
      {
        address: "0x4444444444444444444444444444444444444444",
        symbol: "USDC",
        decimals: 6
      },
      {
        address: "0x7777777777777777777777777777777777777777",
        symbol: "USDT",
        decimals: 6
      }
    ],
    pools: [
      {
        asset: "0x7777777777777777777777777777777777777777",
        bank: "0x8888888888888888888888888888888888888888",
        domain: "Casino",
        poolId: 2
      }
    ]
  } as any,
  indexerStatus: {
    chainId: 84532,
    gameHub: "0x1111111111111111111111111111111111111111",
    running: true,
    latestBlock: 220,
    targetBlock: 100,
    blocksPerSecond: 5,
    lastSyncedBlock: 90,
    lagSeconds: 2,
    lastRunAt: 1_765_000_000_000,
    config: {
      confirmationSeconds: 24,
      pollIntervalMs: 10_000,
      batchSize: 200,
      rewindSeconds: 48
    }
  } as any,
  keeperHealth: {
    schemaVersion: 1,
    status: "running",
    role: "primary",
    chainId: 84532,
    gameHub: "0x1111111111111111111111111111111111111111",
    vrfHub: "0x2222222222222222222222222222222222222222",
    keeper: "0x6666666666666666666666666666666666666666",
    startedAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:10.000Z",
    lastScannedBlock: "120",
    queueDepth: 0,
    lastFinalizeSuccessAt: "2026-05-17T00:00:09.000Z",
    lastFinalizeSuccess: {
      betId: "14",
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      latencyMs: 4200
    }
  } as any
};

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release })
}));

// The governance panel reads its own API route; it has its own tests.
vi.mock("../../../features/ops/ops-governance-panel", () => ({
  OpsGovernancePanel: () => null
}));

vi.mock("../../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus,
    syncNow,
    refreshIndexerStatus
  })
}));

vi.mock("../../../features/ops/useKeeperHealth", () => ({
  useKeeperHealth: () => ({
    snapshot: state.keeperHealth,
    view: {
      label: "Healthy",
      tone: "success",
      detail: "Keeper primary updated 10s ago."
    },
    refresh: refreshKeeperHealth
  })
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;

  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);
  }

  function translate(key: string, values?: Record<string, string | number>) {
    const message = resolveMessage(`ops.${key}`);
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  }

  return {
    useLocale: () => "en",
    useTranslations: () => translate
  };
});

import { OpsPageClient } from "./pageClient";

describe("OpsPageClient", () => {
  afterEach(() => {
    cleanup();
    syncNow.mockClear();
    refreshIndexerStatus.mockClear();
    refreshKeeperHealth.mockClear();
    state.indexerStatus.lastError = undefined;
    state.indexerStatus.running = true;
    state.indexerStatus.lagSeconds = 2;
  });

  it("frames ops as a release and worker pulse", () => {
    render(<OpsPageClient />);

    expect(screen.getByRole("heading", { name: /Release and worker pulse/i })).toBeDefined();
    expect(screen.getByText("Canonical release proof")).toBeDefined();
    expect(screen.getByText("Operational focus")).toBeDefined();
    expect(screen.getByText("Recent operational receipts")).toBeDefined();
    expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
    expect(screen.getByText("2 s")).toBeDefined();
    expect(screen.getByText("Healthy within 24 seconds.")).toBeDefined();
    expect(screen.getByText("48 s")).toBeDefined();
    expect(screen.getByText("200 blocks")).toBeDefined();
    expect(screen.getByText("Keeper state")).toBeDefined();
    expect(screen.getAllByText("Casino keeper").length).toBeGreaterThan(0);
    expect(screen.getByText("Keeper queue")).toBeDefined();
    expect(screen.getByText("0 pending")).toBeDefined();
    expect(screen.getByText("0x8888...8888")).toBeDefined();
  });

  it.each([
    [25, "Behind"],
    [72, "Behind"],
    [73, "Stalled"]
  ])("judges an indexer lag of %i seconds %s against the 24-second window", (lag, label) => {
    state.indexerStatus.lagSeconds = lag;
    render(<OpsPageClient />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText(`${lag} s`)).toBeDefined();
  });

  it("keeps sync and refresh actions wired to the runtime", () => {
    render(<OpsPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Sync indexer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(refreshIndexerStatus).toHaveBeenCalledTimes(1);
    expect(refreshKeeperHealth).toHaveBeenCalledTimes(1);
  });
});
