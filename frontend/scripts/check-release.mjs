import fs from "node:fs/promises";
import path from "node:path";

const STRICT = process.env.STRICT_RELEASE === "1";
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
const LEGACY_GAME_AGGREGATOR_KEY = `hu${"b"}`;
const LEGACY_BANK_DIRECTORY_KEY = `bank${"Registry"}`;
const requiredChainIds = parseRequiredChainIds(process.env.REQUIRED_EMBEDDED_CHAIN_IDS);

const dir = path.resolve(process.cwd(), "packages/ssot/src/release/embedded");
const entries = await fs.readdir(dir);
const jsons = entries.filter((f) => f.endsWith(".json"));
const seenChainIds = new Set();

function isValidDecimals(value) {
  return Number.isInteger(value) && value >= 0 && value <= 36;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

let ok = true;
let fatal = false;

for (const f of jsons) {
  const p = path.join(dir, f);
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
  if (Number.isInteger(raw?.chainId)) seenChainIds.add(raw.chainId);
  const issues = [];
  const fatalIssues = [];
  const contracts = raw?.contracts ?? {};
  if (raw.isPlaceholder) issues.push("isPlaceholder=true");
  if (Object.hasOwn(contracts, LEGACY_GAME_AGGREGATOR_KEY)) {
    fatalIssues.push("legacy game aggregator key present");
  }
  if (Object.hasOwn(contracts, LEGACY_BANK_DIRECTORY_KEY)) {
    fatalIssues.push("legacy bank directory key present");
  }
  if (Object.hasOwn(raw?.sports ?? {}, LEGACY_GAME_AGGREGATOR_KEY)) {
    fatalIssues.push("legacy sports aggregator key present");
  }
  if (raw?.meta?.schemaVersion !== 2) issues.push("schemaVersion is not 2");

  for (const key of REQUIRED_CORE_CONTRACTS) {
    const value = contracts[key];
    if (typeof value !== "string" || value.length === 0) {
      issues.push(`${key} missing`);
    } else if (value.toLowerCase() === ZERO_ADDRESS) {
      issues.push(`${key} is zero`);
    }
  }

  if (raw?.sports?.enabled) {
    for (const key of REQUIRED_SPORTS_CONTRACTS) {
      const value = contracts[key];
      if (typeof value !== "string" || value.length === 0) {
        issues.push(`${key} missing`);
      } else if (value.toLowerCase() === ZERO_ADDRESS) {
        issues.push(`${key} is zero`);
      }
    }
    if (
      !isNonEmptyString(raw.sports.sportsHub) ||
      raw.sports.sportsHub.toLowerCase() === ZERO_ADDRESS
    ) {
      issues.push("sports.sportsHub missing");
    } else if (
      contracts.sportsHub &&
      raw.sports.sportsHub.toLowerCase() !== contracts.sportsHub.toLowerCase()
    ) {
      issues.push("sports.sportsHub does not match contracts.sportsHub");
    }
    if (
      !isNonEmptyString(raw.sports.riskEngine) ||
      raw.sports.riskEngine.toLowerCase() === ZERO_ADDRESS
    ) {
      issues.push("sports.riskEngine missing");
    } else if (
      contracts.sportsRiskEngine &&
      raw.sports.riskEngine.toLowerCase() !== contracts.sportsRiskEngine.toLowerCase()
    ) {
      issues.push("sports.riskEngine does not match contracts.sportsRiskEngine");
    }
  }
  if (!raw?.assets?.length) issues.push("assets empty");
  if (!raw?.games || Object.keys(raw.games).length === 0) issues.push("games empty");
  if (!Array.isArray(raw?.gamesMeta) || raw.gamesMeta.length === 0) issues.push("gamesMeta empty");
  if (!Array.isArray(raw?.pools) || raw.pools.length === 0) issues.push("pools empty");

  raw?.assets?.forEach?.((asset, index) => {
    if (!isNonEmptyString(asset?.symbol)) issues.push(`assets[${index}].symbol missing`);
    if (!isValidDecimals(asset?.decimals)) issues.push(`assets[${index}].decimals invalid`);
  });
  raw?.pools?.forEach?.((pool, index) => {
    if (!isNonEmptyString(pool?.symbol)) issues.push(`pools[${index}].symbol missing`);
    if (!isValidDecimals(pool?.decimals)) issues.push(`pools[${index}].decimals invalid`);
  });

  if (fatalIssues.length) {
    ok = false;
    fatal = true;
    console.error(`[release-check] ${f}: ${fatalIssues.join(", ")}`);
  }

  if (issues.length) {
    ok = false;
    const msg = `[release-check] ${f}: ${issues.join(", ")}`;
    if (STRICT) {
      console.error(msg);
    } else {
      console.log(msg);
    }
  }
}

for (const chainId of requiredChainIds) {
  if (!seenChainIds.has(chainId)) {
    ok = false;
    fatal = true;
    console.error(`[release-check] missing required embedded release chain-${chainId}.json`);
  }
}

if (fatal || (!ok && STRICT)) {
  process.exit(1);
}

function parseRequiredChainIds(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}
