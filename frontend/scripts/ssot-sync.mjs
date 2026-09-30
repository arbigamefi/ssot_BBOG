#!/usr/bin/env node
/** Import authenticated current release metadata; contract ABIs come from the current build. */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Only the current architecture is admitted by this checkout.
const RELEASE_LINE = {
  name: "v1.6",
  suffix: "v16",
  architectureVersion: "v1.6-house-edge-allocation",
  schema: "SSOT_RELEASE_DIGEST_V16",
  scriptSuffix: "V16"
};

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const fromArg = getArg("--from");
if (!fromArg) {
  console.error("\nMissing --from <releaseBundleDir|tar.gz>\n");
  console.error("Example: pnpm ssot:sync -- --from ../ssot-release-chain-84532.tar.gz\n");
  process.exit(1);
}

const ROOT = process.cwd();
const FROM_INPUT = path.resolve(ROOT, fromArg);

const OUT_EMBEDDED = path.resolve(ROOT, "packages/ssot/src/release/embedded");

const isTar = (p) => p.endsWith(".tar.gz") || p.endsWith(".tgz");
const isAppleJunk = (name) => name.startsWith("._") || name === ".DS_Store";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

function chainName(chainId) {
  switch (Number(chainId)) {
    case 84532:
      return "Base Sepolia";
    case 8453:
      return "Base";
    case 42161:
      return "Arbitrum One";
    case 421614:
      return "Arbitrum Sepolia";
    default:
      return `Chain ${chainId}`;
  }
}

function normalizeAddress(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function normalizeNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function requireNumeric(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} is required`);
  return n;
}

function buildEmbeddedAssets(manifest) {
  const pools = Array.isArray(manifest.pools) ? manifest.pools : [];
  const casinoPools = pools.filter(
    (p) => String(p.domain).toLowerCase() === "casino" || Number(p.domainId) === 1
  );
  const sourcePools = casinoPools.length > 0 ? casinoPools : pools;
  const seenAssets = new Set();
  const assets = [];
  for (const pool of sourcePools) {
    if (!pool.asset || !pool.bank) continue;
    const asset = normalizeAddress(pool.asset);
    if (seenAssets.has(asset)) continue;
    seenAssets.add(asset);
    assets.push({
      symbol: requireString(pool.symbol, `pools[${pool.poolId ?? assets.length}].symbol`),
      decimals: requireNumeric(pool.decimals, `pools[${pool.poolId ?? assets.length}].decimals`),
      address: asset,
      bank: normalizeAddress(pool.bank)
    });
  }
  return assets;
}

function buildEmbeddedGames(manifest) {
  return Object.fromEntries(
    manifest.games.map((g) => [String(g.gameId).toLowerCase(), normalizeAddress(g.module)])
  );
}

function buildEmbeddedGamesMeta(manifest) {
  if (!Array.isArray(manifest.games)) return undefined;
  return manifest.games.map((g) => ({
    gameId: String(g.gameId).toLowerCase(),
    slug: g.slug,
    label: g.label,
    module: normalizeAddress(g.module),
    paramsEncoding: g.paramsEncoding
  }));
}

function buildEmbeddedSports(manifest) {
  if (!manifest.sports || typeof manifest.sports !== "object") return undefined;
  const s = manifest.sports;
  return {
    enabled: Boolean(s.enabled),
    riskEngine: normalizeAddress(s.riskEngine),
    sportsHub: normalizeAddress(s.sportsHub),
    oddsSignerSetHash: s.oddsSignerSetHash,
    resultReporterSetHash: s.resultReporterSetHash,
    resultReporterThreshold: String(s.resultReporterThreshold ?? "0"),
    resultChallengeTimeoutSeconds: String(s.resultChallengeTimeoutSeconds ?? "0"),
    resultChallenger: normalizeAddress(s.resultChallenger),
    resultArbitrator: normalizeAddress(s.resultArbitrator),
    maxStake: String(s.maxStake ?? "0"),
    maxPayout: String(s.maxPayout ?? "0"),
    maxMarketReserved: String(s.maxMarketReserved ?? "0"),
    maxOutcomeReserved: String(s.maxOutcomeReserved ?? "0"),
    maxEventReserved: String(s.maxEventReserved ?? "0")
  };
}

function buildEmbeddedPools(manifest) {
  if (!Array.isArray(manifest.pools)) return undefined;
  return manifest.pools.map((pool, index) => ({
    poolId: normalizeNumeric(pool.poolId),
    domainId: normalizeNumeric(pool.domainId),
    domain: String(pool.domain ?? ""),
    active: Boolean(pool.active),
    asset: normalizeAddress(requireString(pool.asset, `pools[${index}].asset`)),
    bank: normalizeAddress(requireString(pool.bank, `pools[${index}].bank`)),
    symbol: requireString(pool.symbol, `pools[${index}].symbol`),
    decimals: requireNumeric(pool.decimals, `pools[${index}].decimals`),
    sportsRisk: pool.sportsRisk
      ? {
          maxStake: String(pool.sportsRisk.maxStake ?? "0"),
          maxPayout: String(pool.sportsRisk.maxPayout ?? "0"),
          maxMarketReserved: String(pool.sportsRisk.maxMarketReserved ?? "0"),
          maxOutcomeReserved: String(pool.sportsRisk.maxOutcomeReserved ?? "0"),
          maxEventReserved: String(pool.sportsRisk.maxEventReserved ?? "0"),
          riskHash: String(pool.sportsRisk.riskHash ?? "")
        }
      : null
  }));
}

async function writeEmbeddedIndex(jsonFiles) {
  const indexPath = path.join(OUT_EMBEDDED, "index.ts");
  const imports = [];
  const entries = [];
  for (const f of jsonFiles) {
    const varName = "r" + f.replace(/[^a-zA-Z0-9]/g, "_");
    imports.push(`import ${varName} from "./${f}";`);
    // Use computed keys to allow numeric chainId at runtime.
    entries.push(`  [${varName}.chainId]: ${varName},`);
  }
  const content = `// AUTO-GENERATED by pnpm ssot:sync. DO NOT EDIT.\n\n${imports.join("\n")}\n\nexport const embeddedReleases: Record<number, unknown> = {\n${entries.join("\n")}\n};\n\nexport const embeddedChainIds: number[] = Object.keys(embeddedReleases).map((k) => Number(k));\n`;
  await fs.writeFile(indexPath, content, "utf8");
}

