/* global URL, process */

const ALCHEMY_NETWORKS = [
  "base-mainnet",
  "base-sepolia",
  "arb-mainnet",
  "arb-sepolia",
  "eth-mainnet"
];

// Only allow Alchemy when the build is configured to use it. With NEXT_PUBLIC_ALCHEMY_API_KEY the app builds
// Alchemy URLs itself (app-shell/rpc.ts), so there is no configured URL to derive the origin from.
function alchemyOrigins(env) {
  if (!env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim()) return [];
  return ALCHEMY_NETWORKS.flatMap((network) => [
    `https://${network}.g.alchemy.com`,
    `wss://${network}.g.alchemy.com`
  ]);
}

function configuredRpcOrigins(env) {
  return [
    env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
    env.NEXT_PUBLIC_ARBITRUM_WS_RPC_URL,
    env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
    env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_WS_RPC_URL,
    env.NEXT_PUBLIC_BASE_RPC_URL,
    env.NEXT_PUBLIC_BASE_WS_RPC_URL,
    env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    env.NEXT_PUBLIC_BASE_SEPOLIA_WS_RPC_URL,
    env.NEXT_PUBLIC_MAINNET_RPC_URL,
    env.NEXT_PUBLIC_MAINNET_WS_RPC_URL,
    env.NEXT_PUBLIC_RPC_URL
  ].flatMap((value) => {
    if (!value) return [];
    try {
      const url = new URL(value);
      // The app derives the WebSocket URL from an Alchemy HTTP URL, so allow both.
      if (url.protocol === "https:" && url.hostname.endsWith(".g.alchemy.com")) {
        return [url.origin, `wss://${url.host}`];
      }
      return [url.origin];
    } catch {
      return [];
    }
  });
}

export function buildContentSecurityPolicy({ env = process.env, isDev = false } = {}) {
  const scriptSrc = isDev
    ? ["script-src 'self' 'unsafe-eval' 'unsafe-inline' https://mcp.figma.com"]
    : ["script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"];
  const connectSrc = [
    ...new Set([
      "connect-src 'self'",
      ...(isDev ? ["https://mcp.figma.com"] : []),
      // Reown / Web3Modal fetches a small remote project configuration at app
      // bootstrap. WalletConnect websocket + relay hosts stay covered below.
      "https://api.web3modal.org",
      "https://*.walletconnect.com",
      "https://*.walletconnect.org",
      "wss://*.walletconnect.com",
      "wss://*.walletconnect.org",
      // RainbowKit uses MetaMask SDK (not WalletConnect) on mobile. Its
      // pairing channel needs HTTPS and a WebSocket before opening the app.
      "https://metamask-sdk.api.cx.metamask.io",
      "wss://metamask-sdk.api.cx.metamask.io",
      "https://sepolia.base.org",
      "https://mainnet.base.org",
      "https://arb1.arbitrum.io",
      // Ethereum mainnet — ENS reverse resolution only (keyless fallback).
      "https://cloudflare-eth.com",
      ...alchemyOrigins(env),
      ...configuredRpcOrigins(env),
      "https://*.sentry.io",
      "https://*.ingest.sentry.io",
      "https://cloudflareinsights.com",
      "https://static.cloudflareinsights.com"
    ])
  ].join(" ");

  return [
    "default-src 'self'",
    ...scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"])
  ].join("; ");
}

export function buildSecurityHeaders({ env = process.env, isDev = false } = {}) {
  return [
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
      value: buildContentSecurityPolicy({ env, isDev })
    }
  ];
}
