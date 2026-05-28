type PublicRpcEnv = Record<string, string | undefined>;

type RpcChain = {
  id: number;
  rpcUrls: {
    default: { http: readonly string[] };
    [key: string]: { http: readonly string[] };
  };
};

const ALCHEMY_NETWORK_BY_CHAIN_ID: Record<number, string> = {
  1: "eth-mainnet",
  42161: "arb-mainnet",
  421614: "arb-sepolia",
  8453: "base-mainnet",
  84532: "base-sepolia"
};

const PUBLIC_RPC_ENV_BY_CHAIN_ID: Record<number, string> = {
  // Ethereum mainnet is used ONLY for ENS reverse resolution — never for
  // transactions. It is not a selectable app chain.
  1: "NEXT_PUBLIC_MAINNET_RPC_URL",
  42161: "NEXT_PUBLIC_ARBITRUM_RPC_URL",
  421614: "NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL",
  8453: "NEXT_PUBLIC_BASE_RPC_URL",
  84532: "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"
};

const DEFAULT_PUBLIC_RPC_ENV: PublicRpcEnv = {
  NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  NEXT_PUBLIC_ARBITRUM_RPC_URL: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
  NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  NEXT_PUBLIC_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL
};

/** Public, keyless mainnet RPC used as a last-resort ENS resolver. */
export const FALLBACK_MAINNET_RPC_URL = "https://cloudflare-eth.com";

/** Mainnet RPC for ENS resolution: env → Alchemy → keyless public fallback. */
export function resolveMainnetEnsRpcUrl(env: PublicRpcEnv = DEFAULT_PUBLIC_RPC_ENV) {
  return resolvePublicRpcUrl(1, env) ?? FALLBACK_MAINNET_RPC_URL;
}

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type ResolveRpcOptions = {
  /**
   * Allow the generic `NEXT_PUBLIC_RPC_URL` to back this chain. A single shared
   * URL physically points to ONE network, so it is only safe when the
   * deployment serves a single chain. Multi-chain deployments MUST leave this
   * off and rely on per-chain URLs or the Alchemy key (both correct per
   * network). Defaults to off so the generic fallback is opt-in.
   */
  allowGenericFallback?: boolean;
};

export function resolvePublicRpcUrl(
  chainId: number,
  env: PublicRpcEnv = DEFAULT_PUBLIC_RPC_ENV,
  options: ResolveRpcOptions = {}
) {
  const chainSpecificKey = PUBLIC_RPC_ENV_BY_CHAIN_ID[chainId];
  const chainSpecific = cleanEnvValue(chainSpecificKey ? env[chainSpecificKey] : undefined);
  if (chainSpecific) return chainSpecific;

  // Per-network provider key — always resolves to the correct endpoint for
  // each chain, so it takes precedence over the single shared URL.
  const alchemyNetwork = ALCHEMY_NETWORK_BY_CHAIN_ID[chainId];
  const alchemyKey = cleanEnvValue(env.NEXT_PUBLIC_ALCHEMY_API_KEY);
  if (alchemyNetwork && alchemyKey) {
    return `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // Generic single-URL fallback — single-chain deployments only.
  if (options.allowGenericFallback) {
    const generic = cleanEnvValue(env.NEXT_PUBLIC_RPC_URL);
    if (generic) return generic;
  }

  return undefined;
}

export function withConfiguredRpc<TChain extends RpcChain>(
  chain: TChain,
  env: PublicRpcEnv = DEFAULT_PUBLIC_RPC_ENV,
  options: ResolveRpcOptions = {}
): TChain {
  const rpcUrl = resolvePublicRpcUrl(chain.id, env, options);
  if (!rpcUrl) return chain;

  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { ...chain.rpcUrls.default, http: [rpcUrl] },
      public: { ...chain.rpcUrls.default, http: [rpcUrl] }
    }
  };
}
