import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { UnknownBlockGrace } from "./block-grace.js";
import { readPoolHealth } from "./pools.js";
const bank = "0x1111111111111111111111111111111111111111" as const;
const vault = "0x2222222222222222222222222222222222222222" as const;
const asset = "0x3333333333333333333333333333333333333333" as const;
const pool = { bank, vault, asset, decimals: 6, poolId: 1 };
function fixture() {
  const state = {
    bankCash: 12n,
    vaultCash: 100n,
    L: 100n,
    P: 10n,
    R: 30n,
    K: 20n,
    G: 110n,
    PF: 1n,
    XP: 1n,
    PP: 0n,
    accountingValid: true,
    riskInPaused: false
  };
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "getSSOT") return state;
    if (functionName === "vault") return vault;
    if (functionName === "bank") return bank;
    if (functionName === "asset") return asset;
    if (functionName === "openHolds") return 5n;
    if (functionName === "MAX_OPEN_HOLDS") return 128n;
    if (functionName === "minBetAmount") return 10_000n;
    if (functionName === "lpAccounting") return [10n, 30n, 0];
    throw new Error(`Unexpected read ${functionName}`);
  });
  const client = {
    getBlock: vi.fn(async () => ({ number: 100n })),
    readContract
  } as unknown as PublicClient;
  return { state, client, readContract };
}
describe("NFT pool health", () => {
  it("reads custody/accounting and the one open-position count at one fixed block", async () => {
    const f = fixture();
    expect(await readPoolHealth(pool, f.client)).toMatchObject({
      bank,
      vault,
      observedBlock: "100",
      openHolds: "5",
      capacityHeadroom: "123",
      minBetAmount: "10000",
      bankCash: "12",
      vaultCash: "100",
      P: "10",
      K: "20",
      G: "110",
      accountingValid: true
    });
    expect(
      f.readContract.mock.calls.every(([q]) => (q as { blockNumber?: bigint }).blockNumber === 100n)
    ).toBe(true);
    expect(f.readContract.mock.calls.map(([q]) => q.functionName)).not.toContain("activateBatch");
  });
  it("makes a deficit actionable while preserving the raw buckets", async () => {
    const f = fixture();
    f.state.accountingValid = false;
    f.state.bankCash = 0n;
    expect(await readPoolHealth(pool, f.client)).toMatchObject({
      bankCash: "0",
      P: "10",
      accountingValid: false,
      error: "Bank/Vault accounting invariant failed"
    });
  });
  it("rejects a release pointing at a different immutable Vault", async () => {
    const f = fixture();
    const original = f.readContract.getMockImplementation()!;
    f.readContract.mockImplementation(async (q) =>
      q.functionName === "vault" ? bank : original(q)
    );
    expect(await readPoolHealth(pool, f.client)).toMatchObject({
      error: expect.stringContaining("binding mismatch")
    });
  });
  it("keeps a received but unaccounted result actionable until it settles", async () => {
    const f = fixture();
    const original = f.readContract.getMockImplementation()!;
    f.readContract.mockImplementation(async (q) =>
      q.functionName === "lpAccounting" ? [10n, 30n, 2] : original(q)
    );
    expect(await readPoolHealth(pool, f.client)).toMatchObject({
      lpStatus: 2,
      error: "Canonical VRF result awaits accounting"
    });
  });
  it("does not conceal an unavailable canonical LP status as healthy zero assets", async () => {
    const f = fixture();
    const original = f.readContract.getMockImplementation()!;
    f.readContract.mockImplementation(async (q) =>
      q.functionName === "lpAccounting" ? [10n, 30n, 4] : original(q)
    );
    expect(await readPoolHealth(pool, f.client)).toMatchObject({
      L: "100",
      lpStatus: 4,
      error: expect.stringContaining("unavailable")
    });
  });

  it("holds a read that reached a node without the pinned block for five consecutive minutes", async () => {
    const f = fixture();
    let now = Date.parse("2026-10-11T00:00:00.000Z");
    const grace = new UnknownBlockGrace(() => now);
    const original = f.readContract.getMockImplementation()!;
    let missing = true;
    f.readContract.mockImplementation(async (q) => {
      if (missing && q.functionName === "getSSOT") throw new Error("header not found");
      return original(q);
    });
    const first = await readPoolHealth(pool, f.client, grace);
    expect(first.error).toBeUndefined();
    expect(first).toMatchObject({
      transientError: "Error: header not found",
      transientSince: "2026-10-11T00:00:00.000Z"
    });
    now += 299_999;
    expect((await readPoolHealth(pool, f.client, grace)).error).toBeUndefined();
    now += 1;
    expect(await readPoolHealth(pool, f.client, grace)).toMatchObject({
      error: "Error: header not found"
    });
    missing = false;
    const recovered = await readPoolHealth(pool, f.client, grace);
    expect(recovered.error).toBeUndefined();
    expect(recovered.transientError).toBeUndefined();
    // Any other failure is reported at once.
    f.readContract.mockRejectedValueOnce(new Error("execution reverted"));
    expect((await readPoolHealth(pool, f.client, grace)).error).toBe("Error: execution reverted");
  });
});
