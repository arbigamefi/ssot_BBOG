import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLandingOverview } from "./landing-overview";

const valid = { source: "rpc", chainId: 8453, releaseDigest: "release-a", rows: [] };
afterEach(() => vi.unstubAllGlobals());
function respond(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}
describe("landing bank evidence", () => {
  it.each([
    [valid, 429],
    [{ ...valid, source: "unavailable" }, 200],
    [{ ...valid, chainId: 84532 }, 200],
    [{ ...valid, releaseDigest: "old-release" }, 200],
    [{ ...valid, rows: null }, 200]
  ])(
    "rejects failed or mismatched reads rather than returning empty balances",
    async (body, status) => {
      respond(body, status);
      await expect(fetchLandingOverview(8453, "release-a")).rejects.toThrow();
    }
  );
  it("accepts a successful empty response and preserves exact asset units", async () => {
    respond(valid);
    await expect(fetchLandingOverview(8453, "release-a")).resolves.toEqual({ assets: [] });
    respond({
      ...valid,
      rows: [
        {
          address: "0x01",
          symbol: "WETH",
          decimals: 18,
          totalAssets: "1234567890123456789",
          totalReserved: "0",
          turnover: "0",
          protocolFee: "0"
        }
      ]
    });
    const result = await fetchLandingOverview(8453, "release-a");
    expect(result.assets[0]?.totalAssets).toBe(1234567890123456789n);
    expect(result.assets[0]?.decimals).toBe(18);
  });
});
