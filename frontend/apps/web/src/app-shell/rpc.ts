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

/** Public, keyless mainnet RPC used as a last-resort ENS resolver. */
export const FALLBACK_MAINNET_RPC_URL = "https://cloudflare-eth.com";

/** Mainnet RPC for ENS resolution: env → Alchemy → keyless public fallback. */
export function resolveMainnetEnsRpcUrl(env: PublicRpcEnv = process.env) {
  return resolvePublicRpcUrl(1, env) ?? FALLBACK_MAINNET_RPC_URL;
}

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolvePublicRpcUrl(chainId: number, env: PublicRpcEnv = process.env) {
  const chainSpecificKey = PUBLIC_RPC_ENV_BY_CHAIN_ID[chainId];
  const chainSpecific = cleanEnvValue(chainSpecificKey ? env[chainSpecificKey] : undefined);
  if (chainSpecific) return chainSpecific;

  const generic = cleanEnvValue(env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  const alchemyNetwork = ALCHEMY_NETWORK_BY_CHAIN_ID[chainId];
  const alchemyKey = cleanEnvValue(env.NEXT_PUBLIC_ALCHEMY_API_KEY);
  return alchemyNetwork && alchemyKey
    ? `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`
    : undefined;
}

export function withConfiguredRpc<TChain extends RpcChain>(
  chain: TChain,
  env?: PublicRpcEnv
): TChain {
  const rpcUrl = resolvePublicRpcUrl(chain.id, env);
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
