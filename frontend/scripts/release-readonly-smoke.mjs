#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const ssotRequire = createRequire(path.resolve(frontendRoot, "packages/ssot/package.json"));
const { createPublicClient, getAddress, http, parseAbi } = await import(
  pathToFileURL(ssotRequire.resolve("viem")).href
);
const { baseSepolia } = await import(pathToFileURL(ssotRequire.resolve("viem/chains")).href);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REQUIRED_CORE_CONTRACTS = [
  "governanceTimelock",
  "gameHub",
  "settlementRouter",
  "poolRegistry",
  "vrfHub",
  "refRegistry",
  "refEngine"
];
const chainId = Number(readArg("--chain-id") ?? process.env.CHAIN_ID ?? 84532);
const releasePath =
  readArg("--release") ??
  path.resolve(frontendRoot, "packages/ssot/src/release/embedded", `chain-${chainId}.json`);
const abiRoot =
  readArg("--abi-root") ?? path.resolve(frontendRoot, "packages/ssot/src/abis/contracts");
const rpcRetries = readPositiveInteger(
  readArg("--rpc-retries") ?? process.env.RELEASE_SMOKE_RPC_RETRIES,
  2
);
const rpcRetryDelayMs = readPositiveInteger(
  readArg("--rpc-retry-delay-ms") ?? process.env.RELEASE_SMOKE_RPC_RETRY_DELAY_MS,
  750
);

await loadEnvFiles([path.resolve(frontendRoot, "apps/web/.env.local")]);

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
const LiquidityVaultAbi = await loadAbi("LiquidityVault");
const PoolRegistryAbi = await loadAbi("PoolRegistry");
const ERC20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
]);
const MAX_BPS = 10_000n;
const MAX_TREE_CAPITAL = (1n << 108n) - 1n;
const SSOT_FIELDS = [
  "bankCash",
  "vaultCash",
  "L",
  "P",
  "R",
  "K",
  "G",
  "PF",
  "XP",
  "PP",
  "bankSurplus",
  "vaultSurplus",
  "accountingValid",
  "riskReserveBps",
  "riskReserve",
  "riskFree",
  "withdrawalBufferBps",
  "withdrawalBuffer",
  "lpFreeCapital",
  "riskInPaused",
  "xpAccruedTotal",
  "xpLockedTotal",
  "xpHoldbackTotal",
  "holdbackVestingSeconds",
  "minPlayerTurnoverForUnlock"
];
const PERFORMANCE_FIELDS = [
  "turnover",
  "payoutGross",
  "payoutNet",
  "refunded",
  "feeOnPayout",
  "protocolFeeAccrued",
  "betsHeld",
  "betsSettled",
  "betsRefunded",
  "betsVoided",
  "voided"
];

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
  if (release?.meta?.architectureVersion !== "v1.6-nft-liquidity")
    throw new Error("expected NFT liquidity architecture");
  const contracts = release?.contracts ?? {};
  if (
    !Array.isArray(release.gamesMeta) ||
    release.gamesMeta.length !== 8 ||
    !Array.isArray(release.pools) ||
    release.pools.length === 0
  )
    throw new Error("missing current games or NFT pools");
  if (release?.meta?.releaseLock?.schema !== "SSOT_RELEASE_DIGEST_V16" || release.isPlaceholder) {
    throw new Error("expected an authenticated current deployed release");
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
  return "v1.6-nft-liquidity";
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
  await checkCode(`contract ${name}`, address);
}

// Every governed contract answers to the release's timelock (ADR-0037 §9 D1).
await check("governance is the release timelock", async () => {
  const timelock = getAddress(release.contracts.governanceTimelock);
  const governed = [
    ["PoolRegistry", release.contracts.poolRegistry, PoolRegistryAbi],
    ["GameHub", release.contracts.gameHub, GameHubAbi],
    ...(release.pools ?? []).map((pool) => [`Bank pool ${pool.poolId}`, pool.bank, BankAbi])
  ];
  for (const [name, address, abi] of governed) {
    const governance = await rpcReadContract({
      address: getAddress(address),
      abi,
      functionName: "governance",
      args: []
    });
    if (getAddress(governance) !== timelock) throw new Error(`${name} governance=${governance}`);
  }
  return short(timelock);
});

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

