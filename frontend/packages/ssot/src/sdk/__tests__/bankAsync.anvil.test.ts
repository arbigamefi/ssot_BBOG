import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defineChain,
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  type Abi,
  type Address,
  type Hex
} from "viem";
import { createSSOTSDK } from "../create";
import { getContractAbis } from "../../abis/index.mjs";
const { BankAbi } = getContractAbis();
import type { SSOTRelease } from "../../release/schema";

// Opt-in, existing local artifacts only. Never fork or connect this test to a live chain.
// anvil --host 127.0.0.1 --port 18549 --chain-id 84532 --silent
// BANK_ANVIL_RPC=http://127.0.0.1:18549 pnpm -C frontend/packages/ssot exec vitest run -c vitest.config.ts src/sdk/__tests__/bankAsync.anvil.test.ts
const rpc = process.env.BANK_ANVIL_RPC;
if (rpc) {
  const url = new URL(rpc);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") {
    throw new Error("BANK_ANVIL_RPC must be an isolated http://127.0.0.1 Anvil endpoint.");
  }
}
const repo = fileURLToPath(new URL("../../../../../../", import.meta.url));
function artifact(name: string): { abi: Abi; bytecode: { object: Hex } } {
  return JSON.parse(readFileSync(`${repo}out/${name}.sol/${name}.json`, "utf8"));
}