let extractedDirectory = null;

async function main() {
  let bundleRoot = FROM_INPUT;

  if (isTar(bundleRoot)) {
    console.log("\n[ssot:sync] extracting tar:", bundleRoot);
    extractedDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "ssot-release-"));
    await execFileAsync("tar", ["-xzf", bundleRoot, "-C", extractedDirectory]);
    bundleRoot = extractedDirectory;
  }

  console.log("\n[ssot:sync] bundle root:", bundleRoot);

  const deploymentsDir = path.join(bundleRoot, "deployments");
  const abisDir = path.join(bundleRoot, "abis");

  const { suffix } = RELEASE_LINE;
  const manifestPath = path.join(deploymentsDir, `frontend-manifest-latest-${suffix}.json`);
  const vectorsPath = path.join(deploymentsDir, `golden-vectors-latest-${suffix}.json`);
  const releaseLockPath = path.join(deploymentsDir, `release-latest-${suffix}.json`);
  const latestSnapshotPath = path.join(deploymentsDir, `latest-${suffix}.json`);
  const abiIndexPath = path.join(abisDir, "index.json");

  for (const p of [
    deploymentsDir,
    abisDir,
    manifestPath,
    vectorsPath,
    releaseLockPath,
    latestSnapshotPath,
    abiIndexPath
  ]) {
    if (!(await pathExists(p))) {
      throw new Error(
        `Missing required path: ${p}; expected current release bundle with deployments/ and abis/.`
      );
    }
  }

  const manifest = await readJson(manifestPath);
  const vectors = await readJson(vectorsPath);
  const releaseLock = await readJson(releaseLockPath);
  const latestSnapshot = await readJson(latestSnapshotPath);
  const abiIndex = await readJson(abiIndexPath);

  // Verify all inputs before changing active embedded metadata.
  if (
    manifest.architectureVersion !== RELEASE_LINE.architectureVersion ||
    latestSnapshot.architectureVersion !== RELEASE_LINE.architectureVersion ||
    releaseLock.schema !== RELEASE_LINE.schema
  ) {
    throw new Error(
      `Only a ${RELEASE_LINE.name} release bundle can become the active deployment from this checkout.`
    );
  }
  for (const item of [vectors, releaseLock, latestSnapshot, abiIndex]) {
    if (item.chainId !== manifest.chainId || item.blockNumber !== manifest.blockNumber) {
      throw new Error("Mixed chain or deployment block in release bundle.");
    }
  }
  if (!process.env.RELEASE_SIGNER || !process.env.RPC_URL) {
    throw new Error(
      `Set the trusted RELEASE_SIGNER and chain-specific RPC_URL before importing ${RELEASE_LINE.name}.`
    );
  }
  const repoRoot = path.resolve(ROOT, "..");
  await ensureDir(path.join(repoRoot, "deployments"));
  const verificationDir = await fs.mkdtemp(
    path.join(repoRoot, "deployments", `.verify-${suffix}-`)
  );
  await fs.copyFile(latestSnapshotPath, path.join(verificationDir, "snapshot.json"));
  await fs.copyFile(releaseLockPath, path.join(verificationDir, "release.json"));
  const verificationEnv = {
    ...process.env,
    SNAPSHOT_PATH: path.join(verificationDir, "snapshot.json"),
    RELEASE_PATH: path.join(verificationDir, "release.json")
  };
  let verificationStage = "artifact validation";
  try {
    await execFileAsync(
      process.env.PYTHON ?? "python3",
      [
        "script/release/validate_frontend_artifacts.py",
        "--strict",
        "1",
        "--release",
        releaseLockPath,
        "--snapshot",
        latestSnapshotPath,
        "--notes",
        path.join(deploymentsDir, `release-notes-latest-${suffix}.md`),
        "--manifest",
        manifestPath,
        "--vectors",
        vectorsPath,
        "--abis-index",
        abiIndexPath
      ],
      { cwd: repoRoot, env: verificationEnv }
    );
    verificationStage = "release signature";
    await execFileAsync(
      "forge",
      [
        "script",
        `script/release/VerifyRelease${RELEASE_LINE.scriptSuffix}.s.sol:VerifyRelease${RELEASE_LINE.scriptSuffix}`
      ],
      { cwd: repoRoot, env: verificationEnv }
    );
    verificationStage = "live governance";
    await execFileAsync(
      "forge",
      [
        "script",
        `script/release/VerifyGovernance${RELEASE_LINE.scriptSuffix}.s.sol:VerifyGovernance${RELEASE_LINE.scriptSuffix}`,
        "--rpc-url",
        process.env.RPC_URL
      ],
      { cwd: repoRoot, env: verificationEnv }
    );
  } catch (error) {
    // Preserve the rejecting stage without echoing commands or RPC credentials.
    const detail =
      verificationStage === "artifact validation" ? ` ${String(error.stderr ?? "").trim()}` : "";
    throw new Error(
      `${RELEASE_LINE.name} ${verificationStage} failed; active release was not changed.${detail}`
    );
  } finally {
    await fs.rm(verificationDir, { recursive: true, force: true });
  }

  const chainId = Number(manifest.chainId);
  const blockNumber = Number(manifest.blockNumber);
  const digest = String(releaseLock.digest);
  const addresses = manifest.addresses ?? {};
  const embeddedAssets = buildEmbeddedAssets(manifest);
  const embeddedGames = buildEmbeddedGames(manifest);
  const embeddedGamesMeta = buildEmbeddedGamesMeta(manifest);
  const embeddedSports = buildEmbeddedSports(manifest);
  const embeddedPools = buildEmbeddedPools(manifest);

  // Generate embedded release snapshot consumed by runtime loader
  const embedded = {
    chainId,
    name: chainName(chainId),
    releaseDigest: digest,
    isPlaceholder: false,
    refundTimeoutSeconds:
      Number.isFinite(Number(manifest.refundTimeoutSeconds)) &&
      Number(manifest.refundTimeoutSeconds) > 0
        ? Number(manifest.refundTimeoutSeconds)
        : undefined,
    defaultHouseEdgeBps:
      Number.isFinite(Number(latestSnapshot.defaultHouseEdgeBps)) &&
      Number(latestSnapshot.defaultHouseEdgeBps) >= 0
        ? Number(latestSnapshot.defaultHouseEdgeBps)
        : undefined,
    contracts: {
      gameHub: normalizeAddress(addresses.gameHub),
      settlementRouter: normalizeAddress(addresses.settlementRouter),
      poolRegistry: normalizeAddress(addresses.poolRegistry),
      sportsHub: normalizeAddress(addresses.sportsHub),
      sportsRiskEngine: normalizeAddress(addresses.sportsRiskEngine),
      vrfHub: normalizeAddress(addresses.vrfHub),
      refRegistry: normalizeAddress(addresses.refRegistry),
      refEngine: normalizeAddress(addresses.refEngine),
      adapter: normalizeAddress(addresses.adapter)
    },
    assets: embeddedAssets,
    games: embeddedGames,
    gamesMeta: embeddedGamesMeta,
    sports: embeddedSports,
    pools: embeddedPools,
    meta: {
      blockNumber,
      schemaVersion: manifest.schemaVersion,
      generatedAt: manifest.generatedAt,
      releaseLock
    }
  };

  await ensureDir(OUT_EMBEDDED);
  const embeddedFile = `chain-${chainId}.json`;
  await fs.writeFile(
    path.join(OUT_EMBEDDED, embeddedFile),
    `${JSON.stringify(embedded, null, 2)}\n`,
    "utf8"
  );

  const existing = (await fs.readdir(OUT_EMBEDDED)).filter(
    (f) => f.startsWith("chain-") && f.endsWith(".json") && !isAppleJunk(f)
  );
  existing.sort();
  await writeEmbeddedIndex(existing);

  console.log("[ssot:sync] wrote embedded ->", path.join(OUT_EMBEDDED, embeddedFile));
  console.log("[ssot:sync] done\n");
}

await main()
  .catch((err) => {
    console.error("[ssot:sync] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (extractedDirectory) await fs.rm(extractedDirectory, { recursive: true, force: true });
  });