for (const game of release.gamesMeta ?? []) {
  await check(`GameHub ${game.slug} admission and quote`, async () => {
    const blockNumber = await rpcCall("getBlockNumber", () => client.getBlockNumber());
    const [module, maxBetCount, callbackGasLimit, quote] = await Promise.all([
      ...["gameModule", "gameMaxBetCount", "gameCallbackGasLimit"].map((functionName) =>
        rpcReadContract({
          address: getAddress(release.contracts.gameHub),
          abi: GameHubAbi,
          functionName,
          args: [game.gameId],
          blockNumber
        })
      ),
      rpcReadContract({
        address: getAddress(release.contracts.gameHub),
        abi: GameHubAbi,
        functionName: "quoteVRFFee",
        args: [game.gameId, 1, await client.getGasPrice()],
        blockNumber
      })
    ]);
    assertAddressEq("game module", module, game.module);
    if (
      Number(maxBetCount) !== game.maxBetCount ||
      Number(callbackGasLimit) !== game.callbackGasLimit ||
      BigInt(quote[1]) !== BigInt(callbackGasLimit)
    )
      throw new Error("game admission/quote mismatch");
    return `maxBetCount=${maxBetCount} fee=${quote[0]} gasLimit=${callbackGasLimit}`;
  });
}

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
    // Activity is chain state, not release metadata: the release is signed before the pool takes bets.
    if (String(asset).toLowerCase() !== pool.asset.toLowerCase()) {
      throw new Error(`asset mismatch release=${pool.asset} chain=${asset}`);
    }
    if (String(bank).toLowerCase() !== pool.bank.toLowerCase()) {
      throw new Error(`bank mismatch release=${pool.bank} chain=${bank}`);
    }
    return `${pool.domain} ${short(pool.bank)} ${active ? "active" : "inactive"}`;
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

  await checkCode(`pool ${pool.poolId} Vault bytecode`, pool.vault);
  await check(`Bank/Vault pool ${pool.poolId} accounting and immutable binding`, async () => {
    const blockNumber = await rpcCall("getBlockNumber", () => client.getBlockNumber());
    const bankRead = (functionName) =>
      rpcReadContract({
        address: getAddress(pool.bank),
        abi: BankAbi,
        functionName,
        args: [],
        blockNumber
      });
    const vaultRead = (functionName) =>
      rpcReadContract({
        address: getAddress(pool.vault),
        abi: LiquidityVaultAbi,
        functionName,
        args: [],
        blockNumber
      });
    const balance = (address) =>
      rpcReadContract({
        address: getAddress(pool.asset),
        abi: ERC20Abi,
        functionName: "balanceOf",
        args: [getAddress(address)],
        blockNumber
      });
    const [
      ssot,
      playerPayableTotal,
      pendingStake,
      totalReserved,
      bankVault,
      bankAsset,
      vaultBank,
      vaultAsset,
      root,
      locked,
      bankCash,
      vaultCash
    ] = await Promise.all([
      ...[
        "getSSOT",
        "playerPayableTotal",
        "pendingStakeTotal",
        "totalReserved",
        "vault",
        "asset"
      ].map(bankRead),
      ...["bank", "asset", "getReserve", "lockedLiquidity"].map(vaultRead),
      balance(pool.bank),
      balance(pool.vault)
    ]);
    assertAddressEq("Bank.vault", bankVault, pool.vault);
    assertAddressEq("Bank.asset", bankAsset, pool.asset);
    assertAddressEq("Vault.bank", vaultBank, pool.bank);
    assertAddressEq("Vault.asset", vaultAsset, pool.asset);
    return validateBankSSOT(ssot, {
      playerPayableTotal,
      pendingStake,
      totalReserved,
      root,
      locked,
      bankCash,
      vaultCash
    });
  });

  await check(`Bank pool ${pool.poolId} getPerformance`, async () => {
    const performance = await rpcReadContract({
      address: getAddress(pool.bank),
      abi: BankAbi,
      functionName: "getPerformance",
      args: []
    });
    return validateBankPerformance(performance);
  });

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
    process.env.RPC_URL,
    process.env.NEXT_PUBLIC_RPC_URL
  );
  if (direct) return expandEnvRefs(direct);
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey && chainId === 8453) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  if (alchemyKey && chainId === 84532) return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  throw new Error(
    "Missing RPC URL. Set BASE_MAINNET_RPC_URL, NEXT_PUBLIC_BASE_RPC_URL, BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL, NEXT_PUBLIC_RPC_URL, or NEXT_PUBLIC_ALCHEMY_API_KEY in frontend/apps/web/.env.local."
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

function validateBankSSOT(ssot, totals) {
  assertTupleShape("Bank.getSSOT", ssot, SSOT_FIELDS);
  const data = Object.fromEntries(
    SSOT_FIELDS.map((field) => [
      field,
      ["accountingValid", "riskInPaused"].includes(field)
        ? requiredBoolField("Bank.getSSOT", ssot, field, SSOT_FIELDS)
        : requiredBigintField("Bank.getSSOT", ssot, field, SSOT_FIELDS)
    ])
  );
  const {
    bankCash,
    vaultCash,
    L,
    P,
    R,
    K,
    G,
    PF,
    XP,
    PP,
    bankSurplus,
    vaultSurplus,
    riskReserveBps,
    riskReserve,
    riskFree,
    withdrawalBufferBps,
    withdrawalBuffer,
    lpFreeCapital,
    xpAccruedTotal,
    xpLockedTotal,
    xpHoldbackTotal
  } = data;
  if (Object.values(data).some((value) => typeof value === "bigint" && value < 0n))
    throw new Error("negative accounting value");
  if (!data.accountingValid) throw new Error("Bank accounting is invalid");
  const bindings = {
    bankCash: "bankCash",
    vaultCash: "vaultCash",
    L: "root",
    P: "pendingStake",
    R: "totalReserved",
    K: "locked",
    PP: "playerPayableTotal"
  };
  for (const [field, key] of Object.entries(bindings)) {
    if (typeof totals?.[key] !== "bigint" || data[field] !== totals[key])
      throw new Error(`accounting source mismatch: ${field}`);
  }
  if (R < P || K !== R - P || L < K || G !== L + P || G > MAX_TREE_CAPITAL) {
    throw new Error("capital identity or bound failed: L/P/R/K/G");
  }
  if (bankCash < P + PF + XP + PP || vaultCash < L) throw new Error("custody cash deficit");
  if (bankCash !== P + PF + XP + PP + bankSurplus || vaultCash !== L + vaultSurplus) {
    throw new Error("custody surplus identity failed");
  }
  if (XP !== xpAccruedTotal + xpLockedTotal + xpHoldbackTotal)
    throw new Error("XP bucket identity failed");
  assertBps("Bank.getSSOT.riskReserveBps", riskReserveBps);
  assertBps("Bank.getSSOT.withdrawalBufferBps", withdrawalBufferBps);
  const expectedRiskReserve = (G * riskReserveBps) / MAX_BPS;
  const expectedRiskFree = G >= R + expectedRiskReserve ? G - R - expectedRiskReserve : 0n;
  if (riskReserve !== expectedRiskReserve || riskFree !== expectedRiskFree)
    throw new Error("risk buffer identity failed");
  if (withdrawalBuffer !== (G * withdrawalBufferBps) / MAX_BPS)
    throw new Error("optional outflow buffer identity failed");
  if (lpFreeCapital !== L - K) throw new Error("LP free capital identity failed");
  return `L=${L} P=${P} R=${R} K=${K} G=${G} PP=${PP} surplus=${bankSurplus}/${vaultSurplus} paused=${data.riskInPaused}`;
}

function validateBankPerformance(performance) {
  assertTupleShape("Bank.getPerformance", performance, PERFORMANCE_FIELDS);

  const turnover = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "turnover",
    PERFORMANCE_FIELDS
  );
  const payoutGross = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "payoutGross",
    PERFORMANCE_FIELDS
  );
  const payoutNet = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "payoutNet",
    PERFORMANCE_FIELDS
  );
  const feeOnPayout = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "feeOnPayout",
    PERFORMANCE_FIELDS
  );
  const protocolFeeAccrued = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "protocolFeeAccrued",
    PERFORMANCE_FIELDS
  );
  const betsHeld = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "betsHeld",
    PERFORMANCE_FIELDS
  );
  const betsSettled = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "betsSettled",
    PERFORMANCE_FIELDS
  );
  const betsRefunded = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "betsRefunded",
    PERFORMANCE_FIELDS
  );
  const betsVoided = requiredBigintField(
    "Bank.getPerformance",
    performance,
    "betsVoided",
    PERFORMANCE_FIELDS
  );

  if (payoutGross !== payoutNet + feeOnPayout) {
    throw new Error(
      `payout identity failed: payoutGross=${payoutGross} payoutNet=${payoutNet} feeOnPayout=${feeOnPayout}`
    );
  }
  if (betsSettled + betsRefunded + betsVoided > betsHeld) {
    throw new Error(
      `terminal bet counters exceed held: held=${betsHeld} settled=${betsSettled} refunded=${betsRefunded} voided=${betsVoided}`
    );
  }

  return `turnover=${turnover} payoutGross=${payoutGross} protocolFee=${protocolFeeAccrued} bets=${betsHeld}/${betsSettled}/${betsRefunded}/${betsVoided}`;
}

function assertTupleShape(label, tuple, fields) {
  if (Array.isArray(tuple) && tuple.length !== fields.length) {
    throw new Error(`${label} returned ${tuple.length} values, expected ${fields.length}`);
  }
  for (const field of fields) {
    tupleField(tuple, field, fields);
  }
}

function tupleField(tuple, field, fields) {
  if (tuple && Object.hasOwn(tuple, field)) return tuple[field];
  const index = fields.indexOf(field);
  if (Array.isArray(tuple) && index >= 0 && index < tuple.length) return tuple[index];
  throw new Error(`missing ${field}`);
}

function requiredBigintField(label, tuple, field, fields) {
  const raw = tupleField(tuple, field, fields);
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`${label}.${field} must be bigint-compatible`);
  }
}

function requiredBoolField(label, tuple, field, fields) {
  const raw = tupleField(tuple, field, fields);
  if (typeof raw !== "boolean") throw new Error(`${label}.${field} must be boolean`);
  return raw;
}

function assertBps(label, value) {
  if (value > MAX_BPS) throw new Error(`${label} exceeds ${MAX_BPS}: ${value}`);
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
