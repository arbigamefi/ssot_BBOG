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

export const ReleaseSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1),
  releaseDigest: z.string().min(8),
  isPlaceholder: z.boolean().optional().default(false),
  contracts: z.object({
    hub: Address,
    vrfHub: Address,
    bankRegistry: Address,
    // Optional, but expected in FINAL SHAPE bundles.
    refRegistry: Address.optional(),
    refEngine: Address.optional(),
    adapter: Address.optional()
  }),
  assets: z.array(AssetSchema).min(1),
  games: z.record(z.string(), Address), // gameId(hex) -> module address
  // Optional UI-oriented game metadata synced from the contract release bundle.
  // This enables canonical routing (/games/[slug]) without hardcoding game IDs.
  gamesMeta: z
    .array(
      z.object({
        gameId: z.string().min(10).transform((s) => s.toLowerCase()),
        slug: z.string().min(1),
        label: z.string().min(1),
        module: Address,
        paramsEncoding: z.string().optional()
      })
    )
    .optional(),
  // Optional bundle metadata (used by indexer/journal as a sane default for start blocks).
  meta: z
    .object({
      blockNumber: z.number().int().nonnegative().optional(),
      schemaVersion: z.number().int().optional(),
      generatedAt: z.number().int().optional()
    })
    .partial()
    .optional()
});

export type SSOTRelease = z.infer<typeof ReleaseSchema>;
