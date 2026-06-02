import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHealthzSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("../../../server/healthz", () => ({
  getHealthzSnapshot: getHealthzSnapshotMock
}));

import StatusPage from "./page";

describe("StatusPage", () => {
  afterEach(() => {
    cleanup();
    getHealthzSnapshotMock.mockReset();
  });

  it("renders the health snapshot as a public status page", async () => {
    getHealthzSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "ok",
      chainId: 8453,
      generatedAt: "2026-05-23T00:00:00.000Z",
      checks: {
        release: {
          status: "ok",
          name: "Base",
          warnings: []
        },
        keeper: {
          status: "ok",
          role: "primary",
          keeperStatus: "running",
          updatedAt: "2026-05-23T00:00:00.000Z",
          ageMs: 12_000,
          queueDepth: 0
        },
        betIndex: {
          status: "ok",
          source: "postgres",
          rows: 1,
          durableRequired: true,
          durableConfigured: true
        }
      }
    });
    getHealthzSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "ok",
      chainId: 84532,
      generatedAt: "2026-05-23T00:00:00.000Z",
      checks: {
        release: {
          status: "ok",
          name: "Base Sepolia",
          warnings: []
        },
        keeper: {
          status: "ok",
          role: "primary",
          keeperStatus: "running",
          updatedAt: "2026-05-23T00:00:00.000Z",
          ageMs: 42_000,
          queueDepth: 0
        },
        betIndex: {
          status: "ok",
          source: "postgres",
          rows: 1,
          durableRequired: false,
          durableConfigured: true
        }
      }
    });

    render(await StatusPage());

    expect(screen.getByRole("heading", { name: /system status by chain/i })).toBeTruthy();
    expect(screen.getAllByText("Base Mainnet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Base Sepolia").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chainId 8453").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chainId 84532").length).toBeGreaterThan(0);
    expect(screen.getByText("Base")).toBeTruthy();
    expect(screen.getAllByText("Base Sepolia").length).toBeGreaterThan(0);
    expect(screen.getAllByText("postgres").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Default JSON" }).getAttribute("href")).toBe(
      "/api/healthz"
    );
    const jsonLinks = screen.getAllByRole("link", { name: "JSON" });
    expect(jsonLinks).toHaveLength(2);
    expect(jsonLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/api/healthz?chainId=8453",
      "/api/healthz?chainId=84532"
    ]);
    expect(getHealthzSnapshotMock).toHaveBeenCalledWith({ chainId: 8453 });
    expect(getHealthzSnapshotMock).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it("surfaces degraded check messages", async () => {
    getHealthzSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "degraded",
      chainId: 8453,
      generatedAt: "2026-05-23T00:00:00.000Z",
      checks: {
        release: {
          status: "degraded",
          warnings: [],
          message: "No embedded release"
        },
        keeper: {
          status: "degraded",
          role: "primary",
          keeperStatus: "stopped",
          updatedAt: "2026-05-23T00:00:00.000Z",
          ageMs: null,
          queueDepth: 1,
          message: "keeper status is stopped"
        },
        betIndex: {
          status: "degraded",
          source: "rpc-window",
          rows: 0,
          durableRequired: true,
          durableConfigured: false,
          message: "durable Postgres bet index is required"
        }
      }
    });
    getHealthzSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "ok",
      chainId: 84532,
      generatedAt: "2026-05-23T00:00:00.000Z",
      checks: {
        release: {
          status: "ok",
          name: "Base Sepolia",
          warnings: []
        },
        keeper: {
          status: "ok",
          role: "primary",
          keeperStatus: "running",
          updatedAt: "2026-05-23T00:00:00.000Z",
          ageMs: 42_000,
          queueDepth: 0
        },
        betIndex: {
          status: "ok",
          source: "postgres",
          rows: 1,
          durableRequired: false,
          durableConfigured: true
        }
      }
    });

    render(await StatusPage());

    expect(screen.getAllByText("Degraded").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("No embedded release")).toBeTruthy();
    expect(screen.getByText("keeper status is stopped")).toBeTruthy();
    expect(screen.getByText("durable Postgres bet index is required")).toBeTruthy();
  });
});
