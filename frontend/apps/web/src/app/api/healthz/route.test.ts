import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../server/http/rate-limit";

const queryRecentBetsMock = vi.hoisted(() => vi.fn());
const readKeeperHealthSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("../../../server/betting/recent-bets", () => ({
  queryRecentBets: queryRecentBetsMock
}));

vi.mock("../../../server/ops/keeper-health", () => ({
  readKeeperHealthSnapshot: readKeeperHealthSnapshotMock
}));

const originalEnv = process.env;

function request() {
  return new Request("http://localhost/api/healthz");
}

describe("GET /api/healthz", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_CHAIN_ID: "84532",
      HEALTHZ_KEEPER_MAX_AGE_MS: "300000"
    };
    queryRecentBetsMock.mockReset();
    queryRecentBetsMock.mockResolvedValue({
      schemaVersion: 1,
      cached: false,
      chainId: 84532,
      fromBlock: 1,
      generatedAt: 1,
      rows: [],
      source: "rpc-window",
      toBlock: 2
    });
    readKeeperHealthSnapshotMock.mockReset();
    readKeeperHealthSnapshotMock.mockResolvedValue({
      schemaVersion: 1,
      status: "running",
      role: "primary",
      chainId: 84532,
      gameHub: `0x${"11".repeat(20)}`,
      vrfHub: `0x${"22".repeat(20)}`,
      keeper: `0x${"33".repeat(20)}`,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      queueDepth: 0
    });
  });

  it("returns ok when release, keeper, and optional index checks are healthy", async () => {
    const { GET } = await import("./route");
    const response = await GET(request());
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-ratelimit-limit")).toBe("120");
    expect(body).toMatchObject({
      schemaVersion: 1,
      status: "ok",
      chainId: 84532,
      checks: {
        release: { status: "ok" },
        keeper: { status: "ok", keeperStatus: "running" },
        betIndex: {
          status: "ok",
          durableRequired: false,
          source: "rpc-window"
        }
      }
    });
    expect(queryRecentBetsMock).toHaveBeenCalledWith({ chainId: 84532, limit: 1 });
  });

  it("degrades Base mainnet when keeper and durable index are not ready", async () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = "8453";
    process.env.BET_INDEX_DATABASE_URL = "";
    queryRecentBetsMock.mockResolvedValueOnce({
      schemaVersion: 1,
      cached: false,
      chainId: 8453,
      fromBlock: 0,
      generatedAt: 1,
      rows: [],
      source: "rpc-window",
      toBlock: 0
    });
    readKeeperHealthSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "stopped",
      role: "primary",
      chainId: 8453,
      gameHub: "0x0000000000000000000000000000000000000000",
      vrfHub: "0x0000000000000000000000000000000000000000",
      keeper: "0x0000000000000000000000000000000000000000",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      queueDepth: 0
    });

    const { GET } = await import("./route");
    const response = await GET(request());
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.release.status).toBe("ok");
    expect(body.checks.keeper.status).toBe("degraded");
    expect(body.checks.betIndex).toMatchObject({
      status: "degraded",
      durableRequired: true,
      durableConfigured: false
    });
  });

  it("degrades stale keeper snapshots", async () => {
    readKeeperHealthSnapshotMock.mockResolvedValueOnce({
      schemaVersion: 1,
      status: "running",
      role: "primary",
      chainId: 84532,
      gameHub: `0x${"11".repeat(20)}`,
      vrfHub: `0x${"22".repeat(20)}`,
      keeper: `0x${"33".repeat(20)}`,
      startedAt: new Date(Date.now() - 900000).toISOString(),
      updatedAt: new Date(Date.now() - 900000).toISOString(),
      queueDepth: 0
    });

    const { GET } = await import("./route");
    const response = await GET(request());
    const body = (await response.json()) as any;

    expect(body.status).toBe("degraded");
    expect(body.checks.keeper).toMatchObject({
      status: "degraded",
      keeperStatus: "running"
    });
    expect(body.checks.keeper.message).toContain("stale");
  });

  it("rate limits public health checks per client", async () => {
    process.env.HEALTHZ_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect((await GET(request())).status).toBe(200);
    const response = await GET(request());
    const body = (await response.json()) as any;

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
