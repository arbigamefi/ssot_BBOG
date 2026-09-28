import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryBetIndexStore, type BankProviderLedgerRow } from "@ssot/bet-index";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const mocks = vi.hoisted(() => ({ store: undefined as unknown, scan: vi.fn() }));
vi.mock("@ssot/bet-index", async () => ({
  ...(await vi.importActual<typeof import("@ssot/bet-index")>("@ssot/bet-index")),
  createPostgresBetIndexStore: () => mocks.store
}));
vi.mock("@ssot/ssot/sdk", () => ({
  createSSOTSDK: () => ({ bank: { getProviderLedger: mocks.scan } })
}));
vi.mock("@ssot/ssot/release", () => ({
  embeddedChainIds: [84532],
  loadEmbeddedRelease: () => ({
    ok: true,
    release: {
      pools: [
        {
          poolId: 1,
          bank: "0x1111111111111111111111111111111111111111",
          asset: "0x2222222222222222222222222222222222222222"
        }
      ]
    }
  })
}));
vi.mock("../../../../server/rpc", () => ({ resolveServerRpcUrl: () => "http://127.0.0.1:1" }));
vi.mock("../../../../server/earn/provider-ledger-chain", async () => ({
  ...(await vi.importActual<typeof import("../../../../server/earn/provider-ledger-chain")>(
    "../../../../server/earn/provider-ledger-chain"
  )),
  createProviderLedgerPublicClient: () => ({ getBlockNumber: async () => 100n })
}));

describe("provider cash flow deployment identity", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetModules();
    __resetRateLimitBucketsForTests();
    vi.stubEnv("BET_INDEX_DATABASE_URL", "postgres://local-test-only");
    vi.stubEnv("BET_INDEX_READ_ENABLED", "1");
    mocks.scan.mockReset();
  });

  it("returns claims for the selected Bank including aliases, excluding a previous Bank with the same pool ID", async () => {
    const store = createMemoryBetIndexStore();
    mocks.store = store;
    const row: BankProviderLedgerRow = {
      chainId: 84532,
      poolId: "1",
      owner: "0x3333333333333333333333333333333333333333",
      bank: "0x1111111111111111111111111111111111111111",
      asset: "0x2222222222222222222222222222222222222222",
      id: "unused",
      action: "withdraw",
      assets: "10",
      shares: "10",
      txHash: "0xaa",
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0
    };
    await store.writeBankProviderLedgerRows([
      row,
      {
        ...row,
        txHash: "0xbb",
        bank: "0x4444444444444444444444444444444444444444",
        blockNumber: 21,
        assets: "999"
      },
      { ...row, txHash: "0xcc", poolId: "9", blockNumber: 22, assets: "20" }
    ]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/earn/provider-ledger?chainId=84532&poolId=1&owner=${row.owner}`
      )
    );
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.source).toBe("postgres");
    expect(body.rows.map((item: { assets: string }) => item.assets)).toEqual(["20", "10"]);
    expect(mocks.scan).not.toHaveBeenCalled();
    const mismatched = await GET(
      new Request(
        `http://localhost/api/earn/provider-ledger?chainId=84532&poolId=1&owner=${row.owner}&bank=0x4444444444444444444444444444444444444444`
      )
    );
    expect(mismatched.status).toBe(400);
  });
  it("bounds cash to the requested snapshot and does not infer coverage from nonempty durable rows", async () => {
    const store = createMemoryBetIndexStore();
    mocks.store = store;
    const owner = "0x3333333333333333333333333333333333333333" as const;
    const bank = "0x1111111111111111111111111111111111111111" as const;
    const row: BankProviderLedgerRow = {
      chainId: 84532,
      poolId: "1",
      owner,
      bank,
      asset: bank,
      id: "unused",
      action: "recovery",
      assets: "8",
      shares: "0",
      txHash: "0xaa",
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0,
      caller: bank,
      receiver: owner,
      epochId: "1"
    };
    await store.writeBankProviderLedgerRows([
      row,
      { ...row, txHash: "0xbb", blockNumber: 21, action: "donation", receiver: bank }
    ]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/earn/provider-ledger?chainId=84532&poolId=1&owner=${owner}&endBlock=20`
      )
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.rows).toMatchObject([
      { action: "recovery", epochId: "1", receiver: owner, caller: bank }
    ]);
    expect(body.rows).toHaveLength(1);
    expect(body.coverage).toEqual({ fromBlock: null, toBlock: 20, complete: false });
  });

  it("paginates empty RPC windows instead of claiming a complete empty history", async () => {
    mocks.store = null;
    mocks.scan.mockResolvedValue([]);
    const { GET } = await import("./route");
    const owner = "0x3333333333333333333333333333333333333333";
    const response = await GET(
      new Request(
        `http://localhost/api/earn/provider-ledger?chainId=84532&poolId=1&owner=${owner}&endBlock=5000`
      )
    );
    const body = await response.json();
    expect(body).toMatchObject({
      rows: [],
      coverage: { fromBlock: 3101, toBlock: 5000, complete: false },
      page: { hasMore: true, nextCursor: { beforeBlock: 3101, beforeLogIndex: 0 } }
    });
    expect(mocks.scan).toHaveBeenCalledWith(
      1,
      owner,
      expect.objectContaining({ startBlock: 3101, endBlock: 5000 })
    );
    const last = await GET(
      new Request(
        `http://localhost/api/earn/provider-ledger?chainId=84532&poolId=1&owner=${owner}&endBlock=5000&beforeBlock=100&beforeLogIndex=0`
      )
    );
    expect(await last.json()).toMatchObject({
      coverage: { fromBlock: 0, toBlock: 5000, complete: true },
      page: { hasMore: false }
    });
  });
});
