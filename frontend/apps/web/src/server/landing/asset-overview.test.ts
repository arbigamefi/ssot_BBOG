import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), block: vi.fn() }));
const bank = "0x1111111111111111111111111111111111111111";
const vault = "0x2222222222222222222222222222222222222222";
const asset = "0x3333333333333333333333333333333333333333";
vi.mock("viem", async () => ({
  ...(await vi.importActual<typeof import("viem")>("viem")),
  createPublicClient: () => ({ getBlockNumber: mocks.block })
}));
vi.mock("@ssot/ssot/sdk", () => ({
  createSSOTSDK: () => ({ bank: { getSnapshot: mocks.snapshot } })
}));
vi.mock("@ssot/ssot/release", () => ({
  loadEmbeddedRelease: () => ({
    ok: true,
    release: {
      releaseDigest: "0x123",
      assets: [{ address: asset, bank, symbol: "USDC", decimals: 6 }],
      pools: [{ poolId: 1, bank, vault, asset, symbol: "USDC", decimals: 6 }]
    }
  })
}));
vi.mock("../rpc", () => ({ resolveServerRpcUrl: () => "http://127.0.0.1:1" }));
import { queryLandingAssetOverview } from "./asset-overview";
beforeEach(() => {
  mocks.block.mockResolvedValue(12n);
  mocks.snapshot.mockReset();
  mocks.snapshot.mockResolvedValue({
    bank,
    vault,
    L: 100n,
    K: 10n,
    P: 20n,
    R: 30n,
    G: 120n,
    accountingValid: true,
    totalTurnover: 1000n,
    totalProtocolFeeAccrued: 5n
  });
});
describe("landing LP capital", () => {
  it("uses tree capital and net LP lock, not bettor principal or Bank cash", async () => {
    const result = await queryLandingAssetOverview(84532);
    expect(mocks.snapshot).toHaveBeenCalledWith(1, { blockNumber: 12n });
    expect(result).toMatchObject({
      source: "rpc",
      rows: [{ lpCapital: "100", lockedCapital: "10", turnover: "1000", protocolFee: "5" }]
    });
  });
  it.each(["mismatch", "invalid", "offline"])(
    "marks %s authoritative reads unavailable",
    async (mode) => {
      if (mode === "offline") mocks.snapshot.mockRejectedValue(new Error("RPC"));
      else
        mocks.snapshot.mockResolvedValue({
          bank,
          vault: mode === "mismatch" ? bank : vault,
          accountingValid: mode !== "invalid"
        });
      expect(await queryLandingAssetOverview(84532)).toMatchObject({
        source: "unavailable",
        rows: []
      });
    }
  );
});
