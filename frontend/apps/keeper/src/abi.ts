import { getContractAbis } from "@ssot/ssot/abis";

const abis = getContractAbis();
export const GAME_HUB_KEEPER_ABI = abis.GameHubAbi;
export const VRF_HUB_KEEPER_ABI = abis.VRFHubAbi;
export const BANK_KEEPER_ABI = abis.BankAbi;

export const LIQUIDITY_VAULT_KEEPER_ABI = abis.LiquidityVaultAbi;
