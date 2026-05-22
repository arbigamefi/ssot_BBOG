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

    expect(screen.getByRole("heading", { name: /system status/i })).toBeTruthy();
    expect(screen.getAllByText("Operational")).toHaveLength(4);
    expect(screen.getByText("84532")).toBeTruthy();
    expect(screen.getByText("Base Sepolia")).toBeTruthy();
    expect(screen.getByText("postgres")).toBeTruthy();
    expect(screen.getByRole("link", { name: "JSON" }).getAttribute("href")).toBe("/api/healthz");
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

    render(await StatusPage());

    expect(screen.getAllByText("Degraded")).toHaveLength(4);
    expect(screen.getByText("No embedded release")).toBeTruthy();
    expect(screen.getByText("keeper status is stopped")).toBeTruthy();
    expect(screen.getByText("durable Postgres bet index is required")).toBeTruthy();
  });
});
