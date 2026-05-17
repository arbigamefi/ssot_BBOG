#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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

function keeperEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) parseEnvFile(path.join(REPO_ROOT, file), env);

  env.KEEPER_CHAIN_ID ??= "84532";
  env.KEEPER_RELEASE_PATH ??= path.join(
    FRONTEND_ROOT,
    "packages/ssot/src/release/embedded/chain-84532.json"
  );
  env.KEEPER_RPC_HTTP ??=
    env.RPC_URL ??
    env.BASE_SEPOLIA_RPC_URL ??
    env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    env.NEXT_PUBLIC_RPC_URL ??
    alchemyRpc(env);
  env.KEEPER_PRIVATE_KEY ??= env.PRIVATE_KEY;
  env.KEEPER_POLL_INTERVAL_SECONDS ??= "5";
  env.KEEPER_SCAN_CHUNK_BLOCKS ??= "10";
  env.KEEPER_HEALTH_PATH ??= path.join(
    FRONTEND_ROOT,
    "apps/web/public/ops/casino-keeper-health.json"
  );

  return env;
}

function requireKeeperEnv(env) {
  const missing = ["KEEPER_RPC_HTTP", "KEEPER_PRIVATE_KEY", "KEEPER_RELEASE_PATH"].filter(
    (key) => !env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(`Missing keeper env: ${missing.join(", ")}. Check root .env.`);
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
  const args = process.argv.slice(2);
  const withWeb = args.includes("--with-web");
  const webArgs = args.filter((arg) => arg !== "--with-web" && arg !== "--");
  const env = keeperEnv();
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
