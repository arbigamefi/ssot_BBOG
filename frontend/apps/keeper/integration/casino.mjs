import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  defineChain,
  http,
  keccak256,
  toHex,
  encodeEventTopics,
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
const [owner, player, secondLevel] = await wallet.getAddresses();
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
const bank = await deploy("Bank", [token.address, owner, 6_000n, 6, 10_000n]);
const registry = await deploy("PoolRegistry", [owner]);
const router = await deploy("SettlementRouter", [registry.address]);
const wrapper = await deploy("ExactGasWrapperFixture", []);
const vrf = await deploy("VRFHub", [wrapper.address, router.address]);
const vault = { address: await read(bank, "vault"), abi: artifacts("LiquidityVault").abi };
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
  500,
  2000,
  1000,
  0
]);
const coin = await deploy("CoinTossModule", []);
const gameId = keccak256(toHex("KEEPER_INTEGRATION"));
await write(registry, "registerPool", [1n, token.address, bank.address, 1]);
await write(registry, "setHubRegistered", [hub.address, true]);
await write(registry, "setHubAllowedForPool", [1n, hub.address, true]);
await write(bank, "setSettlementRouterOnce", [router.address]);
await write(bank, "setRandomnessConsumerOnce", [vrf.address]);
await write(refs, "setBinderOnce", [hub.address]);
await write(refs, "bind", [owner, secondLevel]);
await write(hub, "registerGame", [gameId, coin.address, 1, 2_447_746]);
await write(token, "mint", [owner, 100_000_000n]);
await write(token, "mint", [player, 10_000_000n]);
const startBlock = await client.getBlockNumber({ cacheTime: 0 });
await write(token, "approve", [vault.address, 100_000_000n]);
await write(vault, "addDeposit", [100_000_000n]);
await write(token, "approve", [hub.address, 10_000_000n], player);
async function place() {
  const id = await read(router, "nextPositionId");
  const [fee] = await read(hub, "quoteVRFFee", [gameId, 1, await client.getGasPrice()]);
  await write(
    hub,
    "placeBet",
    [
      gameId,
      1n,
      encodeAbiParameters([{ type: "bool" }], [true]),
      { amountPerRoll: 1_000_000n, betCount: 1, stopGain: 0n, stopLoss: 0n },
      owner,
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
  vaultProviderLedgerPools: [
    { bank: bank.address, vault: vault.address, asset: token.address, poolId: 1, decimals: 6 }
  ],
  vaultProviderLedgerScanIntervalMs: 1000
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
    pools: config.vaultProviderLedgerPools,
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
        KEEPER_VAULT_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS: "1",
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

// Reuse viem's installed WS implementation to interrupt only the real socket.
// HTTP goes straight to the owned Anvil; no mocked RPC results or manual enqueue.
async function createWsRelay() {
  const requireViem = createRequire(createRequire(import.meta.url).resolve("viem"));
  const { WebSocket, WebSocketServer } = createRequire(requireViem.resolve("isows"))("ws");
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => server.once("listening", resolve));
  const peers = new Set();
  const acknowledged = new Map();
  let offline = false;
  server.on("connection", (downstream) => {
    if (offline) {
      downstream.close(1013);
      return;
    }
    const upstream = new WebSocket(rpc.replace("http:", "ws:"));
    peers.add(downstream);
    peers.add(upstream);
    const pending = new Map();
    const active = new Map();
    acknowledged.set(downstream, active);
    const waiting = [];
    downstream.on("message", (data) => {
      const request = JSON.parse(data.toString());
      if (request.method === "eth_subscribe") pending.set(request.id, request.params);
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data.toString());
      else waiting.push(data.toString());
    });
    upstream.on("open", () => waiting.splice(0).forEach((data) => upstream.send(data)));
    upstream.on("message", (data) => {
      const response = JSON.parse(data.toString());
      if (pending.has(response.id)) {
        if (!response.error && typeof response.result === "string" && response.result.length > 0) {
          active.set(response.result, pending.get(response.id));
        }
        pending.delete(response.id);
      }
      if (downstream.readyState === WebSocket.OPEN) downstream.send(data.toString());
    });
    downstream.on("close", () => {
      peers.delete(downstream);
      acknowledged.delete(downstream);
      upstream.close();
    });
    upstream.on("close", () => {
      peers.delete(upstream);
      acknowledged.delete(downstream);
      downstream.close();
    });
    downstream.on("error", () => upstream.terminate());
    upstream.on("error", () => downstream.terminate());
  });
  return {
    url: `ws://127.0.0.1:${server.address().port}`,
    subscriptions: () => [...acknowledged.values()].flatMap((active) => [...active.values()]),
    disconnect: () => {
      offline = true;
      for (const peer of peers) peer.terminate();
    },
    resume: () => {
      offline = false;
    },
    stop: async () => {
      for (const peer of peers) peer.terminate();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
const expectedSubscriptions = [
  ...["BetRandomReady", "BetPlaced", "BetFinalized", "BetRefunded"].map((eventName) => ({
    address: hub.address.toLowerCase(),
    topic: encodeEventTopics({ abi: hub.abi, eventName })[0]
  })),
  ...["ResultReceived", "CallbackAttempt"].map((eventName) => ({
    address: vrf.address.toLowerCase(),
    topic: encodeEventTopics({ abi: vrf.abi, eventName })[0]
  }))
];
const hasAllSubscriptions = () =>
  expectedSubscriptions.every(({ address, topic }) =>
    wsRelay
      .subscriptions()
      .some(
        ([kind, filter]) =>
          kind === "logs" &&
          filter.address?.toLowerCase() === address &&
          filter.topics?.[0] === topic
      )
  );
let runtime;
let wsRelay;
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
  assert.equal(rowBeforeKill.referrerL1, owner.toLowerCase());
  assert.equal(rowBeforeKill.referrerL2, secondLevel.toLowerCase());
  assert.deepEqual(
    (await read(hub, "getBetReferralPayees", [id])).map((a) => a.toLowerCase()),
    [owner.toLowerCase(), secondLevel.toLowerCase()]
  );
  const cursorBeforeKill = await store.getCursor(84532, "gamehub-events", hub.address);
  assert.equal((await read(hub, "getBet", [id])).state, 2);
  assert.deepEqual(await stopCli(first, "SIGKILL"), { code: null, signal: "SIGKILL" });
  assert.equal(await store.getCursor(84532, "gamehub-events", hub.address), cursorBeforeKill);
  // The callback is mined only after the first OS process has exited.
  // Deliberately underfund the transport diagnostic callback to persist the first
  // canonical seed while the entire Hub delivery fails. This is a local failure
  // fixture, not a claim about the admitted wrapper callback budget.
  const callback = await write(wrapper, "diagnosticDelivery", [
    before.requestId,
    winningSeed,
    150_000n
  ]);
  assert.equal((await read(vrf, "getRequest", [before.requestId])).state, 2);
  assert.equal((await read(hub, "getBet", [id])).state, 2);
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
  assert.equal(rowAfterRecovery.referrerL1, owner.toLowerCase());
  assert.equal(rowAfterRecovery.referrerL2, secondLevel.toLowerCase());
  const allocation = rowAfterRecovery.houseEdge;
  assert(allocation, "real terminal receipt must include current HouseEdgeAllocated");
  assert.equal(allocation.houseEdgeBps, 200);
  const value = (name) => BigInt(allocation[name]);
  assert.equal(
    value("lpRetained") + value("protocolFee") + value("r0") + value("r1") + value("r2"),
    value("edge")
  );
  assert(value("r0") > 0n && value("r1") > 0n && value("r2") > 0n);
  assert.equal(
    (
      await store.getAffiliateBets({
        chainId: 84532,
        gameHub: hub.address,
        affiliate: owner,
        limit: 10
      })
    ).length,
    1
  );
  assert.equal(
    (
      await store.getAffiliateBets({
        chainId: 84532,
        gameHub: hub.address,
        affiliate: secondLevel,
        limit: 10
      })
    ).length,
    0
  );
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
  // A normally funded callback settles directly. Starting keeper afterwards must
  // index the callback's terminal receipt without creating a second transaction.
  const normalId = await place();
  const normalRequest = (await read(hub, "getBet", [normalId])).requestId;
  const directCallback = await write(wrapper, "deliver", [normalRequest, 0n]);
  assert.equal((await read(hub, "getBet", [normalId])).state, 4);
  assert.equal((await read(vrf, "getRequest", [normalRequest])).state, 3);
  assert.equal(await read(vrf, "unbookedResultCount", [bank.address]), 0n);
  const ssot = await read(bank, "getSSOT");
  assert.equal(ssot.accountingValid, true);
  assert.equal(ssot.P, 0n);
  assert.equal(ssot.R, 0n);
  assert.equal(ssot.K, 0n);
  assert.equal(ssot.vaultCash, ssot.L);
  assert.equal(await read(token, "balanceOf", [vault.address]), ssot.L);
  // Preserve timeout and refused-payment coverage with the current custodian model.
  wsRelay = await createWsRelay();
  const liveConfig = { ...config, wsRpcUrl: wsRelay.url };
  runtime = createKeeperRuntime({ config: liveConfig, logger });
  await runtime.start();
  runtime.enqueue({ source: "manual", betId: normalId, receivedAt: Date.now() });
  await until(
    async () =>
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: normalId.toString() }))
        ?.state === "finalized",
    "direct callback terminal indexing"
  );
  assert(
    !events.some(
      (e) => e.name === "casino.finalize.broadcast" && e.fields?.betId === normalId.toString()
    )
  );
  assert.equal(
    (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: normalId.toString() }))
      .finalizedTxHash,
    directCallback.transactionHash
  );
  await until(hasAllSubscriptions, "six acknowledged WS event filters before interruption");
  const subscriptionsBefore = wsRelay.subscriptions();
  wsRelay.disconnect();
  await until(() => wsRelay.subscriptions().length === 0, "all real WS sockets disconnected");
  const outageId = await place();
  const outageRequest = (await read(hub, "getBet", [outageId])).requestId;
  let outageSeed = 0n;
  for (; outageSeed < 100n; outageSeed++) {
    if ((await read(coin, "resolve", [params, spec, outageId, [outageSeed]]))[0] > 0n) break;
  }
  assert(outageSeed < 100n);
  const outageCashBefore = await read(token, "balanceOf", [player]);
  const offlineDelivery = await write(wrapper, "diagnosticDelivery", [
    outageRequest,
    outageSeed,
    200_000n
  ]);
  await until(
    async () =>
      (await store.getBet({ chainId: 84532, gameHub: hub.address, betId: outageId.toString() }))
        ?.state === "finalized",
    "HTTP catches actual missed placement/result and retries the original seed during WS outage"
  );
  const outageTerminal = await read(hub, "getBetTerminal", [outageId]);
  assert.equal(outageTerminal.state, 4);
  assert(outageTerminal.payoutNet > 0n);
  const outageCanonical = await read(vrf, "getRequest", [outageRequest]);
  assert.equal(outageCanonical.seed, outageSeed);
  assert.equal(outageCanonical.state, 3);
  assert.equal(await read(vrf, "unbookedResultCount", [bank.address]), 0n);
  assert.equal(
    await read(token, "balanceOf", [player]),
    outageCashBefore + outageTerminal.payoutNet
  );
  const outageFinalized = await client.getContractEvents({
    ...hub,
    eventName: "BetFinalized",
    args: { positionId: outageId },
    fromBlock: offlineDelivery.blockNumber,
    toBlock: "latest"
  });
  assert.equal(outageFinalized.length, 1);
  assert.notEqual(outageFinalized[0].transactionHash, offlineDelivery.transactionHash);
  const outagePayments = await client.getContractEvents({
    ...token,
    eventName: "Transfer",
    args: { from: bank.address, to: player },
    fromBlock: offlineDelivery.blockNumber,
    toBlock: "latest"
  });
  assert.equal(outagePayments.length, 1);
  assert.equal(outagePayments[0].args.amount, outageTerminal.payoutNet);
  const outageRow = await store.getBet({
    chainId: 84532,
    gameHub: hub.address,
    betId: outageId.toString()
  });
  assert.equal(outageRow.finalizedTxHash, outageFinalized[0].transactionHash);
  const afterOutage = await read(bank, "getSSOT");
  assert.equal(afterOutage.accountingValid, true);
  assert.equal(afterOutage.P + afterOutage.R + afterOutage.K + afterOutage.PP, 0n);
  assert.equal(afterOutage.bankCash, afterOutage.PF + afterOutage.XP);
  assert.equal(afterOutage.vaultCash, afterOutage.L);
  wsRelay.resume();
  await until(hasAllSubscriptions, "six newly acknowledged WS event filters after HTTP recovery");
  const subscriptionsAfter = wsRelay.subscriptions();
  const missing = await place();
  await until(
    () =>
      events.some(
        (e) =>
          e.name === "casino.keeper.enqueued" &&
          e.fields?.betId === missing.toString() &&
          e.fields?.source === "gameHub"
      ),
    "reconnected WS consumes real BetPlaced, independently of HTTP scans"
  );
  writeFileSync(
    join(evidenceDir, "websocket-outage.json"),
    JSON.stringify(
      {
        subscriptionsBefore,
        subscriptionsAfter,
        restoredWsBetId: missing.toString(),
        restoredWsBetPlacedConsumed: true,
        betId: outageId.toString(),
        seed: outageSeed.toString(),
        deliveryTx: offlineDelivery.transactionHash,
        terminalTx: outageRow.finalizedTxHash,
        terminalEvents: outageFinalized.length,
        positivePayments: outagePayments.length,
        actualHttpFallback: true,
        manualEnqueueUsed: false,
        originalSeedPreserved: true,
        cashAndLiabilitiesReconciled: true
      },
      null,
      2
    )
  );
  console.log(
    "PASS: real WS disconnect, HTTP catch-up with original seed, one positive payment, PostgreSQL receipt and WS resubscription"
  );
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
  runtime = createKeeperRuntime({ config: liveConfig, logger });
  await runtime.start();
  await until(
    async () => (await read(bank, "playerPayable", [player])) === 0n,
    "keeper claims refused refund to its player"
  );
  assert.equal(await read(token, "balanceOf", [player]), cashBeforeRefund + 1_000_000n);
  assert.equal(await read(bank, "openHolds"), 0n);
  // A late wrapper callback after timeout cancellation cannot recreate risk or payment.
  const cashAfterClaim = await read(token, "balanceOf", [player]);
  await write(wrapper, "deliver", [pending.requestId, winningSeed]);
  assert.equal((await read(vrf, "getRequest", [pending.requestId])).state, 4);
  assert.equal((await read(hub, "getBet", [missing])).state, 5);
  assert.equal(await read(token, "balanceOf", [player]), cashAfterClaim);
  assert.equal(await read(token, "balanceOf", [hub.address]), 0n);
  assert.equal(await read(token, "allowance", [hub.address, bank.address]), 0n);
  assert(events.some((event) => event.name === "casino.finalize.broadcast"));
  console.log(
    "PASS: real keeper + Anvil + PostgreSQL restart, immutable L1/L2 referral snapshots, direct-only attribution, house-edge conservation, fixed deadlines, pause refund, refused-payment recovery and cash ownership"
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
  await wsRelay?.stop();
  await store.close();
}
// viem keeps a shared websocket transport alive after unsubscribing. All runtime
// operations and database clients have been joined above; end the owned test process.
process.exit(0);
