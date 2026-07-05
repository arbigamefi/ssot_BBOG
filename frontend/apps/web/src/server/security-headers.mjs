/* global URL, process */

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
    env.NEXT_PUBLIC_MAINNET_WS_RPC_URL,
    env.NEXT_PUBLIC_RPC_URL
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
}

export function buildContentSecurityPolicy({ env = process.env, isDev = false } = {}) {
  const scriptSrc = isDev
    ? ["script-src 'self' 'unsafe-eval' 'unsafe-inline' https://mcp.figma.com"]
    : ["script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"];
  const connectSrc = [
    "connect-src 'self'",
    ...(isDev ? ["https://mcp.figma.com"] : []),
    // Reown / Web3Modal fetches a small remote project configuration at app
    // bootstrap. WalletConnect websocket + relay hosts stay covered below.
    "https://api.web3modal.org",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.com",
    "wss://*.walletconnect.org",
    "https://sepolia.base.org",
    "https://mainnet.base.org",
    "https://arb1.arbitrum.io",
    "https://base-sepolia.g.alchemy.com",
    "wss://base-sepolia.g.alchemy.com",
    "https://base-mainnet.g.alchemy.com",
    "wss://base-mainnet.g.alchemy.com",
    "https://arb-sepolia.g.alchemy.com",
    "wss://arb-sepolia.g.alchemy.com",
    "https://arb-mainnet.g.alchemy.com",
    "wss://arb-mainnet.g.alchemy.com",
    // Ethereum mainnet — ENS reverse resolution only (cloudflare keyless
    // fallback + Alchemy when NEXT_PUBLIC_ALCHEMY_API_KEY is set).
    "https://cloudflare-eth.com",
    "https://eth-mainnet.g.alchemy.com",
    "wss://eth-mainnet.g.alchemy.com",
    ...configuredRpcOrigins(env),
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://cloudflareinsights.com",
    "https://static.cloudflareinsights.com"
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
