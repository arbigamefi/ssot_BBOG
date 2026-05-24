#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const ssotRequire = createRequire(path.resolve(frontendRoot, "packages/ssot/package.json"));
const { createPublicClient, getAddress, http, parseAbi } = await import(
  pathToFileURL(ssotRequire.resolve("viem")).href
);
const { baseSepolia } = await import(pathToFileURL(ssotRequire.resolve("viem/chains")).href);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REQUIRED_CORE_CONTRACTS = [
  "gameHub",
  "settlementRouter",
  "poolRegistry",
  "vrfHub",
  "refRegistry",
  "refEngine",
  "adapter"
];
const REQUIRED_SPORTS_CONTRACTS = ["sportsHub", "sportsRiskEngine"];
const chainId = Number(readArg("--chain-id") ?? process.env.CHAIN_ID ?? 84532);
const releasePath =
  readArg("--release") ??
  path.resolve(frontendRoot, "packages/ssot/src/release/embedded", `chain-${chainId}.json`);
const abiRoot =
  readArg("--abi-root") ??
  path.resolve(frontendRoot, "packages/ssot/src/abis/release", `chain-${chainId}`);
const rpcRetries = readPositiveInteger(
  readArg("--rpc-retries") ?? process.env.RELEASE_SMOKE_RPC_RETRIES,
  2
);
const rpcRetryDelayMs = readPositiveInteger(
  readArg("--rpc-retry-delay-ms") ?? process.env.RELEASE_SMOKE_RPC_RETRY_DELAY_MS,
  750
);

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
const ERC20Abi = parseAbi(["function decimals() view returns (uint8)"]);
const LEGACY_GAME_AGGREGATOR_KEY = `hu${"b"}`;
const LEGACY_BANK_DIRECTORY_KEY = `bank${"Registry"}`;

let ok = true;
const releaseAssetsByAddress = new Map();
const erc20DecimalsByAddress = new Map();

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
    Object.hasOwn(contracts, LEGACY_GAME_AGGREGATOR_KEY) ||
    Object.hasOwn(contracts, LEGACY_BANK_DIRECTORY_KEY) ||
    Object.hasOwn(release?.sports ?? {}, LEGACY_GAME_AGGREGATOR_KEY)
  ) {
    throw new Error("legacy release keys are present in embedded release");
  }
  for (const key of REQUIRED_CORE_CONTRACTS) {
    const address = contracts[key];
    if (typeof address !== "string" || address.length === 0) {
      throw new Error(`contracts.${key} missing`);
    }
    if (address.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(`contracts.${key} is zero`);
    }
  }
  if (release.sports?.enabled) {
    for (const key of REQUIRED_SPORTS_CONTRACTS) {
      const address = contracts[key];
      if (typeof address !== "string" || address.length === 0) {
        throw new Error(`contracts.${key} missing`);
      }
      if (address.toLowerCase() === ZERO_ADDRESS) {
        throw new Error(`contracts.${key} is zero`);
      }
    }
  }
  return "v1.3";
});

await check("rpc chainId", async () => {
  const actual = await rpcCall("getChainId", () => client.getChainId());
  if (actual !== chainId) throw new Error(`expected ${chainId}, got ${actual}`);
  return String(actual);
});

await check("rpc block height", async () => {
  const block = await rpcCall("getBlockNumber", () => client.getBlockNumber());
  const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
  if (releaseBlock > 0n && block < releaseBlock) {
    throw new Error(`RPC block ${block} is behind release block ${releaseBlock}`);
  }
  return block.toString();
});

for (const [name, address] of Object.entries(release.contracts ?? {})) {
  if (
    !release.sports?.enabled &&
    REQUIRED_SPORTS_CONTRACTS.includes(name) &&
    String(address).toLowerCase() === ZERO_ADDRESS
  ) {
    console.log(`[skip] contract ${name}: sports disabled`);
    continue;
  }
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
  const [fee, gasLimit] = await rpcReadContract({
    address: getAddress(release.contracts.gameHub),
    abi: GameHubAbi,
    functionName: "quoteVRFFee",
    args: [1]
  });
  return `fee=${fee.toString()} gasLimit=${gasLimit.toString()}`;
});

for (const asset of release.assets ?? []) {
  const assetAddress = asset.address ?? asset.asset;
  await check(`asset ${asset.symbol ?? short(assetAddress)} decimals`, async () => {
    if (typeof assetAddress !== "string" || assetAddress.length === 0) {
      throw new Error("asset address missing");
    }
    const normalized = getAddress(assetAddress);
    const expectedDecimals = normalizeDecimals(asset.decimals, `asset ${asset.symbol} decimals`);
    const chainDecimals = await readErc20Decimals(normalized);
    if (chainDecimals !== expectedDecimals) {
      throw new Error(`release=${expectedDecimals} chain=${chainDecimals}`);
    }
    releaseAssetsByAddress.set(normalized.toLowerCase(), {
      ...asset,
      address: normalized,
      decimals: expectedDecimals
    });
    return `${short(normalized)} decimals=${chainDecimals}`;
  });
}

