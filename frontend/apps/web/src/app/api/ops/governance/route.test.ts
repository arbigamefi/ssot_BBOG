import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryOpsGovernanceMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/governance/timelock-queue", () => ({
  queryOpsGovernance: queryOpsGovernanceMock
}));

describe("GET /api/ops/governance", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.OPS_GOVERNANCE_RATE_LIMIT_PER_MINUTE;
    queryOpsGovernanceMock.mockReset();
    queryOpsGovernanceMock.mockResolvedValue({
      schemaVersion: 1,
      source: "postgres",
      operations: [],
      voidWindows: [],
      disabledGames: []
    });
  });

  it("returns the full governance history of the requested chain", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ops/governance?chainId=84532"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(queryOpsGovernanceMock).toHaveBeenCalledWith({ chainId: 84532 });
    expect(await response.json()).toMatchObject({ voidWindows: [], disabledGames: [] });
  });

  it("rate-limits before reading the index", async () => {
    process.env.OPS_GOVERNANCE_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/ops/governance?chainId=84532"));
    const limited = await GET(new Request("http://localhost/api/ops/governance?chainId=84532"));
    expect(limited.status).toBe(429);
    expect(queryOpsGovernanceMock).toHaveBeenCalledTimes(1);
  });
});
