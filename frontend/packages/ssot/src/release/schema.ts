import { z } from "zod";

// NOTE: Addresses are stored as lowercase 0x-prefixed hex strings.
const Address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((s) => s.toLowerCase());

export const AssetSchema = z.object({
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(36),
  address: Address,
  bank: Address,
  vault: Address
});

// Every release pool is a casino pool (SSOTTypes.PoolDomain.Casino).
export const PoolSchema = z.object({
  poolId: z.number().int().positive(),
  domainId: z.literal(1),
  domain: z.literal("Casino"),
  active: z.boolean(),
  asset: Address,
  bank: Address,
  vault: Address,
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(36)
});

export const ReleaseSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1),
  releaseDigest: z.string().min(8),
  isPlaceholder: z.boolean().optional().default(false),
  refundTimeoutSeconds: z.number().int().positive().optional(),
  defaultHouseEdgeBps: z.number().int().min(0).max(10_000).optional(),
  contracts: z.object({
    gameHub: Address,
    settlementRouter: Address,
    poolRegistry: Address,
    vrfHub: Address,
    refRegistry: Address,
    refEngine: Address
  }),
  assets: z.array(AssetSchema).min(1),
  games: z.record(z.string(), Address), // gameId(hex) -> module address
  gamesMeta: z
    .array(
      z.object({
        gameId: z
          .string()
          .min(10)
          .transform((s) => s.toLowerCase()),
        slug: z.string().min(1),
        label: z.string().min(1),
        module: Address,
        maxBetCount: z.number().int().min(1).max(25),
        callbackGasLimit: z.number().int().min(200_000).max(2_447_746),
        paramsEncoding: z.string().optional()
      })
    )
    .min(1),
  pools: z.array(PoolSchema).min(1),
  // Current authenticated deployment identity; no inferred deployment or older LP architecture.
  meta: z.object({
    architectureVersion: z.literal("v1.6-nft-liquidity"),
    blockNumber: z.number().int().nonnegative(),
    schemaVersion: z.literal(2),
    generatedAt: z.number().int().optional(),
    // Only the current signed release schema is supported.
    releaseLock: z.object({ schema: z.literal("SSOT_RELEASE_DIGEST_V16") })
  })
});

export type SSOTRelease = z.infer<typeof ReleaseSchema>;
