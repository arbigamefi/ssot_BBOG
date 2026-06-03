import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const queryCasinoTimeseriesMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../server/betting/casino-analytics", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../server/betting/casino-analytics")
  >("../../../../server/betting/casino-analytics");
  return {
    ...actual,
    queryCasinoTimeseries: queryCasinoTimeseriesMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/casino/timeseries", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.CASINO_TIMESERIES_RATE_LIMIT_PER_MINUTE;
    queryCasinoTimeseriesMock.mockReset();
    queryCasinoTimeseriesMock.mockResolvedValue({
      asset: {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
        symbol: "USDC"
      },
      chainId: 8453,
      days: 7,
      generatedAt: 1,
      gameId: null,
      points: [],
      schemaVersion: 1,
      source: "postgres"
    });
  });

  it("delegates chain id and clamped day window to the timeseries service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/timeseries?chainId=8453&days=14"));

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryCasinoTimeseriesMock).toHaveBeenCalledWith({
      asset: undefined,
      chainId: 8453,
      days: 14
    });
  });

  it("forwards a valid per-game gameId to the timeseries service", async () => {
    const gameId = `0x${"11".repeat(32)}`;
    const { GET } = await import("./route");
    const response = await GET(
      request(`/api/casino/timeseries?chainId=8453&days=7&gameId=${gameId}`)
    );

    expect(response.status).toBe(200);
    expect(queryCasinoTimeseriesMock).toHaveBeenCalledWith({
      asset: undefined,
      chainId: 8453,
      days: 7,
      gameId
    });
  });

  it("forwards an asset scope to the timeseries service", async () => {
    const asset = `0x${"12".repeat(20)}`;
    const { GET } = await import("./route");
    const response = await GET(
      request(`/api/casino/timeseries?chainId=8453&days=7&asset=${asset}`)
    );

    expect(response.status).toBe(200);
    expect(queryCasinoTimeseriesMock).toHaveBeenCalledWith({
      asset,
      chainId: 8453,
      days: 7
    });
  });

  it("rejects a malformed gameId before hitting the service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/timeseries?chainId=8453&gameId=0xnope"));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_GAME_ID");
    expect(queryCasinoTimeseriesMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed asset before hitting the service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/timeseries?chainId=8453&asset=0xnotvalid"));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_ASSET");
    expect(queryCasinoTimeseriesMock).not.toHaveBeenCalled();
  });

  it("clamps an excessive day window before hitting the service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/casino/timeseries?chainId=8453&days=999"));

    expect(response.status).toBe(200);
    expect(queryCasinoTimeseriesMock).toHaveBeenCalledWith({
      asset: undefined,
      chainId: 8453,
      days: 90
    });
  });

  it("maps unsupported release assets to a 400", async () => {
    const asset = `0x${"34".repeat(20)}` as `0x${string}`;
    const { UnsupportedCasinoAnalyticsAssetError } =
      await import("../../../../server/betting/casino-analytics");
    queryCasinoTimeseriesMock.mockRejectedValueOnce(
      new UnsupportedCasinoAnalyticsAssetError(8453, asset)
    );
    const { GET } = await import("./route");
    const response = await GET(request(`/api/casino/timeseries?chainId=8453&asset=${asset}`));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("UNSUPPORTED_ASSET");
  });

  it("rate limits public timeseries reads", async () => {
    process.env.CASINO_TIMESERIES_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect((await GET(request("/api/casino/timeseries?chainId=8453"))).status).toBe(200);
    const response = await GET(request("/api/casino/timeseries?chainId=8453"));
    const body = await json(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
