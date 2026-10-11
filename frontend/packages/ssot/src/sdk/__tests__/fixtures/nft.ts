import { vi } from "vitest";
import type { PublicClient, WalletClient } from "viem";
import { createSSOTSDK } from "../../create";
import type { SSOTRelease } from "../../../release/schema";
export const OWNER = "0x0000000000000000000000000000000000000011" as const;
export const BANK = "0x0000000000000000000000000000000000000022" as const;
export const ASSET = "0x0000000000000000000000000000000000000033" as const;
export const VAULT = "0x0000000000000000000000000000000000000044" as const;
export const OTHER = "0x0000000000000000000000000000000000000055" as const;
export const MODULE = "0x0000000000000000000000000000000000000066" as const;
const TIMELOCK = "0x0000000000000000000000000000000000000077" as const;
export const HASH = `0x${"a".repeat(64)}` as const;
export const GAME = `0x${"b".repeat(64)}` as const;
export const FIRST_ID = 1n << 40n;
export const ONE = 1_000_000_000_000n;
export const release = {
  chainId: 84532,
  releaseDigest: "nft-sdk-test",
  pools: [{ poolId: 1, asset: ASSET, bank: BANK, vault: VAULT, decimals: 6 }],
  contracts: {
    governanceTimelock: TIMELOCK,
    gameHub: BANK,
    vrfHub: BANK,
    refRegistry: BANK,
    settlementRouter: BANK,
    poolRegistry: BANK
  },
  games: { [GAME]: MODULE },
  gamesMeta: [{ gameId: GAME, module: MODULE, maxBetCount: 25, callbackGasLimit: 2_447_746 }]
} as unknown as SSOTRelease;

export function nftFixture(assertWalletContext?: () => void) {
  const state = {
    allowance: 0n,
    nftCount: 2n,
    status: 0,
    owner: OWNER as `0x${string}`,
    assets: 10n,
    maxPercent: ONE,
    maxAssets: 10n,
    hash: HASH as `0x${string}`,
    maxBetCount: 25,
    houseEdgeBps: 200,
    minBetAmount: 1n,
    unbooked: 0n,
    requiredReserve: 20n,
    gameDisabled: false,
    playerOpenHolds: 0n,
    poolActive: true,
    ssot: {
      L: 100n,
      P: 20n,
      R: 50n,
      K: 30n,
      G: 120n,
      bankCash: 29n,
      vaultCash: 100n,
      bankSurplus: 0n,
      vaultSurplus: 0n,
      PF: 4n,
      XP: 3n,
      PP: 2n,
      accountingValid: true,
      riskReserveBps: 1000n,
      riskReserve: 12n,
      riskFree: 58n,
      lpFreeCapital: 70n,
      withdrawalBufferBps: 500n,
      withdrawalBuffer: 6n,
      riskInPaused: false
    }
  };
  const pub = {
    getBlockNumber: vi.fn().mockResolvedValue(42n),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      hash: state.hash,
      timestamp: 100_000n
    })),
    getGasPrice: vi.fn().mockResolvedValue(3n),
    getLogs: vi.fn().mockResolvedValue([]),
    readContract: vi.fn(
      async ({
        address,
        functionName,
        args
      }: {
        address: string;
        functionName: string;
        args?: readonly unknown[];
        blockNumber?: bigint;
      }): Promise<unknown> => {
        switch (functionName) {
          case "vault":
            return VAULT;
          case "bank":
            return BANK;
          case "asset":
            return ASSET;
          case "getSSOT":
            return state.ssot;
          case "getPerformance":
            // held 9 = settled 6 + refunded 1 + voided 1 + open 1
            return [1n, 2n, 3n, 4n, 5n, 6n, 9n, 6n, 1n, 1n, 10n];
          case "lpAccounting":
            return [state.ssot.P, state.ssot.R, state.status];
          case "openHolds":
            return 1n;
          case "MAX_OPEN_HOLDS":
            return 128n;
          case "openHoldsOf":
            return state.playerOpenHolds;
          case "MAX_OPEN_HOLDS_PER_PLAYER":
            return 2n;
          case "minBetAmount":
            return state.minBetAmount;
          case "unbookedResultCount":
            return state.unbooked;
          case "isPoolActive":
            return state.poolActive;
          case "playerPayable":
            return 2n;
          case "allowance":
            return state.allowance;
          case "balanceOf":
            return address.toLowerCase() === VAULT.toLowerCase() ? state.nftCount : 1000n;
          case "tokenOfOwnerByIndex":
            return FIRST_ID + BigInt(args![1] as bigint);
          case "depositState":
            return {
              owner: state.owner,
              assets: state.assets,
              maxPercent: state.maxPercent,
              maxAssets: state.maxAssets,
              withdrawAfter: 86_400n,
              status: state.status
            };
          case "gameModule":
            return MODULE;
          case "gameMaxBetCount":
            return state.maxBetCount;
          case "defaultHouseEdgeBps":
            return state.houseEdgeBps;
          case "gameCallbackGasLimit":
            return 2_447_746;
          case "gameDisabled":
            return state.gameDisabled;
          case "quoteVRFFee":
            return [100n, 2_447_746];
          case "riskInPaused":
            return false;
          case "maxPayout":
            return state.requiredReserve;
          default:
            throw new Error(`Unexpected read ${functionName}`);
        }
      }
    ),
    simulateContract: vi.fn(async (request: Record<string, unknown>) => ({ request })),
    waitForTransactionReceipt: vi.fn(async () => {
      state.allowance = 1_000_000n;
      return { status: "success", blockNumber: 43n, logs: [] };
    })
  };
  const wallet = { writeContract: vi.fn().mockResolvedValue(HASH) };
  const sdk = createSSOTSDK({
    release,
    publicClient: pub as unknown as PublicClient,
    walletClient: wallet as unknown as WalletClient,
    account: OWNER,
    assertWalletContext
  });
  return { sdk, pub, wallet, state };
}
