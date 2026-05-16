#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const appRoot = path.resolve(root, "apps/web");
const buildRoot = path.resolve(appRoot, ".next");
const manifestPath = path.resolve(buildRoot, "app-build-manifest.json");

const budgets = [
  { route: "/(marketing)/page", publicPath: "/", maxKb: 155 },
  { route: "/(product)/casino/page", publicPath: "/casino", maxKb: 170 },
  { route: "/(product)/casino/[slug]/page", publicPath: "/casino/[slug]", maxKb: 195 },
  { route: "/(product)/earn/page", publicPath: "/earn", maxKb: 175 },
  { route: "/(product)/ops/page", publicPath: "/ops", maxKb: 145 },
  { route: "/(product)/portfolio/page", publicPath: "/portfolio", maxKb: 175 },
  {
    route: "/(product)/portfolio/activity/page",
    publicPath: "/portfolio/activity",
    maxKb: 150
  },
  { route: "/(product)/portfolio/claims/page", publicPath: "/portfolio/claims", maxKb: 170 },
  { route: "/(product)/sportsbook/page", publicPath: "/sportsbook", maxKb: 175 },
  {
    route: "/(product)/sportsbook/[marketId]/page",
    publicPath: "/sportsbook/[marketId]",
    maxKb: 175
  },
  { route: "/(legal)/legal/privacy/page", publicPath: "/legal/privacy", maxKb: 130 }
];

if (!fs.existsSync(manifestPath)) {
  console.error(
    `[bundle-budget] missing ${path.relative(process.cwd(), manifestPath)}; run pnpm -C frontend/apps/web build first`
  );
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const pages = manifest.pages ?? {};
let failed = false;

console.log(`[bundle-budget] manifest=${path.relative(process.cwd(), manifestPath)}`);

for (const budget of budgets) {
  const files = pages[budget.route];
  if (!Array.isArray(files)) {
    console.error(`[bundle-budget] missing route ${budget.route} (${budget.publicPath})`);
    failed = true;
    continue;
  }

  const gzipBytes = gzipTotal(files.filter((file) => file.endsWith(".js")));
  const gzipKb = gzipBytes / 1024;
  const status = gzipKb <= budget.maxKb ? "ok" : "fail";
  const margin = budget.maxKb - gzipKb;

  console.log(
    `[bundle-budget] ${status} ${budget.publicPath}: ${gzipKb.toFixed(1)} kB <= ${budget.maxKb} kB (${margin.toFixed(1)} kB margin)`
  );

  if (gzipKb > budget.maxKb) {
    failed = true;
  }
}

if (failed) {
  console.error("[bundle-budget] FAILED");
  process.exit(1);
}

console.log("[bundle-budget] OK");

function gzipTotal(files) {
  let total = 0;
  const seen = new Set(files);

  for (const file of seen) {
    const fullPath = path.resolve(buildRoot, file);
    if (!fullPath.startsWith(buildRoot + path.sep) || !fs.existsSync(fullPath)) {
      throw new Error(`[bundle-budget] missing chunk ${file}`);
    }
    total += zlib.gzipSync(fs.readFileSync(fullPath)).length;
  }

  return total;
}
