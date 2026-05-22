import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import { buildSecurityHeaders } from "./src/server/security-headers.mjs";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../../..");
const initialEnvKeys = new Set(Object.keys(process.env));

for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(repoRoot, envFile);
  if (!fs.existsSync(envPath)) continue;
  const parsed = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const unquoted = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
    parsed[key] = unquoted.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
      return parsed[name] ?? process.env[name] ?? "";
    });
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (!initialEnvKeys.has(key)) process.env[key] = value;
  }
}

const isDev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ssot/ui", "@ssot/ssot"],
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: buildSecurityHeaders({ env: process.env, isDev })
      }
    ];
  }
};

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const sentryConfig = {
  // Suppress Sentry CLI logs in dev
  silent: !process.env.CI,
  // Upload source maps for readable stack traces
  widenClientFileUpload: true,
  // Hide source maps from users
  hideSourceMaps: true,
  // Tree-shake Sentry debug logging (replaces deprecated disableLogger)
  bundleSizeOptimizations: {
    excludeDebugStatements: true
  }
};

// Keep local and preview bundles lean when Sentry is not configured.
const configWithIntl = withNextIntl(nextConfig);
const config = sentryDsn
  ? (await import("@sentry/nextjs")).withSentryConfig(configWithIntl, sentryConfig)
  : configWithIntl;

export default config;
