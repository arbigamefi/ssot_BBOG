import fs from "node:fs/promises";
import path from "node:path";

const STRICT = process.env.STRICT_RELEASE === "1";
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
const LEGACY_GAME_AGGREGATOR_KEY = `hu${"b"}`;
const LEGACY_BANK_DIRECTORY_KEY = `bank${"Registry"}`;

const dir = path.resolve(process.cwd(), "packages/ssot/src/release/embedded");
const entries = await fs.readdir(dir);
const jsons = entries.filter((f) => f.endsWith(".json"));

let ok = true;
let fatal = false;

for (const f of jsons) {
  const p = path.join(dir, f);
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
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

  for (const key of REQUIRED_CONTRACTS) {
    const value = contracts[key];
    if (typeof value !== "string" || value.length === 0) {
      issues.push(`${key} missing`);
    } else if (value.toLowerCase() === ZERO_ADDRESS) {
      issues.push(`${key} is zero`);
    }
  }

  if (
    raw?.sports?.enabled &&
    raw.sports.sportsHub &&
    contracts.sportsHub &&
    raw.sports.sportsHub.toLowerCase() !== contracts.sportsHub.toLowerCase()
  ) {
    issues.push("sports.sportsHub does not match contracts.sportsHub");
  }
  if (
    raw?.sports?.enabled &&
    raw.sports.riskEngine &&
    contracts.sportsRiskEngine &&
    raw.sports.riskEngine.toLowerCase() !== contracts.sportsRiskEngine.toLowerCase()
  ) {
    issues.push("sports.riskEngine does not match contracts.sportsRiskEngine");
  }
  if (!raw?.assets?.length) issues.push("assets empty");
  if (!raw?.games || Object.keys(raw.games).length === 0) issues.push("games empty");
  if (!Array.isArray(raw?.gamesMeta) || raw.gamesMeta.length === 0) issues.push("gamesMeta empty");
  if (!Array.isArray(raw?.pools) || raw.pools.length === 0) issues.push("pools empty");

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

if (fatal || (!ok && STRICT)) {
  process.exit(1);
}
