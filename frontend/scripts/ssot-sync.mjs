#!/usr/bin/env node
/**
 * ssot:sync (FINAL SHAPE)
 *
 * Synchronize a **contract release bundle** into this repo.
 *
 * The bundle is the single source of truth and MUST contain:
 *   - deployments/frontend-manifest-latest-v15.json
 *   - deployments/golden-vectors-latest-v15.json
 *   - deployments/release-latest-v15.json
 *   - deployments/latest-v15.json (required for verification)
 *   - abis/index.json + abis/*.abi.json
 *   - (optional) MANIFEST.sha256
 *
 * Supported inputs:
 *   - A directory containing the files above, OR
 *   - A .tar.gz / .tgz of such a directory.
 *
 * Output:
 *   - packages/ssot/src/release/embedded/*.json (+ embedded/index.ts)
 *   - packages/ssot/src/abis/release/chain-<id>/* (+ release/index.ts)
 *   - packages/ssot/src/fixtures/release-bundles/... (auditable mirror)
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
const OUT_ABIS = path.resolve(ROOT, "packages/ssot/src/abis/release");
const OUT_FIXT = path.resolve(ROOT, "packages/ssot/src/fixtures/release-bundles");

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

async function firstExistingPath(baseDir, candidates) {
  for (const candidate of candidates) {
    const p = path.join(baseDir, candidate);
    if (await pathExists(p)) return p;
  }
  return path.join(baseDir, candidates[0]);
}

async function copyFile(src, dst) {
  await ensureDir(path.dirname(dst));
  await fs.copyFile(src, dst);
}

async function copyDirFiltered(srcDir, dstDir) {
  await ensureDir(dstDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    if (isAppleJunk(e.name)) continue;
    const s = path.join(srcDir, e.name);
    const d = path.join(dstDir, e.name);
    if (e.isDirectory()) {
      await copyDirFiltered(s, d);
    } else if (e.isFile()) {
      await copyFile(s, d);
    }
  }
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

function shortDigest(digest) {
  const s = String(digest ?? "");
  if (s.startsWith("0x") && s.length >= 10) return s.slice(2, 10);
  return s.slice(0, 8);
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
  if (Array.isArray(manifest.assets) && manifest.assets.length > 0) {
    return manifest.assets.map((a, index) => {
      const assetAddress = a.asset ?? a.address;
      return {
        symbol: requireString(a.symbol, `assets[${index}].symbol`),
        decimals: requireNumeric(a.decimals, `assets[${index}].decimals`),
        address: normalizeAddress(requireString(assetAddress, `assets[${index}].asset`)),
        bank: normalizeAddress(requireString(a.bank, `assets[${index}].bank`))
      };
    });
  }

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
  if (Array.isArray(manifest.games)) {
    return Object.fromEntries(
      manifest.games.map((g) => [String(g.gameId).toLowerCase(), normalizeAddress(g.module)])
    );
  }
  return Object.fromEntries(
    Object.entries(manifest.games ?? {}).map(([gameId, module]) => [
      String(gameId).toLowerCase(),
      normalizeAddress(module)
    ])
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

async function extractTarToTemp(tarPath) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ssot-release-"));
  await execFileAsync("tar", ["-xzf", tarPath, "-C", tmp]);
  // Some tars contain a single top-level directory, some don't.
  const entries = await fs.readdir(tmp, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !isAppleJunk(n));
  if (dirs.length === 1) {
    return path.join(tmp, dirs[0]);
  }
  return tmp;
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

async function writeAbiReleaseIndex(chainId, abiIndex, contractNames) {
  const chainDirName = `chain-${chainId}`;
  const chainDir = path.join(OUT_ABIS, chainDirName);
  await ensureDir(chainDir);

  // Write chain-level index.ts
  const imports = [`import abiIndex from "./index.json";`, `export { abiIndex };`];
  for (const name of contractNames) {
    const varName = name.replace(/[^a-zA-Z0-9]/g, "_");
    imports.push(`import ${varName} from "./${name}.abi.json";`);
    imports.push(`export const ${varName}Abi = ${varName}.abi;`);
  }
  const content = `// AUTO-GENERATED by pnpm ssot:sync. DO NOT EDIT.\n${imports.join("\n")}\n`;
  await fs.writeFile(path.join(chainDir, "index.ts"), content, "utf8");

  // Root release/index.ts is generated separately by scanning all chains.

  // keep abiIndex json for audit
  await fs.writeFile(
    path.join(chainDir, "index.json"),
    `${JSON.stringify(abiIndex, null, 2)}\n`,
    "utf8"
  );
}

async function writeAbiRootIndex() {
  const rootIndexPath = path.join(OUT_ABIS, "index.ts");
  if (!(await pathExists(OUT_ABIS))) {
    await fs.writeFile(
      rootIndexPath,
      `// AUTO-GENERATED by pnpm ssot:sync. DO NOT EDIT.\n`,
      "utf8"
    );
    return;
  }
  const dirs = (await fs.readdir(OUT_ABIS, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name.startsWith("chain-"))
    .map((e) => e.name)
    .sort();
  const lines = [`// AUTO-GENERATED by pnpm ssot:sync. DO NOT EDIT.`];
  for (const d of dirs) {
    const id = Number(d.replace(/^chain-/, ""));
    if (!Number.isFinite(id)) continue;
    lines.push(`export * as chain_${id} from "./${d}/index";`);
  }
  lines.push("");
  await fs.writeFile(rootIndexPath, lines.join("\n"), "utf8");
}

async function main() {
  let bundleRoot = FROM_INPUT;
  let cleanupTmp = null;

  if (isTar(bundleRoot)) {
    console.log("\n[ssot:sync] extracting tar:", bundleRoot);
    bundleRoot = await extractTarToTemp(bundleRoot);
    cleanupTmp = bundleRoot;
  }

  console.log("\n[ssot:sync] bundle root:", bundleRoot);

  const deploymentsDir = path.join(bundleRoot, "deployments");
  const abisDir = path.join(bundleRoot, "abis");

  const manifestPath = await firstExistingPath(deploymentsDir, [
    "frontend-manifest-latest-v15.json"
  ]);
  const vectorsPath = await firstExistingPath(deploymentsDir, ["golden-vectors-latest-v15.json"]);
  const releaseLockPath = await firstExistingPath(deploymentsDir, ["release-latest-v15.json"]);
  const latestSnapshotPath = await firstExistingPath(deploymentsDir, ["latest-v15.json"]);
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
      console.error("\n[ssot:sync] missing required path:", p);
      console.error(
        "This command expects a FINAL SHAPE release bundle containing deployments/ and abis/.\n"
      );
      process.exit(1);
    }
  }

  const manifest = await readJson(manifestPath);
  const vectors = await readJson(vectorsPath);
  const releaseLock = await readJson(releaseLockPath);
  const latestSnapshot = await readJson(latestSnapshotPath);
  const abiIndex = await readJson(abiIndexPath);

  // Verify the supplied bundle before changing embedded addresses or deleting a fixture directory.
  if (
    manifest.architectureVersion !== "v1.5-safe-governance" ||
    latestSnapshot.architectureVersion !== "v1.5-safe-governance" ||
    releaseLock.schema !== "SSOT_RELEASE_DIGEST_V15"
  ) {
    throw new Error("Only a v1.5 release bundle can become the active deployment.");
  }
  for (const item of [vectors, releaseLock, latestSnapshot, abiIndex]) {
    if (item.chainId !== manifest.chainId || item.blockNumber !== manifest.blockNumber) {
      throw new Error("Mixed chain or deployment block in release bundle.");
    }
  }
  if (!process.env.RELEASE_SIGNER || !process.env.RPC_URL) {
    throw new Error(
      "Set the trusted RELEASE_SIGNER and chain-specific RPC_URL before importing v1.5."
    );
  }
  const repoRoot = path.resolve(ROOT, "..");
  const verificationDir = await fs.mkdtemp(path.join(repoRoot, "deployments", ".verify-v15-"));
  await fs.copyFile(latestSnapshotPath, path.join(verificationDir, "snapshot.json"));
  await fs.copyFile(releaseLockPath, path.join(verificationDir, "release.json"));
  const verificationEnv = {
    ...process.env,
    SNAPSHOT_PATH: path.join(verificationDir, "snapshot.json"),
    RELEASE_PATH: path.join(verificationDir, "release.json")
  };
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
        path.join(deploymentsDir, "release-notes-latest-v15.md"),
        "--manifest",
        manifestPath,
        "--vectors",
        vectorsPath,
        "--schema",
        "2",
        "--tag-suffix=-v15",
        "--abis-index",
        abiIndexPath
      ],
      { cwd: repoRoot, env: verificationEnv }
    );
    await execFileAsync(
      "forge",
      ["script", "script/release/VerifyReleaseV15.s.sol:VerifyReleaseV15"],
      { cwd: repoRoot, env: verificationEnv }
    );
    await execFileAsync(
      "forge",
      [
        "script",
        "script/release/VerifyGovernanceV15.s.sol:VerifyGovernanceV15",
        "--rpc-url",
        process.env.RPC_URL
      ],
      { cwd: repoRoot, env: verificationEnv }
    );
  } catch {
    throw new Error(
      "v1.5 bundle or live governance verification failed; active release was not changed."
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

  const fixtureDir = path.join(
    OUT_FIXT,
    `chain-${chainId}`,
    `${blockNumber}-${shortDigest(digest)}`
  );
  await fs.rm(fixtureDir, { recursive: true, force: true });
  await ensureDir(fixtureDir);

  console.log(`[ssot:sync] chainId=${chainId} block=${blockNumber} digest=${digest}`);

  // Mirror raw inputs for audit
  await copyFile(manifestPath, path.join(fixtureDir, path.basename(manifestPath)));
  await copyFile(vectorsPath, path.join(fixtureDir, path.basename(vectorsPath)));
  await copyFile(releaseLockPath, path.join(fixtureDir, path.basename(releaseLockPath)));
  if (await pathExists(latestSnapshotPath)) {
    await copyFile(latestSnapshotPath, path.join(fixtureDir, path.basename(latestSnapshotPath)));
  }
  // Mirror ABI index + ABI files
  await copyFile(abiIndexPath, path.join(fixtureDir, "abi-index.json"));
  await copyDirFiltered(abisDir, path.join(fixtureDir, "abis"));

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
      refRegistry: normalizeAddress(addresses.refRegistry ?? addresses.referralRegistry),
      refEngine: normalizeAddress(addresses.refEngine ?? addresses.referralEngine),
      adapter: normalizeAddress(addresses.adapter ?? addresses.adapterChainlinkV2PlusWrapper)
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
      bundle: {
        manifestPath: path.posix.join("deployments", path.basename(manifestPath)),
        vectorsPath: path.posix.join("deployments", path.basename(vectorsPath)),
        releaseLockPath: path.posix.join("deployments", path.basename(releaseLockPath)),
        abiIndexPath: "abis/index.json"
      },
      releaseLock,
      abiIndex
    }
  };

  await ensureDir(OUT_EMBEDDED);
  const embeddedFile = `chain-${chainId}.json`;
  await fs.writeFile(
    path.join(OUT_EMBEDDED, embeddedFile),
    `${JSON.stringify(embedded, null, 2)}\n`,
    "utf8"
  );

  // Generate embedded/index.ts
  // Final-shape policy: only chain-<id>.json files are supported.
  // Remove any legacy placeholders to avoid drift.
  const allEmbedded = (await fs.readdir(OUT_EMBEDDED)).filter(
    (f) => f.endsWith(".json") && !isAppleJunk(f)
  );
  for (const f of allEmbedded) {
    if (!f.startsWith("chain-")) {
      await fs.rm(path.join(OUT_EMBEDDED, f), { force: true });
    }
  }
  const existing = (await fs.readdir(OUT_EMBEDDED)).filter(
    (f) => f.startsWith("chain-") && f.endsWith(".json") && !isAppleJunk(f)
  );
  existing.sort();
  await writeEmbeddedIndex(existing);

  // Copy ABI files into canonical location
  const chainAbiDir = path.join(OUT_ABIS, `chain-${chainId}`);
  await ensureDir(chainAbiDir);
  // Copy all .abi.json referenced by abiIndex
  const contractEntries = Array.isArray(abiIndex.contracts) ? abiIndex.contracts : [];
  const contractNames = [];
  for (const c of contractEntries) {
    const abiFile = c.abiFile;
    if (typeof abiFile !== "string" || !abiFile.endsWith(".abi.json")) continue;
    const src = path.join(abisDir, abiFile);
    if (!(await pathExists(src))) continue;
    await copyFile(src, path.join(chainAbiDir, abiFile));
    // name without suffix
    const base = abiFile.replace(/\.abi\.json$/i, "");
    if (!contractNames.includes(base)) contractNames.push(base);
  }
  contractNames.sort();
  // Write chain-level ABI index + TS exports
  await writeAbiReleaseIndex(chainId, abiIndex, contractNames);

  // Write root ABI index.ts by scanning all available chain-* directories.
  await writeAbiRootIndex();

  console.log("[ssot:sync] wrote embedded ->", path.join(OUT_EMBEDDED, embeddedFile));
  console.log("[ssot:sync] wrote abis ->", chainAbiDir);
  console.log("[ssot:sync] wrote fixtures ->", fixtureDir);
  console.log("[ssot:sync] done\n");

  // Note: cleanupTmp is a path inside os tmp; allow OS to clean up.
  void cleanupTmp;
}

main().catch((err) => {
  console.error("[ssot:sync] failed:", err);
  process.exit(1);
});
