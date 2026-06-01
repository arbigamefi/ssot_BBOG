import { isSupportedAppChain, resolveDefaultAppChainId } from "../app-shell/chain-registry";

export function parseRequestChainId(value?: string | null) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && isSupportedAppChain(parsed)) return parsed;
  return resolveDefaultAppChainId(process.env.NEXT_PUBLIC_CHAIN_ID);
}