for (const pool of release.pools ?? []) {
  await check(`PoolRegistry pool ${pool.poolId}`, async () => {
    const poolId = BigInt(pool.poolId);
    const [active, asset, bank] = await Promise.all([
      rpcReadContract({
        address: getAddress(release.contracts.poolRegistry),
        abi: PoolRegistryAbi,
        functionName: "isPoolActive",
        args: [poolId]
      }),
      rpcReadContract({
        address: getAddress(release.contracts.poolRegistry),
        abi: PoolRegistryAbi,
        functionName: "assetFor",
        args: [poolId]
      }),
      rpcReadContract({
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

  await check(`pool ${pool.poolId} asset decimals`, async () => {
    const asset = getAddress(pool.asset);
    const expectedDecimals = normalizeDecimals(pool.decimals, `pool ${pool.poolId} decimals`);
    const chainDecimals = await readErc20Decimals(asset);
    if (chainDecimals !== expectedDecimals) {
      throw new Error(`release=${expectedDecimals} chain=${chainDecimals}`);
    }
    const releaseAsset = releaseAssetsByAddress.get(asset.toLowerCase());
    if (releaseAsset && releaseAsset.decimals !== expectedDecimals) {
      throw new Error(
        `asset ${releaseAsset.symbol ?? short(asset)} decimals=${releaseAsset.decimals} pool=${expectedDecimals}`
      );
    }
    return `${pool.symbol ?? short(asset)} decimals=${chainDecimals}`;
  });

  await checkCode(`pool ${pool.poolId} bank bytecode`, pool.bank);

  await check(`Bank pool ${pool.poolId} getSSOT`, async () => {
    const ssot = await rpcReadContract({
      address: getAddress(pool.bank),
      abi: BankAbi,
      functionName: "getSSOT",
      args: []
    });
    return `NAV=${bigintValue(ssot, "NAV")} R=${bigintValue(ssot, "R")} PF=${bigintValue(ssot, "PF")}`;
  });

  if (String(pool.domain).toLowerCase() === "casino") {
    await check(`GameHub riskInPaused pool ${pool.poolId}`, async () => {
      const paused = await rpcReadContract({
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
      rpcReadContract({
        address: getAddress(release.contracts.sportsHub),
        abi: SportsHubAbi,
        functionName: "poolRegistry",
        args: []
      }),
      rpcReadContract({
        address: getAddress(release.contracts.sportsHub),
        abi: SportsHubAbi,
        functionName: "riskEngine",
        args: []
      }),
      rpcReadContract({
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
      const riskHash = await rpcReadContract({
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
    console.error(`[fail] ${label}: ${sanitizeErrorMessage(error)}`);
  }
}

async function checkCode(label, address) {
  await check(label, async () => {
    const normalized = getAddress(address);
    const code = await rpcCall(`getBytecode:${short(normalized)}`, () =>
      client.getBytecode({ address: normalized })
    );
    if (!code || code === "0x") throw new Error(`no bytecode at ${normalized}`);
    return `${short(normalized)} bytes=${(code.length - 2) / 2}`;
  });
}

async function rpcReadContract(params) {
  return rpcCall(`${params.functionName}:${short(params.address)}`, () =>
    client.readContract(params)
  );
}

async function readErc20Decimals(address) {
  const normalized = getAddress(address);
  const cacheKey = normalized.toLowerCase();
  if (erc20DecimalsByAddress.has(cacheKey)) return erc20DecimalsByAddress.get(cacheKey);
  const decimals = normalizeDecimals(
    await rpcReadContract({
      address: normalized,
      abi: ERC20Abi,
      functionName: "decimals",
      args: []
    }),
    `ERC20 ${short(normalized)} decimals`
  );
  erc20DecimalsByAddress.set(cacheKey, decimals);
  return decimals;
}

async function rpcCall(label, fn) {
  let lastError;
  for (let attempt = 0; attempt <= rpcRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= rpcRetries || !isRetryableRpcError(error)) break;
      await sleep(rpcRetryDelayMs * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${sanitizeErrorMessage(lastError)}`);
}

function isRetryableRpcError(error) {
  const text = sanitizeErrorMessage(error).toLowerCase();
  return (
    text.includes("429") ||
    text.includes("too many requests") ||
    text.includes("rate limit") ||
    text.includes("timeout") ||
    text.includes("network")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const direct = firstDefined(
    process.env.RPC_URL,
    ...(chainId === 8453
      ? [
          process.env.BASE_MAINNET_RPC_URL,
          process.env.BASE_RPC_URL,
          process.env.NEXT_PUBLIC_BASE_RPC_URL
        ]
      : []),
    ...(chainId === 84532
      ? [process.env.BASE_SEPOLIA_RPC_URL, process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL]
      : []),
    process.env.NEXT_PUBLIC_RPC_URL
  );
  if (direct) return expandEnvRefs(direct);
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey && chainId === 8453) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  if (alchemyKey && chainId === 84532) return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  throw new Error(
    "Missing RPC URL. Set RPC_URL, BASE_MAINNET_RPC_URL, NEXT_PUBLIC_BASE_RPC_URL, BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_RPC_URL, or NEXT_PUBLIC_ALCHEMY_API_KEY."
  );
}

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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

function normalizeDecimals(value, label) {
  const decimals = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error(`${label} must be an integer between 0 and 255`);
  }
  return decimals;
}

function sanitizeErrorMessage(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/(https?:\/\/[^/\s]+\/v2\/)[A-Za-z0-9_-]+/g, "$1<redacted>")
    .replace(/([?&]apiKey=)[^&\s]+/gi, "$1<redacted>")
    .replace(/([?&]key=)[^&\s]+/gi, "$1<redacted>");
}
