import { getContractAbis } from "@ssot/ssot/abis";

const abis = getContractAbis();
export const GAME_HUB_KEEPER_ABI = abis.GameHubAbi;
export const VRF_HUB_KEEPER_ABI = abis.VRFHubAbi;
export const SPORTS_HUB_KEEPER_ABI = abis.SportsHubAbi;
export const BANK_REDEMPTION_KEEPER_ABI = abis.BankAbi;
