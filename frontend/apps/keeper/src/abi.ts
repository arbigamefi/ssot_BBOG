import { getContractAbis } from "@ssot/ssot/abis";

const abis = getContractAbis();
export const GAME_HUB_KEEPER_ABI = abis.GameHubAbi;
export const VRF_HUB_KEEPER_ABI = abis.VRFHubAbi;
export const BANK_KEEPER_ABI = abis.BankAbi;
export const POOL_REGISTRY_KEEPER_ABI = abis.PoolRegistryAbi;
export const GOVERNANCE_TIMELOCK_KEEPER_ABI = abis.GovernanceTimelockAbi;

export const LIQUIDITY_VAULT_KEEPER_ABI = abis.LiquidityVaultAbi;
