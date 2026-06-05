import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { buildSecurityHeaders } from "./src/server/security-headers.mjs";

const isDev = process.env.NODE_ENV === "development";
const isLowMemoryBuild = process.env.LOW_MEMORY_BUILD === "1";
const skipBuildValidation = process.env.NEXT_SKIP_BUILD_VALIDATION === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@ssot/ui", "@ssot/ssot"],
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  eslint: {
    ignoreDuringBuilds: skipBuildValidation
  },
  typescript: {
    ignoreBuildErrors: skipBuildValidation
  },

  experimental: isLowMemoryBuild
    ? {}
    : {
        // Per-import tree-shaking for large barrel packages — Next rewrites
        // `import { X } from "pkg"` into deep imports so unused exports don't
        // ship. Pure bundle hygiene, no behavioural change.
        optimizePackageImports: [
          "@heroicons/react/24/outline",
          "@heroicons/react/24/solid",
          "@ssot/ui",
          "framer-motion",
          "wagmi",
          "viem",
          "@rainbow-me/rainbowkit"
        ]
      },

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
