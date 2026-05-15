#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const ssotRequire = createRequire(path.resolve(frontendRoot, "packages/ssot/package.json"));
const { createPublicClient, getAddress, http } = await import(
  pathToFileURL(ssotRequire.resolve("viem")).href
);
const { baseSepolia } = await import(pathToFileURL(ssotRequire.resolve("viem/chains")).href);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REQUIRED_CONTRACTS = [
  "gameHub",
  "settlementRouter",
  "poolRegistry",
  "sportsHub",
  "sportsRiskEngine",
  "vrfHub",
  "refRegistry",
  "refEngine",
  "adapter"
];
const chainId = Number(readArg("--chain-id") ?? process.env.CHAIN_ID ?? 84532);
const releasePath =
  readArg("--release") ??
  path.resolve(frontendRoot, "packages/ssot/src/release/embedded", `chain-${chainId}.json`);
const abiRoot =
  readArg("--abi-root") ??
  path.resolve(frontendRoot, "packages/ssot/src/abis/release", `chain-${chainId}`);

await loadEnvFiles([
  path.resolve(repoRoot, ".env"),
  path.resolve(repoRoot, ".env.v13-sports.local"),
  path.resolve(frontendRoot, ".env"),
  path.resolve(frontendRoot, "apps/web/.env"),
  path.resolve(frontendRoot, "apps/web/.env.local")
]);

const release = JSON.parse(await fs.readFile(releasePath, "utf8"));
const rpcUrl = resolveRpcUrl();
const rpcHost = safeHost(rpcUrl);

const client = createPublicClient({
  chain:
    chainId === baseSepolia.id
      ? baseSepolia
      : {
          id: chainId,
          name: release.name ?? `chain-${chainId}`,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } }
        },
  transport: http(rpcUrl, { timeout: 15_000 })
});

const GameHubAbi = await loadAbi("GameHub");
const BankAbi = await loadAbi("Bank");
const PoolRegistryAbi = await loadAbi("PoolRegistry");
const SportsHubAbi = await loadAbi("SportsHub");
const SportsRiskEngineAbi = await loadAbi("SportsRiskEngine");

let ok = true;

console.log(
  `[release-smoke] chain=${chainId} release=${path.relative(process.cwd(), releasePath)}`
);
console.log(`[release-smoke] rpcHost=${rpcHost}`);

await check("release schemaVersion", () => {
  if (release?.meta?.schemaVersion !== 2) {
    throw new Error(`expected schemaVersion=2, got ${release?.meta?.schemaVersion}`);
  }
  const contracts = release?.contracts ?? {};
  if (
    Object.hasOwn(contracts, "hub") ||
    Object.hasOwn(contracts, "bankRegistry") ||
    Object.hasOwn(release?.sports ?? {}, "hub")
  ) {
    throw new Error("legacy hub/bankRegistry keys are present in embedded release");
  }
  for (const key of REQUIRED_CONTRACTS) {
    const address = contracts[key];
    if (typeof address !== "string" || address.length === 0) {
      throw new Error(`contracts.${key} missing`);
    }
    if (address.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(`contracts.${key} is zero`);
    }
  }
  return "v1.3";
});

await check("rpc chainId", async () => {
  const actual = await client.getChainId();
  if (actual !== chainId) throw new Error(`expected ${chainId}, got ${actual}`);
  return String(actual);
});

await check("rpc block height", async () => {
  const block = await client.getBlockNumber();
  const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
  if (releaseBlock > 0n && block < releaseBlock) {
    throw new Error(`RPC block ${block} is behind release block ${releaseBlock}`);
  }
  return block.toString();
});

for (const [name, address] of Object.entries(release.contracts ?? {})) {
  await checkCode(`contract ${name}`, address);
}

for (const game of release.gamesMeta ?? []) {
  await check(`game ${game.slug} module mapping`, () => {
    const mapped = release.games?.[game.gameId];
    if (!mapped) throw new Error(`release.games missing ${game.gameId}`);
    if (mapped.toLowerCase() !== game.module.toLowerCase()) {
      throw new Error(`gamesMeta module ${game.module} does not match games map ${mapped}`);
    }
    return short(game.module);
  });
  await checkCode(`game ${game.slug} bytecode`, game.module);
}

await check("GameHub quoteVRFFee(1)", async () => {
  const [fee, gasLimit] = await client.readContract({
    address: getAddress(release.contracts.gameHub),
    abi: GameHubAbi,
    functionName: "quoteVRFFee",
    args: [1]
  });
  return `fee=${fee.toString()} gasLimit=${gasLimit.toString()}`;
});

