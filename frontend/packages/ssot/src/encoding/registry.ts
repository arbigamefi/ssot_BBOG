import type { Hex } from "viem";
import { encodeDiceParams, decodeDiceParams } from "./dice";
import { encodeCoinTossParams, decodeCoinTossParams } from "./cointoss";
import { encodeRouletteParams, decodeRouletteParams } from "./roulette";
import { encodeKenoParams, decodeKenoParams } from "./keno";
import { encodePlinkoParams, decodePlinkoParams } from "./plinko";
import { encodeSlotsParams, decodeSlotsParams } from "./slots";
import { encodeBaccaratParams, decodeBaccaratParams } from "./baccarat";
import { encodeSicBoParams, decodeSicBoParams } from "./sicbo";

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
      encode: (p: { cap?: number; target?: number; direction?: "under" | "over" }) =>
        encodeDiceParams({ direction: p.direction ?? "over", target: p.target ?? p.cap ?? 50 }),
      decode: (hex: Hex) => decodeDiceParams(hex),
      defaultParams: { direction: "under", target: 50 },
      paramsDescription: "bool isOver, uint8 target"
    }
  ],
  [
    "coin-toss",
    {
      slug: "coin-toss",
      label: "Coin Toss",
      encode: (p: { face: boolean }) => encodeCoinTossParams(p.face),
      decode: (hex: Hex) => decodeCoinTossParams(hex),
      defaultParams: { face: true },
      paramsDescription: "bool face (true=heads)"
    }
  ],
  [
    "roulette",
    {
      slug: "roulette",
      label: "Roulette",
      encode: (p: any) => encodeRouletteParams(p),
      decode: (hex: Hex) => decodeRouletteParams(hex),
      defaultParams: { kind: "straight", number: 0 },
      paramsDescription: "uint40 mask OR (uint8 kind, uint40 payload)"
    }
  ],
  [
    "keno",
    {
      slug: "keno",
      label: "Keno",
      encode: (p: { mask: bigint }) => encodeKenoParams(p.mask),
      decode: (hex: Hex) => decodeKenoParams(hex),
      defaultParams: { mask: 0xabcden },
      paramsDescription: "uint40 mask"
    }
  ],
  [
    "plinko",
    {
      slug: "plinko",
      label: "Plinko",
      encode: (p: { risk?: "low" | "medium" | "high" | 0 | 1 | 2 }) =>
        encodePlinkoParams(p.risk ?? "medium"),
      decode: (hex: Hex) => decodePlinkoParams(hex),
      defaultParams: { risk: "medium" },
      paramsDescription: "uint8 risk (0=low, 1=medium, 2=high)"
    }
  ],
  [
    "slots",
    {
      slug: "slots",
      label: "Slots",
      encode: (p: { profile?: "classic" | 0 }) => encodeSlotsParams(p.profile ?? "classic"),
      decode: (hex: Hex) => decodeSlotsParams(hex),
      defaultParams: { profile: "classic" },
      paramsDescription: "uint8 profile (0=classic)"
    }
  ],
  [
    "baccarat",
    {
      slug: "baccarat",
      label: "Baccarat",
      encode: (p: { side?: "player" | "banker" | "tie" | 0 | 1 | 2 }) =>
        encodeBaccaratParams(p.side ?? "player"),
      decode: (hex: Hex) => decodeBaccaratParams(hex),
      defaultParams: { side: "player" },
      paramsDescription: "uint8 side (0=player, 1=banker, 2=tie)"
    }
  ],
  [
    "sic-bo",
    {
      slug: "sic-bo",
      label: "Sic Bo",
      encode: (p: {
        kind?:
          | "small"
          | "big"
          | "anyTriple"
          | "specificTriple"
          | "total"
          | "specificDouble"
          | "singleFace"
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6;
        value?: number;
      }) => encodeSicBoParams({ kind: p.kind ?? "small", value: p.value }),
      decode: (hex: Hex) => decodeSicBoParams(hex),
      defaultParams: { kind: "small", value: 0 },
      paramsDescription: "uint8 kind, uint8 value"
    }
  ]
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
