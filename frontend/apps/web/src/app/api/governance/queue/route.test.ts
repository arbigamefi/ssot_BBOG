import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryGovernanceQueueMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/governance/timelock-queue", () => ({
  queryGovernanceQueue: queryGovernanceQueueMock
}));

describe("GET /api/governance/queue", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.GOVERNANCE_QUEUE_RATE_LIMIT_PER_MINUTE;
    queryGovernanceQueueMock.mockReset();
    queryGovernanceQueueMock.mockResolvedValue({
      schemaVersion: 1,
      source: "postgres",
      operations: []
    });
  });

  it("reads the queue of the requested chain without caching the answer", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/governance/queue?chainId=84532"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(queryGovernanceQueueMock).toHaveBeenCalledWith({ chainId: 84532 });
    expect(await response.json()).toMatchObject({ source: "postgres" });
  });

  it("rate-limits before reading the index", async () => {
    process.env.GOVERNANCE_QUEUE_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/governance/queue?chainId=84532"));
    const limited = await GET(new Request("http://localhost/api/governance/queue?chainId=84532"));
    expect(limited.status).toBe(429);
    expect(queryGovernanceQueueMock).toHaveBeenCalledTimes(1);
  });
});
