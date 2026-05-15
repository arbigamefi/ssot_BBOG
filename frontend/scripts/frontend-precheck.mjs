#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
const strict = args.has("--strict");
const report = args.has("--report") || !strict;
const maxExamples = Number(process.env.FRONTEND_PRECHECK_MAX_EXAMPLES ?? 20);

const sourceRoots = [resolve(root, "apps/web/src"), resolve(root, "packages/ui/src")];

const checks = [
  checkTargetStructure(),
  checkForbiddenStyles(),
  checkLegacyShellNames(),
  checkPrototypeRoutes(),
  checkPageClientSize(),
  checkForbiddenWeb3Imports()
];

console.log(
  `[frontend-precheck] mode=${strict ? "strict" : "report"} root=${relative(process.cwd(), root) || "."}`
);

for (const check of checks) {
  printCheck(check);
}

const failures = checks.filter((check) => check.blocking && check.count > 0);

if (strict && failures.length > 0) {
  console.error(
    `[frontend-precheck] strict mode failed: ${failures
      .map((check) => `${check.id}=${check.count}`)
      .join(", ")}`
  );
  process.exit(1);
}

if (report) {
  console.log("[frontend-precheck] report complete");
}

function checkTargetStructure() {
  const required = [
    "packages/ui/src/tokens",
    "packages/ui/src/primitives",
    "packages/ui/src/patterns",
    "packages/ui/src/motion",
    "packages/ui/src/icons",
    "packages/ui/src/utils"
  ];
  const missing = required
    .map((path) => resolve(root, path))
    .filter((path) => !existsSync(path))
    .map(formatPath);

  return {
    id: "target-structure",
    label: "Target UI package structure",
    count: missing.length,
    blocking: true,
    examples: missing
  };
}

function checkForbiddenStyles() {
  const pattern =
    /bg-\[#|text-\[#|border-\[#|shadow-\[|rounded-(?:2xl|3xl|\[)|transition-all|\bdark:/;
  return scanLines({
    id: "forbidden-style",
    label: "Forbidden style utilities",
    roots: sourceRoots,
    pattern,
    blocking: true
  });
}

function checkLegacyShellNames() {
  const pattern =
    /SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher|RoomHud|LowerRoomTabs|HeroProofRibbon|TrustStatsStrip|TrustTableShell/;
  return scanLines({
    id: "legacy-shell",
    label: "Legacy shell names",
    roots: sourceRoots,
    pattern,
    blocking: true
  });
}

function checkPrototypeRoutes() {
  const prototypeRoute = resolve(root, "apps/web/src/app/prototype");
  const examples = existsSync(prototypeRoute) ? [formatPath(prototypeRoute)] : [];
  return {
    id: "prototype-route",
    label: "Prototype routes in production App Router",
    count: examples.length,
    blocking: true,
    examples
  };
}

function checkPageClientSize() {
  const maxLines = 600;
  const examples = filesUnder(resolve(root, "apps/web/src/app"))
    .filter((file) => file.endsWith("pageClient.tsx"))
    .map((file) => ({
      file,
      lines: readFileSync(file, "utf8").split("\n").length
    }))
    .filter((entry) => entry.lines > maxLines)
    .map((entry) => `${formatPath(entry.file)}:${entry.lines}`);

  return {
    id: "page-client-size",
    label: "pageClient.tsx files over 600 lines",
    count: examples.length,
    blocking: true,
    examples
  };
}

function checkForbiddenWeb3Imports() {
  const pattern =
    /(?:from\s+["'](?:wagmi|viem|@rainbow[^"']*)["'])|(?:import\s+["'](?:wagmi|viem|@rainbow[^"']*)["'])/;
  return scanLines({
    id: "web3-import-boundary",
    label: "Direct wagmi/viem/RainbowKit imports outside provider islands",
    extensions: /\.(ts|tsx)$/,
    exclude: (file) =>
      formatPath(file).startsWith("apps/web/src/app-shell/") ||
      formatPath(file).startsWith("apps/web/src/workers/"),
    roots: [resolve(root, "apps/web/src")],
    pattern,
    blocking: true
  });
}

function scanLines({
  id,
  label,
  roots,
  pattern,
  blocking,
  extensions = /\.(css|mjs|ts|tsx)$/,
  exclude = () => false
}) {
  const examples = [];
  let count = 0;

  for (const file of roots.flatMap(filesUnder)) {
    if (!extensions.test(file) || exclude(file)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      if (!pattern.test(line)) {
        continue;
      }

      count += 1;
      if (examples.length < maxExamples) {
        examples.push(`${formatPath(file)}:${index + 1}:${line.trim()}`);
      }
    }
  }

  return { id, label, count, blocking, examples };
}

function filesUnder(path) {
  if (!existsSync(path)) {
    return [];
  }

  const stats = statSync(path);
  if (stats.isFile()) {
    return [path];
  }

  return readdirSync(path)
    .filter((name) => !name.startsWith("."))
    .flatMap((name) => filesUnder(resolve(path, name)));
}

function printCheck(check) {
  const status = check.count === 0 ? "ok" : check.blocking && strict ? "fail" : "warn";
  console.log(`[frontend-precheck] ${status} ${check.id}: ${check.count} ${check.label}`);

  for (const example of check.examples.slice(0, maxExamples)) {
    console.log(`  - ${example}`);
  }

  if (check.count > check.examples.length) {
    console.log(`  ... ${check.count - check.examples.length} more`);
  }
}

function formatPath(path) {
  return relative(root, path);
}
