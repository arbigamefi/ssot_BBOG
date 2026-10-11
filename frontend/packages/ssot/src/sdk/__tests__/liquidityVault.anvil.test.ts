import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  toHex,
  type Abi,
  type Address,
  type Hex
} from "viem";
import { createSSOTSDK, VOID_BET_GAS_LIMIT } from "../create";
import { toDomainError } from "../errors";
import { encodeStakeSpec } from "../../encoding/stakeSpec";
import { getContractAbis } from "../../abis/index.mjs";
import type { SSOTRelease } from "../../release/schema";

// Opt-in local execution only. CI creates and owns the Anvil process and rebuilds current artifacts.
// Unset BANK_ANVIL_RPC means these tests are explicitly skipped, never counted as integration passes.
const rpc = process.env.BANK_ANVIL_RPC;
if (rpc) {
  const url = new URL(rpc);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") {
    throw new Error("BANK_ANVIL_RPC must be an isolated http://127.0.0.1 Anvil endpoint.");
  }
}
const repo = fileURLToPath(new URL("../../../../../../", import.meta.url));
const ONE = 1_000_000_000_000n;
const DAY = 86_400n;
const FIRST_ID = 1n << 40n;
const GAME = keccak256(toHex("LOCAL_SDK_COIN"));
type Contract = { address: Address; abi: Abi };
function artifact(name: string): { abi: Abi; bytecode: { object: Hex } } {
  return JSON.parse(readFileSync(`${repo}out/${name}.sol/${name}.json`, "utf8"));
}

