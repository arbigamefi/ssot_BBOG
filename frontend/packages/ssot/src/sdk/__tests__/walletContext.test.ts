import { describe, expect, it } from "vitest";
import { nftFixture, OWNER, FIRST_ID, ONE, HASH } from "./fixtures/nft";
function fixture() {
  let current = true;
  const f = nftFixture(() => {
    if (!current)
      throw Object.assign(new Error("Wallet context changed"), {
        name: "WalletContextChangedError"
      });
  });
  return {
    ...f,
    revoke: () => {
      current = false;
    }
  };
}

describe("SDK wallet context at the signing boundary", () => {
  it("stops NFT deposit after approval if wallet or release changes", async () => {
    const f = fixture();
    f.pub.waitForTransactionReceipt.mockImplementationOnce(async () => {
      f.revoke();
      f.state.allowance = 10n;
      return { status: "success", blockNumber: 2n, logs: [] };
    });
    expect(await f.sdk.vault.addDeposit(1, 10n, OWNER)).toMatchObject({
      ok: false,
      error: { code: "WALLET_CONTEXT_CHANGED", details: { transactionSubmitted: false } }
    });
    expect(f.wallet.writeContract.mock.calls.map(([request]) => request.functionName)).toEqual([
      "approve"
    ]);
  });
  it("does not prompt a stale NFT withdrawal after its simulation finishes", async () => {
    const f = fixture();
    f.pub.simulateContract.mockImplementationOnce(async (request) => {
      f.revoke();
      return { request };
    });
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).toMatchObject({
      ok: false,
      error: { code: "WALLET_CONTEXT_CHANGED" }
    });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("keeps tracking a submitted NFT withdrawal when wallet context changes", async () => {
    const f = fixture();
    f.pub.waitForTransactionReceipt.mockImplementationOnce(async () => {
      f.revoke();
      return { status: "success", blockNumber: 2n, logs: [] };
    });
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).toMatchObject({
      ok: true,
      txHash: HASH
    });
    expect(f.wallet.writeContract).toHaveBeenCalledTimes(1);
  });
});
