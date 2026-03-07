import { withSentryConfig } from "@sentry/nextjs";

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
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires inline scripts for hydration + hot-reload in dev
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // RPC endpoints + WalletConnect relay + Sentry
              "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://sepolia.base.org https://mainnet.base.org https://arb1.arbitrum.io https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry only when DSN is configured (graceful no-op otherwise)
export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI logs in dev
  silent: !process.env.CI,
  // Upload source maps for readable stack traces
  widenClientFileUpload: true,
  // Hide source maps from users
  hideSourceMaps: true,
  // Tree-shake Sentry debug logging (replaces deprecated disableLogger)
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
