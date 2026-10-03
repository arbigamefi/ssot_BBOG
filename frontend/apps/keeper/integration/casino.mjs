import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
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
// Exercise the shipped CLI in owned child processes. Only public Anvil credentials enter this env.
const evidenceDir =
  process.env.KEEPER_TEST_EVIDENCE_DIR ?? mkdtempSync(join(tmpdir(), "keeper-process-"));
mkdirSync(evidenceDir, { recursive: true });
const releasePath = join(evidenceDir, "local-release.json");
writeFileSync(
  releasePath,
  JSON.stringify({
    chainId: 84532,
    contracts: { gameHub: hub.address, vrfHub: vrf.address },
    pools: config.bankProviderLedgerPools,
    meta: { blockNumber: Number(startBlock) }
  })
);
const children = [];
function startCli(label) {
  const healthPath = join(evidenceDir, `${label}-health.json`);
  const logPath = join(evidenceDir, `${label}.log`);
  const output = openSync(logPath, "w");
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../dist/cli.js", import.meta.url))],
    {
      stdio: ["ignore", output, output],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        KEEPER_RELEASE_PATH: releasePath,
        KEEPER_CHAIN_ID: "84532",
        KEEPER_RPC_HTTP: rpc,
        KEEPER_PRIVATE_KEY: config.privateKey,
        KEEPER_ROLE: "primary",
        KEEPER_POLL_INTERVAL_SECONDS: "0.25",
        KEEPER_RPC_MIN_INTERVAL_MS: "0",
        KEEPER_SCAN_CHUNK_BLOCKS: "100",
        KEEPER_SCAN_MAX_CHUNKS_PER_PASS: "2",
        KEEPER_SCAN_INDEX_EVENTS_ENABLED: "true",
        KEEPER_STARTUP_SCAN_ENABLED: "true",
        KEEPER_HEALTH_PATH: healthPath,
        KEEPER_BANK_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS: "1",
        BET_INDEX_DATABASE_URL: database,
        BET_INDEX_WRITE_ENABLED: "true",
        BET_INDEX_SSL: "false"
      }
    }
  );
  closeSync(output);
  const worker = { label, child, pid: child.pid, healthPath, logPath, exit: undefined };
  worker.exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      worker.exit = { code, signal };
      resolve(worker.exit);
    });
  });
  children.push(worker);
  return worker;
}
async function stopCli(worker, signal = "SIGTERM") {
  if (!worker.exit) worker.child.kill(signal);
  const fallback = setTimeout(() => worker.child.kill("SIGKILL"), 5_000);
  try {
    return await worker.exited;
  } finally {
    clearTimeout(fallback);
  }
}
const readWorkerLogs = (worker) =>
  readFileSync(worker.logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
let runtime;
try {
  await store.initializeSchema();
  const id = await place();
  const before = await read(hub, "getBet", [id]);
  const cashBeforeCallback = await read(token, "balanceOf", [player]);
  const spec = { amountPerRoll: 1_000_000n, betCount: 1, stopGain: 0n, stopLoss: 0n };
  const params = encodeAbiParameters([{ type: "bool" }], [true]);
  let winningSeed = 0n;
  for (; winningSeed < 100n; winningSeed += 1n) {
    if ((await read(coin, "resolve", [params, spec, id, [winningSeed]]))[0] > 0n) break;
  }
  assert(winningSeed < 100n, "local fixture must select a positive payout");
  const first = startCli("before-kill");
  await until(async () => {
    assert(!first.exit, "first CLI exited before its persistent checkpoint");
    const row = await store.getBet({ chainId: 84532, gameHub: hub.address, betId: id.toString() });
    const cursor = await store.getCursor(84532, "gamehub-events", hub.address);
    return (
      row?.refundDeadline === Number(before.refundDeadline) * 1000 &&
      cursor != null &&
      cursor >= row.placedBlock
    );
  }, "first PID durably indexes pending bet and cursor");
  const rowBeforeKill = await store.getBet({
    chainId: 84532,
    gameHub: hub.address,
    betId: id.toString()
  });
  const cursorBeforeKill = await store.getCursor(84532, "gamehub-events", hub.address);
  assert.equal((await read(hub, "getBet", [id])).state, 2);
  assert.deepEqual(await stopCli(first, "SIGKILL"), { code: null, signal: "SIGKILL" });
  assert.equal(await store.getCursor(84532, "gamehub-events", hub.address), cursorBeforeKill);
  // The callback is mined only after the first OS process has exited.
  const callback = await write(vrf, "fulfillRandomWords", [before.requestId, [winningSeed]]);
  assert.equal((await read(hub, "getBet", [id])).state, 3);
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeCallback);
  const second = startCli("after-kill");
  assert.notEqual(second.pid, first.pid);
  await until(async () => {
    assert(!second.exit, "second CLI exited before recovery");
    return (
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: id.toString() }))
        ?.state === "finalized"
    );
  }, "new PID recovers missed callback from same PostgreSQL");
  await until(
    async () => readWorkerLogs(second).some((e) => e.message === "casino.finalize.mined"),
    "new PID records receipt"
  );
  const rowAfterRecovery = await store.getBet({
    chainId: 84532,
    gameHub: hub.address,
    betId: id.toString()
  });
  const terminal = await read(hub, "getBetTerminal", [id]);
  assert.equal(terminal.state, 4);
  assert(terminal.payoutNet > 0n, "positive payment is required for idempotency evidence");
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeCallback + terminal.payoutNet);
  assert.equal(BigInt(rowAfterRecovery.payout), terminal.payoutNet);
  const cursorAfterRecovery = await store.getCursor(84532, "gamehub-events", hub.address);
  assert.equal((await stopCli(second)).code, 0);
  // A third OS process must not repay an already terminal durable position.
  const third = startCli("terminal-replay");
  assert.notEqual(third.pid, second.pid);
  assert.notEqual(third.pid, first.pid);
  await evm.mine({ blocks: 1 });
  const replayThrough = await client.getBlockNumber({ cacheTime: 0 });
  await until(async () => {
    assert(!third.exit, "terminal replay CLI exited early");
    try {
      const health = JSON.parse(readFileSync(third.healthPath, "utf8"));
      return health.status === "running" && BigInt(health.lastScannedBlock) >= replayThrough;
    } catch {
      return false;
    }
  }, "third PID resumes durable cursor and scans after terminal replay");
  assert.equal((await stopCli(third)).code, 0);
  const rowAfterReplay = await store.getBet({
    chainId: 84532,
    gameHub: hub.address,
    betId: id.toString()
  });
  const finalized = await client.getContractEvents({
    ...hub,
    eventName: "BetFinalized",
    args: { positionId: id },
    fromBlock: startBlock,
    toBlock: "latest"
  });
  const payments = await client.getContractEvents({
    ...token,
    eventName: "Transfer",
    args: { from: bank.address, to: player },
    fromBlock: callback.blockNumber,
    toBlock: "latest"
  });
  assert.equal(finalized.length, 1, "exactly one on-chain terminal event across process restarts");
  assert.equal(
    payments.length,
    1,
    "exactly one positive Bank-to-player payment across process restarts"
  );
  assert.equal(payments[0].args.amount, terminal.payoutNet);
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeCallback + terminal.payoutNet);
  assert.equal(rowAfterReplay.finalizedTxHash, finalized[0].transactionHash);
  assert.equal(rowAfterRecovery.finalizedTxHash, rowAfterReplay.finalizedTxHash);
  const secondLogs = readWorkerLogs(second);
  const broadcasts = children
    .flatMap(readWorkerLogs)
    .filter((e) => e.message === "casino.finalize.broadcast" && e.betId === id.toString());
  assert.equal(broadcasts.length, 1);
  for (const name of [
    "casino.finalize.broadcast",
    "casino.keeper.receipt_materialized",
    "casino.finalize.mined"
  ]) {
    assert(
      secondLogs.some((e) => e.message === name && e.txHash === rowAfterReplay.finalizedTxHash),
      name
    );
  }
  const processEvidence = {
    scope: "owned local Anvil and disposable PostgreSQL; not production",
    positionId: id,
    children: children.map(({ label, pid, exit, logPath }) => ({ label, pid, exit, logPath })),
    winningSeed,
    rowBeforeKill,
    cursorBeforeKill,
    callback: {
      transactionHash: callback.transactionHash,
      blockNumber: callback.blockNumber,
      status: callback.status
    },
    rowAfterRecovery,
    cursorAfterRecovery,
    rowAfterReplay,
    replayThrough,
    terminal,
    finalized: finalized.map(({ transactionHash, blockNumber, args }) => ({
      transactionHash,
      blockNumber,
      args
    })),
    payments: payments.map(({ transactionHash, blockNumber, args }) => ({
      transactionHash,
      blockNumber,
      args
    })),
    cashBeforeCallback,
    cashAfterReplay: await read(token, "balanceOf", [player]),
    broadcastCount: broadcasts.length
  };
  writeFileSync(
    join(evidenceDir, "process-recovery.json"),
    JSON.stringify(processEvidence, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n"
  );
  console.log(
    "PASS: distinct CLI PIDs, SIGKILL before offline callback, durable PostgreSQL recovery, one positive payment after terminal restart"
  );
  // Preserve the existing timeout and refused-payment cases below.
  runtime = createKeeperRuntime({ config, logger });
  await runtime.start();
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
  for (const worker of children) await stopCli(worker);
  await runtime?.stop();
  await store.close();
}
// viem keeps shared websocket transports alive after unsubscribing. All runtime
// operations and database clients have been joined above; end the owned test process.
process.exit(0);
