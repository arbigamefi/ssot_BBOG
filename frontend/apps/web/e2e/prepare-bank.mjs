// Isolated money-flow fixture. Invoked only by script/ci/bank_wallet_e2e.sh.
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes
} from "viem";
const rpc = process.env.BANK_ANVIL_RPC;
if (!rpc || new URL(rpc).hostname !== "127.0.0.1") throw new Error("Local Anvil required");
const chain = defineChain({
  id: 84532,
  name: "Local fixture",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } }
});
const publicClient = createPublicClient({ chain, transport: http(rpc) });
await publicClient.request({ method: "anvil_getAutomine" });
const wallet = createWalletClient({ chain, transport: http(rpc) });
const [owner] = await wallet.getAddresses();
const artifact = (name) =>
  JSON.parse(readFileSync(new URL(`../../../../out/${name}.sol/${name}.json`, import.meta.url)));
async function deploy(name, args) {
  const a = artifact(name);
  const hash = await wallet.deployContract({
    account: owner,
    abi: a.abi,
    bytecode: a.bytecode.object,
    args
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Deploy failed");
  return { address: receipt.contractAddress, abi: a.abi };
}
const token = await deploy("MockERC20", ["Local asset", "LOCAL", 6]);
const bank = await deploy("Bank", [token.address, owner, 6_000n, 6, 10_000n]);
const poolRegistry = await deploy("PoolRegistry", [owner]);
const router = await deploy("SettlementRouter", [poolRegistry.address]);
const wrapper = await deploy("MockVRFV2PlusWrapper", []);
const vrf = await deploy("VRFHub", [wrapper.address, router.address]);
const referrals = await deploy("ReferralRegistry", [owner]);
const engine = await deploy("DefaultReferralEngine", []);
const hub = await deploy("GameHub", [
  router.address,
  vrf.address,
  referrals.address,
  engine.address,
  owner,
  3_600n,
  200,
  1_000,
  2_000,
  500,
  3_000
]);
async function write(contract, functionName, args) {
  const hash = await wallet.writeContract({ ...contract, account: owner, functionName, args });
  if ((await publicClient.waitForTransactionReceipt({ hash })).status !== "success")
    throw new Error(`${functionName} failed`);
}
await write(bank, "setSettlementRouterOnce", [router.address]);
await write(bank, "setRandomnessConsumerOnce", [vrf.address]);
await write(poolRegistry, "registerPool", [1n, token.address, bank.address, 1]);
await write(poolRegistry, "setHubRegistered", [hub.address, true]);
await write(poolRegistry, "setHubAllowedForPool", [1n, hub.address, true]);
await write(referrals, "setBinderOnce", [hub.address]);
const modules = {};
for (const [id, name] of [
  ["DICE", "DiceModule"],
  ["COIN_TOSS", "CoinTossModule"],
  ["ROULETTE", "RouletteModule"],
  ["KENO", "KenoModule"],
  ["PLINKO", "PlinkoModule"],
  ["SIC_BO", "SicBoModule"],
  ["SLOTS", "SlotsModule"],
  ["BACCARAT", "BaccaratModule"]
]) {
  const module = await deploy(name, []);
  const gameId = keccak256(toBytes(id));
  await write(hub, "registerGame", [gameId, module.address, 25, 2_447_746]);
  modules[gameId] = module.address;
}
const vault = await publicClient.readContract({ ...bank, functionName: "vault" });
const hash = await wallet.writeContract({
  ...token,
  account: owner,
  functionName: "mint",
  args: [owner, 1_000_000_000n]
});
await publicClient.waitForTransactionReceipt({ hash });
// Reuse the pinned viem Multicall3 bytecode used by the real wallet client's batched reads.
const { multicall3Bytecode } = await import(
  new URL("constants/contracts.js", import.meta.resolve("viem"))
);
const multiHash = await wallet.deployContract({
  account: owner,
  abi: [],
  bytecode: multicall3Bytecode
});
const multiReceipt = await publicClient.waitForTransactionReceipt({ hash: multiHash });
const multiCode = await publicClient.getCode({ address: multiReceipt.contractAddress });
if (!multiCode) throw new Error("Multicall3 fixture deployment failed");
await publicClient.request({
  method: "anvil_setCode",
  params: ["0xca11bde05977b3631167028862be2a173976ca11", multiCode]
});
const fixture = JSON.parse(
  readFileSync(
    new URL("../../../packages/ssot/src/fixtures/release-v16.fixture.json", import.meta.url)
  )
);
Object.assign(fixture, {
  chainId: 84532,
  name: "Isolated browser test",
  isPlaceholder: false,
  architectureVersion: "v1.6-nft-liquidity",
  refundTimeoutSeconds: 3_600,
  contracts: {
    ...fixture.contracts,
    gameHub: hub.address,
    refRegistry: referrals.address,
    refEngine: engine.address,
    vrfHub: vrf.address,
    settlementRouter: router.address,
    poolRegistry: poolRegistry.address
  },
  assets: [{ symbol: "LOCAL", decimals: 6, address: token.address, bank: bank.address, vault }],
  pools: [
    {
      poolId: 1,
      domainId: 1,
      domain: "casino",
      active: true,
      asset: token.address,
      bank: bank.address,
      vault,
      symbol: "LOCAL",
      decimals: 6
    }
  ]
});
fixture.games = modules;
fixture.gamesMeta = fixture.gamesMeta.map((game) => ({ ...game, module: modules[game.gameId] }));
// All consumers stay confined to the owned localhost node; this fixture is not an authenticated release.
writeFileSync(
  new URL("../../../packages/ssot/src/release/embedded/index.ts", import.meta.url),
  `// Temporary isolated browser fixture; runner restores original bytes.\nexport const embeddedReleases: Record<number, unknown> = {84532:${JSON.stringify(fixture)}};\nexport const embeddedChainIds: number[] = [84532];\n`
);
writeFileSync(
  process.env.BANK_E2E_STATE,
  JSON.stringify({
    owner,
    token: token.address,
    bank: bank.address,
    vault,
    hub: hub.address,
    vrf: vrf.address,
    wrapper: wrapper.address
  })
);