async function fixture(minBetAmount = 10_000n) {
  const chain = defineChain({
    id: 84532,
    name: "Isolated NFT SDK Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc!] } }
  });
  const transport = http(rpc!);
  const client = createPublicClient({ chain, transport, cacheTime: 0, pollingInterval: 20 });
  const wallet = createWalletClient({ chain, transport });
  const evm = createTestClient({ mode: "anvil", chain, transport });
  expect(await evm.getAutomine()).toBe(true); // Verify local Anvil methods before any write.
  expect(await client.getChainId()).toBe(chain.id);
  const accounts = await wallet.getAddresses();
  if (accounts.length < 3) throw new Error("Three unlocked local Anvil accounts required.");
  const [owner, player, recipient] = accounts as [Address, Address, Address];
  async function deploy(name: string, args: readonly unknown[]): Promise<Contract> {
    const compiled = artifact(name);
    const hash = await wallet.deployContract({
      account: owner,
      abi: compiled.abi,
      bytecode: compiled.bytecode.object,
      args
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    if (!receipt.contractAddress) throw new Error(`${name} missing deployment address`);
    return { address: receipt.contractAddress, abi: compiled.abi };
  }
  async function write(
    contract: Contract,
    functionName: string,
    args: readonly unknown[] = [],
    account: Address = owner
  ) {
    const hash = await wallet.writeContract({
      ...contract,
      account,
      functionName,
      args,
      gas: 6_000_000n
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    return receipt;
  }
  const token = await deploy("BlacklistToken", []);
  const registry = await deploy("PoolRegistry", [owner]);
  const router = await deploy("SettlementRouter", [registry.address]);
  const wrapper = await deploy("MockVRFV2PlusWrapper", []);
  const vrf = await deploy("VRFHub", [wrapper.address, router.address]);
  const bank = await deploy("Bank", [token.address, owner, 0n, 6, minBetAmount]);
  await write(bank, "setSettlementRouterOnce", [router.address]);
  await write(bank, "setRandomnessConsumerOnce", [vrf.address]);
  await write(registry, "registerPool", [1n, token.address, bank.address, 1]);
  const vault: Contract = {
    address: (await client.readContract({ ...bank, functionName: "vault" })) as Address,
    abi: getContractAbis().LiquidityVaultAbi
  };
  await write(token, "mint", [owner, 1_000_000_000n]);
  await write(token, "mint", [player, 1_000_000_000n]);
  const release = {
    chainId: chain.id,
    releaseDigest: "isolated-sdk-nft",
    isPlaceholder: true,
    contracts: {
      // The deployer governs this isolated fixture.
      governanceTimelock: owner,
      gameHub: bank.address,
      vrfHub: vrf.address,
      settlementRouter: router.address,
      poolRegistry: registry.address,
      refRegistry: bank.address
    },
    pools: [
      {
        poolId: 1,
        domainId: 1,
        domain: "Casino",
        asset: token.address,
        bank: bank.address,
        vault: vault.address,
        symbol: "LOCAL",
        decimals: 6
      }
    ],
    games: {},
    gamesMeta: [],
    meta: { blockNumber: 0 }
  } as unknown as SSOTRelease;
  const sdkFor = (account: Address) =>
    createSSOTSDK({ release, publicClient: client, walletClient: wallet, account });
  const sdk = sdkFor(owner);
  const read = async (contract: Contract, functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ ...contract, functionName, args });
  async function mature(timestamp: bigint) {
    await evm.setNextBlockTimestamp({ timestamp });
    await evm.mine({ blocks: 1 });
  }
  async function casino(stake: bigint) {
    const refs = await deploy("ReferralRegistry", [owner]);
    const engine = await deploy("DefaultReferralEngine", []);
    const hub = await deploy("GameHub", [
      router.address,
      vrf.address,
      refs.address,
      engine.address,
      owner,
      3600n,
      200,
      0,
      0,
      0,
      0
    ]);
    const module = await deploy("CoinTossModule", []);
    await write(registry, "setHubRegistered", [hub.address, true]);
    await write(registry, "setHubAllowedForPool", [1n, hub.address, true]);
    await write(refs, "setBinderOnce", [hub.address]);
    await write(hub, "registerGame", [GAME, module.address, 1, 2_447_746]);
    Object.assign(release.contracts, { gameHub: hub.address, refRegistry: refs.address });
    release.games[GAME] = module.address;
    release.gamesMeta = [
      {
        gameId: GAME,
        module: module.address,
        slug: "coin",
        label: "Local coin",
        maxBetCount: 1,
        callbackGasLimit: 2_447_746
      }
    ];
    const playerSdk = sdkFor(player);
    const params = encodeAbiParameters([{ type: "bool" }], [false]);
    const spec = { amountPerRoll: stake, betCount: 1, stopGain: 0n, stopLoss: 0n };
    const plan = await playerSdk.gameHub.planPlaceBet({
      chainId: chain.id,
      gameId: GAME,
      poolId: 1,
      betCount: 1,
      stake,
      params,
      stakeSpec: encodeStakeSpec(spec),
      maxHouseEdgeBps: 200
    });
    if ("error" in plan) throw new Error(`${plan.error.code}: ${plan.error.message}`);
    const placed = await playerSdk.gameHub.executePlan(plan);
    expect(placed.placeBetTx.ok).toBe(true);
    if (placed.betId == null) throw new Error("Placed bet ID missing");
    const bet = await playerSdk.gameHub.getBet(placed.betId);
    expect(bet.houseEdgeBps).toBe(200);
    // Select a winning local fixture seed through the real pure module; no production randomness is changed.
    let seed: bigint | undefined;
    for (let candidate = 0n; candidate < 128n; candidate++) {
      const [payout] = (await read(module, "resolve", [
        params,
        spec,
        placed.betId,
        [candidate]
      ])) as [bigint, bigint];
      if (payout === 2n * stake) {
        seed = candidate;
        break;
      }
    }
    if (seed === undefined) throw new Error("No local fixture winning seed found");
    const settle = () => write(wrapper, "fulfillTo", [vrf.address, bet.requestId, [seed!]]);
    const planAnother = () =>
      playerSdk.gameHub.planPlaceBet({
        chainId: chain.id,
        gameId: GAME,
        poolId: 1,
        betCount: 1,
        stake,
        params,
        stakeSpec: encodeStakeSpec(spec),
        maxHouseEdgeBps: 200
      });
    return { playerSdk, hub, betId: placed.betId, settle, planAnother };
  }
  return {
    owner,
    player,
    recipient,
    client,
    wallet,
    evm,
    token,
    registry,
    bank,
    vault,
    sdk,
    sdkFor,
    read,
    write,
    mature,
    casino
  };
}

describe.skipIf(!rpc)("NFT SDK on isolated Anvil", () => {
  it("approves Vault, creates enumerable deposits and keeps count distinct from tree capital", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    expect((await f.sdk.vault.addDeposit(1, 3_000_000n, f.recipient)).ok).toBe(true);
    const own = await f.sdk.vault.getDeposits(1, f.owner, { limit: 1 });
    const gift = await f.sdkFor(f.recipient).vault.getDeposits(1, f.recipient);
    expect(own).toMatchObject({ nftCount: 1n, complete: true });
    expect(own.items[0]).toMatchObject({
      depositId: FIRST_ID,
      assets: 10_000_000n,
      status: "coolingDown"
    });
    expect(gift.items[0]).toMatchObject({
      depositId: FIRST_ID + 1n,
      owner: getAddress(f.recipient),
      assets: 3_000_000n
    });
    expect(await f.read(f.token, "allowance", [f.owner, f.bank.address])).toBe(0n);
    expect(await f.read(f.token, "balanceOf", [f.vault.address])).toBe(13_000_000n);
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      L: 13_000_000n,
      G: 13_000_000n,
      P: 0n,
      R: 0n,
      K: 0n,
      lpFreeCapital: 13_000_000n
    });
    const ledger = await f.sdk.vault.getProviderLedger(1, f.recipient, { startBlock: 0 });
    expect(ledger).toHaveLength(1); // Mint Transfer is not a second cash deposit.
    expect(ledger[0]).toMatchObject({
      action: "deposit",
      payer: f.owner.toLowerCase(),
      owner: f.recipient.toLowerCase(),
      assets: 3_000_000n
    });
  }, 40_000);

  it("enforces maturity, relocks a partial withdrawal, and transfers withdrawal rights with the NFT", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    const original = await f.sdk.vault.getDeposit(1, FIRST_ID);
    expect((await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).ok).toBe(false);
    expect(await f.sdk.vault.getDeposit(1, FIRST_ID)).toMatchObject({
      withdrawAfter: original.withdrawAfter,
      assets: 10_000_000n
    });
    await f.mature(original.withdrawAfter);
    const partial = await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE / 2n);
    expect(partial.ok).toBe(true);
    const receipt = await f.client.getTransactionReceipt({ hash: partial.txHash });
    const block = await f.client.getBlock({ blockNumber: receipt.blockNumber });
    const remaining = await f.sdk.vault.getDeposit(1, FIRST_ID);
    expect(remaining).toMatchObject({
      assets: 5_000_000n,
      withdrawAfter: block.timestamp + DAY,
      status: "coolingDown"
    });
    // Make withdrawal otherwise executable: coolingDown must not mask a broken owner check.
    await f.mature(remaining.withdrawAfter);
    await f.write(f.vault, "approve", [f.player, FIRST_ID]);
    await expect(
      f.client.simulateContract({
        ...f.vault,
        account: f.player,
        functionName: "withdrawDeposit",
        args: [FIRST_ID, ONE]
      })
    ).rejects.toThrow();
    await f.write(f.vault, "transferFrom", [f.owner, f.recipient, FIRST_ID], f.player);
    expect(await f.sdk.vault.getDeposit(1, FIRST_ID)).toMatchObject({
      owner: getAddress(f.recipient),
      withdrawAfter: remaining.withdrawAfter
    });
    expect((await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).ok).toBe(false);
    expect((await f.sdkFor(f.recipient).vault.withdrawDeposit(1, FIRST_ID, ONE)).ok).toBe(true);
    expect(await f.read(f.token, "balanceOf", [f.recipient])).toBe(5_000_000n);
    expect((await f.sdkFor(f.recipient).vault.getDeposits(1, f.recipient)).nftCount).toBe(0n);
    await expect(f.sdk.vault.getDeposit(1, FIRST_ID)).rejects.toThrow();
  }, 40_000);

  it("reads pending G/L/P/R/K and confirms callback settlement creates separately claimable player debt", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    const c = await f.casino(1_000_000n);
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      L: 10_000_000n,
      P: 1_000_000n,
      R: 2_000_000n,
      K: 1_000_000n,
      G: 11_000_000n,
      openHolds: 1n,
      unbookedResultCount: 0n
    });
    await f.write(f.token, "setBlocked", [f.player, true]);
    await c.settle();
    expect((await c.playerSdk.gameHub.getBet(c.betId)).state).toBe("finalized");
    const payable = await f.sdk.bank.getPlayerPayable(1, f.player);
    expect(payable).toBe(1_960_000n);
    const snapshot = await f.sdk.bank.getSnapshot(1);
    expect(snapshot).toMatchObject({
      P: 0n,
      R: 0n,
      K: 0n,
      G: snapshot.L,
      playerPayableTotal: payable,
      openHolds: 0n,
      unbookedResultCount: 0n,
      accountingValid: true,
      lpStatus: "ready"
    });
    expect((await f.sdk.bank.claimPlayerPayable(1, f.player)).ok).toBe(false);
    expect(await f.sdk.bank.getPlayerPayable(1, f.player)).toBe(payable);
    await f.write(f.token, "setBlocked", [f.player, false]);
    const before = (await f.read(f.token, "balanceOf", [f.player])) as bigint;
    expect((await f.sdk.bank.claimPlayerPayable(1, f.player)).ok).toBe(true);
    expect(await f.read(f.token, "balanceOf", [f.player])).toBe(before + payable);
    expect(await f.sdk.bank.getPlayerPayable(1, f.player)).toBe(0n);
    expect((await f.sdk.bank.getSnapshot(1)).L).toBe(snapshot.L);
  }, 40_000);

  it("voids a received result that cannot be booked, with the fixed gas limit", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    const c = await f.casino(1_000_000n);
    // An issuer freeze of the Vault fails the winning settlement: the result stays unbooked (P5a).
    await f.write(f.token, "setBlocked", [f.vault.address, true]);
    await c.settle();
    const bet = await c.playerSdk.gameHub.getBet(c.betId);
    expect(bet.state).toBe("randomReady");
    const requestedAt = bet.vrfRequestedAt!;
    expect(await c.playerSdk.gameHub.getVoidStatus(c.betId)).toMatchObject({
      voidable: false,
      inWindow: false,
      resultReceived: true,
      eligibleAt: requestedAt + 7 * 86_400
    });
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      unbookedResultCount: 1n,
      lpStatus: "unbookedResult"
    });
    // Governance is the deployer in this isolated fixture; it opens the Bank's window.
    await f.write(c.hub, "openVoidWindow", [1n]);
    const windowed = await c.playerSdk.gameHub.getVoidStatus(c.betId);
    expect(windowed).toMatchObject({
      voidable: false,
      inWindow: true,
      eligibleAt: requestedAt + 86_400
    });
    await f.mature(BigInt(windowed.eligibleAt));
    expect((await c.playerSdk.gameHub.getVoidStatus(c.betId)).voidable).toBe(true);
    const voided = await c.playerSdk.gameHub.voidBet(c.betId);
    expect(voided).toMatchObject({ ok: true, outcome: "voided" });
    expect((await f.client.getTransaction({ hash: voided.txHash })).gas).toBe(VOID_BET_GAS_LIMIT);
    expect((await c.playerSdk.gameHub.getBet(c.betId)).state).toBe("voided");
    expect(await c.playerSdk.gameHub.getTerminalProof(c.betId)).toMatchObject({
      kind: "voided",
      refund: { refundAmount: 1_000_000n, txHash: voided.txHash }
    });
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      totalBetsVoided: 1n,
      totalVoided: 1_000_000n,
      unbookedResultCount: 0n,
      openHolds: 0n,
      playerPayableTotal: 1_000_000n
    });
    expect(await f.sdk.bank.getPlayerPayable(1, f.player)).toBe(1_000_000n);
    expect(await f.sdk.bank.getOpenHolds(1, f.player)).toEqual({ open: 0n, max: 2n });
    expect(await c.playerSdk.gameHub.getVoidStatus(c.betId)).toMatchObject({
      voidable: false,
      resultReceived: false
    });
    expect(await c.playerSdk.governance.getTimelock()).toBe(getAddress(f.owner));
  }, 60_000);

  it("stops a third open bet and a disabled game in planning; binds referrers on the registry", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    await f.casino(1_000_000n);
    // A second hub shares the Bank's per-player count (ADR-0037 §5).
    const second = await f.casino(1_000_000n);
    expect(await f.sdk.bank.getOpenHolds(1, f.player)).toEqual({ open: 2n, max: 2n });
    expect(await second.planAnother()).toMatchObject({
      error: { code: "PLAYER_OPEN_HOLD_LIMIT", details: { open: "2", max: "2" } }
    });
    await f.write(second.hub, "disableGame", [GAME]);
    expect(await second.playerSdk.gameHub.getGameConfig(GAME)).toMatchObject({ disabled: true });
    expect(await second.planAnother()).toMatchObject({ error: { code: "GAME_DISABLED" } });
    const referred = f.sdkFor(f.recipient);
    expect((await referred.referral.bind(f.player)).ok).toBe(true);
    expect(await referred.referral.referrerOf(f.recipient)).toBe(getAddress(f.player));
    // First touch is permanent: the registry refuses a second bind in simulation.
    expect(await referred.referral.bind(f.owner)).toMatchObject({
      ok: false,
      error: { code: "INVALID_CONFIG", details: { transactionSubmitted: false } }
    });
  }, 60_000);

  it("takes deposits while the pool is inactive and plans bets only while PoolRegistry reports it active", async () => {
    const f = await fixture();
    // Registered but inactive (ADR-0037 §9 D1): LPs deposit, nobody bets.
    await f.write(f.registry, "setPoolActive", [1n, false]);
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    expect((await f.sdk.bank.getSnapshot(1)).poolActive).toBe(false);
    await f.write(f.registry, "setPoolActive", [1n, true]);
    const c = await f.casino(1_000_000n);
    // GameHub.riskInPaused is also true for an inactive pool; planning names the inactivity.
    await f.write(f.registry, "setPoolActive", [1n, false]);
    expect(await c.planAnother()).toMatchObject({
      error: { code: "POOL_INACTIVE", details: { poolId: 1 } }
    });
    await f.write(f.registry, "setPoolActive", [1n, true]);
    expect(await c.planAnother()).not.toHaveProperty("error");
  }, 60_000);

  it("refuses deposits while paused and still lets a mature NFT exit", async () => {
    const f = await fixture();
    expect((await f.sdk.vault.addDeposit(1, 10_000_000n)).ok).toBe(true);
    await f.write(f.bank, "setRiskInPaused", [true]);
    expect(await f.sdk.vault.addDeposit(1, 1_000_000n)).toMatchObject({
      ok: false,
      error: { code: "DEPOSITS_PAUSED" }
    });
    // The Vault's own revert decodes to the same code.
    const direct = await f.client
      .simulateContract({
        ...f.vault,
        account: f.owner,
        functionName: "addDepositFor",
        args: [f.owner, 1_000_000n]
      })
      .then(
        () => undefined,
        (error: unknown) => toDomainError(error)
      );
    expect(direct).toMatchObject({ code: "DEPOSITS_PAUSED" });
    const position = await f.sdk.vault.getDeposit(1, FIRST_ID);
    await f.mature(position.withdrawAfter);
    expect((await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).ok).toBe(true);
  }, 40_000);

  it("closes a matured zero-value NFT after an actual fully reserved loss", async () => {
    const f = await fixture(1n);
    // Raw one-unit stake makes fee rounding zero: the covered two-unit payout consumes one LP unit.
    expect((await f.sdk.vault.addDeposit(1, 1n)).ok).toBe(true);
    const c = await f.casino(1n);
    await c.settle();
    expect((await c.playerSdk.gameHub.getBet(c.betId)).state).toBe("finalized");
    const position = await f.sdk.vault.getDeposit(1, FIRST_ID);
    expect(position.assets).toBe(0n);
    await f.mature(position.withdrawAfter);
    expect(await f.sdk.vault.quoteWithdrawal(1, FIRST_ID, ONE / 2n)).toMatchObject({
      executable: false,
      reason: "zeroWithdrawal"
    });
    expect(await f.sdk.vault.quoteWithdrawal(1, FIRST_ID, ONE)).toMatchObject({
      executable: true,
      closeOnly: true,
      assets: 0n
    });
    expect((await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).ok).toBe(true);
    expect((await f.sdk.vault.getDeposits(1, f.owner)).nftCount).toBe(0n);
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      L: 0n,
      P: 0n,
      R: 0n,
      K: 0n,
      G: 0n,
      accountingValid: true
    });
  }, 40_000);
});
