import fs from "node:fs/promises";
import path from "node:path";

const STRICT = process.env.STRICT_RELEASE === "1";

const dir = path.resolve(process.cwd(), "packages/ssot/src/release/embedded");
const entries = await fs.readdir(dir);
const jsons = entries.filter((f) => f.endsWith(".json"));

let ok = true;

for (const f of jsons) {
  const p = path.join(dir, f);
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
  const issues = [];
  if (raw.isPlaceholder) issues.push("isPlaceholder=true");
  const gameHub = raw?.contracts?.gameHub;
  if (raw?.meta?.schemaVersion !== 2) issues.push("schemaVersion is not 2");
  if (
    typeof gameHub === "string" &&
    gameHub.toLowerCase() === "0x0000000000000000000000000000000000000000"
  ) {
    issues.push("gameHub is zero");
  }
  if (!raw?.contracts?.poolRegistry) issues.push("poolRegistry missing");
  if (!raw?.assets?.length) issues.push("assets empty");
  if (!raw?.games || Object.keys(raw.games).length === 0) issues.push("games empty");
  if (!Array.isArray(raw?.gamesMeta) || raw.gamesMeta.length === 0) issues.push("gamesMeta empty");
  if (!Array.isArray(raw?.pools) || raw.pools.length === 0) issues.push("pools empty");

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

if (!ok && STRICT) {
  process.exit(1);
}
