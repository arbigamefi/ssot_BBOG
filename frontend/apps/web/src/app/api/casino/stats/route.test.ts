import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryCasinoStatsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/betting/casino-analytics", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../server/betting/casino-analytics")
  >("../../../../server/betting/casino-analytics");
  return {
    ...actual,
    queryCasinoStats: queryCasinoStatsMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/casino/stats", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.CASINO_STATS_RATE_LIMIT_PER_MINUTE;
    queryCasinoStatsMock.mockReset();
    queryCasinoStatsMock.mockResolvedValue({
      asset: {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
        symbol: "USDC"
      },
      chainId: 8453,
      games: [],
      generatedAt: 1,
      schemaVersion: 1,
      source: "postgres",
      stats: {
        betCount: 0,
        payout: "0",
        payoutGross: "0",
        settledCount: 0,
        turnover: "0",
        uniquePlayers: 0
      }
    });
  });

  it("delegates chain id to the casino stats service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/stats?chainId=8453"));

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryCasinoStatsMock).toHaveBeenCalledWith({
      asset: undefined,
      chainId: 8453,
      windowDays: undefined
    });
  });

  it("forwards a time window to the casino stats service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/stats?chainId=8453&window=7"));

    expect(response.status).toBe(200);
    expect(queryCasinoStatsMock).toHaveBeenCalledWith({
      asset: undefined,
      chainId: 8453,
      windowDays: 7
    });
  });

  it("forwards an asset scope to the casino stats service", async () => {
    const asset = `0x${"12".repeat(20)}`;
    const { GET } = await import("./route");
    const response = await GET(request(`/api/casino/stats?chainId=8453&asset=${asset}`));

    expect(response.status).toBe(200);
    expect(queryCasinoStatsMock).toHaveBeenCalledWith({
      asset,
      chainId: 8453,
      windowDays: undefined
    });
  });

  it("rejects a malformed asset before hitting the service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/stats?chainId=8453&asset=0xnope"));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_ASSET");
    expect(queryCasinoStatsMock).not.toHaveBeenCalled();
  });

  it("maps unsupported release assets to a 400", async () => {
    const asset = `0x${"34".repeat(20)}` as `0x${string}`;
    const { UnsupportedCasinoAnalyticsAssetError } =
      await import("../../../../server/betting/casino-analytics");
    queryCasinoStatsMock.mockRejectedValueOnce(
      new UnsupportedCasinoAnalyticsAssetError(8453, asset)
    );
    const { GET } = await import("./route");
    const response = await GET(request(`/api/casino/stats?chainId=8453&asset=${asset}`));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("UNSUPPORTED_ASSET");
  });

  it("rate limits public stats reads", async () => {
    process.env.CASINO_STATS_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect((await GET(request("/api/casino/stats?chainId=8453"))).status).toBe(200);
    const response = await GET(request("/api/casino/stats?chainId=8453"));
    const body = await json(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
