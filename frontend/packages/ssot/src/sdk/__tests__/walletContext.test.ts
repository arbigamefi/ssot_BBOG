import { describe, expect, it, vi } from "vitest";
import type { PublicClient, WalletClient } from "viem";
import { createSSOTSDK } from "../create";
import type { SSOTRelease } from "../../release/schema";

const ACCOUNT = "0x0000000000000000000000000000000000000011" as const;
const BANK = "0x0000000000000000000000000000000000000022" as const;
const ASSET = "0x0000000000000000000000000000000000000033" as const;
const HASH = `0x${"a".repeat(64)}` as const;
const release = {
  chainId: 84532,
  releaseDigest: "wallet-context-test",
  pools: [{ poolId: 1, active: true, asset: ASSET, bank: BANK, decimals: 6 }],
  contracts: { gameHub: BANK, vrfHub: BANK, sportsHub: BANK, refRegistry: BANK }
} as unknown as SSOTRelease;

function fixture() {
  let current = true;
  let allowance = 0n;
  const pub = {
    getBlockNumber: vi.fn().mockResolvedValue(1n),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "allowance" ? allowance : 10n
    ),
    simulateContract: vi.fn(async (request) => ({ request })),
    waitForTransactionReceipt: vi.fn(async () => {
      allowance = 10n;
      return { status: "success", blockNumber: 2n, logs: [] };
    })
  };
  const wallet = { writeContract: vi.fn().mockResolvedValue(HASH) };
  const sdk = createSSOTSDK({
    release,
    publicClient: pub as unknown as PublicClient,
    walletClient: wallet as unknown as WalletClient,
    account: ACCOUNT,
    assertWalletContext: () => {
      if (!current)
        throw Object.assign(new Error("Wallet context changed"), {
          name: "WalletContextChangedError"
        });
    }
  });
  return {
    sdk,
    pub,
    wallet,
    revoke: () => {
      current = false;
    }
  };
}

describe("SDK wallet context at the signing boundary", () => {
  it.each(["deposit", "mint"] as const)(
    "stops %s after approval if the wallet or release changed while confirming",
    async (method) => {
      const f = fixture();
      f.pub.waitForTransactionReceipt.mockImplementationOnce(async () => {
        f.revoke();
        f.pub.readContract.mockResolvedValue(10n);
        return { status: "success", blockNumber: 2n, logs: [] };
      });
      const result = await f.sdk.bank[method](1, 10n, ACCOUNT);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "WALLET_CONTEXT_CHANGED", details: { transactionSubmitted: false } }
      });
      expect(f.wallet.writeContract.mock.calls.map(([request]) => request.functionName)).toEqual([
        "approve"
      ]);
    }
  );

  it("does not prompt a stale redemption after its simulation finishes", async () => {
    const f = fixture();
    f.pub.simulateContract.mockImplementationOnce(async (request) => {
      f.revoke();
      return { request };
    });
    const result = await f.sdk.bank.requestRedeem(1, 10n, ACCOUNT, ACCOUNT);
    expect(result).toMatchObject({ ok: false, error: { code: "WALLET_CONTEXT_CHANGED" } });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });

  it("keeps tracking a transaction already submitted when the wallet changes", async () => {
    const f = fixture();
    f.pub.waitForTransactionReceipt.mockImplementationOnce(async () => {
      f.revoke();
      return { status: "success", blockNumber: 2n, logs: [] };
    });
    expect(await f.sdk.bank.requestRedeem(1, 10n, ACCOUNT, ACCOUNT)).toMatchObject({
      ok: true,
      txHash: HASH
    });
    expect(f.wallet.writeContract).toHaveBeenCalledTimes(1);
  });
});
