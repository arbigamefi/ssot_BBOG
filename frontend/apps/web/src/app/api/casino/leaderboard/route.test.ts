import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryCasinoLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/betting/casino-analytics", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../server/betting/casino-analytics")
  >("../../../../server/betting/casino-analytics");
  return {
    ...actual,
    queryCasinoLeaderboard: queryCasinoLeaderboardMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/casino/leaderboard", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.CASINO_LEADERBOARD_RATE_LIMIT_PER_MINUTE;
    queryCasinoLeaderboardMock.mockReset();
    queryCasinoLeaderboardMock.mockResolvedValue({
      asset: {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
        symbol: "USDC"
      },
      by: "turnover",
      chainId: 8453,
      generatedAt: 1,
      rows: [],
      schemaVersion: 1,
      source: "postgres"
    });
  });

  it("delegates chain id and clamped limit to the leaderboard service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/leaderboard?chainId=8453&limit=3"));

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryCasinoLeaderboardMock).toHaveBeenCalledWith({
      by: "turnover",
      chainId: 8453,
      limit: 3,
      gameId: undefined
    });
  });

  it("forwards a valid per-game gameId to the leaderboard service", async () => {
    const gameId = `0x${"11".repeat(32)}`;
    const { GET } = await import("./route");
    const response = await GET(
      request(`/api/casino/leaderboard?chainId=8453&limit=5&gameId=${gameId}`)
    );

    expect(response.status).toBe(200);
    expect(queryCasinoLeaderboardMock).toHaveBeenCalledWith({
      by: "turnover",
      chainId: 8453,
      limit: 5,
      gameId
    });
  });

  it("supports durable top-win ranking", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/leaderboard?chainId=8453&by=topWin&limit=7"));

    expect(response.status).toBe(200);
    expect(queryCasinoLeaderboardMock).toHaveBeenCalledWith({
      by: "topWin",
      chainId: 8453,
      limit: 7,
      gameId: undefined
    });
  });

  it("rejects a malformed gameId before hitting the service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/leaderboard?chainId=8453&gameId=0xnotvalid"));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_GAME_ID");
    expect(queryCasinoLeaderboardMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported ranking dimensions", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/leaderboard?chainId=8453&by=netPnl"));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("UNSUPPORTED_SORT");
    expect(queryCasinoLeaderboardMock).not.toHaveBeenCalled();
  });

  it("rate limits public leaderboard reads", async () => {
    process.env.CASINO_LEADERBOARD_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect((await GET(request("/api/casino/leaderboard?chainId=8453"))).status).toBe(200);
    const response = await GET(request("/api/casino/leaderboard?chainId=8453"));
    const body = await json(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