async function fixture(tokenName: "MockERC20" | "BlacklistToken" = "MockERC20") {
  const transport = http(rpc!);
  const localChain = defineChain({
    id: 84532,
    name: "Isolated local Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc!] } }
  });
  const client = createPublicClient({
    chain: localChain,
    transport,
    cacheTime: 0,
    pollingInterval: 20
  });
  const wallet = createWalletClient({ chain: localChain, transport });
  const evm = createTestClient({ mode: "anvil", chain: localChain, transport });
  const metadata = await evm.getAutomine(); // Verify the endpoint exposes local Anvil methods before writing.
  expect(metadata).toBe(true);
  const [owner, player, depositor] = await wallet.getAddresses();
  if (!owner || !player || !depositor)
    throw new Error("Anvil must expose at least three unlocked local accounts.");
  async function deploy(name: string, args: readonly unknown[]) {
    const compiled = artifact(name);
    const hash = await wallet.deployContract({
      account: owner!,
      abi: compiled.abi,
      bytecode: compiled.bytecode.object,
      args
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress || receipt.status !== "success")
      throw new Error(`${name} deployment failed`);
    return { address: receipt.contractAddress, abi: compiled.abi };
  }
  const token = await deploy(
    tokenName,
    tokenName === "MockERC20" ? ["Local test asset", "LOCAL", 6] : []
  );
  const bank = await deploy("Bank", [token.address, owner, 0n, "Local Bank share", "LBS", 6]);
  const makeRelease = (bankAddress: Address) =>
    ({
      chainId: localChain.id,
      releaseDigest: "anvil-only-sdk-integration",
      isPlaceholder: true,
      contracts: {
        gameHub: bankAddress,
        vrfHub: bankAddress,
        sportsHub: bankAddress,
        refRegistry: bankAddress
      },
      pools: [
        {
          poolId: 1,
          domainId: 0,
          domain: "casino",
          active: true,
          asset: token.address,
          bank: bankAddress,
          symbol: "LOCAL",
          decimals: 6
        }
      ],
      games: {},
      gamesMeta: []
    }) as unknown as SSOTRelease;
  const sdkFor = (account: Address) =>
    createSSOTSDK({
      release: makeRelease(bank.address),
      publicClient: client,
      walletClient: wallet,
      account
    });
  const sdk = sdkFor(owner);
  const minted = await wallet.writeContract({
    account: owner,
    address: token.address,
    abi: token.abi,
    functionName: "mint",
    args: [owner, 1_000_000_000n]
  });
  await client.waitForTransactionReceipt({ hash: minted });

  async function write(
    contract: { address: Address; abi: Abi },
    functionName: string,
    args: readonly unknown[] = [],
    account: Address = owner!
  ) {
    const hash = await wallet.writeContract({ ...contract, account, functionName, args });
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    return receipt;
  }
  return { client, wallet, evm, owner, player, depositor, token, bank, sdk, sdkFor, write };
}

describe.skipIf(!rpc)("Bank SDK on isolated Anvil", () => {
  it("deposits, cancels, prices and claims with actual ABI and cash-event ledger", async () => {
    const { client, wallet, evm, owner, token, bank, sdk } = await fixture();

    expect((await sdk.bank.deposit(1, 100_000_000n, owner)).ok).toBe(true);
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      shares: 100_000_000n,
      activeAndClaimableAssets: 100_000_000n
    });
    expect((await sdk.bank.requestRedeem(1, 40_000_000n)).ok).toBe(true);
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      shares: 60_000_000n,
      queuedShares: 40_000_000n,
      cancellableShares: 40_000_000n,
      claimableAssets: 0n
    });
    expect((await sdk.bank.cancelRedeemRequest(1)).ok).toBe(true);
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      shares: 100_000_000n,
      queuedShares: 0n,
      cancellableShares: 0n,
      queuedBatch: null
    });
    expect((await sdk.bank.requestRedeem(1, 40_000_000n)).ok).toBe(true);
    const pending = await sdk.bank.getPosition(1, owner);
    const cutoff = pending.queuedBatch?.cutoff;
    if (!cutoff) throw new Error("Missing controller batch cutoff.");
    await evm.setNextBlockTimestamp({ timestamp: cutoff });
    await evm.mine({ blocks: 1 });
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      queuedShares: 40_000_000n,
      cancellableShares: 40_000_000n
    });
    const cancelledAtCutoff = await sdk.bank.cancelRedeemRequest(1);
    expect(cancelledAtCutoff.ok).toBe(true);
    expect((await sdk.bank.requestRedeem(1, 40_000_000n)).ok).toBe(true);
    const queuedAgain = await sdk.bank.getPosition(1, owner);
    const nextCutoff = queuedAgain.queuedBatch?.cutoff;
    if (!nextCutoff) throw new Error("Missing queued batch eligibility time.");
    await evm.setNextBlockTimestamp({ timestamp: nextCutoff });
    await evm.mine({ blocks: 1 });
    const priced = await wallet.writeContract({
      account: owner,
      address: bank.address,
      abi: BankAbi,
      functionName: "activateBatch"
    });
    await client.waitForTransactionReceipt({ hash: priced });
    expect(await sdk.bank.getSnapshot(1)).toMatchObject({
      totalAssets: 60_000_000n,
      totalSupply: 60_000_000n,
      exitPayable: 40_000_000n,
      recoveryBacking: 0n,
      activeReserved: 0n
    });
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      queuedShares: 0n,
      claimableShares: 40_000_000n,
      claimableAssets: 40_000_000n,
      activeAndClaimableAssets: 100_000_000n,
      queuedBatch: null
    });
    expect(
      (await sdk.bank.getProviderLedger(1, owner, { startBlock: 0 })).map((row) => row.action)
    ).toEqual(["deposit"]);
    expect(await sdk.bank.maxWithdraw(1, owner)).toBe(40_000_000n);
    expect((await sdk.bank.syncRedeem(1)).ok).toBe(true);
    const before = await sdk.bank.getAssetBalance(token.address, owner);
    const claim = await sdk.bank.redeem(1, 40_000_000n);
    expect(claim.ok).toBe(true);
    expect(await sdk.bank.getAssetBalance(token.address, owner)).toBe(before + 40_000_000n);
    expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
      shares: 60_000_000n,
      queuedShares: 0n,
      claimableShares: 0n,
      claimableAssets: 0n,
      activeAndClaimableAssets: 60_000_000n
    });
    expect((await sdk.bank.getSnapshot(1)).exitPayable).toBe(0n);
    const ledger = await sdk.bank.getProviderLedger(1, owner, { startBlock: 0 });
    expect(ledger.map((row) => [row.action, row.assets, row.shares])).toEqual([
      ["withdraw", 40_000_000n, 40_000_000n],
      ["deposit", 100_000_000n, 100_000_000n]
    ]);
    expect(ledger[0]?.txHash).toBe(claim.txHash);

    // Donation makes mint(1 share) require ceil(1 * (NAV + V)/(supply + V)) = 2 asset units.
    const donation = await wallet.writeContract({
      account: owner,
      address: token.address,
      abi: token.abi,
      functionName: "transfer",
      args: [bank.address, 1n]
    });
    await client.waitForTransactionReceipt({ hash: donation });
    expect(await sdk.bank.convertToAssets(1, 1n)).toBe(1n);
    const beforeMint = await sdk.bank.getAssetBalance(token.address, owner);
    expect((await sdk.bank.mint(1, 1n, owner)).ok).toBe(true);
    expect(await sdk.bank.getAssetBalance(token.address, owner)).toBe(beforeMint - 2n);
    expect((await sdk.bank.getPosition(1, owner)).shares).toBe(60_000_001n);
  }, 60_000);
  it.each([false, true])(
    "prices liquid exit immediately and preserves all snapshot recovery rights (player payable: %s)",
    async (deferred) => {
      const { evm, owner, player, depositor, token, bank, sdk, sdkFor, write } = await fixture(
        deferred ? "BlacklistToken" : "MockERC20"
      );
      // Real Bank/SDK integration; this signer is the authorized router. Casino/VRF is covered in Forge.
      await write(bank, "setSettlementRouterOnce", [owner]);
      await write(token, "mint", [player, 100_000_000n]);
      await write(token, "mint", [depositor, 20_000_000n]);
      await write(token, "approve", [bank.address, 100_000_000n], player);
      expect((await sdk.bank.deposit(1, 100_000_000n, owner)).ok).toBe(true);
      const hash = `0x${"11".repeat(32)}` as Hex;
      await write(bank, "holdBet", [1n, player, 10_000_000n, 30_000_000n, hash]);
      expect((await sdk.bank.requestRedeem(1, 40_000_000n)).ok).toBe(true);
      const queued = await sdk.bank.getPosition(1, owner);
      expect(queued).toMatchObject({ queuedLiquidAssets: 32_000_000n });
      await evm.setNextBlockTimestamp({ timestamp: queued.queuedBatch!.cutoff });
      await evm.mine({ blocks: 1 });
      await write(bank, "activateBatch");
      expect(await sdk.bank.getSnapshot(1)).toMatchObject({
        totalAssets: 48_000_000n,
        totalSupply: 60_000_000n,
        recoveryBacking: 30_000_000n,
        activeReserved: 0n,
        totalReserved: 30_000_000n,
        openHolds: 1n,
        exitPayable: 32_000_000n
      });
      expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
        queuedShares: 0n,
        claimableShares: 40_000_000n,
        claimableAssets: 32_000_000n
      });
      const rightsBefore = await sdk.bank.getRecovery(1, 1n, owner);
      // Both the 40m request and the 60m wallet balance belong to the snapshot owner.
      expect(rightsBefore).toMatchObject({
        shares: 100_000_000n,
        claimableAssets: 0n,
        remainingHolds: 1n,
        remainingReserve: 30_000_000n
      });
      const ownerBefore = await sdk.bank.getAssetBalance(token.address, owner);
      expect((await sdk.bank.redeem(1, 40_000_000n)).ok).toBe(true);
      expect(await sdk.bank.getAssetBalance(token.address, owner)).toBe(ownerBefore + 32_000_000n);
      await write(bank, "holdBet", [2n, player, 5_000_000n, 15_000_000n, hash]);
      expect((await sdkFor(depositor).bank.deposit(1, 20_000_000n, depositor)).ok).toBe(true);
      expect((await sdkFor(depositor).bank.getPosition(1, depositor)).shares).toBe(22_592_592n);
      expect(await sdk.bank.getRecovery(1, 1n, owner)).toMatchObject({
        shares: rightsBefore.shares,
        pendingAssets: rightsBefore.pendingAssets,
        claimableAssets: 0n
      });
      expect(await sdk.bank.getRecovery(1, 1n, depositor)).toMatchObject({
        shares: 0n,
        claimableAssets: 0n,
        pendingAssets: 0n
      });
      expect((await sdk.bank.requestRedeem(1, 10_000_000n)).ok).toBe(true);
      const playerBefore = await sdk.bank.getAssetBalance(token.address, player);
      if (deferred) await write(token, "setBlocked", [player, true]);
      // Direct authorized Bank boundary, including all XP buckets (not a Casino referral allocation).
      await write(bank, "settleBet", [
        1n,
        20_000_000n,
        18_000_000n,
        2_000_000n,
        1_000_000n,
        [
          {
            payee: depositor,
            sourcePlayer: player,
            accrued: 1_000_000n,
            locked: 1_000_000n,
            holdback: 1_000_000n,
            reason: hash
          }
        ]
      ]);
      const debt = deferred ? 20_000_000n : 0n;
      expect(await sdk.bank.getSnapshot(1)).toMatchObject({
        totalAssets: 73_000_000n,
        totalReserved: 15_000_000n,
        activeReserved: 15_000_000n,
        recoveryBacking: 6_000_000n,
        openHolds: 1n,
        exitPayable: 0n,
        playerPayableTotal: debt,
        protocolFeesPayable: 1_000_000n,
        externalPayablesTotal: 3_000_000n
      });
      expect(await sdk.bank.getRecovery(1, 1n, owner)).toMatchObject({
        shares: 100_000_000n,
        claimableAssets: 6_000_000n,
        pendingAssets: 0n,
        remainingHolds: 0n
      });
      expect(await sdk.bank.getAssetBalance(token.address, player)).toBe(
        playerBefore + 20_000_000n - debt
      );
      expect((await sdk.bank.syncRecovery(1, 1n)).ok).toBe(true);
      expect((await sdk.bank.claimRecovery(1, 1n)).ok).toBe(true);
      expect(await sdk.bank.getAssetBalance(token.address, owner)).toBe(ownerBefore + 38_000_000n);
      expect(await sdk.bank.getAssetBalance(token.address, bank.address)).toBe(77_000_000n + debt);
      expect(await sdk.bank.getRecovery(1, 1n, owner)).toMatchObject({
        claimedAssets: 6_000_000n,
        claimableAssets: 0n,
        finalSynced: true
      });
      expect(await sdk.bank.getPosition(1, owner)).toMatchObject({
        shares: 50_000_000n,
        queuedShares: 10_000_000n,
        claimableAssets: 0n
      });
      expect(await sdk.bank.getSnapshot(1)).toMatchObject({
        totalAssets: 73_000_000n,
        recoveryBacking: 0n,
        playerPayableTotal: debt,
        openHolds: 1n
      });
      expect((await sdk.bank.getRecoveryPage(1, owner)).items).toMatchObject([
        { epochId: 1n, claimedAssets: 6_000_000n }
      ]);
      const ledger = await sdk.bank.getProviderLedger(1, owner, { startBlock: 0 });
      expect(ledger.map((row) => [row.action, row.assets])).toEqual([
        ["recovery", 6_000_000n],
        ["withdraw", 32_000_000n],
        ["deposit", 100_000_000n]
      ]);
      if (deferred) {
        await write(token, "setBlocked", [player, false]);
        expect((await sdk.bank.claimPlayerPayable(1, player)).ok).toBe(true);
        expect(await sdk.bank.getAssetBalance(token.address, bank.address)).toBe(77_000_000n);
        expect(await sdk.bank.getSnapshot(1)).toMatchObject({
          totalAssets: 73_000_000n,
          playerPayableTotal: 0n,
          recoveryBacking: 0n
        });
        expect(await sdk.bank.getRecovery(1, 1n, owner)).toMatchObject({
          claimedAssets: 6_000_000n,
          claimableAssets: 0n
        });
      }
    },
    60_000
  );

  it("a permanently open old position cannot block later full exits, and old recovery pays its original owner", async () => {
    const { evm, owner, player, depositor, token, bank, sdk, sdkFor, write } = await fixture();
    await write(bank, "setSettlementRouterOnce", [owner]);
    await write(token, "mint", [player, 1_000_000n]);
    await write(token, "approve", [bank.address, 1_000_000n], player);
    await write(token, "mint", [depositor, 100_000_000n]);
    expect((await sdk.bank.deposit(1, 100_000_000n, owner)).ok).toBe(true);
    const hash = `0x${"22".repeat(32)}` as Hex;
    await write(bank, "holdBet", [1n, player, 1_000_000n, 20_000_000n, hash]);
    const seal = async (account: Address, shares: bigint) => {
      const accountSDK = sdkFor(account);
      expect((await accountSDK.bank.requestRedeem(1, shares)).ok).toBe(true);
      const queued = await accountSDK.bank.getPosition(1, account);
      await evm.setNextBlockTimestamp({ timestamp: queued.queuedBatch!.cutoff });
      await evm.mine({ blocks: 1 });
      await write(bank, "activateBatch");
      const claim = await accountSDK.bank.getPosition(1, account);
      expect((await accountSDK.bank.redeem(1, shares)).ok).toBe(true);
      return claim.claimableAssets;
    };
    expect(await seal(owner, 100_000_000n)).toBe(81_000_000n);
    expect(await sdk.bank.getSnapshot(1)).toMatchObject({
      totalAssets: 0n,
      totalSupply: 0n,
      recoveryBacking: 20_000_000n,
      openHolds: 1n
    });
    expect((await sdkFor(depositor).bank.deposit(1, 100_000_000n, depositor)).ok).toBe(true);
    expect(await seal(depositor, 50_000_000n)).toBe(50_000_000n);
    expect(await seal(depositor, 50_000_000n)).toBe(50_000_000n);
    expect(await sdk.bank.getSnapshot(1)).toMatchObject({
      totalAssets: 0n,
      totalSupply: 0n,
      currentEpoch: 4n,
      recoveryBacking: 20_000_000n,
      openHolds: 1n
    });
    expect(await sdk.bank.getAssetBalance(token.address, depositor)).toBe(100_000_000n);
    expect((await sdk.bank.getRecoveryPage(1, owner)).items.map((item) => item.epochId)).toEqual([
      1n
    ]);
    expect(await sdk.bank.getRecovery(1, 1n, depositor)).toMatchObject({
      shares: 0n,
      pendingAssets: 0n
    });
    // A late valid refund releases the original pocket only; later LPs already exited.
    await write(bank, "refundBet", [1n, 1_000_000n]);
    expect(await sdk.bank.getRecovery(1, 1n, owner)).toMatchObject({
      shares: 100_000_000n,
      claimableAssets: 19_000_000n,
      pendingAssets: 0n
    });
    expect((await sdk.bank.claimRecovery(1, 1n)).ok).toBe(true);
    expect(await sdk.bank.getAssetBalance(token.address, owner)).toBe(1_000_000_000n);
    expect(await sdk.bank.getAssetBalance(token.address, bank.address)).toBe(0n);
    expect(await sdk.bank.getSnapshot(1)).toMatchObject({
      totalAssets: 0n,
      recoveryBacking: 0n,
      openHolds: 0n,
      playerPayableTotal: 0n,
      exitPayable: 0n
    });
  }, 60_000);
});
