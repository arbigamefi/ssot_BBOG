#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

function parseEnvFile(filePath, target) {
  if (!fs.existsSync(filePath)) return;
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

function alchemyRpc(env) {
  const key = env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim();
  return key ? `https://base-sepolia.g.alchemy.com/v2/${key}` : undefined;
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
}

function backfillEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) parseEnvFile(path.join(REPO_ROOT, file), env);

  env.KEEPER_CHAIN_ID ??= "84532";
  env.KEEPER_RELEASE_PATH ??= path.join(
    FRONTEND_ROOT,
    "packages/ssot/src/release/embedded/chain-84532.json"
  );
  env.KEEPER_RELEASE_PATH = resolveRepoPath(env.KEEPER_RELEASE_PATH);
  env.KEEPER_RPC_HTTP ??=
    env.RPC_URL ??
    env.BASE_SEPOLIA_RPC_URL ??
    env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    env.NEXT_PUBLIC_RPC_URL ??
    alchemyRpc(env);
  env.BET_INDEX_SCAN_CHUNK_BLOCKS ??= env.KEEPER_SCAN_CHUNK_BLOCKS ?? "10";
  env.BET_INDEX_CONFIRMATIONS ??= "2";

  return env;
}

function requireBackfillEnv(env) {
  const missing = ["KEEPER_RPC_HTTP", "KEEPER_RELEASE_PATH"].filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing bet index backfill env: ${missing.join(", ")}. Check root .env.`);
  }
  if (!truthy(env.BET_INDEX_DRY_RUN) && !env.BET_INDEX_DATABASE_URL?.trim()) {
    throw new Error(
      "Missing BET_INDEX_DATABASE_URL. Set BET_INDEX_DRY_RUN=true for a no-write scan."
    );
  }
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: FRONTEND_ROOT,
    env: options.env ?? process.env,
    stdio: "inherit"
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${child.spawnargs.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

async function main() {
  const env = backfillEnv();
  requireBackfillEnv(env);
  await run("pnpm", ["-C", "apps/keeper", "backfill"], { env });
}

main().catch((error) => {
  console.error(`[bet-index-backfill] ${error?.message ?? String(error)}`);
  process.exit(1);
});
