import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEmbeddedReleaseMock = vi.hoisted(() => vi.fn());

vi.mock("@ssot/ssot/release", () => ({
  loadEmbeddedRelease: loadEmbeddedReleaseMock
}));

describe("casino analytics asset resolution", () => {
  beforeEach(() => {
    delete process.env.BET_INDEX_DATABASE_URL;
    delete process.env.BET_INDEX_READ_ENABLED;
    loadEmbeddedReleaseMock.mockReset();
    loadEmbeddedReleaseMock.mockReturnValue({
      ok: true,
      release: {
        assets: [
          {
            address: "0x0000000000000000000000000000000000000001",
            decimals: 6,
            symbol: "USDC"
          },
          {
            address: "0x0000000000000000000000000000000000000002",
            decimals: 6,
            symbol: "USDT"
          }
        ],
        gamesMeta: [],
        pools: [
          {
            active: true,
            asset: "0x0000000000000000000000000000000000000002",
            domain: "Casino",
            poolId: 2
          }
        ]
      }
    });
  });

  it("defaults analytics to the active casino pool asset", async () => {
    const { queryCasinoStats } = await import("./casino-analytics");

    const response = await queryCasinoStats({ chainId: 8453 });

    expect(response.source).toBe("unavailable");
    expect(response.asset).toEqual({
      address: "0x0000000000000000000000000000000000000002",
      decimals: 6,
      symbol: "USDT"
    });
  });

  it("rejects a release asset that is not backed by an active casino pool", async () => {
    const { queryCasinoStats, UnsupportedCasinoAnalyticsAssetError } =
      await import("./casino-analytics");

    await expect(
      queryCasinoStats({
        asset: "0x0000000000000000000000000000000000000001",
        chainId: 8453
      })
    ).rejects.toBeInstanceOf(UnsupportedCasinoAnalyticsAssetError);
  });
});
