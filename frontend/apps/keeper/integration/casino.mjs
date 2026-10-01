import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  defineChain,
  http,
  keccak256,
  toHex,
  encodeAbiParameters
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { createKeeperRuntime } from "../dist/runtime.js";
import { createPostgresBetIndexStore } from "@ssot/bet-index";

// Invoked only by the owned, disposable Anvil/PostgreSQL shell harness.
const rpc = process.env.KEEPER_TEST_ANVIL_RPC;
const database = process.env.KEEPER_TEST_POSTGRES_URL;
for (const value of [rpc, database]) {
  assert(value && new URL(value).hostname === "127.0.0.1", "Integration endpoints must be local");
}
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const chain = defineChain({
  id: 84532,
  name: "Keeper integration",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } }
});
const client = createPublicClient({
  chain,
  transport: http(rpc),
  cacheTime: 0,
  pollingInterval: 50
});
const wallet = createWalletClient({ chain, transport: http(rpc) });
const evm = createTestClient({ chain, transport: http(rpc), mode: "anvil" });
assert.equal(await evm.getAutomine(), true);
const [owner, player] = await wallet.getAddresses();
// Public Anvil test mnemonic; never reads or signs with a user's wallet.
const keeper = mnemonicToAccount("test test test test test test test test test test test junk", {
  addressIndex: 9
});
const artifacts = (name) => JSON.parse(readFileSync(`${root}out/${name}.sol/${name}.json`, "utf8"));
async function deploy(name, args) {
  const artifact = artifacts(name);
  const hash = await wallet.deployContract({
    account: owner,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return { address: receipt.contractAddress, abi: artifact.abi };
}
async function write(contract, functionName, args = [], account = owner, value = 0n) {
  const hash = await wallet.writeContract({
    ...contract,
    account,
    functionName,
    args,
    value,
    gas: 12_000_000n
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return receipt;
}
const read = (contract, functionName, args = []) =>
  client.readContract({ ...contract, functionName, args });
async function until(predicate, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
const token = await deploy("BlacklistToken", []);
const bank = await deploy("Bank", [token.address, owner, 0n, "LP", "LP", 6, 1_000_000n]);
const registry = await deploy("PoolRegistry", [owner]);
const router = await deploy("SettlementRouter", [registry.address]);
const vrf = await deploy("VRFHub", [owner, owner]);
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
const coin = await deploy("CoinTossModule", []);
const gameId = keccak256(toHex("KEEPER_INTEGRATION"));
await write(registry, "registerPool", [1n, token.address, bank.address, 1]);
await write(registry, "setHubRegistered", [hub.address, true]);
await write(registry, "setHubAllowedForPool", [1n, hub.address, true]);
await write(bank, "setSettlementRouterOnce", [router.address]);
await write(refs, "setBinderOnce", [hub.address]);
await write(hub, "registerGame", [gameId, coin.address]);
await write(token, "mint", [owner, 100_000_000n]);
await write(token, "mint", [player, 10_000_000n]);
await write(token, "approve", [bank.address, 100_000_000n]);
await write(bank, "deposit", [100_000_000n, owner]);
await write(token, "approve", [hub.address, 10_000_000n], player);
const startBlock = await client.getBlockNumber({ cacheTime: 0 });
async function place() {
  const id = await read(router, "nextPositionId");
  const [fee] = await read(hub, "quoteVRFFee", [1, await client.getGasPrice()]);
  await write(
    hub,
    "placeBet",
    [
      gameId,
      1n,
      encodeAbiParameters([{ type: "bool" }], [true]),
      { amountPerRoll: 1_000_000n, betCount: 1, stopGain: 0n, stopLoss: 0n },
      "0x0000000000000000000000000000000000000000",
      200
    ],
    player,
    fee
  );
  return id;
}
const config = {
  chainId: 84532,
  gameHub: hub.address,
  vrfHub: vrf.address,
  httpRpcUrl: rpc,
  wsRpcUrl: rpc.replace("http:", "ws:"),
  privateKey: toHex(keeper.getHdKey().privateKey),
  role: "primary",
  backupDelayMs: 0,
  pollIntervalMs: 250,
  rpcMinIntervalMs: 0,
  scanChunkBlocks: 100n,
  scanMaxChunksPerPass: 2,
  scanIndexEventsEnabled: true,
  startupScanEnabled: true,
  startBlock,
  casinoRecoveryStartBlock: startBlock,
  betIndexDatabaseUrl: database,
  betIndexSsl: false,
  betIndexWriteEnabled: true,
  bankProviderLedgerPools: [{ bank: bank.address, asset: token.address, poolId: 1, decimals: 6 }],
  bankProviderLedgerScanIntervalMs: 1000,
  sportsTicketIndexEnabled: false,
  sportsTerminalizerEnabled: false,
  sportsTerminalizerScanChunkBlocks: 100n,
  sportsTerminalizerMarketIds: [],
  sportsTerminalizerMaxTicketsPerMarket: 2,
  sportsTicketScanChunkBlocks: 100n,
  sportsTicketScanMaxBlocks: 100n,
  sportsTicketScanStartBlock: startBlock
};
const events = [];
const logger = {
  info: (name, fields) => events.push({ name, fields }),
  warn: (name, fields) => events.push({ name, fields }),
  error: (name, fields) => events.push({ name, fields })
};
const store = createPostgresBetIndexStore({ connectionString: database, ssl: false });
let runtime;
try {
  await store.initializeSchema();
  const id = await place();
  const before = await read(hub, "getBet", [id]);
  runtime = createKeeperRuntime({ config, logger });
  await runtime.start();
  await until(
    async () =>
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: id.toString() }))
        ?.refundDeadline ===
      Number(before.refundDeadline) * 1000,
    "fixed deadline indexed in PostgreSQL"
  );
  await runtime.stop();
  runtime = undefined;
  // A missed callback while offline must be recovered from actual logs and the persistent cursor.
  await write(vrf, "fulfillRandomWords", [before.requestId, [42n]]);
  assert.equal((await read(hub, "getBet", [id])).state, 3, "callback made bet ready");
  runtime = createKeeperRuntime({ config, logger });
  await runtime.start();
  await until(async () => (await read(hub, "getBet", [id])).state === 4, "restart terminalization");
  await until(
    async () =>
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: id.toString() }))
        ?.state === "finalized",
    "terminal PostgreSQL receipt"
  );
  const missing = await place();
  const pending = await read(hub, "getBet", [missing]);
  await write(hub, "setRefundTimeout", [86_400n]);
  await write(bank, "setRiskInPaused", [true]);
  await write(token, "setBlocked", [player, true]);
  const cashBeforeRefund = await read(token, "balanceOf", [player]);
  await evm.setNextBlockTimestamp({ timestamp: pending.refundDeadline });
  await evm.mine({ blocks: 1 });
  runtime.enqueue({ source: "manual", betId: missing, receivedAt: Date.now() });
  await until(
    async () => (await read(hub, "getBet", [missing])).state === 5,
    "fixed-deadline refund during pause"
  );
  await until(
    async () =>
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: missing.toString() }))
        ?.state === "refunded",
    "refund PostgreSQL receipt"
  );
  assert.equal(await read(bank, "playerPayable", [player]), 1_000_000n);
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeRefund);
  const debtBlock = await client.getBlockNumber({ cacheTime: 0 });
  await evm.mine({ blocks: 128 });
  assert((await client.getBlock({ blockTag: "finalized" })).number >= debtBlock);
  await until(
    async () =>
      runtime.health
        .snapshot()
        .payables?.some((item) => item.pending > 0 && (item.error || item.claimError)),
    "refused claim remains visible in keeper health"
  );
  assert.equal(await read(bank, "playerPayable", [player]), 1_000_000n);
  await runtime.stop();
  runtime = undefined;
  await write(token, "setBlocked", [player, false]);
  runtime = createKeeperRuntime({ config, logger });
  await runtime.start();
  await until(
    async () => (await read(bank, "playerPayable", [player])) === 0n,
    "keeper claims refused refund to its player"
  );
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeRefund + 1_000_000n);
  assert.equal(await read(bank, "activeOpenHolds"), 0n);
  assert.equal(await read(token, "balanceOf", [hub.address]), 0n);
  assert.equal(await read(token, "allowance", [hub.address, bank.address]), 0n);
  assert(events.some((event) => event.name === "casino.finalize.broadcast"));
  console.log(
    "PASS: real keeper + Anvil + PostgreSQL restart, fixed deadlines, pause refund, refused-payment recovery and cash ownership"
  );
} catch (error) {
  console.error(runtime?.health.snapshot().payables);
  console.error(
    events.filter((event) => /failed|error|finalize|enqueued/.test(event.name)).slice(-12)
  );
  throw error;
} finally {
  await runtime?.stop();
  await store.close();
}
// viem keeps shared websocket transports alive after unsubscribing. All runtime
// operations and database clients have been joined above; end the owned test process.
process.exit(0);
