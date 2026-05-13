// Single source of truth for commonly used network addresses in deploy/runbooks.
// Keep this file aligned with your frontend constants.

export const USDC = {
  BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  BASE_SEPOLIA: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  ARBITRUM_ONE: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  ARBITRUM_SEPOLIA: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
} as const;

// Chainlink VRF v2.5 Wrapper (direct funding) addresses.
// For SSOT cleanroom deploys, only WRAPPER is required by `script/DeployV13.s.sol`.
export const VRF_WRAPPER = {
  BASE: "0xb0407dbe851f8318bd31404A49e658143C982F23",
  BASE_SEPOLIA: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed",
  ARBITRUM_ONE: "0x14632CD5c12eC5875D41350B55e825c54406BaaB",
  ARBITRUM_SEPOLIA: "0x29576aB8152A09b9DC634804e4aDE73dA1f3a3CC",
} as const;

// Wrapped native token addresses (WETH on OP-stack chains, WETH on Arbitrum).
export const WRAPPED_NATIVE = {
  base: "0x4200000000000000000000000000000000000006",
  baseSepolia: "0x4200000000000000000000000000000000000006",
  arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  arbitrumSepolia: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
} as const;
