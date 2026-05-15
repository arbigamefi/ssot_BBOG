import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const syncNow = vi.fn(async () => undefined);
const refreshIndexerStatus = vi.fn();

const state = {
  release: {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    contracts: {
      hub: "0x1111111111111111111111111111111111111111",
      vrfHub: "0x2222222222222222222222222222222222222222",
      bankRegistry: "0x3333333333333333333333333333333333333333"
    },
    assets: [
      {
        address: "0x4444444444444444444444444444444444444444",
        bank: "0x5555555555555555555555555555555555555555",
        symbol: "USDC",
        decimals: 6
      }
    ]
  } as any,
  indexerStatus: {
    chainId: 84532,
    hub: "0x1111111111111111111111111111111111111111",
    running: true,
    latestBlock: 120,
    safeHeadBlock: 108,
    lastSyncedBlock: 106,
    lagBlocks: 2,
    lastRunAt: 1_765_000_000_000,
    config: {
      confirmations: 12,
      pollIntervalMs: 10_000,
      batchSize: 2_000,
      rewindBlocks: 24
    }
  } as any
};

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release })
}));

vi.mock("../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus,
    syncNow,
    refreshIndexerStatus
  })
}));

vi.mock("../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

import { OpsPageClient } from "./pageClient";

describe("OpsPageClient", () => {
  afterEach(() => {
    cleanup();
    syncNow.mockClear();
    refreshIndexerStatus.mockClear();
    state.indexerStatus.lastError = undefined;
    state.indexerStatus.running = true;
    state.indexerStatus.lagBlocks = 2;
  });

  it("frames ops as a release and worker pulse", () => {
    render(<OpsPageClient />);

    expect(screen.getByRole("heading", { name: /Release and worker pulse/i })).toBeDefined();
    expect(screen.getByText("Canonical release proof")).toBeDefined();
    expect(screen.getByText("Operational focus")).toBeDefined();
    expect(screen.getByText("Recent operational receipts")).toBeDefined();
    expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
    expect(screen.getByText("2 blocks")).toBeDefined();
  });

  it("keeps sync and refresh actions wired to the runtime", () => {
    render(<OpsPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Sync indexer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(refreshIndexerStatus).toHaveBeenCalledTimes(1);
  });
});
