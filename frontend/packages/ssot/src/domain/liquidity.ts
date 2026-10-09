/** LiquidityVault protocol constants. Dependency-free so client bundles can import them without the SDK. */
/** Azuro percentage precision used by `withdrawDeposit`: 1e12 is 100%. */
export const NFT_WITHDRAWAL_ONE = 1_000_000_000_000n;
/** Wrapper bound on gross capital G = L + P (ADR-0034, numerical admission). */
export const MAX_TREE_CAPITAL = (1n << 108n) - 1n;