for (const pool of release.pools ?? []) {
  await check(`PoolRegistry pool ${pool.poolId}`, async () => {
    const poolId = BigInt(pool.poolId);
    const [active, asset, bank] = await Promise.all([
      client.readContract({
        address: getAddress(release.contracts.poolRegistry),
        abi: PoolRegistryAbi,
        functionName: "isPoolActive",
        args: [poolId]
      }),
      client.readContract({
        address: getAddress(release.contracts.poolRegistry),
        abi: PoolRegistryAbi,
        functionName: "assetFor",
        args: [poolId]
      }),
      client.readContract({
        address: getAddress(release.contracts.poolRegistry),
        abi: PoolRegistryAbi,
        functionName: "bankFor",
        args: [poolId]
      })
    ]);
    if (Boolean(active) !== Boolean(pool.active)) {
      throw new Error(`active mismatch release=${pool.active} chain=${active}`);
    }
    if (String(asset).toLowerCase() !== pool.asset.toLowerCase()) {
      throw new Error(`asset mismatch release=${pool.asset} chain=${asset}`);
    }
    if (String(bank).toLowerCase() !== pool.bank.toLowerCase()) {
      throw new Error(`bank mismatch release=${pool.bank} chain=${bank}`);
    }
    return `${pool.domain} ${short(pool.bank)}`;
  });

  await checkCode(`pool ${pool.poolId} bank bytecode`, pool.bank);

  await check(`Bank pool ${pool.poolId} getSSOT`, async () => {
    const ssot = await client.readContract({
      address: getAddress(pool.bank),
      abi: BankAbi,
      functionName: "getSSOT",
      args: []
    });
    return `NAV=${bigintValue(ssot, "NAV")} R=${bigintValue(ssot, "R")} PF=${bigintValue(ssot, "PF")}`;
  });

  if (String(pool.domain).toLowerCase() === "casino") {
    await check(`GameHub riskInPaused pool ${pool.poolId}`, async () => {
      const paused = await client.readContract({
        address: getAddress(release.contracts.gameHub),
        abi: GameHubAbi,
        functionName: "riskInPaused",
        args: [BigInt(pool.poolId)]
      });
      return String(paused);
    });
  }
}

if (release.sports?.enabled) {
  await check("SportsHub wiring", async () => {
    const [poolRegistry, riskEngine, settlementRouter] = await Promise.all([
      client.readContract({
        address: getAddress(release.contracts.sportsHub),
        abi: SportsHubAbi,
        functionName: "poolRegistry",
        args: []
      }),
      client.readContract({
        address: getAddress(release.contracts.sportsHub),
        abi: SportsHubAbi,
        functionName: "riskEngine",
        args: []
      }),
      client.readContract({
        address: getAddress(release.contracts.sportsHub),
        abi: SportsHubAbi,
        functionName: "settlementRouter",
        args: []
      })
    ]);
    assertAddressEq("sports poolRegistry", poolRegistry, release.contracts.poolRegistry);
    assertAddressEq("sports riskEngine", riskEngine, release.contracts.sportsRiskEngine);
    assertAddressEq(
      "sports settlementRouter",
      settlementRouter,
      release.contracts.settlementRouter
    );
    return `risk=${short(riskEngine)} router=${short(settlementRouter)}`;
  });

  const sportsPools = (release.pools ?? []).filter(
    (pool) => String(pool.domain).toLowerCase() === "sports"
  );
  for (const pool of sportsPools) {
    await check(`SportsRiskEngine pool ${pool.poolId} hash`, async () => {
      const riskHash = await client.readContract({
        address: getAddress(release.contracts.sportsRiskEngine),
        abi: SportsRiskEngineAbi,
        functionName: "currentRiskHashForPool",
        args: [BigInt(pool.poolId)]
      });
      if (
        pool.sportsRisk?.riskHash &&
        String(riskHash).toLowerCase() !== pool.sportsRisk.riskHash.toLowerCase()
      ) {
        throw new Error(`riskHash mismatch release=${pool.sportsRisk.riskHash} chain=${riskHash}`);
      }
      return String(riskHash);
    });
  }
}

if (!ok) {
  console.error("[release-smoke] FAILED");
  process.exit(1);
}

console.log("[release-smoke] OK");

async function check(label, fn) {
  try {
    const value = await fn();
    console.log(`[ok] ${label}${value === undefined ? "" : `: ${value}`}`);
  } catch (error) {
    ok = false;
    console.error(`[fail] ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkCode(label, address) {
  await check(label, async () => {
    const normalized = getAddress(address);
    const code = await client.getBytecode({ address: normalized });
    if (!code || code === "0x") throw new Error(`no bytecode at ${normalized}`);
    return `${short(normalized)} bytes=${(code.length - 2) / 2}`;
  });
}

async function loadAbi(name) {
  const raw = JSON.parse(await fs.readFile(path.join(abiRoot, `${name}.abi.json`), "utf8"));
  return raw.abi ?? raw;
}

async function loadEnvFiles(files) {
  for (const file of files) {
    let text;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = parseEnvValue(rawValue);
    }
  }
}

function parseEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return expandEnvRefs(value.slice(1, -1));
  }
  return expandEnvRefs(value);
}

function expandEnvRefs(value) {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key) => {
    return process.env[key] ?? match;
  });
}

function resolveRpcUrl() {
  const direct =
    process.env.RPC_URL ??
    process.env.BASE_SEPOLIA_RPC_URL ??
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL;
  if (direct) return expandEnvRefs(direct);
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey) return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  throw new Error(
    "Missing RPC URL. Set RPC_URL, BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_RPC_URL, or NEXT_PUBLIC_ALCHEMY_API_KEY."
  );
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function short(value) {
  const text = String(value);
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function bigintValue(value, key) {
  const raw = value?.[key];
  return raw === undefined ? "n/a" : BigInt(raw).toString();
}

function assertAddressEq(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}
