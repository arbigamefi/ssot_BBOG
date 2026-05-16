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
  bank: Address
});

const NumericString = z.string().regex(/^[0-9]+$/);

export const SportsReleaseSchema = z.object({
  enabled: z.boolean(),
  riskEngine: Address,
  sportsHub: Address,
  oddsSignerSetHash: z.string().min(8),
  resultReporterSetHash: z.string().min(8),
  resultReporterThreshold: NumericString,
  resultChallengeTimeoutSeconds: NumericString.optional(),
  resultChallenger: Address.optional(),
  resultArbitrator: Address.optional(),
  maxStake: NumericString,
  maxPayout: NumericString,
  maxMarketReserved: NumericString,
  maxOutcomeReserved: NumericString,
  maxEventReserved: NumericString
});

export const PoolSchema = z.object({
  poolId: z.number().int().positive(),
  domainId: z.number().int().nonnegative(),
  domain: z.string().min(1),
  active: z.boolean(),
  asset: Address,
  bank: Address,
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(36),
  sportsRisk: z
    .object({
      maxStake: NumericString,
      maxPayout: NumericString,
      maxMarketReserved: NumericString,
      maxOutcomeReserved: NumericString,
      maxEventReserved: NumericString,
      riskHash: z.string().min(8)
    })
    .nullable()
    .optional()
});

export const ReleaseSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1),
  releaseDigest: z.string().min(8),
  isPlaceholder: z.boolean().optional().default(false),
  contracts: z.object({
    gameHub: Address,
    settlementRouter: Address,
    poolRegistry: Address,
    sportsHub: Address,
    sportsRiskEngine: Address,
    vrfHub: Address,
    refRegistry: Address,
    refEngine: Address,
    adapter: Address
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
        paramsEncoding: z.string().optional()
      })
    )
    .min(1),
  sports: SportsReleaseSchema,
  pools: z.array(PoolSchema).min(1),
  // Optional bundle metadata (used by indexer/journal as a sane default for start blocks).
  meta: z
    .object({
      blockNumber: z.number().int().nonnegative().optional(),
      schemaVersion: z.literal(2).optional(),
      generatedAt: z.number().int().optional()
    })
    .partial()
    .optional()
});

export type SSOTRelease = z.infer<typeof ReleaseSchema>;
