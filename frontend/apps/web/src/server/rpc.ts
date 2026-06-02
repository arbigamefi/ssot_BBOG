import { resolvePublicRpcUrl } from "../app-shell/rpc";

type ServerRpcEnv = Record<string, string | undefined>;

const SERVER_RPC_ENV_BY_CHAIN_ID: Record<number, string[]> = {
  // Ethereum mainnet is used only for ENS resolution in this app.
  1: ["MAINNET_RPC_URL", "ETHEREUM_RPC_URL", "NEXT_PUBLIC_MAINNET_RPC_URL"],
  42161: ["ARBITRUM_RPC_URL", "NEXT_PUBLIC_ARBITRUM_RPC_URL"],
  421614: ["ARBITRUM_SEPOLIA_RPC_URL", "NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL"],
  8453: ["BASE_MAINNET_RPC_URL", "NEXT_PUBLIC_BASE_RPC_URL", "BASE_RPC_URL"],
  84532: ["BASE_SEPOLIA_RPC_URL", "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"]
};

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstConfigured(env: ServerRpcEnv, names: readonly string[]) {
  for (const name of names) {
    const value = cleanEnvValue(env[name]);
    if (value) return value;
  }
  return undefined;
}

export type ResolveServerRpcOptions = {
  /**
   * Allow RPC_URL / NEXT_PUBLIC_RPC_URL to serve this chain. A generic URL can
   * only point to one network, so it is unsafe for multi-chain deployments and
   * remains opt-in for legacy single-chain scripts.
   */
  allowGenericFallback?: boolean;
};

export function resolveServerRpcUrl(
  chainId: number,
  env: ServerRpcEnv = process.env,
  options: ResolveServerRpcOptions = {}
) {
  return (
    firstConfigured(env, SERVER_RPC_ENV_BY_CHAIN_ID[chainId] ?? []) ??
    resolvePublicRpcUrl(chainId, env) ??
    (options.allowGenericFallback
      ? (cleanEnvValue(env.RPC_URL) ?? cleanEnvValue(env.NEXT_PUBLIC_RPC_URL))
      : undefined)
  );
}
