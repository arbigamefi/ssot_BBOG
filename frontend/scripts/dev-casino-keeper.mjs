#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const FRONTEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const KEEPER_DEPLOY_ENV_DIR = path.join(FRONTEND_ROOT, "deploy/casino-keeper");
const DEFAULT_KEEPER_ENV_FILE = "primary.env";
const LEGACY_PUBLIC_HEALTH_PATH = path.join(
  FRONTEND_ROOT,
  "apps/web/public/ops/casino-keeper-health.json"
);
const DEFAULT_DEV_REWIND_BLOCKS = 2_000n;
const DEFAULT_LOCAL_BET_INDEX_DATABASE_URL =
  "postgres://arbigamefi:arbigamefi_dev_only@127.0.0.1:54329/arbigamefi";

function parseEnvFile(filePath, target) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keeper env file not found: ${filePath}`);
  }
  const parsed = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const unquoted = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
    parsed[key] = unquoted.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
      return parsed[name] ?? target[name] ?? "";
    });
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] === undefined) target[key] = value;
  }
}

function resolveRepoPath(value) {
  if (value.startsWith("~/")) {
    return path.join(process.env.HOME ?? "", value.slice(2));
  }
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function resolveKeeperDeployEnvFile() {
  const requested = process.env.KEEPER_ENV_FILE?.trim() || DEFAULT_KEEPER_ENV_FILE;
  const resolved = path.isAbsolute(requested)
    ? requested
    : path.resolve(KEEPER_DEPLOY_ENV_DIR, requested);
  const relative = path.relative(KEEPER_DEPLOY_ENV_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `KEEPER_ENV_FILE must resolve inside frontend/deploy/casino-keeper: ${requested}`
    );
  }
  return resolved;
}

function displayKeeperEnvFile(filePath) {
  return path.relative(FRONTEND_ROOT, filePath) || filePath;
}

function readReleaseBlock(releasePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(releasePath, "utf8"));
    const blockNumber = raw?.meta?.blockNumber ?? raw?.meta?.releaseLock?.blockNumber;
    return blockNumber == null ? undefined : BigInt(blockNumber);
  } catch {
    return undefined;
  }
}

function parseRewindBlocks(env) {
  const raw = env.KEEPER_DEV_REWIND_BLOCKS?.trim();
  if (!raw) return DEFAULT_DEV_REWIND_BLOCKS;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : DEFAULT_DEV_REWIND_BLOCKS;
  } catch {
    return DEFAULT_DEV_REWIND_BLOCKS;
  }
}

async function fetchLatestBlock(rpcUrl) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
  });
  if (!response.ok) throw new Error(`eth_blockNumber failed with HTTP ${response.status}`);
  const body = await response.json();
  if (typeof body.result !== "string") throw new Error("eth_blockNumber returned no block");
  return BigInt(body.result);
}

function canConnectTcp({ host, port, timeoutMs = 250 }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

async function applyLocalBetIndexDefaults(env) {
  if (!env.BET_INDEX_DATABASE_URL?.trim()) {
    const localPostgresReady = await canConnectTcp({ host: "127.0.0.1", port: 54329 });
    if (!localPostgresReady) {
      console.error(
        "[casino-keeper-dev] local bet-index Postgres is not reachable; run `pnpm bet-index:db:up` to enable durable bet feeds."
      );
      return;
    }
    env.BET_INDEX_DATABASE_URL = DEFAULT_LOCAL_BET_INDEX_DATABASE_URL;
    console.error("[casino-keeper-dev] using local bet-index Postgres on 127.0.0.1:54329");
  }

  env.BET_INDEX_SSL ??= "false";
  env.BET_INDEX_READ_ENABLED ??= "true";
  env.BET_INDEX_WRITE_ENABLED ??= "true";
}

async function applyDevStartBlock(env) {
  if (env.KEEPER_START_BLOCK?.trim()) return;
  if (!env.KEEPER_RPC_HTTP?.trim()) return;

  try {
    const latest = await fetchLatestBlock(env.KEEPER_RPC_HTTP);
    const releaseBlock = readReleaseBlock(env.KEEPER_RELEASE_PATH) ?? 0n;
    const rewindBlocks = parseRewindBlocks(env);
    const rewindStart = latest > rewindBlocks ? latest - rewindBlocks : 0n;
    const startBlock = rewindStart > releaseBlock ? rewindStart : releaseBlock;
    env.KEEPER_START_BLOCK = startBlock.toString();
    console.error(
      `[casino-keeper-dev] KEEPER_START_BLOCK=${env.KEEPER_START_BLOCK} (latest=${latest}, rewind=${rewindBlocks})`
    );
  } catch (error) {
    console.error(
      `[casino-keeper-dev] could not derive recent KEEPER_START_BLOCK; falling back to release block: ${
        error?.message ?? String(error)
      }`
    );
  }
}

function cleanupLegacyPublicHealthFile() {
  try {
    fs.rmSync(LEGACY_PUBLIC_HEALTH_PATH, { force: true });
  } catch {
    // Best effort only: a stale public health file makes Next.js route resolution fail.
  }

  try {
    fs.rmdirSync(path.dirname(LEGACY_PUBLIC_HEALTH_PATH));
  } catch {
    // Directory may be absent or contain unrelated files.
  }
}

async function keeperEnv() {
  const env = { ...process.env };
  const keeperEnvFile = resolveKeeperDeployEnvFile();
  parseEnvFile(keeperEnvFile, env);

  if (env.KEEPER_RELEASE_PATH?.trim()) {
    env.KEEPER_RELEASE_PATH = resolveRepoPath(env.KEEPER_RELEASE_PATH);
  }
  env.KEEPER_POLL_INTERVAL_SECONDS ??= "5";
  env.KEEPER_SCAN_CHUNK_BLOCKS ??= "10";
  env.KEEPER_HEALTH_PATH ??= path.join(FRONTEND_ROOT, ".runtime/casino-keeper-health.json");
  env.KEEPER_HEALTH_PATH = resolveRepoPath(env.KEEPER_HEALTH_PATH);
  await applyLocalBetIndexDefaults(env);
  await applyDevStartBlock(env);
  env.KEEPER_ENV_FILE = displayKeeperEnvFile(keeperEnvFile);

  return env;
}

function requireKeeperEnv(env) {
  const missing = ["KEEPER_RPC_HTTP", "KEEPER_PRIVATE_KEY", "KEEPER_RELEASE_PATH"].filter(
    (key) => !env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing keeper env: ${missing.join(", ")}. Check frontend/deploy/casino-keeper/${DEFAULT_KEEPER_ENV_FILE} or set KEEPER_ENV_FILE to another file in that directory.`
    );
  }
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: FRONTEND_ROOT,
    env: options.env ?? process.env,
    stdio: "inherit"
  });
  return child;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${child.spawnargs.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

function stop(child) {
  if (!child.killed) child.kill("SIGTERM");
}

async function main() {
  cleanupLegacyPublicHealthFile();
  const args = process.argv.slice(2);
  const withWeb = args.includes("--with-web");
  const webArgs = args.filter((arg) => arg !== "--with-web" && arg !== "--");
  const env = await keeperEnv();
  requireKeeperEnv(env);

  await waitForExit(run("pnpm", ["-C", "apps/keeper", "build"], { env }));

  const children = [run("pnpm", ["-C", "apps/keeper", "start"], { env })];
  if (withWeb) children.push(run("pnpm", ["-C", "apps/web", "dev", ...webArgs], { env }));

  const shutdown = () => {
    for (const child of children) stop(child);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await Promise.race(children.map(waitForExit)).finally(shutdown);
}

main().catch((error) => {
  console.error(`[casino-keeper-dev] ${error?.message ?? String(error)}`);
  process.exit(1);
});
