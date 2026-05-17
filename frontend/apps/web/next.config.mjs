import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const configuredRpcOrigins = [
  process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  process.env.NEXT_PUBLIC_RPC_URL
]
  .map((value) => {
    if (!value) return undefined;
    try {
      return new URL(value).origin;
    } catch {
      return undefined;
    }
  })
  .filter(Boolean);

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
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires inline scripts for hydration + hot-reload in dev
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://mcp.figma.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // RPC endpoints + WalletConnect relay + Sentry
              [
                "connect-src 'self'",
                "https://mcp.figma.com",
                "https://*.walletconnect.com",
                "https://*.walletconnect.org",
                "wss://*.walletconnect.com",
                "wss://*.walletconnect.org",
                "https://sepolia.base.org",
                "https://mainnet.base.org",
                "https://arb1.arbitrum.io",
                "https://base-sepolia.g.alchemy.com",
                "https://base-mainnet.g.alchemy.com",
                "https://arb-sepolia.g.alchemy.com",
                "https://arb-mainnet.g.alchemy.com",
                ...configuredRpcOrigins,
                "https://*.sentry.io",
                "https://*.ingest.sentry.io"
              ].join(" "),
              "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org",
              "worker-src 'self' blob:"
            ].join("; ")
          }
        ]
      }
    ];
  }
};

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

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
const config = sentryDsn
  ? (await import("@sentry/nextjs")).withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;

export default config;
