import type { Hex } from "viem";
import { encodeDiceParams, decodeDiceParams } from "./dice";
import { encodeCoinTossParams, decodeCoinTossParams } from "./cointoss";
import { encodeRouletteParams, decodeRouletteParams } from "./roulette";
import { encodeKenoParams, decodeKenoParams } from "./keno";

/**
 * A registered game encoder with encode/decode functions and
 * default parameters for UI initialization.
 */
export interface GameEncoder {
  slug: string;
  label: string;
  /** Encode UI state into on-chain params hex. */
  encode: (params: any) => Hex;
  /** Decode on-chain params hex back to structured params. */
  decode: (encoded: Hex) => Record<string, unknown>;
  /** Default params for form initialization. */
  defaultParams: Record<string, unknown>;
  /** ABI parameter description (e.g. "uint8" for dice cap). */
  paramsDescription: string;
}

/**
 * Global encoder registry — maps game slug to its encoder.
 *
 * To add a new game:
 * 1. Create encode/decode functions in `packages/ssot/src/encoding/`
 * 2. Register them here with slug, label, defaults
 * 3. Add a ParamsForm component in `packages/ui`
 * 4. Add the form mapping in `pageClient.tsx` FORM_COMPONENTS
 */
const REGISTRY: ReadonlyMap<string, GameEncoder> = new Map<string, GameEncoder>([
  [
    "dice",
    {
      slug: "dice",
      label: "Dice",
      encode: (p: { cap: number }) => encodeDiceParams(p.cap),
      decode: (hex: Hex) => decodeDiceParams(hex),
      defaultParams: { cap: 50 },
      paramsDescription: "uint8 cap (0-255)",
    },
  ],
  [
    "coin-toss",
    {
      slug: "coin-toss",
      label: "Coin Toss",
      encode: (p: { face: boolean }) => encodeCoinTossParams(p.face),
      decode: (hex: Hex) => decodeCoinTossParams(hex),
      defaultParams: { face: true },
      paramsDescription: "bool face (true=heads)",
    },
  ],
  [
    "roulette",
    {
      slug: "roulette",
      label: "Roulette",
      encode: (p: { mask: bigint }) => encodeRouletteParams(p.mask),
      decode: (hex: Hex) => decodeRouletteParams(hex),
      defaultParams: { mask: 0x12345n },
      paramsDescription: "uint40 mask",
    },
  ],
  [
    "keno",
    {
      slug: "keno",
      label: "Keno",
      encode: (p: { mask: bigint }) => encodeKenoParams(p.mask),
      decode: (hex: Hex) => decodeKenoParams(hex),
      defaultParams: { mask: 0xabcden },
      paramsDescription: "uint40 mask",
    },
  ],
]);

/**
 * Look up the encoder for a given game slug.
 * Returns undefined if no encoder is registered.
 */
export function getGameEncoder(slug: string): GameEncoder | undefined {
  return REGISTRY.get(slug);
}

/**
 * Look up the encoder, throwing if not found.
 */
export function requireGameEncoder(slug: string): GameEncoder {
  const encoder = REGISTRY.get(slug);
  if (!encoder) {
    throw new Error(`No encoder registered for game slug: "${slug}"`);
  }
  return encoder;
}

/**
 * List all registered game slugs.
 */
export function registeredGameSlugs(): string[] {
  return Array.from(REGISTRY.keys());
}
