import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryRecentBetsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<typeof import("../../../../server/betting/recent-bets")>(
    "../../../../server/betting/recent-bets"
  );
  return {
    ...actual,
    queryRecentBets: queryRecentBetsMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/bets/recent", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.BETS_RECENT_RATE_LIMIT_PER_MINUTE;
    queryRecentBetsMock.mockReset();
    queryRecentBetsMock.mockResolvedValue({
      cached: false,
      chainId: 84532,
      fromBlock: 100,
      generatedAt: 1,
      rows: [],
      schemaVersion: 1,
      source: "rpc-window",
      toBlock: 200
    });
  });

  it("delegates query params to the recent bets service", async () => {
    const { GET } = await import("./route");
    const gameId = `0x${"aa".repeat(32)}`;
    const response = await GET(request(`/api/bets/recent?chainId=84532&limit=3&gameId=${gameId}`));

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryRecentBetsMock).toHaveBeenCalledWith({
      chainId: 84532,
      gameId,
      limit: 3
    });
  });

  it("rejects malformed game ids before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/recent?gameId=0x1234"));

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("RECENT_BETS_FAILED");
    expect(queryRecentBetsMock).not.toHaveBeenCalled();
  });

  it("returns an empty best-effort feed when aggregation is unavailable", async () => {
    queryRecentBetsMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/recent?chainId=84532&limit=12"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      cached: false,
      chainId: 84532,
      fromBlock: 0,
      rows: [],
      schemaVersion: 1,
      source: "rpc-window",
      toBlock: 0
    });
  });

  it("rate limits public recent bet reads", async () => {
    process.env.BETS_RECENT_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect((await GET(request("/api/bets/recent?chainId=84532"))).status).toBe(200);
    const response = await GET(request("/api/bets/recent?chainId=84532"));
    const body = await json(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
